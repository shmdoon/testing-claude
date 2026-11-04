import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env.server";
import { sendEmail, emailLayout } from "@/lib/email/send";
import { renderInvoicePdf, type InvoiceForPdf } from "@/lib/invoices/pdf";
import { writeAudit } from "@/lib/audit";
import { couponDiscount, formatPaise } from "./money";
import { getProvider, mockGateway, mockPaymentId, type PaymentProvider } from "./provider";
import { hashToken, newToken, signLink, siteUrl } from "@/lib/links";
import { sendWhatsApp } from "@/lib/whatsapp/send";

type Admin = ReturnType<typeof createAdminClient>;
export class PaymentError extends Error {}

const INVOICES_BUCKET = () => getServerEnv().SUPABASE_INVOICES_BUCKET;

// ---------------------------------------------------------------------------
// Pricing (server-side only — the browser never sends an amount)
// ---------------------------------------------------------------------------
export type Quote = { listPaise: number; discountPaise: number; totalPaise: number; couponId: string | null; couponCode: string | null };

export async function quote(admin: Admin, courseId: string, buyerId: string, couponCode?: string | null): Promise<Quote> {
  const { data: course } = await admin.from("courses").select("id, is_free, price_paise, status").eq("id", courseId).maybeSingle();
  if (!course || course.status !== "published") throw new PaymentError("This course isn't available.");
  if (course.is_free) throw new PaymentError("This course is free — no purchase needed.");

  let coupon: { id: string; code: string; kind: "percent" | "flat"; value: number } | null = null;
  const code = couponCode?.trim().toUpperCase();
  if (code) {
    const { data: c } = await admin.from("coupons").select("*").eq("code", code).maybeSingle();
    const now = Date.now();
    if (
      !c ||
      !c.active ||
      (c.expires_at && new Date(c.expires_at).getTime() < now) ||
      (c.usage_limit !== null && c.used_count >= c.usage_limit) ||
      (c.course_id && c.course_id !== courseId)
    ) {
      throw new PaymentError("That coupon code isn't valid.");
    }
    const { count } = await admin.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", c.id).eq("user_id", buyerId);
    if (count) throw new PaymentError("You've already used this coupon.");
    coupon = c;
  }
  const discountPaise = couponDiscount(course.price_paise, coupon);
  return { listPaise: course.price_paise, discountPaise, totalPaise: course.price_paise - discountPaise, couponId: coupon?.id ?? null, couponCode: coupon?.code ?? null };
}

// ---------------------------------------------------------------------------
// Order creation
// ---------------------------------------------------------------------------
export type CheckoutStart =
  | { kind: "gateway"; mode: "razorpay" | "mock"; keyId: string; orderId: string; providerOrderId: string; amount: number; courseTitle: string; email: string; phone: string; name: string }
  | { kind: "free"; orderId: string };

export type Payer = { name: string; email?: string; phone?: string };

/**
 * One account per child: the child's account is the buyer; the person paying
 * (parent/guardian, 18+) is recorded for the invoice. `paymentRequestId` is set
 * when paying through a WhatsApp payment link (no login).
 */
