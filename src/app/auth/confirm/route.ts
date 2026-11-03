import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { postSignInPath } from "@/lib/auth/actions";

const querySchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.enum(["email", "magiclink", "signup", "recovery", "invite", "email_change"]),
  next: z.string().optional(),
});

/**
 * Magic-link target that works across devices (token_hash flow). Configure the
 * Supabase email templates to link here — see docs/SETUP.md.
 */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (parsed.success) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: parsed.data.token_hash,
      type: parsed.data.type,
    });
    if (!error && data.user) {
      return NextResponse.redirect(new URL(await postSignInPath(data.user.id, parsed.data.next), origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
