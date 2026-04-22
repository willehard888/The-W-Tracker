import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25),0_1px_2px_hsl(0_0%_0%/0.35)] hover:bg-primary/85",
        secondary:
          "border-[hsl(var(--border-strong)/0.7)] bg-[hsl(var(--card))] text-fg-muted shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.18),0_1px_2px_hsl(0_0%_0%/0.35)] hover:bg-destructive/85",
        outline:
          "text-foreground border-[hsl(var(--border-strong)/0.7)] bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