export async function startCheckout(input: { studentId: string; courseId: string; couponCode?: string | null; payer: Payer; paymentRequestId?: string }): Promise<CheckoutStart> {
  const admin = createAdminClient();
  const provider = getProvider();
  if (!provider) throw new PaymentError("Payments aren't set up yet.");

  const { data: student } = await admin.from("profiles").select("id, role, account_status, parent_phone, parent_email").eq("id", input.studentId).single();
  if (!student || student.role !== "student") throw new PaymentError("Courses are bought for a student account.");
  if (student.account_status !== "active") throw new PaymentError("A parent needs to approve this account first (check WhatsApp).");

  const { data: enrolled } = await admin.from("enrollments").select("id").eq("user_id", student.id).eq("course_id", input.courseId).eq("status", "active").maybeSingle();
  if (enrolled) throw new PaymentError("Already enrolled in this course.");

  const q = await quote(admin, input.courseId, student.id, input.couponCode);
  const { data: course } = await admin.from("courses").select("title").eq("id", input.courseId).single();
  const payerEmail = input.payer.email || student.parent_email || undefined;
  const payerPhone = input.payer.phone || student.parent_phone || undefined;

  const free = q.totalPaise === 0;
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      buyer_id: student.id,
      student_id: student.id,
      course_id: input.courseId,
      list_price_paise: q.listPaise,
      discount_paise: q.discountPaise,
      total_paise: q.totalPaise,
      coupon_id: q.couponId,
      provider: free ? "free" : provider.mode,
      payer_name: input.payer.name,
      payer_email: payerEmail ?? null,
      payer_phone: payerPhone ?? null,
      payment_request_id: input.paymentRequestId ?? null,
    })
    .select("id")
    .single();
  if (error || !order) throw new PaymentError("Couldn't start checkout. Please try again.");

  if (free) {
    const { data: invoiceId, error: fe } = await admin.rpc("fulfill_order", { p_order_id: order.id, p_provider_payment_id: null as unknown as string, p_amount_paise: 0, p_method: "coupon" });
    if (fe) throw new PaymentError("Couldn't complete the order.");
    if (invoiceId) await deliverInvoice(invoiceId as string, { notify: true });
    return { kind: "free", orderId: order.id };
  }

  const gwOrder = await provider.createOrder({ amount: q.totalPaise, receipt: order.id, notes: { order_id: order.id, course_id: input.courseId } });
  await admin.from("orders").update({ provider_order_id: gwOrder.id }).eq("id", order.id);
  return {
    kind: "gateway",
    mode: provider.mode,
    keyId: provider.keyId,
    orderId: order.id,
    providerOrderId: gwOrder.id,
    amount: q.totalPaise,
    courseTitle: course?.title ?? "Course",
    email: payerEmail ?? "",
    phone: payerPhone ?? "",
    name: input.payer.name,
  };
}

/** Who may act on an order: the signed-in child account, or the holder of the WhatsApp payment link. */
export type OrderAuth = { userId: string } | { paymentRequestId: string };

function ownsOrder(order: { buyer_id: string; payment_request_id: string | null }, auth: OrderAuth) {
  return "userId" in auth ? order.buyer_id === auth.userId : order.payment_request_id === auth.paymentRequestId;
}

// ---------------------------------------------------------------------------
// WhatsApp payment links ("ask my parent to pay")
// ---------------------------------------------------------------------------
const PAY_LINK_DAYS = 7;

export async function createPaymentLink(studentId: string, courseId: string): Promise<{ status: "sent" | "manual" | "failed" }> {
  const admin = createAdminClient();
  const { data: student } = await admin.from("profiles").select("full_name, parent_phone, account_status").eq("id", studentId).single();
  if (!student?.parent_phone) throw new PaymentError("We don't have a WhatsApp number for your parent.");
  if (student.account_status !== "active") throw new PaymentError("Your parent needs to approve your account first.");
  const q = await quote(admin, courseId, studentId, null);
  const { data: course } = await admin.from("courses").select("title").eq("id", courseId).single();
  const token = newToken();
  const { data: req, error } = await admin
    .from("payment_requests")
    .insert({ student_id: studentId, course_id: courseId, token_hash: await hashToken(token), expires_at: new Date(Date.now() + PAY_LINK_DAYS * 864e5).toISOString() })
    .select("id")
    .single();
  if (error || !req) throw new PaymentError("Couldn't create the payment link.");
  const r = await sendWhatsApp({
    to: student.parent_phone,
    template: "payment_link",
    params: [(student.full_name ?? "Your child").split(" ")[0]!, course?.title ?? "a course", `INR ${formatPaise(q.totalPaise)}`, siteUrl(`/pay/${token}`)],
    studentId,
    related: { type: "payment_request", id: req.id },
  });
  return { status: r.status };
}

export async function getPaymentRequest(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const { data } = await createAdminClient()
    .from("payment_requests")
    .select("id, status, expires_at, student_id, course_id, profiles!payment_requests_student_id_fkey(full_name, parent_name, parent_email, parent_phone), courses(title, slug, price_paise, is_free)")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (!data) return null;
  return { ...data, expired: new Date(data.expires_at) < new Date() };
}

// ---------------------------------------------------------------------------
// Checkout success → verify signature → fulfil (idempotent with the webhook)
// ---------------------------------------------------------------------------
export const verifySchema = z.object({
  order_id: z.uuid(),
  pay_token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/).optional(),
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(512),
  razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/),
});

