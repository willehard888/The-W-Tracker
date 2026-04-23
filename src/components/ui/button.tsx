import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import magmaTexture from "@/assets/btn-magma-texture.jpg";
import goldTexture from "@/assets/btn-gold-texture.jpg";
import lavaTexture from "@/assets/btn-lava-texture.jpg";

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
          "hover:[animation:fire-breathe-glow_3.6s_ease-in-out_infinite]",
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

        // Outline — premium ember-tinted glass with warm hairline border.
        // Inherited by every existing `variant="outline"` callsite — entire app warms up automatically.
        outline: [
          "relative text-foreground overflow-hidden isolate",
          "[background:linear-gradient(180deg,hsl(42_60%_46%/0.05)_0%,hsl(258_16%_6%)_100%)]",
          "border border-transparent",
          "[border-image:linear-gradient(180deg,hsl(var(--gold-soft)/0.55),hsl(18_95%_42%/0.32))_1]",
          "shadow-[inset_0_1px_0_hsl(var(--gold)/0.10),inset_0_-1px_0_hsl(20_85%_8%/0.45),0_1px_2px_hsl(0_0%_0%/0.3)]",
          // Hover: ember hairline + diagonal heat shimmer (GPU translate sweep)
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(var(--gold-light)/0.18)_50%,transparent_70%)]",
          "after:opacity-0 after:transition-[transform,opacity] after:duration-[700ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:opacity-100 hover:after:[transform:translate3d(260%,0,0)]",
          "hover:text-[hsl(var(--gold-light))]",
          "hover:[border-image:linear-gradient(180deg,hsl(var(--gold)/0.85),hsl(18_95%_50%/0.55))_1]",
          "hover:[background:linear-gradient(180deg,hsl(42_60%_46%/0.10)_0%,hsl(258_16%_8%)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(var(--gold)/0.18),inset_0_-1px_0_hsl(20_85%_8%/0.5),0_2px_4px_hsl(0_0%_0%/0.3),0_6px_18px_-6px_hsl(var(--gold)/0.25)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.45)]",
        ].join(" "),

        // Secondary — premium gold-glass panel.
        // Inherited by ~175 existing `variant="secondary"` callsites — entire app auto-warms.
        secondary: [
          "relative text-secondary-foreground overflow-hidden isolate",
          "[background:linear-gradient(180deg,hsl(258_16%_11%)_0%,hsl(258_16%_7%)_100%)]",
          // Top gold hairline + bottom warm coal hairline + faint inner gold radiance
          "shadow-[inset_0_1px_0_hsl(var(--gold)/0.16),inset_0_-1px_0_hsl(20_85%_6%/0.55),inset_0_-14px_30px_-18px_hsl(var(--gold-soft)/0.22),0_1px_2px_hsl(0_0%_0%/0.3)]",
          "border border-[hsl(var(--gold)/0.12)]",
          "hover:[background:linear-gradient(180deg,hsl(258_16%_13%)_0%,hsl(258_16%_8%)_100%)]",
          "hover:border-[hsl(var(--gold)/0.32)]",
          "hover:text-[hsl(var(--gold-light))]",
          "hover:shadow-[inset_0_1px_0_hsl(var(--gold)/0.24),inset_0_-1px_0_hsl(20_85%_6%/0.6),inset_0_-14px_32px_-18px_hsl(var(--gold-soft)/0.32),0_3px_10px_-2px_hsl(0_0%_0%/0.4),0_8px_22px_-8px_hsl(var(--gold)/0.22)]",
          "active:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.5)]",
          "focus-visible:[animation:button-warm-rim-breathe_4s_ease-in-out_infinite]",
        ].join(" "),

        // Ghost — transparent with gold lift on hover
        ghost: [
          "text-foreground",
          "hover:bg-[hsl(var(--gold)/0.06)]",
          "hover:text-[hsl(var(--gold-light))]",
          "hover:shadow-[inset_0_1px_0_hsl(var(--gold)/0.12),inset_0_-1px_0_hsl(var(--gold-soft)/0.35)]",
          "active:bg-[hsl(var(--gold)/0.10)]",
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

        // Ember — THE tribes/fire signature CTA. Premium molten metal:
        //   1. 3-layer background: vertical heat streaks + top satin band + ember body
        //   2. Layered shadows: coal bezel + inner heat-bed + outer flame glow + soft pulsing halo
        //   3. ::before — golden crown top + hot heat-bloom bottom
        //   4. ::after — diagonal heat shimmer sweep on hover
        //   5. Living halo via `ember-halo-pulse` (slow, premium, GPU-only)
        //   6. Press: sunken into coals + halo briefly damped
        ember: [
          "text-[hsl(28_92%_8%)] font-extrabold tracking-[-0.005em]",
          "[text-shadow:0_1px_0_hsl(40_100%_88%/0.6),0_0_8px_hsl(48_100%_92%/0.25)]",
          "overflow-hidden isolate",
          // BASE: vertical heat streaks + top satin band + ember body
          "[background:repeating-linear-gradient(90deg,transparent_0,transparent_8%,hsl(48_100%_94%/0.05)_8.4%,transparent_8.8%),linear-gradient(180deg,hsl(48_100%_92%/0)_0%,hsl(48_100%_96%/0.22)_46%,hsl(48_100%_96%/0.28)_50%,hsl(48_100%_96%/0.22)_54%,hsl(48_100%_92%/0)_70%),linear-gradient(180deg,hsl(48_100%_75%)_0%,hsl(38_100%_64%)_16%,hsl(26_100%_58%)_38%,hsl(18_98%_54%)_64%,hsl(14_92%_44%)_88%,hsl(10_85%_30%)_100%)]",
          // ::before — golden crown + bottom heat-bloom
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
          "before:[background:radial-gradient(120%_75%_at_50%_-22%,hsl(48_100%_98%/0.7)_0%,hsl(46_100%_90%/0.22)_30%,transparent_62%),radial-gradient(140%_90%_at_50%_125%,hsl(20_100%_62%/0.6)_0%,hsl(14_92%_46%/0.28)_38%,transparent_72%)]",
          // ::after — diagonal heat shimmer (sweeps on hover, GPU translate)
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_28%,hsl(48_100%_98%/0.55)_50%,transparent_72%)]",
          "after:opacity-80 after:transition-transform after:duration-[900ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:[transform:translate3d(280%,0,0)]",
          // Living halo — slow premium pulse via keyframe (defined in index.css)
          "ember-halo",
          "[animation:ember-halo-pulse_3.6s_ease-in-out_infinite]",
          // Hover: brighter coals + faster halo
          "hover:brightness-[1.08] hover:saturate-[1.10]",
          "hover:[animation-duration:2.2s]",
          // Pressed: sunken into coals
          "active:brightness-[0.94] active:saturate-[0.95]",
          "active:before:opacity-50 active:after:opacity-25",
          "active:[animation:none]",
          "active:shadow-[inset_0_0_0_0.5px_hsl(10_85%_8%/0.8),inset_0_2px_5px_hsl(10_82%_10%/0.6),inset_0_-1px_0_hsl(46_100%_82%/0.18),inset_0_-6px_14px_-8px_hsl(18_95%_50%/0.5),0_1px_1px_hsl(0_0%_0%/0.4)]",
          "disabled:grayscale-[0.5] disabled:after:hidden disabled:before:hidden disabled:[animation:none]",
        ].join(" "),

        // Ember outline — premium hairline ember for secondary tribe actions
        "ember-outline": [
          "relative text-[hsl(22_98%_66%)] font-semibold",
          "border border-[hsl(18_95%_58%/0.5)]",
          "overflow-hidden isolate",
          "[background:linear-gradient(180deg,hsl(18_95%_58%/0.08)_0%,hsl(14_92%_42%/0.05)_100%)]",
          "shadow-[inset_0_1px_0_hsl(48_100%_88%/0.14),inset_0_-1px_0_hsl(10_82%_14%/0.4),inset_0_-8px_16px_-12px_hsl(18_95%_58%/0.4),0_1px_2px_hsl(14_70%_10%/0.3),0_4px_12px_-6px_hsl(18_95%_58%/0.25)]",
          // ::before — soft inner heat glow at the bottom
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none",
          "before:[background:radial-gradient(120%_80%_at_50%_120%,hsl(18_98%_58%/0.18)_0%,transparent_60%)]",
          // ::after — hover heat shimmer
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(22_98%_70%/0.18)_50%,transparent_70%)]",
          "after:opacity-0 after:transition-[transform,opacity] after:duration-[700ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:opacity-100 hover:after:[transform:translate3d(260%,0,0)]",
          "hover:text-[hsl(28_100%_74%)]",
          "hover:border-[hsl(18_95%_58%/0.85)]",
          "hover:[background:linear-gradient(180deg,hsl(18_95%_58%/0.18)_0%,hsl(14_92%_42%/0.10)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(48_100%_88%/0.2),inset_0_-1px_0_hsl(10_82%_14%/0.45),inset_0_-10px_18px_-12px_hsl(18_95%_60%/0.55),0_2px_3px_hsl(14_70%_10%/0.35),0_8px_20px_-4px_hsl(18_95%_58%/0.4)]",
          "active:[background:linear-gradient(180deg,hsl(18_95%_58%/0.10)_0%,hsl(14_92%_42%/0.05)_100%)]",
          "active:shadow-[inset_0_2px_4px_hsl(10_82%_10%/0.5)]",
        ].join(" "),

        // Coal / Hiillos — THE next-level evolution of the gold/amber CTA.
        // A glowing coal: deep anthracite body that the heat burns through from beneath.
        //   • Deep coal body (so the inner heat has darkness to glow against)
        //   • Inner radial heat-bed (red-orange) burning through from below
        //   • Golden top crown — keeps the regal/identity association of gold
        //   • Cracking surface texture: faint horizontal ember fissures
        //   • Living halo: slow gold→ember pulse, premium and alive
        //   • Press: coal "settles", heat dampens, fissures dim
        // Use this where you previously used `gold` for high-value identity actions
        // (Login / Continue / Accept / Save Changes / Save Image / Earn Status).
        coal: [
          "text-[hsl(46_100%_88%)] font-extrabold tracking-[-0.005em]",
          "[text-shadow:0_1px_0_hsl(20_60%_8%/0.85),0_0_10px_hsl(28_100%_56%/0.4)]",
          "overflow-hidden isolate",
          // BASE: horizontal ember fissures + warm satin band + deep coal body
          "[background:repeating-linear-gradient(180deg,transparent_0,transparent_22%,hsl(20_95%_50%/0.10)_23%,transparent_24%,transparent_46%,hsl(28_95%_55%/0.07)_47%,transparent_48%),linear-gradient(180deg,hsl(46_100%_92%/0)_0%,hsl(40_100%_88%/0.12)_46%,hsl(40_100%_88%/0.16)_50%,hsl(40_100%_88%/0.12)_54%,hsl(46_100%_92%/0)_70%),radial-gradient(140%_100%_at_50%_120%,hsl(18_98%_42%)_0%,hsl(14_88%_24%)_38%,hsl(18_55%_12%)_72%,hsl(20_45%_8%)_100%)]",
          // Coal bezel: deep dark rim + warm inner heat + soft golden crown highlight
          "shadow-[inset_0_0_0_0.5px_hsl(20_70%_6%/0.9),inset_0_1px_0_hsl(46_100%_92%/0.55),inset_0_-1px_0_hsl(20_85%_6%/0.85),inset_0_8px_18px_-10px_hsl(40_100%_70%/0.25),inset_0_-12px_28px_-8px_hsl(18_95%_42%/0.55),0_1px_2px_hsl(0_0%_0%/0.5),0_8px_20px_-3px_hsl(18_95%_38%/0.4),0_18px_36px_-14px_hsl(28_85%_36%/0.5)]",
          // ::before — golden top crown + intense bottom heat-bed (the burning core)
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
          "before:[background:radial-gradient(120%_60%_at_50%_-25%,hsl(48_100%_92%/0.55)_0%,hsl(42_100%_70%/0.18)_30%,transparent_60%),radial-gradient(160%_110%_at_50%_135%,hsl(20_100%_56%/0.7)_0%,hsl(14_92%_38%/0.32)_35%,transparent_70%)]",
          // ::after — diagonal gold→ember heat shimmer on hover
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_28%,hsl(48_100%_92%/0.45)_50%,transparent_72%)]",
          "after:opacity-80 after:transition-transform after:duration-[900ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:[transform:translate3d(280%,0,0)]",
          // Living halo — slow premium pulse via keyframe (defined in index.css)
          "coal-halo",
          "[animation:coal-halo-pulse_4s_ease-in-out_infinite]",
          // Hover: hotter core + faster halo
          "hover:brightness-[1.08] hover:saturate-[1.10]",
          "hover:[animation-duration:2.6s]",
          // Pressed: coal settles, heat dampens
          "active:brightness-[0.94] active:saturate-[0.95]",
          "active:before:opacity-50 active:after:opacity-25",
          "active:[animation:none]",
          "active:shadow-[inset_0_0_0_0.5px_hsl(20_70%_4%/0.95),inset_0_2px_5px_hsl(20_75%_6%/0.7),inset_0_-1px_0_hsl(40_100%_80%/0.18),inset_0_-8px_18px_-10px_hsl(18_95%_42%/0.5),0_1px_1px_hsl(0_0%_0%/0.5)]",
          "disabled:grayscale-[0.5] disabled:after:hidden disabled:before:hidden disabled:[animation:none]",
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
          "border border-[hsl(18_95%_58%/0.45)]",
          "[background:linear-gradient(180deg,hsl(18_95%_58%/0.10)_0%,hsl(14_92%_42%/0.06)_100%)]",
          "shadow-[inset_0_1px_0_hsl(48_100%_88%/0.16),inset_0_-1px_0_hsl(10_82%_14%/0.45),inset_0_-10px_20px_-12px_hsl(18_95%_58%/0.42),0_1px_2px_hsl(14_70%_10%/0.32),0_4px_14px_-6px_hsl(18_95%_58%/0.28)]",
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none",
          "before:[background:radial-gradient(120%_80%_at_50%_120%,hsl(18_98%_58%/0.22)_0%,transparent_60%)]",
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(22_98%_72%/0.24)_50%,transparent_70%)]",
          "after:opacity-0 after:transition-[transform,opacity] after:duration-[700ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:opacity-100 hover:after:[transform:translate3d(260%,0,0)]",
          "hover:text-[hsl(28_100%_78%)]",
          "hover:border-[hsl(18_95%_58%/0.85)]",
          "hover:[background:linear-gradient(180deg,hsl(18_95%_58%/0.20)_0%,hsl(14_92%_42%/0.12)_100%)]",
          "hover:shadow-[inset_0_1px_0_hsl(48_100%_88%/0.22),inset_0_-1px_0_hsl(10_82%_14%/0.5),inset_0_-12px_22px_-12px_hsl(18_95%_60%/0.55),0_2px_3px_hsl(14_70%_10%/0.35),0_8px_22px_-4px_hsl(18_95%_58%/0.42)]",
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

        // ─────────────────────────────────────────────────────────────────────
        // MAGMA — real lava-cracked rock CTA. Photographic texture + animated
        // heat shift through the cracks. The pinnacle "fire" CTA in the app.
        //   • Real molten-rock texture base (animated background-position drift)
        //   • Glowing crack overlay via mix-blend so cracks pulse with light
        //   • Top dark vignette keeps text legible against bright lava
        //   • Hover: heat intensifies (saturation + brightness + faster drift)
        //   • Press: lava cools (settles), animations pause
        // Use sparingly — this is the "ignite" / "go nuclear" button.
        // ─────────────────────────────────────────────────────────────────────
        magma: [
          "text-[hsl(48_100%_94%)] font-extrabold tracking-[-0.005em] uppercase text-xs",
          "[text-shadow:0_1px_0_hsl(20_90%_6%/0.95),0_0_10px_hsl(28_100%_56%/0.6),0_2px_8px_hsl(14_92%_30%/0.85)]",
          "overflow-hidden isolate",
          // BASE: real lava texture (drifts slowly), warmed via overlay
          "[background-image:url(var(--magma-bg)),linear-gradient(180deg,hsl(14_92%_46%/0.25)_0%,hsl(20_85%_18%/0.45)_100%)]",
          "[background-size:200%_200%,100%_100%] [background-position:0%_50%,0_0]",
          "[background-blend-mode:overlay,normal]",
          // Coal bezel — keeps the molten contained and tactile
          "shadow-[inset_0_0_0_0.5px_hsl(20_70%_4%/0.95),inset_0_1px_0_hsl(48_100%_92%/0.45),inset_0_-1px_0_hsl(20_85%_6%/0.9),inset_0_-12px_28px_-10px_hsl(18_98%_48%/0.55),0_1px_2px_hsl(0_0%_0%/0.55),0_8px_22px_-3px_hsl(18_95%_42%/0.55),0_18px_42px_-12px_hsl(14_92%_38%/0.65)]",
          // ::before — top dark vignette for text legibility + bottom heat bloom
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
          "before:[background:radial-gradient(120%_55%_at_50%_-15%,hsl(20_80%_4%/0.55)_0%,transparent_55%),radial-gradient(140%_100%_at_50%_125%,hsl(20_100%_56%/0.45)_0%,transparent_70%)]",
          // ::after — diagonal heat sweep on hover
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_28%,hsl(48_100%_96%/0.45)_50%,transparent_72%)]",
          "after:opacity-70 after:transition-transform after:duration-[900ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:[transform:translate3d(280%,0,0)]",
          // Living: slow background drift + halo pulse
          "[animation:magma-drift_18s_linear_infinite,ember-halo-pulse_3.6s_ease-in-out_infinite]",
          // Hover: hotter
          "hover:brightness-[1.10] hover:saturate-[1.18]",
          "hover:[animation-duration:10s,2.2s]",
          // Press: lava cools, animations stop
          "active:brightness-[0.92] active:saturate-[0.92]",
          "active:before:opacity-50 active:after:opacity-25",
          "active:[animation:none]",
          "active:shadow-[inset_0_0_0_0.5px_hsl(20_70%_3%/0.95),inset_0_2px_6px_hsl(20_75%_5%/0.75),inset_0_-1px_0_hsl(40_100%_82%/0.18),inset_0_-8px_18px_-10px_hsl(18_95%_42%/0.5),0_1px_1px_hsl(0_0%_0%/0.5)]",
          "disabled:grayscale-[0.6] disabled:after:hidden disabled:before:hidden disabled:[animation:none]",
        ].join(" "),

        // ─────────────────────────────────────────────────────────────────────
        // BULLION — real polished gold-bar CTA. Photographic 999.9 fine gold.
        //   • Real polished gold texture base (subtle vertical drift = light moves)
        //   • Top mirror-shine highlight band
        //   • Engraved bezel keeps the bar feeling tactile
        //   • Hover: brighter shine + faster sheen sweep
        // Use for premium identity actions (Upgrade, Claim, Save Status, Receipt).
        // ─────────────────────────────────────────────────────────────────────
        bullion: [
          "text-[hsl(28_92%_8%)] font-extrabold tracking-[-0.005em] uppercase text-xs",
          "[text-shadow:0_1px_0_hsl(50_100%_98%/0.85),0_0_4px_hsl(50_100%_94%/0.4)]",
          "overflow-hidden isolate",
          // BASE: real polished gold texture + warm gradient overlay
          "[background-image:url(var(--bullion-bg)),linear-gradient(180deg,hsl(50_100%_88%/0.4)_0%,hsl(38_96%_52%/0.5)_100%)]",
          "[background-size:170%_170%,100%_100%] [background-position:50%_30%,0_0]",
          "[background-blend-mode:overlay,normal]",
          // Engraved bullion bezel
          "shadow-[inset_0_0_0_0.5px_hsl(30_78%_18%/0.65),inset_0_1px_0_hsl(50_100%_99%/1),inset_0_-1px_0_hsl(30_82%_22%/0.65),inset_0_-8px_16px_-10px_hsl(30_82%_28%/0.5),0_1px_2px_hsl(30_60%_14%/0.4),0_8px_20px_-3px_hsl(40_92%_52%/0.5),0_20px_38px_-14px_hsl(38_88%_48%/0.55)]",
          // ::before — soft mirror-shine band on top + warm bottom glow
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
          "before:[background:linear-gradient(180deg,hsl(50_100%_99%/0.55)_0%,hsl(50_100%_99%/0.18)_18%,transparent_42%),radial-gradient(140%_70%_at_50%_125%,hsl(38_100%_60%/0.32)_0%,transparent_65%)]",
          // ::after — diagonal mirror-sheen sweep
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(50_100%_99%/0.55)_50%,transparent_70%)]",
          "after:opacity-70 after:transition-transform after:duration-[850ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:[transform:translate3d(260%,0,0)]",
          // Living: slow vertical light drift on the polished surface
          "[animation:bullion-shine-drift_14s_ease-in-out_infinite]",
          // Hover: brighter + slightly more saturated
          "hover:brightness-[1.06] hover:saturate-[1.08]",
          "hover:[animation-duration:8s]",
          // Press: muted, settles
          "active:brightness-[0.95]",
          "active:before:opacity-55 active:after:opacity-30",
          "active:[animation:none]",
          "active:shadow-[inset_0_0_0_0.5px_hsl(24_85%_14%/0.7),inset_0_2px_4px_hsl(24_75%_16%/0.5),inset_0_-1px_0_hsl(50_100%_90%/0.2),0_1px_1px_hsl(0_0%_0%/0.3)]",
          "disabled:grayscale-[0.4] disabled:after:hidden disabled:before:hidden disabled:[animation:none]",
        ].join(" "),

        // ─────────────────────────────────────────────────────────────────────
        // AURUM — gold → lava morph. The crown-jewel CTA.
        // Idle: a polished molten-gold bar (warm, calm, premium).
        // Hover: real lava texture ignites underneath, cracks bloom hot,
        //        the surface breathes, halo pulses, mirror-sheen sweeps.
        // Press: lava cools, settles into the bar.
        // Use for the single most important action on a screen
        // (Upgrade to Elite, Claim Reward, Forge Battle, Save Status).
        // ─────────────────────────────────────────────────────────────────────
        aurum: [
          "text-[hsl(28_92%_8%)] font-extrabold tracking-[-0.005em]",
          "[text-shadow:0_1px_0_hsl(50_100%_96%/0.7)]",
          "overflow-hidden isolate",
          // BASE: same polished gold bar as `gold` (so idle reads as luxury, not aggression)
          "[background:linear-gradient(180deg,hsl(50_100%_98%/0)_0%,hsl(50_100%_99%/0.14)_44%,hsl(50_100%_99%/0.2)_50%,hsl(50_100%_99%/0.14)_56%,hsl(50_100%_98%/0)_70%),linear-gradient(180deg,hsl(52_100%_90%)_0%,hsl(48_100%_80%)_18%,hsl(46_100%_68%)_44%,hsl(42_100%_58%)_72%,hsl(38_96%_48%)_92%,hsl(34_92%_40%)_100%)]",
          // Engraved gold bezel — gives the bar weight and tactility
          "shadow-[inset_0_0_0_0.5px_hsl(30_78%_18%/0.55),inset_0_1px_0_hsl(50_100%_99%/0.95),inset_0_-1px_0_hsl(30_82%_22%/0.55),inset_0_-6px_14px_-8px_hsl(30_82%_28%/0.45),0_1px_2px_hsl(30_60%_14%/0.35),0_8px_18px_-3px_hsl(40_92%_52%/0.45),0_18px_34px_-14px_hsl(38_88%_48%/0.5)]",
          // ::before — REAL LAVA TEXTURE LAYER (transparent at idle, ignites on hover)
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
          "before:[background-image:url(var(--lava-bg))]",
          "before:[background-size:180%_180%] before:[background-position:50%_50%]",
          "before:[background-blend-mode:overlay]",
          "before:opacity-0 before:scale-[1.04] before:[mix-blend-mode:hard-light]",
          // Smooth morph: opacity + scale settle on a soft cubic curve
          "before:transition-[opacity,transform,filter] before:duration-[700ms] before:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          // ::after — diagonal mirror sheen sweep (works in both gold and lava states)
          "after:content-[''] after:absolute after:inset-y-0 after:-left-1/3 after:w-1/2 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(110deg,transparent_30%,hsl(48_100%_98%/0.55)_50%,transparent_70%)]",
          "after:opacity-70 after:transition-transform after:duration-[850ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:[transform:translate3d(280%,0,0)]",
          // Living gold halo — slow, premium pulse at idle
          "[animation:fire-breathe-glow_4.8s_ease-in-out_infinite]",
          // ── HOVER — the morph: gold bar ignites into lava ──────────────────
          "hover:brightness-[1.06] hover:saturate-[1.10]",
          "hover:before:opacity-100 hover:before:scale-100",
          // While ignited: lava breathes (background drift) + cracks glow brighter
          "hover:before:[animation:aurum-lava-breathe_8s_ease-in-out_infinite]",
          // Halo intensifies into ember pulse on hover
          "hover:[animation:aurum-halo-pulse_2.4s_ease-in-out_infinite]",
          "hover:shadow-[inset_0_0_0_0.5px_hsl(20_85%_10%/0.7),inset_0_1px_0_hsl(50_100%_99%/0.95),inset_0_-1px_0_hsl(20_85%_8%/0.6),inset_0_-8px_18px_-8px_hsl(18_95%_42%/0.55),0_2px_3px_hsl(20_70%_8%/0.45),0_14px_28px_-3px_hsl(20_98%_46%/0.55),0_28px_52px_-14px_hsl(14_92%_38%/0.6)]",
          // ── PRESS — lava cools, settles back into the bar ─────────────────
          "active:brightness-[0.95]",
          "active:before:opacity-60 active:before:scale-[0.99] active:before:[animation:none]",
          "active:after:opacity-25",
          "active:[animation:none]",
          "active:shadow-[inset_0_0_0_0.5px_hsl(24_85%_14%/0.7),inset_0_2px_4px_hsl(24_75%_16%/0.5),inset_0_-1px_0_hsl(50_100%_90%/0.2),0_1px_1px_hsl(0_0%_0%/0.3)]",
          "disabled:grayscale-[0.45] disabled:after:hidden disabled:before:hidden disabled:[animation:none]",
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

    // Inject texture URLs as CSS vars for variants that consume them.
    const textureStyle = React.useMemo<React.CSSProperties | undefined>(() => {
      if (variant === "magma") {
        return { ["--magma-bg" as string]: `url(${magmaTexture})` };
      }
      if (variant === "bullion") {
        return { ["--bullion-bg" as string]: `url(${goldTexture})` };
      }
      if (variant === "aurum") {
        return { ["--lava-bg" as string]: `url(${lavaTexture})` };
      }
      return undefined;
    }, [variant]);

    const mergedStyle = textureStyle
      ? { ...textureStyle, ...((props as React.HTMLAttributes<HTMLElement>).style ?? {}) }
      : (props as React.HTMLAttributes<HTMLElement>).style;

    // When asChild, Slot requires a single child — preserve children as-is.
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          onClick={handleClick}
          {...props}
          style={mergedStyle}
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
        style={mergedStyle}
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
