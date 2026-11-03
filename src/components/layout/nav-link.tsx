"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-secondary text-secondary-foreground hover:bg-secondary",
      )}
    >
      {children}
    </Link>
  );
}
