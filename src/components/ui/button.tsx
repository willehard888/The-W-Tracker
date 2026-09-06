import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";

// ─────────────────────────────────────────────────────────────────────
// PRIMARY EMBER — the single, clean orange-amber CTA look used across the
// whole app (the "Start Your Journey" style). One vertical gradient
// (light amber crown → saturated orange foot), crisp dark text, a soft
// engraved bezel + warm outer glow. GPU-friendly: no texture images, no
// per-frame animation — just a gradient + box-shadow. Shared by every
// filled primary variant so all CTAs match.
// ─────────────────────────────────────────────────────────────────────
const PRIMARY_EMBER = [
  "text-[hsl(26_85%_10%)] font-extrabold tracking-[-0.005em]",
  "[text-shadow:0_1px_0_hsl(45_100%_88%/0.4)]",
  "overflow-hidden isolate",
  // MOLTEN METAL: champagne crown → rich amber → deep ember foot. The old
  // bright flat orange read as bubblegum; expensive = deeper, less saturated,
  // with a machined hairline rim and tight dark depth instead of neon bloom.
  "[background:linear-gradient(180deg,hsl(44_92%_68%)_0%,hsl(36_90%_58%)_34%,hsl(27_88%_49%)_68%,hsl(19_82%_40%)_100%)]",
  // Machined bezel: 1px light rim, crisp top edge, engraved foot, tight dark
  // drop shadow (depth) + restrained warm halo (not a glow bomb)
  "shadow-[0_0_0_1px_hsl(40_80%_70%/0.35),inset_0_1px_0_hsl(48_100%_92%/0.7),inset_0_-2px_6px_hsl(16_80%_24%/0.5),0_2px_6px_hsl(20_60%_8%/0.5),0_12px_28px_-12px_hsl(20_70%_10%/0.8),0_6px_18px_-8px_hsl(28_90%_45%/0.35)]",
  // ::before — metallic sheen band on the crown + faint molten heat at the foot
  "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
  "before:[background:linear-gradient(180deg,hsl(50_100%_96%/0.32)_0%,hsl(48_100%_90%/0.08)_28%,transparent_45%),radial-gradient(120%_60%_at_50%_125%,hsl(16_95%_45%/0.28)_0%,transparent_60%)]",
  // ::after — slow glass glint sweep on hover (the luxury tell)
  "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
  "after:[background:linear-gradient(110deg,transparent_30%,hsl(50_100%_95%/0.45)_50%,transparent_70%)]",
  "after:opacity-0 after:transition-[transform,opacity] after:duration-[900ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
  "hover:after:opacity-100 hover:after:[transform:translate3d(260%,0,0)]",
  "hover:brightness-[1.04]",
  "hover:shadow-[0_0_0_1px_hsl(42_85%_74%/0.5),inset_0_1px_0_hsl(48_100%_92%/0.8),inset_0_-2px_6px_hsl(16_80%_24%/0.55),0_3px_8px_hsl(20_60%_8%/0.55),0_16px_36px_-12px_hsl(20_70%_10%/0.85),0_10px_24px_-8px_hsl(30_90%_48%/0.45)]",
  // Pressed: sunken, rim dims
  "active:brightness-[0.96]",
  "active:before:opacity-60",
  "active:shadow-[0_0_0_1px_hsl(40_80%_70%/0.28),inset_0_2px_5px_hsl(18_75%_14%/0.55),inset_0_-1px_0_hsl(46_100%_86%/0.15),0_1px_2px_hsl(0_0%_0%/0.3)]",
  "disabled:grayscale-[0.3] disabled:before:hidden disabled:after:hidden",
].join(" ");

