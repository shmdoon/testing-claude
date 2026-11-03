import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfSafe, renderInvoicePdf, type InvoiceForPdf } from "./pdf";

const inv: InvoiceForPdf = {
  number: "INV/2026-27/000001",
  kind: "invoice",
  issued_at: "2026-11-03T10:00:00Z",
  buyer_name: "Meera Rao",
  buyer_email: "meera@example.com",
  student_name: "Asha Rao",
  line_items: [{ description: "Online course: AI Explorers — ₹499 “special”", sac: "999293", quantity: 1, list_price_paise: 49900, discount_paise: 4990, amount_paise: 44910 }],
  taxable_paise: 38059,
  cgst_paise: 3425,
  sgst_paise: 3426,
  igst_paise: 0,
  total_paise: 44910,
  tax_snapshot: { mode: "cgst_sgst", rate_percent: 18, seller_name: "Test Seller", seller_address: "1 Road, Bengaluru, Karnataka 560001", seller_gstin: "29ABCDE1234F1Z5", sac_code: "999293", footer: "Computer generated." },
  provider_payment_id: "pay_123",
  is_test: true,
};

describe("invoice PDF", () => {
  it("renders a one-page A4 PDF with metadata", async () => {
    const bytes = await renderInvoicePdf(inv);
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("TAX INVOICE INV/2026-27/000001");
  });

  it("titles unregistered sellers' documents INVOICE and credit notes CREDIT NOTE", async () => {
    const plain = await PDFDocument.load(await renderInvoicePdf({ ...inv, tax_snapshot: { ...inv.tax_snapshot, seller_gstin: null, mode: "none" } }));
    expect(plain.getTitle()).toMatch(/^INVOICE /);
    const cn = await PDFDocument.load(await renderInvoicePdf({ ...inv, kind: "credit_note", original_number: "INV/2026-27/000001" }));
    expect(cn.getTitle()).toMatch(/^CREDIT NOTE /);
  });

  it("never throws on characters the standard font can't draw", async () => {
    await expect(renderInvoicePdf({ ...inv, buyer_name: "आशा 🙂 Rao" })).resolves.toBeInstanceOf(Uint8Array);
    expect(pdfSafe("₹499 – “ok”")).toBe('Rs.499 - "ok"');
  });
});
