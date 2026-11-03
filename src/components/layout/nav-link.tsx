"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = { href: string; exact?: boolean; children: React.ReactNode };

const base =
  "flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

/**
 * The active-state highlight depends on the URL (runtime data), so it streams
 * in behind Suspense; the prerendered shell shows the plain link.
 */
export function NavLink(props: Props) {
  return (
    <Suspense fallback={<Link href={props.href} className={base}>{props.children}</Link>}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink({ href, exact, children }: Props) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(base, active && "bg-secondary text-secondary-foreground hover:bg-secondary")}
    >
      {children}
    </Link>
  );
}
