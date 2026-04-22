import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-[transform,box-shadow,background,opacity] duration-[220ms] [transition-timing-function:var(--ease-spring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.985]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        gold:
          "text-primary-foreground font-bold tracking-wide " +
          "[background:linear-gradient(180deg,hsl(42_88%_62%)_0%,hsl(42_78%_54%)_50%,hsl(42_64%_42%)_100%)] " +
          "shadow-[inset_0_1px_0_hsl(42_95%_82%/0.55),inset_0_-1px_0_hsl(42_50%_22%/0.5),0_2px_2px_hsl(42_70%_30%/0.25),0_8px_18px_-6px_hsl(42_78%_54%/0.45)] " +
          "hover:brightness-[1.04] " +
          "active:shadow-[inset_0_2px_3px_hsl(42_50%_22%/0.45),inset_0_-1px_0_hsl(42_95%_82%/0.25),0_1px_1px_hsl(0_0%_0%/0.2)]",
        "gold-outline": "border border-gold/40 text-gold hover:bg-gold/10 hover:border-gold/60",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-lg px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const handleClick = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      hapticImpact("light");
      onClick?.(e);
    }, [onClick]);
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} onClick={handleClick} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
