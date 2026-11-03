import type { Enums } from "@/lib/supabase/database.types";

export type AppRole = Enums<"app_role">;
export type AccountStatus = Enums<"account_status">;

export const APP_ROLES: readonly AppRole[] = ["student", "parent", "content_editor", "admin"] as const;

/** Which roles may enter each protected area. Admin may enter everything. */
export const AREA_ROLES = {
  learn: ["student", "admin"],
  parent: ["parent", "admin"],
  studio: ["content_editor", "admin"],
  admin: ["admin"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Area = keyof typeof AREA_ROLES;

export const PROTECTED_PREFIXES: Record<Area, string> = {
  learn: "/learn",
  parent: "/parent",
  studio: "/studio",
  admin: "/admin",
};

export function canAccessArea(role: AppRole, area: Area): boolean {
  return (AREA_ROLES[area] as readonly AppRole[]).includes(role);
}

/** Landing page after sign-in for each role. */
export function homeForRole(role: AppRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "content_editor":
      return "/studio";
    case "parent":
      return "/parent";
    case "student":
      return "/learn";
  }
}

/** Area a pathname belongs to, or null for public pages. */
export function areaForPath(pathname: string): Area | null {
  for (const [area, prefix] of Object.entries(PROTECTED_PREFIXES) as [Area, string][]) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return area;
  }
  return null;
}

/**
 * Only allow same-origin relative redirects (prevents open redirects via ?next=).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
