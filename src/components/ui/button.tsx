import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";

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
    "active:scale-[0.985]",
    // Inner content (text + icons) lifts ABOVE the gloss/glint overlays so it stays crisp,
    // and settles down 0.5px on press for tactile feel
    "[&>*]:relative [&>*]:z-[3]",
    "[&>span]:transition-transform [&>span]:duration-150 [&:active>span]:translate-y-[0.5px]",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary — CLEAN gold bar. Polished + GPU-friendly:
        //   1. Single rich vertical gradient (champagne top → warm amber foot)
        //   2. Subtle horizontal satin band (kept gentle so text stays crisp)
        //   3. Crisp engraved bezel (top highlight + dark hairline + warm bottom)
        //   4. Lightweight ::before crown highlight + warm bottom inner glow
        //   5. Hover-only diagonal shimmer (transform sweep — no repaint cost)
        default: [
          "text-[hsl(28_92%_10%)] font-extrabold tracking-[-0.005em]",
          "[text-shadow:0_1px_0_hsl(50_100%_96%/0.7)]",
          "overflow-hidden isolate",
          // BASE: rich 6-stop gold + soft satin band (low opacity = legible text)
          "[background:linear-gradient(180deg,hsl(50_100%_98%/0)_0%,hsl(50_100%_99%/0.14)_44%,hsl(50_100%_99%/0.2)_50%,hsl(50_100%_99%/0.14)_56%,hsl(50_100%_98%/0)_70%),linear-gradient(180deg,hsl(52_100%_90%)_0%,hsl(48_100%_80%)_18%,hsl(46_100%_68%)_44%,hsl(42_100%_58%)_72%,hsl(38_96%_48%)_92%,hsl(34_92%_40%)_100%)]",
          // Engraved bezel — clean and warm
          "shadow-[inset_0_0_0_0.5px_hsl(30_78%_18%/0.55),inset_0_1px_0_hsl(50_100%_99%/0.95),inset_0_-1px_0_hsl(30_82%_22%/0.55),inset_0_-6px_14px_-8px_hsl(30_82%_28%/0.45),0_1px_2px_hsl(30_60%_14%/0.35),0_8px_18px_-3px_hsl(40_92%_52%/0.45),0_18px_34px_-14px_hsl(38_88%_48%/0.5)]",
          // ::before — top crown highlight + soft warm bottom glow
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
          "before:[background:radial-gradient(120%_70%_at_50%_-20%,hsl(50_100%_99%/0.55)_0%,hsl(50_100%_96%/0.18)_32%,transparent_62%),radial-gradient(120%_60%_at_50%_120%,hsl(38_100%_60%/0.28)_0%,transparent_60%)]",
          // ::after — narrow diagonal shimmer (translate3d sweep stays on GPU)
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(50_100%_99%/0.45)_50%,transparent_70%)]",
          "after:opacity-70 after:transition-transform after:duration-[750ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:[transform:translate3d(260%,0,0)]",
          // Hover: a touch brighter + warmer
          "hover:brightness-[1.05] hover:saturate-[1.06]",
          "hover:shadow-[inset_0_0_0_0.5px_hsl(30_78%_18%/0.6),inset_0_1px_0_hsl(50_100%_99%/1),inset_0_-1px_0_hsl(30_82%_22%/0.6),inset_0_-6px_16px_-8px_hsl(30_82%_28%/0.5),0_2px_3px_hsl(30_60%_14%/0.4),0_12px_22px_-3px_hsl(40_92%_52%/0.55),0_24px_46px_-14px_hsl(38_88%_48%/0.6)]",
          // Pressed: muted + sunken
          "active:brightness-[0.96]",
          "active:before:opacity-50 active:after:opacity-30",
          "active:shadow-[inset_0_0_0_0.5px_hsl(24_85%_14%/0.7),inset_0_2px_4px_hsl(24_75%_16%/0.5),inset_0_-1px_0_hsl(50_100%_90%/0.2),0_1px_1px_hsl(0_0%_0%/0.3)]",
          "disabled:grayscale-[0.4] disabled:after:hidden disabled:before:hidden",
        ].join(" "),

        // Obsidian — dark metal escape hatch when gold is too loud (rare).
        obsidian: [
          "text-primary-foreground",
          "[background:linear-gradient(180deg,hsl(258_16%_14%)_0%,hsl(258_18%_8%)_100%)]",
          "shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.14),inset_0_1.5px_0_hsl(0_0%_100%/0.04),inset_0_0_18px_hsl(0_0%_0%/0.25),inset_0_-1px_0_hsl(0_0%_0%/0.45),0_1px_1px_hsl(0_0%_0%/0.35),0_6px_14px_-4px_hsl(0_0%_0%/0.45)]",
          "hover:[background:linear-gradient(180deg,hsl(258_16%_16%)_0%,hsl(258_18%_10%)_100%)]",
          "hover:shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.18),inset_0_1.5px_0_hsl(0_0%_100%/0.05),inset_0_0_20px_hsl(0_0%_0%/0.22),inset_0_-1px_0_hsl(0_0%_0%/0.5),0_2px_2px_hsl(0_0%_0%/0.4),0_10px_22px_-6px_hsl(0_0%_0%/0.55)]",
          "active:[background:linear-gradient(0deg,hsl(258_16%_14%)_0%,hsl(258_18%_8%)_100%)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.6),inset_0_0_18px_hsl(0_0%_0%/0.3),0_1px_1px_hsl(0_0%_0%/0.3)]",
        ].join(" "),

        // Destructive — red metal with vignette
        destructive: [
          "text-destructive-foreground",
          "[background:linear-gradient(180deg,hsl(0_70%_32%)_0%,hsl(0_75%_22%)_100%)]",
          "shadow-[inset_0_0.5px_0_hsl(0_90%_85%/0.35),inset_0_1.5px_0_hsl(0_90%_85%/0.08),inset_0_0_18px_hsl(0_60%_8%/0.3),inset_0_-1px_0_hsl(0_60%_10%/0.55),0_1px_1px_hsl(0_60%_10%/0.5),0_6px_14px_-4px_hsl(0_70%_30%/0.45)]",
          "hover:[background:linear-gradient(180deg,hsl(0_72%_36%)_0%,hsl(0_78%_25%)_100%)]",
          "hover:shadow-[inset_0_0.5px_0_hsl(0_90%_85%/0.4),inset_0_1.5px_0_hsl(0_90%_85%/0.1),inset_0_0_20px_hsl(0_60%_8%/0.25),inset_0_-1px_0_hsl(0_60%_10%/0.6),0_2px_2px_hsl(0_60%_10%/0.55),0_10px_22px_-6px_hsl(0_70%_32%/0.55)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_60%_10%/0.65),inset_0_0_18px_hsl(0_60%_8%/0.35),0_1px_1px_hsl(0_0%_0%/0.3)]",
        ].join(" "),

        // Outline — gradient hairline border for built-in 3D
        outline: [
          "text-foreground",
          "[background:linear-gradient(180deg,hsl(258_16%_8%)_0%,hsl(258_16%_6%)_100%)]",
          "border border-transparent",
          "[border-image:linear-gradient(180deg,hsl(var(--border-strong)/0.9),hsl(var(--border)/0.5))_1]",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05),0_1px_2px_hsl(0_0%_0%/0.25)]",
          "hover:text-foreground",
          "hover:[border-image:linear-gradient(180deg,hsl(var(--border-strong)),hsl(var(--border-strong)/0.7))_1]",
          "hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08),0_2px_4px_hsl(0_0%_0%/0.3)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.4)]",
        ].join(" "),

        // Secondary — quiet panel
        secondary: [
          "text-secondary-foreground",
          "[background:linear-gradient(180deg,hsl(258_16%_10%)_0%,hsl(258_16%_7%)_100%)]",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05),0_1px_2px_hsl(0_0%_0%/0.28)]",
          "hover:[background:linear-gradient(180deg,hsl(258_16%_12%)_0%,hsl(258_16%_9%)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.07),0_3px_8px_-2px_hsl(0_0%_0%/0.35)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.45)]",
        ].join(" "),

        // Ghost — transparent + hairline lift on hover
        ghost: [
          "text-foreground",
          "hover:bg-[hsl(0_0%_100%/0.04)]",
          "hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),inset_0_-1px_0_hsl(var(--border-strong)/0.7)]",
          "active:bg-[hsl(0_0%_100%/0.06)]",
        ].join(" "),

        // Link — gold-soft → gold
        link: "text-[hsl(var(--gold-soft))] underline-offset-4 hover:text-[hsl(var(--gold))] hover:underline",

        // Gold — alias of default (legible bright metallic gold)
        gold: [
          "text-[hsl(28_92%_10%)] font-extrabold tracking-[-0.005em]",
          "[text-shadow:0_1px_0_hsl(50_100%_96%/0.7)]",
          "overflow-hidden isolate",
          "[background:linear-gradient(180deg,hsl(50_100%_98%/0)_0%,hsl(50_100%_99%/0.14)_44%,hsl(50_100%_99%/0.2)_50%,hsl(50_100%_99%/0.14)_56%,hsl(50_100%_98%/0)_70%),linear-gradient(180deg,hsl(52_100%_90%)_0%,hsl(48_100%_80%)_18%,hsl(46_100%_68%)_44%,hsl(42_100%_58%)_72%,hsl(38_96%_48%)_92%,hsl(34_92%_40%)_100%)]",
          "shadow-[inset_0_0_0_0.5px_hsl(30_78%_18%/0.55),inset_0_1px_0_hsl(50_100%_99%/0.95),inset_0_-1px_0_hsl(30_82%_22%/0.55),inset_0_-6px_14px_-8px_hsl(30_82%_28%/0.45),0_1px_2px_hsl(30_60%_14%/0.35),0_8px_18px_-3px_hsl(40_92%_52%/0.45),0_18px_34px_-14px_hsl(38_88%_48%/0.5)]",
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
          "before:[background:radial-gradient(120%_70%_at_50%_-20%,hsl(50_100%_99%/0.55)_0%,hsl(50_100%_96%/0.18)_32%,transparent_62%),radial-gradient(120%_60%_at_50%_120%,hsl(38_100%_60%/0.28)_0%,transparent_60%)]",
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(50_100%_99%/0.45)_50%,transparent_70%)]",
          "after:opacity-70 after:transition-transform after:duration-[750ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:[transform:translate3d(260%,0,0)]",
          "hover:brightness-[1.05] hover:saturate-[1.06]",
          "hover:shadow-[inset_0_0_0_0.5px_hsl(30_78%_18%/0.6),inset_0_1px_0_hsl(50_100%_99%/1),inset_0_-1px_0_hsl(30_82%_22%/0.6),inset_0_-6px_16px_-8px_hsl(30_82%_28%/0.5),0_2px_3px_hsl(30_60%_14%/0.4),0_12px_22px_-3px_hsl(40_92%_52%/0.55),0_24px_46px_-14px_hsl(38_88%_48%/0.6)]",
          "active:brightness-[0.96]",
          "active:before:opacity-50 active:after:opacity-30",
          "active:shadow-[inset_0_0_0_0.5px_hsl(24_85%_14%/0.7),inset_0_2px_4px_hsl(24_75%_16%/0.5),inset_0_-1px_0_hsl(50_100%_90%/0.2),0_1px_1px_hsl(0_0%_0%/0.3)]",
          "disabled:grayscale-[0.4] disabled:after:hidden disabled:before:hidden",
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

        // Glass — surface-glass + saturate filter
        glass: [
          "text-foreground",
          "backdrop-blur-xl backdrop-saturate-150",
          "[background:linear-gradient(180deg,hsl(0_0%_100%/0.06)_0%,hsl(0_0%_100%/0.02)_100%)]",
          "border border-white/10",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.1),0_2px_8px_-2px_hsl(0_0%_0%/0.4),0_8px_24px_-8px_hsl(0_0%_0%/0.5)]",
          "hover:[background:linear-gradient(180deg,hsl(0_0%_100%/0.09)_0%,hsl(0_0%_100%/0.03)_100%)]",
          "hover:border-white/15",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.4)]",
        ].join(" "),

        // Tier — uses --tier-color / --tier-color-deep CSS vars; defaults to gold
        tier: [
          "text-primary-foreground font-bold tracking-[-0.005em]",
          "[--tier-color:var(--gold)] [--tier-color-deep:var(--gold-dark)]",
          "[background:linear-gradient(180deg,hsl(var(--tier-color)/0.95)_0%,hsl(var(--tier-color)/0.75)_45%,hsl(var(--tier-color-deep)/0.85)_100%)]",
          "shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.55),inset_0_1.5px_0_hsl(0_0%_100%/0.12),inset_0_-8px_18px_-8px_hsl(var(--tier-color-deep)/0.55),inset_0_-1px_0_hsl(0_0%_0%/0.45),0_1px_1px_hsl(0_0%_0%/0.4),0_8px_20px_-6px_hsl(var(--tier-color)/0.45)]",
          "hover:brightness-[1.06]",
          "hover:shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.65),inset_0_1.5px_0_hsl(0_0%_100%/0.15),inset_0_-8px_20px_-8px_hsl(var(--tier-color-deep)/0.6),inset_0_-1px_0_hsl(0_0%_0%/0.45),0_2px_2px_hsl(0_0%_0%/0.45),0_12px_28px_-8px_hsl(var(--tier-color)/0.55)]",
          "active:shadow-[inset_0_2px_4px_hsl(0_0%_0%/0.55),inset_0_-6px_14px_-6px_hsl(var(--tier-color-deep)/0.5),0_1px_1px_hsl(0_0%_0%/0.25)]",
        ].join(" "),

        // Success — green metal
        success: [
          "text-primary-foreground font-semibold",
          "[background:linear-gradient(180deg,hsl(140_55%_38%)_0%,hsl(140_60%_26%)_100%)]",
          "shadow-[inset_0_0.5px_0_hsl(140_80%_85%/0.35),inset_0_1.5px_0_hsl(140_80%_85%/0.08),inset_0_-8px_16px_-8px_hsl(140_70%_15%/0.5),inset_0_-1px_0_hsl(140_60%_10%/0.55),0_1px_1px_hsl(140_60%_10%/0.45),0_6px_14px_-4px_hsl(140_60%_28%/0.45)]",
          "hover:brightness-[1.05]",
          "hover:shadow-[inset_0_0.5px_0_hsl(140_80%_85%/0.4),inset_0_1.5px_0_hsl(140_80%_85%/0.1),inset_0_-8px_18px_-8px_hsl(140_70%_15%/0.55),inset_0_-1px_0_hsl(140_60%_10%/0.6),0_2px_2px_hsl(140_60%_10%/0.5),0_10px_22px_-6px_hsl(140_60%_28%/0.55)]",
          "active:shadow-[inset_0_2px_4px_hsl(140_60%_10%/0.6),inset_0_-6px_12px_-6px_hsl(140_70%_12%/0.45),0_1px_1px_hsl(0_0%_0%/0.25)]",
        ].join(" "),

        // Warning — amber metal for risky actions
        warning: [
          "text-primary-foreground font-semibold",
          "[background:linear-gradient(180deg,hsl(38_90%_52%)_0%,hsl(38_80%_38%)_100%)]",
          "shadow-[inset_0_0.5px_0_hsl(38_100%_88%/0.45),inset_0_1.5px_0_hsl(38_100%_88%/0.1),inset_0_-8px_16px_-8px_hsl(28_85%_22%/0.5),inset_0_-1px_0_hsl(28_60%_14%/0.55),0_1px_1px_hsl(28_60%_14%/0.45),0_6px_14px_-4px_hsl(38_70%_36%/0.45)]",
          "hover:brightness-[1.05]",
          "hover:shadow-[inset_0_0.5px_0_hsl(38_100%_88%/0.55),inset_0_1.5px_0_hsl(38_100%_88%/0.12),inset_0_-8px_18px_-8px_hsl(28_85%_22%/0.55),inset_0_-1px_0_hsl(28_60%_14%/0.6),0_2px_2px_hsl(28_60%_14%/0.5),0_10px_22px_-6px_hsl(38_70%_36%/0.55)]",
          "active:shadow-[inset_0_2px_4px_hsl(28_60%_14%/0.6),inset_0_-6px_12px_-6px_hsl(28_85%_18%/0.45),0_1px_1px_hsl(0_0%_0%/0.25)]",
        ].join(" "),

        // Danger outline — hairline destructive, transparent base
        "danger-outline": [
          "text-[hsl(var(--destructive))] font-semibold",
          "border border-[hsl(var(--destructive)/0.5)]",
          "bg-[hsl(var(--destructive)/0.04)]",
          "shadow-[inset_0_1px_0_hsl(var(--destructive)/0.08)]",
          "hover:bg-[hsl(var(--destructive)/0.12)] hover:border-[hsl(var(--destructive)/0.7)]",
          "hover:shadow-[inset_0_1px_0_hsl(var(--destructive)/0.18),0_4px_12px_-4px_hsl(var(--destructive)/0.25)]",
          "active:bg-[hsl(var(--destructive)/0.08)]",
        ].join(" "),

        // Ember — THE tribes/fire signature CTA. Molten ember-orange metal with
        //   1. Deep multi-stop ember gradient (gold crown → ember → deep coal)
        //   2. Hot inner glow at the bottom that "burns" (mimics a coal bed)
        //   3. Crisp gold top hairline + dark coal bottom bezel
        //   4. ::before — radial heat-bloom from below + golden top crown
        //   5. ::after — diagonal heat shimmer sweeping on hover
        //   6. Soft outer flame halo that pulses subtly even at rest
        ember: [
          "text-[hsl(28_92%_8%)] font-extrabold tracking-[-0.005em]",
          "[text-shadow:0_1px_0_hsl(40_100%_88%/0.55)]",
          "overflow-hidden isolate",
          // BASE: gold crown sliver → bright ember body → deep coal foot
          "[background:linear-gradient(180deg,hsl(48_100%_92%/0)_0%,hsl(48_100%_94%/0.18)_46%,hsl(48_100%_94%/0.24)_50%,hsl(48_100%_94%/0.18)_54%,hsl(48_100%_92%/0)_70%),linear-gradient(180deg,hsl(46_100%_72%)_0%,hsl(34_100%_60%)_18%,hsl(22_98%_56%)_42%,hsl(16_94%_50%)_70%,hsl(12_88%_40%)_92%,hsl(10_82%_30%)_100%)]",
          // Crisp coal bezel + inner heat-bed glow + outer flame halo
          "shadow-[inset_0_0_0_0.5px_hsl(14_85%_14%/0.65),inset_0_1px_0_hsl(48_100%_94%/0.85),inset_0_-1px_0_hsl(10_82%_18%/0.7),inset_0_-10px_22px_-10px_hsl(18_95%_58%/0.7),0_1px_2px_hsl(14_70%_10%/0.5),0_8px_20px_-3px_hsl(18_95%_55%/0.55),0_18px_38px_-12px_hsl(16_94%_50%/0.55)]",
          // ::before — top gold crown + bottom hot heat-bloom
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
          "before:[background:radial-gradient(120%_70%_at_50%_-20%,hsl(48_100%_96%/0.6)_0%,hsl(46_100%_88%/0.18)_34%,transparent_64%),radial-gradient(120%_80%_at_50%_120%,hsl(18_98%_60%/0.55)_0%,hsl(14_92%_48%/0.25)_40%,transparent_72%)]",
          // ::after — diagonal heat shimmer
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(48_100%_96%/0.5)_50%,transparent_70%)]",
          "after:opacity-70 after:transition-transform after:duration-[850ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:[transform:translate3d(260%,0,0)]",
          // Hover: brighter heat, bigger flame halo
          "hover:brightness-[1.07] hover:saturate-[1.08]",
          "hover:shadow-[inset_0_0_0_0.5px_hsl(14_85%_14%/0.7),inset_0_1px_0_hsl(48_100%_96%/0.95),inset_0_-1px_0_hsl(10_82%_18%/0.75),inset_0_-12px_24px_-10px_hsl(18_95%_60%/0.8),0_2px_3px_hsl(14_70%_10%/0.55),0_12px_26px_-3px_hsl(18_95%_58%/0.65),0_28px_52px_-12px_hsl(16_94%_50%/0.7)]",
          // Pressed: damped coals
          "active:brightness-[0.96]",
          "active:before:opacity-50 active:after:opacity-30",
          "active:shadow-[inset_0_0_0_0.5px_hsl(10_85%_10%/0.75),inset_0_2px_5px_hsl(10_82%_12%/0.55),inset_0_-1px_0_hsl(46_100%_82%/0.18),inset_0_-6px_14px_-8px_hsl(18_95%_50%/0.5),0_1px_1px_hsl(0_0%_0%/0.35)]",
          "disabled:grayscale-[0.4] disabled:after:hidden disabled:before:hidden",
        ].join(" "),

        // Ember outline — hairline ember tone for secondary tribe actions (Invite, Manage, Leave)
        "ember-outline": [
          "text-[hsl(18_95%_62%)] font-semibold",
          "border border-[hsl(18_95%_58%/0.45)]",
          "[background:linear-gradient(180deg,hsl(18_95%_58%/0.06)_0%,hsl(14_92%_45%/0.04)_100%)]",
          "shadow-[inset_0_1px_0_hsl(48_100%_88%/0.10),inset_0_-6px_14px_-10px_hsl(18_95%_58%/0.35),0_1px_2px_hsl(14_70%_10%/0.25)]",
          "hover:text-[hsl(22_98%_70%)]",
          "hover:border-[hsl(18_95%_58%/0.75)]",
          "hover:[background:linear-gradient(180deg,hsl(18_95%_58%/0.16)_0%,hsl(14_92%_45%/0.08)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(48_100%_88%/0.16),inset_0_-8px_16px_-10px_hsl(18_95%_58%/0.5),0_4px_14px_-4px_hsl(18_95%_58%/0.35)]",
          "active:[background:linear-gradient(180deg,hsl(18_95%_58%/0.10)_0%,hsl(14_92%_45%/0.04)_100%)]",
          "active:shadow-[inset_0_2px_4px_hsl(10_82%_12%/0.4)]",
        ].join(" "),
      },
      size: {
        default: "h-10 min-h-10 px-4 py-2 rounded-md",
        sm: "h-9 min-h-9 px-3 rounded-md text-xs",
        lg: "h-12 min-h-12 px-8 rounded-lg text-base",
        xl: "h-14 min-h-14 px-10 rounded-lg text-lg tracking-[-0.01em] font-display",
        icon: "h-10 w-10 min-h-10 rounded-md",
        "icon-sm": "h-8 w-8 min-h-8 rounded-md [&_svg]:size-3.5",
        "icon-lg": "h-12 w-12 min-h-12 rounded-md [&_svg]:size-5",
        pill: "h-9 min-h-9 px-5 rounded-full text-xs",
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
