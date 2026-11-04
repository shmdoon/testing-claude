import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/learn", "/admin", "/studio", "/api/", "/auth/", "/lp/", "/consent/", "/pay/", "/signup/complete"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