// Variants whose ::before is free (no surface sheen) — these get the invisible
// hit-area expansion for icon-sm / xs / icon via compoundVariants below.
const HIT_AREA_VARIANTS = [
  "obsidian", "destructive", "outline", "secondary", "ghost", "link",
  "gold-outline", "glass", "tier", "success", "warning", "danger-outline", "gold-icon",
] as const;

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap",
    "rounded-md text-sm font-semibold select-none",
    "ring-offset-background",
    // Lighter transition: only transform + box-shadow + filter — avoids triggering repaints on color/background.
    "transition-[transform,box-shadow,filter] duration-200 [transition-timing-function:var(--ease-spring)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "focus-visible:shadow-[0_0_0_4px_hsl(var(--ring)/0.18)]",
    "disabled:pointer-events-none disabled:opacity-50 disabled:saturate-[0.6] disabled:cursor-not-allowed",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    // Inner content (text + icons) lifts ABOVE the gloss/glint overlays so it stays crisp,
    // and settles down 0.5px on press for tactile feel
    "[&>*]:relative [&>*]:z-[3]",
    "[&>span]:transition-transform [&>span]:duration-150 [&:active>span]:translate-y-[0.5px]",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary — the clean orange-amber CTA (shared PRIMARY_EMBER look).
        default: PRIMARY_EMBER,

        // Obsidian — flat dark surface.
        obsidian: "bg-[hsl(258_16%_13%)] text-primary-foreground border border-border/60 hover:bg-[hsl(258_16%_16%)]",

        // Destructive — flat solid red.
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",

        // Outline — clean hairline, transparent (flat).
        outline: "border border-border bg-transparent text-foreground hover:bg-secondary/40 hover:border-[hsl(var(--border-strong))]",

        // Secondary — flat translucent surface (Whoop/Apple-style, no glass/glint).
        secondary: "bg-secondary text-secondary-foreground border border-border/60 hover:bg-secondary/80",

        // Ghost — transparent, subtle neutral hover.
        ghost: "text-foreground hover:bg-secondary/60",

        // Link — gold-soft → gold
        link: "text-[hsl(var(--gold-soft))] underline-offset-4 hover:text-[hsl(var(--gold))] hover:underline",

        // Gold outline — clean gold hairline, fills lightly on hover.
        "gold-outline": "border border-[hsl(var(--gold)/0.4)] text-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.04)] font-semibold hover:bg-[hsl(var(--gold)/0.1)] hover:border-[hsl(var(--gold)/0.6)]",

        // Glass — restrained frosted surface (no heavy glow).
        glass: "text-foreground bg-white/[0.04] border border-white/10 backdrop-blur-md hover:bg-white/[0.07]",

        // Tier — flat gold fill (uses --tier-color var; defaults to gold).
        tier: "text-primary-foreground font-bold [--tier-color:var(--gold)] [background:hsl(var(--tier-color))] hover:brightness-105",

        // Success — flat green.
        success: "text-white font-semibold bg-[hsl(152_52%_36%)] hover:brightness-105",

        // Warning — flat amber.
        warning: "text-[hsl(24_80%_12%)] font-semibold bg-[hsl(38_86%_52%)] hover:brightness-105",

        // Danger outline — clean destructive hairline, transparent base.
        "danger-outline": "border border-[hsl(var(--destructive)/0.5)] text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.04)] font-semibold hover:bg-[hsl(var(--destructive)/0.1)] hover:border-[hsl(var(--destructive)/0.7)]",

        // Ember — the tribes/fire signature CTA. Now the shared primary look.
        ember: PRIMARY_EMBER,

        // Ember outline — premium hairline ember for secondary tribe actions
        "ember-outline": [
          "relative text-[hsl(22_98%_66%)] font-semibold",
          "border border-[hsl(var(--ember)/0.5)]",
          "overflow-hidden isolate",
          "[background:linear-gradient(180deg,hsl(var(--ember)/0.08)_0%,hsl(14_92%_42%/0.05)_100%)]",
          "shadow-[inset_0_1px_0_hsl(48_100%_88%/0.14),inset_0_-1px_0_hsl(10_82%_14%/0.4),inset_0_-8px_16px_-12px_hsl(var(--ember)/0.4),0_1px_2px_hsl(14_70%_10%/0.3),0_4px_12px_-6px_hsl(var(--ember)/0.25)]",
          // ::before — soft inner heat glow at the bottom
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none",
          "before:[background:radial-gradient(120%_80%_at_50%_120%,hsl(18_98%_58%/0.18)_0%,transparent_60%)]",
          // ::after — hover heat shimmer
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(22_98%_70%/0.18)_50%,transparent_70%)]",
          "after:opacity-0 after:transition-[transform,opacity] after:duration-[700ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:opacity-100 hover:after:[transform:translate3d(260%,0,0)]",
          "hover:text-[hsl(28_100%_74%)]",
          "hover:border-[hsl(var(--ember)/0.85)]",
          "hover:[background:linear-gradient(180deg,hsl(var(--ember)/0.18)_0%,hsl(14_92%_42%/0.10)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(48_100%_88%/0.2),inset_0_-1px_0_hsl(10_82%_14%/0.45),inset_0_-10px_18px_-12px_hsl(18_95%_60%/0.55),0_2px_3px_hsl(14_70%_10%/0.35),0_8px_20px_-4px_hsl(var(--ember)/0.4)]",
          "active:[background:linear-gradient(180deg,hsl(var(--ember)/0.10)_0%,hsl(14_92%_42%/0.05)_100%)]",
          "active:shadow-[inset_0_2px_4px_hsl(10_82%_10%/0.5)]",
        ].join(" "),

        // Gold-soft — explicit premium gold-glass for cancel/compare/message style actions.
        // Stronger gold crown than `secondary` — pick this when you want clearer "luxury cancel".
        "gold-soft": [
          "relative text-[hsl(var(--gold-light))] font-semibold overflow-hidden isolate",
          "[background:linear-gradient(180deg,hsl(258_16%_12%)_0%,hsl(258_16%_7%)_100%)]",
          "border border-[hsl(var(--gold)/0.28)]",
          "shadow-[inset_0_1px_0_hsl(var(--gold)/0.30),inset_0_-1px_0_hsl(20_85%_6%/0.55),inset_0_-14px_30px_-16px_hsl(var(--gold-soft)/0.30),0_1px_2px_hsl(0_0%_0%/0.32)]",
          "before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:rounded-t-[inherit] before:pointer-events-none",
          "before:[background:radial-gradient(120%_100%_at_50%_-30%,hsl(var(--gold-light)/0.22)_0%,transparent_70%)]",
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(var(--gold-light)/0.30)_50%,transparent_70%)]",
          "after:opacity-0 after:transition-[transform,opacity] after:duration-[750ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:opacity-100 hover:after:[transform:translate3d(260%,0,0)]",
          "hover:text-[hsl(46_100%_84%)]",
          "hover:border-[hsl(var(--gold)/0.55)]",
          "hover:[background:linear-gradient(180deg,hsl(258_16%_14%)_0%,hsl(258_16%_8%)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(var(--gold)/0.4),inset_0_-1px_0_hsl(20_85%_6%/0.6),inset_0_-14px_32px_-16px_hsl(var(--gold-soft)/0.42),0_3px_10px_-2px_hsl(0_0%_0%/0.4),0_10px_24px_-8px_hsl(var(--gold)/0.32)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.5)]",
        ].join(" "),

        // Ember-glass — explicit ember-tinted glass for tribe/fire-context secondary actions.
        // Stronger ember vibe than the inherited `outline` look.
        "ember-glass": [
          "relative text-[hsl(22_98%_72%)] font-semibold overflow-hidden isolate",
          "border border-[hsl(var(--ember)/0.45)]",
          "[background:linear-gradient(180deg,hsl(var(--ember)/0.10)_0%,hsl(14_92%_42%/0.06)_100%)]",
          "shadow-[inset_0_1px_0_hsl(48_100%_88%/0.16),inset_0_-1px_0_hsl(10_82%_14%/0.45),inset_0_-10px_20px_-12px_hsl(var(--ember)/0.42),0_1px_2px_hsl(14_70%_10%/0.32),0_4px_14px_-6px_hsl(var(--ember)/0.28)]",
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none",
          "before:[background:radial-gradient(120%_80%_at_50%_120%,hsl(18_98%_58%/0.22)_0%,transparent_60%)]",
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(22_98%_72%/0.24)_50%,transparent_70%)]",
          "after:opacity-0 after:transition-[transform,opacity] after:duration-[700ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:opacity-100 hover:after:[transform:translate3d(260%,0,0)]",
          "hover:text-[hsl(28_100%_78%)]",
          "hover:border-[hsl(var(--ember)/0.85)]",
          "hover:[background:linear-gradient(180deg,hsl(var(--ember)/0.20)_0%,hsl(14_92%_42%/0.12)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(48_100%_88%/0.22),inset_0_-1px_0_hsl(10_82%_14%/0.5),inset_0_-12px_22px_-12px_hsl(18_95%_60%/0.55),0_2px_3px_hsl(14_70%_10%/0.35),0_8px_22px_-4px_hsl(var(--ember)/0.42)]",
          "active:shadow-[inset_0_2px_4px_hsl(10_82%_10%/0.5)]",
        ].join(" "),

        // Gold-icon — for icon-only buttons (back/close/clear) that need a warm hover.
        "gold-icon": [
          "text-[hsl(var(--foreground-muted))]",
          "hover:bg-[hsl(var(--gold)/0.08)]",
          "hover:text-[hsl(var(--gold-light))]",
          "hover:shadow-[inset_0_1px_0_hsl(var(--gold)/0.20),inset_0_-1px_0_hsl(var(--gold-soft)/0.35),0_4px_14px_-4px_hsl(var(--gold)/0.30)]",
          "active:bg-[hsl(var(--gold)/0.14)]",
        ].join(" "),

        // Coal outline — hairline coal for secondary actions matching `coal`
        "coal-outline": [
          "relative text-[hsl(40_100%_78%)] font-semibold",
          "border border-[hsl(28_85%_42%/0.55)]",
          "overflow-hidden isolate",
          "[background:linear-gradient(180deg,hsl(20_45%_10%/0.55)_0%,hsl(20_55%_6%/0.65)_100%)]",
          "shadow-[inset_0_1px_0_hsl(46_100%_88%/0.12),inset_0_-1px_0_hsl(20_85%_6%/0.6),inset_0_-8px_16px_-12px_hsl(20_95%_45%/0.32),0_1px_2px_hsl(0_0%_0%/0.4),0_4px_12px_-6px_hsl(28_85%_36%/0.22)]",
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none",
          "before:[background:radial-gradient(120%_80%_at_50%_120%,hsl(20_98%_50%/0.18)_0%,transparent_60%)]",
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(40_100%_82%/0.18)_50%,transparent_70%)]",
          "after:opacity-0 after:transition-[transform,opacity] after:duration-[700ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:opacity-100 hover:after:[transform:translate3d(260%,0,0)]",
          "hover:text-[hsl(46_100%_84%)]",
          "hover:border-[hsl(28_92%_52%/0.85)]",
          "hover:[background:linear-gradient(180deg,hsl(20_55%_14%/0.65)_0%,hsl(20_60%_8%/0.75)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(46_100%_88%/0.18),inset_0_-1px_0_hsl(20_85%_6%/0.7),inset_0_-10px_18px_-12px_hsl(20_95%_45%/0.45),0_2px_3px_hsl(0_0%_0%/0.45),0_8px_20px_-4px_hsl(28_85%_36%/0.35)]",
          "active:shadow-[inset_0_2px_4px_hsl(20_85%_6%/0.7)]",
        ].join(" "),

        // (gold/coal/magma/bullion/aurum aliases removed — 7 names for one
        // identical button meant the same CTA was declared 5 different ways.
        // `ember` and `default` are the two that remain.)
      },
      size: {
        default: "h-10 min-h-10 px-4 py-2 rounded-md",
        sm: "h-9 min-h-9 px-3 rounded-md text-xs",
        /**
         * Inline micro-action inside a dense text row — a comment's
         * Reply/Edit/Delete beside its timestamp, a banner's Remove. Added
         * because nothing existed under `sm` (36px), so every one of these was
         * hand-rolled: four near-identical class strings in TribePostCard alone.
         *
         * 28px is BELOW the 44pt tap floor by necessity — it has to be, to sit
         * on a comment meta line. The 44 pt hit area comes from the
         * compoundVariants below (an invisible ::before, like icon-sm/icon)
         * on every variant that doesn't own ::before for its surface. On the
         * surface-owning variants (default/ember, ember-outline, ember-glass,
         * coal-outline, gold-soft) the expansion would be clipped by their
         * overflow-hidden and skew the sheen — use min-h-11 min-w-11 there.
         *
         * gap-1 (both hops: root for asChild, inner span otherwise) keeps a
         * Reply · Edit · Delete meta row at its hand-rolled 4px density.
         */
        xs: "h-7 min-h-7 px-2 rounded-md text-[11px] [&_svg]:size-3 gap-1 [&>span]:gap-1",
        lg: "h-12 min-h-12 px-8 rounded-lg text-base",
        xl: "h-14 min-h-14 px-10 rounded-lg text-lg tracking-[-0.01em] font-display",
        icon: "h-10 w-10 min-h-10 rounded-md",
        "icon-sm": "h-8 w-8 min-h-8 rounded-md [&_svg]:size-3.5",
        "icon-lg": "h-12 w-12 min-h-12 rounded-md [&_svg]:size-5",
        // Filter chips ran gap-1.5 when hand-rolled; keep that density here
        // rather than the base gap-2.5 (root hop for asChild, span otherwise).
        pill: "h-9 min-h-9 px-5 rounded-full text-xs gap-1.5 [&>span]:gap-1.5",
      },
    },
    // Invisible 44 pt hit area for the three sub-floor sizes. Only variants
    // WITHOUT a ::before surface layer — the ember/gold surfaces own ::before
    // for their sheen and clip it with overflow-hidden.
    compoundVariants: [
      { variant: [...HIT_AREA_VARIANTS], size: "icon-sm", class: "before:absolute before:-inset-1.5 before:content-['']" },
      { variant: [...HIT_AREA_VARIANTS], size: "xs", class: "before:absolute before:-inset-2 before:content-['']" },
      { variant: [...HIT_AREA_VARIANTS], size: "icon", class: "before:absolute before:-inset-0.5 before:content-['']" },
    ],
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
          <span className="absolute inset-0 flex items-center justify-center z-[4]">
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
