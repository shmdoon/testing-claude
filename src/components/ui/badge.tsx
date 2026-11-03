import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary",
        accent: "bg-accent/20 text-accent-foreground dark:text-accent",
        success: "bg-success/15 text-success",
        warning: "bg-warning/20 text-warning-foreground dark:text-warning",
        outline: "border-2 border-border",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
