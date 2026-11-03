import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import { areaForPath } from "@/lib/auth/roles";
import { campaigns } from "@/content/marketing";
import { ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE, attributionFromUrl, encodeAttribution } from "@/lib/marketing/attribution";
import type { Database } from "./database.types";

/**
 * Refreshes the Supabase session cookie on every matched request and sends
 * signed-out visitors of protected areas to /login. Role checks happen in
 * each area's layout via the DAL (they need a DB read).
 */
export async function updateSession(request: NextRequest) {
  // Unknown ad-campaign slugs → a real 404 status (pages stream, so the page itself can't change it).
  const lp = request.nextUrl.pathname.match(/^\/lp\/([^/]+)\/?$/);
  if (lp && !Object.hasOwn(campaigns, decodeURIComponent(lp[1]!))) {
    return NextResponse.rewrite(new URL("/_campaign-not-found", request.url));
  }

  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    },
  );

  // Do not put code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (!signedIn && areaForPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  // First-touch campaign attribution (only set once; httpOnly, first-party).
  if (request.method === "GET" && !request.cookies.has(ATTRIBUTION_COOKIE)) {
    const attr = attributionFromUrl(request.nextUrl, request.headers.get("referer"));
    if (attr) {
      response.cookies.set(ATTRIBUTION_COOKIE, encodeAttribution(attr), {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        maxAge: ATTRIBUTION_MAX_AGE,
        path: "/",
      });
    }
  }

  return response;
}
