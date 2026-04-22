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
    "transition-[transform,box-shadow,background,opacity,filter,color,border-color] duration-200 [transition-timing-function:var(--ease-spring)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "focus-visible:shadow-[0_0_0_4px_hsl(var(--ring)/0.18)]",
    "disabled:pointer-events-none disabled:opacity-50 disabled:saturate-[0.6] disabled:cursor-not-allowed",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:scale-[0.985] will-change-transform",
    // Inner content (text + icons) lifts ABOVE the gloss/glint overlays so it stays crisp,
    // and settles down 0.5px on press for tactile feel
    "[&>*]:relative [&>*]:z-[3]",
    "[&>span]:transition-transform [&>span]:duration-150 [&:active>span]:translate-y-[0.5px]",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary — PHYSICAL brushed gold bar. Multi-layer recipe inspired
        // by how real polished gold reflects light:
        //   1. Anisotropic horizontal gloss band (the "rolled bar" sheen)
        //   2. Vertical 7-stop gradient: hot top rim → bright belly → bronze foot
        //   3. SVG noise micro-texture blended in for tactile grain
        //   4. Hot top rim hairline + dark bottom rim hairline (engraved bezel)
        //   5. Cross-grain hue shimmer (faceted feel)
        //   6. Animated diagonal glint on hover (anisotropic specular sweep)
        //   7. Warm spill drop-shadow that tints the surface beneath
        default: [
          "text-[hsl(26_90%_8%)] font-extrabold tracking-[-0.005em]",
          "[text-shadow:0_1px_0_hsl(50_100%_94%/0.55)]",
          "overflow-hidden isolate",
          // BASE: gloss-band kept SOFT (max 0.28 opacity) so it never washes out the text.
          // Gradient stays bright through the middle for legibility.
          "[background:linear-gradient(180deg,hsl(50_100%_70%/0)_0%,hsl(50_100%_98%/0.18)_38%,hsl(50_100%_99%/0.28)_46%,hsl(50_100%_98%/0.18)_54%,hsl(50_100%_70%/0)_66%),linear-gradient(178deg,hsl(50_100%_84%)_0%,hsl(48_100%_72%)_22%,hsl(46_100%_62%)_50%,hsl(42_98%_54%)_78%,hsl(36_90%_44%)_100%),url(\"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%20120%2040'%3E%3Cfilter%20id%3D'n'%3E%3CfeTurbulence%20type%3D'fractalNoise'%20baseFrequency%3D'0.9%200.06'%20numOctaves%3D'2'%20stitchTiles%3D'stitch'%2F%3E%3CfeColorMatrix%20values%3D'0%200%200%200%200.95%20%200%200%200%200%200.78%20%200%200%200%200%200.36%20%200%200%200%200.25%200'%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D'100%25'%20height%3D'100%25'%20filter%3D'url(%23n)'%2F%3E%3C%2Fsvg%3E\")]",
          "[background-blend-mode:screen,normal,overlay]",
          "[background-size:100%_100%,100%_100%,180px_60px]",
          // Engraved bezel — dark hairline + bright top rim + warm bottom rim + soft halo (no heavy black inner cap)
          "shadow-[inset_0_0_0_0.5px_hsl(28_72%_16%/0.6),inset_0_1px_0_hsl(50_100%_99%/0.95),inset_0_2px_0_hsl(48_100%_90%/0.5),inset_0_-1px_0_hsl(28_75%_22%/0.55),inset_0_-8px_16px_-10px_hsl(28_80%_28%/0.45),0_1px_2px_hsl(28_60%_14%/0.4),0_8px_18px_-3px_hsl(38_88%_48%/0.5),0_18px_36px_-12px_hsl(38_85%_46%/0.55)]",
          // ::before — top crown highlight + cross-grain hue facets (faceted feel)
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
          "before:[background:radial-gradient(115%_75%_at_50%_-25%,hsl(50_100%_99%/0.85)_0%,hsl(50_100%_94%/0.32)_28%,transparent_58%),linear-gradient(90deg,hsl(40_85%_46%/0)_0%,hsl(48_100%_88%/0.18)_22%,hsl(36_82%_38%/0)_42%,hsl(48_100%_88%/0.14)_62%,hsl(36_82%_38%/0)_82%,hsl(48_100%_88%/0.18)_96%,hsl(40_85%_46%/0)_100%)]",
          "before:[background-blend-mode:screen]",
          // ::after — soft bottom rim glow + animated diagonal anisotropic glint
          "after:content-[''] after:absolute after:inset-0 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(180deg,transparent_64%,hsl(48_100%_90%/0.22)_88%,hsl(50_100%_96%/0.32)_100%),linear-gradient(108deg,transparent_34%,hsl(50_100%_99%/0.9)_50%,transparent_66%)]",
          "after:[background-size:100%_100%,250%_100%] after:[background-position:0_0,140%_0]",
          "after:transition-[background-position,opacity] after:duration-[900ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:[background-position:0_0,-40%_0]",
          // Hover: brighter + warm spill
          "hover:brightness-[1.05] hover:saturate-[1.06]",
          "hover:shadow-[inset_0_0_0_0.5px_hsl(28_72%_16%/0.65),inset_0_1px_0_hsl(50_100%_99%/1),inset_0_2px_0_hsl(48_100%_90%/0.55),inset_0_-1px_0_hsl(28_75%_22%/0.6),inset_0_-8px_18px_-10px_hsl(28_80%_28%/0.5),0_2px_3px_hsl(28_60%_14%/0.45),0_12px_22px_-3px_hsl(38_88%_48%/0.6),0_26px_50px_-14px_hsl(38_85%_46%/0.65)]",
          // Pressed: muted + sunken (kept the inverted-sheen vibe but not as dark)
          "active:brightness-[0.95]",
          "active:before:opacity-40 active:after:opacity-30",
          "active:shadow-[inset_0_0_0_0.5px_hsl(22_85%_12%/0.75),inset_0_2.5px_5px_hsl(22_75%_14%/0.6),inset_0_-1px_0_hsl(48_100%_88%/0.2),inset_0_-6px_14px_-6px_hsl(28_80%_22%/0.45),0_1px_1px_hsl(0_0%_0%/0.3)]",
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

        // Gold — alias of default (bright metallic gold + grain + anisotropic gloss)
        gold: [
          "text-[hsl(30_85%_11%)] font-extrabold tracking-[-0.005em]",
          "[text-shadow:0_1px_0_hsl(50_100%_94%/0.7),0_-0.5px_0_hsl(28_70%_16%/0.25)]",
          "overflow-hidden isolate",
          "[background:linear-gradient(180deg,hsl(50_100%_70%/0)_0%,hsl(50_100%_98%/0.5)_38%,hsl(50_100%_99%/0.7)_46%,hsl(50_100%_98%/0.5)_54%,hsl(50_100%_70%/0)_66%),linear-gradient(178deg,hsl(50_100%_86%)_0%,hsl(48_100%_74%)_18%,hsl(46_100%_64%)_38%,hsl(42_98%_56%)_60%,hsl(38_92%_48%)_82%,hsl(32_84%_38%)_100%),url(\"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%20120%2040'%3E%3Cfilter%20id%3D'n'%3E%3CfeTurbulence%20type%3D'fractalNoise'%20baseFrequency%3D'0.9%200.06'%20numOctaves%3D'2'%20stitchTiles%3D'stitch'%2F%3E%3CfeColorMatrix%20values%3D'0%200%200%200%200.95%20%200%200%200%200%200.78%20%200%200%200%200%200.36%20%200%200%200%200.4%200'%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D'100%25'%20height%3D'100%25'%20filter%3D'url(%23n)'%2F%3E%3C%2Fsvg%3E\")]",
          "[background-blend-mode:screen,normal,overlay]",
          "[background-size:100%_100%,100%_100%,180px_60px]",
          "shadow-[inset_0_0_0_0.5px_hsl(28_72%_16%/0.6),inset_0_1px_0_hsl(50_100%_99%/0.95),inset_0_2px_0_hsl(48_100%_90%/0.5),inset_0_-1px_0_hsl(28_75%_22%/0.55),inset_0_-8px_16px_-10px_hsl(28_80%_28%/0.45),0_1px_2px_hsl(28_60%_14%/0.4),0_8px_18px_-3px_hsl(38_88%_48%/0.5),0_18px_36px_-12px_hsl(38_85%_46%/0.55)]",
          "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:z-[1]",
          "before:[background:radial-gradient(115%_75%_at_50%_-25%,hsl(50_100%_99%/0.85)_0%,hsl(50_100%_94%/0.32)_28%,transparent_58%),linear-gradient(90deg,hsl(40_85%_46%/0)_0%,hsl(48_100%_88%/0.18)_22%,hsl(36_82%_38%/0)_42%,hsl(48_100%_88%/0.14)_62%,hsl(36_82%_38%/0)_82%,hsl(48_100%_88%/0.18)_96%,hsl(40_85%_46%/0)_100%)]",
          "before:[background-blend-mode:screen]",
          "after:content-[''] after:absolute after:inset-0 after:rounded-[inherit] after:pointer-events-none after:z-[2]",
          "after:[background:linear-gradient(180deg,transparent_64%,hsl(48_100%_90%/0.22)_88%,hsl(50_100%_96%/0.32)_100%),linear-gradient(108deg,transparent_34%,hsl(50_100%_99%/0.9)_50%,transparent_66%)]",
          "after:[background-size:100%_100%,250%_100%] after:[background-position:0_0,140%_0]",
          "after:transition-[background-position,opacity] after:duration-[900ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          "hover:after:[background-position:0_0,-40%_0]",
          "hover:brightness-[1.05] hover:saturate-[1.06]",
          "hover:shadow-[inset_0_0_0_0.5px_hsl(28_72%_16%/0.65),inset_0_1px_0_hsl(50_100%_99%/1),inset_0_2px_0_hsl(48_100%_90%/0.55),inset_0_-1px_0_hsl(28_75%_22%/0.6),inset_0_-8px_18px_-10px_hsl(28_80%_28%/0.5),0_2px_3px_hsl(28_60%_14%/0.45),0_12px_22px_-3px_hsl(38_88%_48%/0.6),0_26px_50px_-14px_hsl(38_85%_46%/0.65)]",
          "active:brightness-[0.95]",
          "active:before:opacity-40 active:after:opacity-30",
          "active:shadow-[inset_0_0_0_0.5px_hsl(22_85%_12%/0.75),inset_0_2.5px_5px_hsl(22_75%_14%/0.6),inset_0_-1px_0_hsl(48_100%_88%/0.2),inset_0_-6px_14px_-6px_hsl(28_80%_22%/0.45),0_1px_1px_hsl(0_0%_0%/0.3)]",
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
