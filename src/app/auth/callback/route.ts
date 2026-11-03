import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postSignInPath } from "@/lib/auth/actions";

/** OAuth (Google) and PKCE magic-link redirect target: exchanges ?code= for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      return NextResponse.redirect(new URL(await postSignInPath(data.user.id, next), origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
