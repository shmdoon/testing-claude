import type { MetadataRoute } from "next";
import { getPublishedCourses } from "@/lib/content/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const courses = await getPublishedCourses();
  const fixed = ["", "/courses", "/signup", "/legal/privacy", "/legal/terms", "/legal/refund"].map((p) => ({
    url: `${site}${p}`,
    changeFrequency: (p === "" || p === "/courses" ? "weekly" : "yearly") as "weekly" | "yearly",
    priority: p === "" ? 1 : p === "/courses" ? 0.8 : 0.3,
  }));
  return [...fixed, ...courses.map((c) => ({ url: `${site}/courses/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 }))];
}
