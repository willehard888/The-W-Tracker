import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap",
    "rounded-md text-sm font-semibold",
    "ring-offset-background",
    "transition-[transform,box-shadow,background,opacity,filter,color] duration-200 [transition-timing-function:var(--ease-spring)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "focus-visible:shadow-[0_0_0_4px_hsl(var(--ring)/0.18)]",
    "disabled:pointer-events-none disabled:opacity-50 disabled:saturate-[0.6]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:scale-[0.985] will-change-transform",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary dark — obsidian metal
        default: [
          "text-primary-foreground",
          "[background:linear-gradient(180deg,hsl(258_16%_14%)_0%,hsl(258_18%_8%)_100%)]",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),inset_0_-1px_0_hsl(0_0%_0%/0.4),0_1px_1px_hsl(0_0%_0%/0.35),0_6px_14px_-4px_hsl(0_0%_0%/0.45)]",
          "hover:[background:linear-gradient(180deg,hsl(258_16%_16%)_0%,hsl(258_18%_10%)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.14),inset_0_-1px_0_hsl(0_0%_0%/0.45),0_2px_2px_hsl(0_0%_0%/0.4),0_10px_22px_-6px_hsl(0_0%_0%/0.55)]",
          "active:[background:linear-gradient(0deg,hsl(258_16%_14%)_0%,hsl(258_18%_8%)_100%)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.55),0_1px_1px_hsl(0_0%_0%/0.3)]",
        ].join(" "),

        // Destructive — red metal, same recipe as default
        destructive: [
          "text-destructive-foreground",
          "[background:linear-gradient(180deg,hsl(0_70%_32%)_0%,hsl(0_75%_22%)_100%)]",
          "shadow-[inset_0_1px_0_hsl(0_90%_75%/0.3),inset_0_-1px_0_hsl(0_60%_10%/0.55),0_1px_1px_hsl(0_60%_10%/0.5),0_6px_14px_-4px_hsl(0_70%_30%/0.45)]",
          "hover:[background:linear-gradient(180deg,hsl(0_72%_36%)_0%,hsl(0_78%_25%)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(0_90%_75%/0.35),inset_0_-1px_0_hsl(0_60%_10%/0.6),0_2px_2px_hsl(0_60%_10%/0.55),0_10px_22px_-6px_hsl(0_70%_32%/0.55)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_60%_10%/0.6),0_1px_1px_hsl(0_0%_0%/0.3)]",
        ].join(" "),

        // Outline — surface-panel base + hairline
        outline: [
          "text-foreground",
          "[background:linear-gradient(180deg,hsl(258_16%_8%)_0%,hsl(258_16%_6%)_100%)]",
          "border border-border/70",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04),0_1px_2px_hsl(0_0%_0%/0.25)]",
          "hover:border-[hsl(var(--border-strong))] hover:text-foreground",
          "hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.07),0_2px_4px_hsl(0_0%_0%/0.3)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.4)]",
        ].join(" "),

        // Secondary — quiet panel, subtle lift
        secondary: [
          "text-secondary-foreground",
          "[background:linear-gradient(180deg,hsl(258_16%_10%)_0%,hsl(258_16%_7%)_100%)]",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05),0_1px_2px_hsl(0_0%_0%/0.28)]",
          "hover:[background:linear-gradient(180deg,hsl(258_16%_12%)_0%,hsl(258_16%_9%)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.07),0_3px_8px_-2px_hsl(0_0%_0%/0.35)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.45)]",
        ].join(" "),

        // Ghost — transparent, hairline on hover
        ghost: [
          "text-foreground",
          "hover:bg-[hsl(0_0%_100%/0.04)]",
          "hover:shadow-[inset_0_-1px_0_hsl(var(--border-strong)/0.7)]",
          "active:bg-[hsl(0_0%_100%/0.06)]",
        ].join(" "),

        // Link — gold-soft → gold
        link: "text-[hsl(var(--gold-soft))] underline-offset-4 hover:text-[hsl(var(--gold))] hover:underline",

        // Gold — hero CTA, three-stop metallic
        gold: [
          "text-primary-foreground font-bold tracking-[-0.005em]",
          "[background:linear-gradient(180deg,hsl(42_95%_72%)_0%,hsl(42_85%_56%)_45%,hsl(42_65%_38%)_100%)]",
          "shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.55),inset_0_-1px_0_hsl(42_50%_18%/0.5),0_1px_1px_hsl(42_60%_18%/0.4),0_8px_20px_-6px_hsl(42_78%_50%/0.45)]",
          "hover:brightness-[1.04]",
          "hover:shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.65),inset_0_-1px_0_hsl(42_50%_18%/0.5),0_2px_2px_hsl(42_60%_18%/0.45),0_12px_28px_-8px_hsl(42_78%_50%/0.55)]",
          "active:[background:linear-gradient(180deg,hsl(42_88%_64%)_0%,hsl(42_78%_48%)_45%,hsl(42_60%_32%)_100%)]",
          "active:shadow-[inset_0_0_0_0.5px_hsl(0_0%_100%/0.35),inset_0_2px_4px_hsl(42_50%_18%/0.55),0_1px_1px_hsl(0_0%_0%/0.25)]",
        ].join(" "),

        // Gold outline — hairline gold-soft, fills on hover
        "gold-outline": [
          "text-[hsl(var(--gold))] font-semibold",
          "border border-[hsl(var(--gold-soft)/0.5)]",
          "bg-[hsl(var(--gold)/0.04)]",
          "shadow-[inset_0_1px_0_hsl(var(--gold)/0.08)]",
          "hover:bg-[hsl(var(--gold)/0.12)] hover:border-[hsl(var(--gold)/0.7)]",
          "hover:shadow-[inset_0_1px_0_hsl(var(--gold)/0.18),0_4px_12px_-4px_hsl(var(--gold)/0.25)]",
          "active:bg-[hsl(var(--gold)/0.08)]",
        ].join(" "),

        // Glass — surface-glass + light rake
        glass: [
          "text-foreground",
          "backdrop-blur-xl",
          "[background:linear-gradient(180deg,hsl(0_0%_100%/0.06)_0%,hsl(0_0%_100%/0.02)_100%)]",
          "border border-white/10",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.1),0_2px_8px_-2px_hsl(0_0%_0%/0.4),0_8px_24px_-8px_hsl(0_0%_0%/0.5)]",
          "hover:[background:linear-gradient(180deg,hsl(0_0%_100%/0.09)_0%,hsl(0_0%_100%/0.03)_100%)]",
          "hover:border-white/15",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.4)]",
        ].join(" "),

        // Tier — uses --tier-color CSS var; falls back to gold
        tier: [
          "text-primary-foreground font-bold tracking-[-0.005em]",
          "[--tier-color:var(--gold)]",
          "[background:linear-gradient(180deg,hsl(var(--tier-color)/0.95)_0%,hsl(var(--tier-color)/0.75)_45%,hsl(var(--tier-color)/0.55)_100%)]",
          "shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.5),inset_0_-1px_0_hsl(0_0%_0%/0.45),0_1px_1px_hsl(0_0%_0%/0.4),0_8px_20px_-6px_hsl(var(--tier-color)/0.45)]",
          "hover:brightness-[1.06]",
          "hover:shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.6),inset_0_-1px_0_hsl(0_0%_0%/0.45),0_2px_2px_hsl(0_0%_0%/0.45),0_12px_28px_-8px_hsl(var(--tier-color)/0.55)]",
          "active:shadow-[inset_0_2px_4px_hsl(0_0%_0%/0.55),0_1px_1px_hsl(0_0%_0%/0.25)]",
        ].join(" "),
      },
      size: {
        default: "h-10 min-h-10 px-4 py-2 rounded-md",
        sm: "h-9 min-h-9 px-3 rounded-md text-xs",
        lg: "h-12 min-h-12 px-8 rounded-lg text-base",
        xl: "h-14 min-h-14 px-10 rounded-lg text-lg tracking-[-0.01em]",
        icon: "h-10 w-10 min-h-10 rounded-md",
        "icon-sm": "h-8 w-8 min-h-8 rounded-md [&_svg]:size-3.5",
        "icon-lg": "h-12 w-12 min-h-12 rounded-md [&_svg]:size-5",
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
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      onClick,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (loading) return;
        hapticImpact("light");
        onClick?.(e);
      },
      [onClick, loading],
    );

    // When asChild, Slot requires a single child — preserve children as-is.
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          onClick={handleClick}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin" />
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center justify-center gap-2.5",
            loading && "opacity-0",
          )}
        >
          {children}
        </span>
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