export async function verifyAndFulfil(auth: OrderAuth, input: z.infer<typeof verifySchema>): Promise<{ status: "paid" | "pending" }> {
  const admin = createAdminClient();
  const provider = getProvider();
  if (!provider) throw new PaymentError("Payments aren't set up.");
  const { data: order } = await admin.from("orders").select("*").eq("id", input.order_id).maybeSingle();
  if (!order || !ownsOrder(order, auth) || order.provider_order_id !== input.razorpay_order_id) throw new PaymentError("Order not found.");
  if (order.status === "paid") return { status: "paid" };
  if (!(await provider.verifyCheckout(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature))) {
    throw new PaymentError("Payment could not be verified.");
  }
  // Signature proves authorisation; fulfil only once the gateway reports it captured.
  const payment = await provider.fetchPayment(input.razorpay_payment_id);
  if (payment.order_id !== order.provider_order_id) throw new PaymentError("Payment doesn't match the order.");
  if (payment.status !== "captured") return { status: "pending" }; // the webhook will finish it
  await fulfil(admin, order.id, payment.id, payment.amount, payment.method ?? null);
  return { status: "paid" };
}

async function fulfil(admin: Admin, orderId: string, paymentId: string, amount: number, method: string | null) {
  const { data: invoiceId, error } = await admin.rpc("fulfill_order", {
    p_order_id: orderId,
    p_provider_payment_id: paymentId,
    p_amount_paise: amount,
    p_method: method ?? "unknown",
  });
  if (error) throw new PaymentError(`Fulfilment failed: ${error.message}`);
  if (invoiceId) {
    const { data: inv } = await admin.from("invoices").select("emailed_at").eq("id", invoiceId as string).single();
    if (!inv?.emailed_at) await deliverInvoice(invoiceId as string, { notify: true });
  }
}

// ---------------------------------------------------------------------------
// Webhook (source of truth)
// ---------------------------------------------------------------------------
type RzpEvent = {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; amount: number; method?: string; status: string; error_code?: string; error_description?: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number; notes?: Record<string, string> } };
  };
};

export async function handleWebhook(raw: string, signature: string | null, eventId: string | null): Promise<{ status: number; result: string }> {
  const provider = getProvider();
  if (!provider) return { status: 503, result: "payments disabled" };
  if (!(await provider.verifyWebhook(raw, signature))) return { status: 400, result: "bad signature" };

  let event: RzpEvent;
  try {
    event = JSON.parse(raw) as RzpEvent;
  } catch {
    return { status: 400, result: "bad json" };
  }
  const admin = createAdminClient();
  const id = eventId ?? `${event.event}:${event.payload.payment?.entity.id ?? event.payload.refund?.entity.id ?? "unknown"}`;

  // Idempotency: each gateway event is processed once.
  const { error: dupe } = await admin.from("webhook_events").insert({ provider: provider.mode, event_id: id, event_type: event.event });
  if (dupe) {
    if (dupe.code === "23505") return { status: 200, result: "duplicate" };
    throw dupe;
  }

  try {
    let result = "ignored";
    if (event.event === "payment.captured" && event.payload.payment) {
      const p = event.payload.payment.entity;
      const { data: order } = await admin.from("orders").select("id").eq("provider_order_id", p.order_id).maybeSingle();
      if (order) {
        await fulfil(admin, order.id, p.id, p.amount, p.method ?? null);
        result = "processed";
      }
    } else if (event.event === "payment.failed" && event.payload.payment) {
      const p = event.payload.payment.entity;
      const { data: order } = await admin.from("orders").select("id").eq("provider_order_id", p.order_id).maybeSingle();
      if (order) {
        await admin.rpc("mark_payment_failed", {
          p_order_id: order.id,
          p_provider_payment_id: p.id,
          p_amount_paise: p.amount,
          p_code: p.error_code ?? "failed",
          p_description: p.error_description ?? "",
        });
        result = "processed";
      }
    } else if (event.event === "refund.processed" && event.payload.refund) {
      const r = event.payload.refund.entity;
      // Exact lookups only (no filter strings built from payload values).
      let { data: refund } = await admin.from("refunds").select("id").eq("provider_refund_id", r.id).maybeSingle();
      const noted = r.notes?.refund_id;
      if (!refund && noted && z.uuid().safeParse(noted).success) {
        ({ data: refund } = await admin.from("refunds").select("id").eq("id", noted).maybeSingle());
      }
      if (refund) {
        await completeRefund(admin, refund.id, r.id);
        result = "processed";
      }
    }
    await admin.from("webhook_events").update({ status: result, processed_at: new Date().toISOString() }).eq("provider", provider.mode).eq("event_id", id);
    return { status: 200, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Allow the gateway's retry to try again.
    await admin.from("webhook_events").delete().eq("provider", provider.mode).eq("event_id", id);
    console.error("webhook failed", event.event, msg);
    return { status: 500, result: "error" };
  }
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------
export async function requestRefund(input: { orderId: string; adminId: string; reason: string }): Promise<{ status: "pending" | "processed" }> {
  const admin = createAdminClient();
  const provider = getProvider();
  if (!provider) throw new PaymentError("Payments aren't set up.");
  const { data: order } = await admin.from("orders").select("*").eq("id", input.orderId).maybeSingle();
  if (!order || order.status !== "paid") throw new PaymentError("Only paid orders can be refunded.");
  if (order.provider === "free") throw new PaymentError("Nothing was charged for this order.");
  const { data: payment } = await admin.from("payments").select("*").eq("order_id", order.id).eq("status", "captured").maybeSingle();
  if (!payment) throw new PaymentError("No captured payment for this order.");

  const { data: refund, error } = await admin
    .from("refunds")
    .insert({ order_id: order.id, payment_id: payment.id, amount_paise: payment.amount_paise, reason: input.reason.slice(0, 500), requested_by: input.adminId })
    .select("id")
    .single();
  if (error) throw new PaymentError(error.code === "23505" ? "A refund is already in progress." : "Couldn't record the refund.");

  await writeAudit({ actorId: input.adminId, action: "refund.requested", targetType: "order", targetId: order.id, metadata: { amount_paise: payment.amount_paise, reason: input.reason.slice(0, 200) } });

  let gw: { id: string; status: string };
  try {
    gw = await provider.refund(payment.provider_payment_id, payment.amount_paise, { refund_id: refund.id, order_id: order.id });
  } catch (e) {
    await admin.from("refunds").update({ status: "failed" }).eq("id", refund.id);
    throw new PaymentError(`The gateway refused the refund: ${e instanceof Error ? e.message : "error"}`);
  }
  await admin.from("refunds").update({ provider_refund_id: gw.id }).eq("id", refund.id);

  if (provider.mode === "mock") {
    // Play the gateway: send the signed refund.processed webhook.
    await simulateWebhook("refund.processed", { refund: { entity: { id: gw.id, payment_id: payment.provider_payment_id, amount: payment.amount_paise, notes: { refund_id: refund.id } } } });
    return { status: "processed" };
  }
  return { status: "pending" };
}

async function completeRefund(admin: Admin, refundId: string, providerRefundId: string) {
  const { data: cnId, error } = await admin.rpc("process_refund", { p_refund_id: refundId, p_provider_refund_id: providerRefundId });
  if (error) throw error;
  if (cnId) {
    const { data: cn } = await admin.from("invoices").select("emailed_at").eq("id", cnId as string).single();
    if (!cn?.emailed_at) await deliverInvoice(cnId as string, { notify: true });
  }
}

// ---------------------------------------------------------------------------
// Invoice documents: PDF → private bucket → email
// ---------------------------------------------------------------------------
/** PDF → private bucket → WhatsApp (signed download link) + email if we have one. */
export async function deliverInvoice(invoiceId: string, opts: { notify: boolean }): Promise<{ path: string; emailed: boolean; whatsapp: string | null }> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invoices").select("*, original:original_invoice_id(number), orders(student_id, course_id, courses(title))").eq("id", invoiceId).single();
  if (!inv) throw new PaymentError("Invoice not found.");
  const pdf = await renderInvoicePdf({
    ...(inv as unknown as InvoiceForPdf),
    original_number: (inv as { original?: { number: string } | null }).original?.number ?? null,
  });
  const path = `${inv.buyer_id}/${inv.number.replaceAll("/", "-")}.pdf`;
  const { error } = await admin.storage.from(INVOICES_BUCKET()).upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw new PaymentError(`Couldn't store the PDF: ${error.message}`);
  await admin.from("invoices").update({ pdf_path: path }).eq("id", inv.id);

  let emailed = false;
  let whatsapp: string | null = null;
  if (opts.notify) {
    const credit = inv.kind === "credit_note";
    const order = (inv as { orders?: { student_id: string; courses?: { title: string } | null } | null }).orders;
    const course = order?.courses?.title ?? "the course";
    const child = (inv.student_name ?? "your child").split(" ")[0]!;
    const link = siteUrl(`/api/invoices/link/${await signLink("invoice", inv.id, 60 * 60 * 24 * 30)}`);

    if (inv.buyer_phone) {
      const r = await sendWhatsApp(
        credit
          ? { to: inv.buyer_phone, template: "refund_processed", params: [child, course, `INR ${formatPaise(inv.total_paise)}`, link], studentId: order?.student_id, related: { type: "invoice", id: inv.id } }
          : { to: inv.buyer_phone, template: "invoice_ready", params: [child, course, `INR ${formatPaise(inv.total_paise)}`, inv.number, link], studentId: order?.student_id, related: { type: "invoice", id: inv.id } },
      );
      whatsapp = r.status;
    }
    if (inv.buyer_email) {
      const { html, text } = emailLayout(
        credit ? "Your refund is complete" : "Payment received — thank you!",
        credit
          ? [`We've refunded INR ${formatPaise(inv.total_paise)} for ${course}.`, `Credit note ${inv.number} is attached. Refunds usually reach your account in 5–7 working days.`]
          : [`We've received INR ${formatPaise(inv.total_paise)} for ${course} for ${child}.`, `Invoice ${inv.number} is attached. The course is unlocked now.`],
      );
      const r = await sendEmail({
        to: inv.buyer_email,
        subject: credit ? `Refund processed — ${inv.number}` : `Your invoice ${inv.number}`,
        html,
        text,
        template: credit ? "credit_note" : "invoice",
        related: { type: "invoice", id: inv.id },
        attachments: [{ filename: `${inv.number.replaceAll("/", "-")}.pdf`, content: pdf }],
      });
      emailed = r.status !== "failed";
    }
    if (emailed || whatsapp) await admin.from("invoices").update({ emailed_at: new Date().toISOString() }).eq("id", inv.id);
  }
  return { path, emailed, whatsapp };
}

export async function invoiceSignedUrl(invoiceId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invoices").select("pdf_path").eq("id", invoiceId).single();
  const path = inv?.pdf_path ?? (await deliverInvoice(invoiceId, { notify: false })).path;
  const { data, error } = await admin.storage.from(INVOICES_BUCKET()).createSignedUrl(path, 60, { download: true });
  if (error || !data) throw new PaymentError("Couldn't create a download link.");
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Mock gateway (development/tests only)
// ---------------------------------------------------------------------------
export async function simulateWebhook(event: string, payload: RzpEvent["payload"]) {
  const raw = JSON.stringify({ entity: "event", event, payload, created_at: Math.floor(Date.now() / 1000) });
  return handleWebhook(raw, await mockGateway.webhookSignature(raw), `evt_mock_${crypto.randomUUID()}`);
}

/** What Razorpay Checkout + its webhook would do for a mock order. */
export async function mockPay(auth: OrderAuth, orderId: string, outcome: "success" | "failure") {
  const provider = getProvider() as PaymentProvider | null;
  if (provider?.mode !== "mock") throw new PaymentError("Mock payments are disabled.");
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || !ownsOrder(order, auth) || !order.provider_order_id) throw new PaymentError("Order not found.");
  const status = outcome === "success" ? "captured" : "failed";
  const paymentId = mockPaymentId(order.provider_order_id, order.total_paise, status);
  const entity = {
    id: paymentId,
    order_id: order.provider_order_id,
    amount: order.total_paise,
    method: "mock",
    status,
    ...(status === "failed" ? { error_code: "BAD_REQUEST_ERROR", error_description: "Payment declined (simulated)" } : {}),
  };
  await simulateWebhook(status === "captured" ? "payment.captured" : "payment.failed", { payment: { entity } });
  if (status === "failed") return { ok: false as const };
  return {
    ok: true as const,
    razorpay_order_id: order.provider_order_id,
    razorpay_payment_id: paymentId,
    razorpay_signature: await mockGateway.checkoutSignature(order.provider_order_id, paymentId),
  };
}
