/**
 * LifeOSCard — structured daily Life OS plan.
 *
 * Shows today's AI-generated brief across 5 life domains:
 *   TODAY FOCUS · BODY · RECOVERY · FUEL · MIND · ADJUSTMENT
 *
 * Design language: matches the rest of W Coach — dark, gold accents, minimal.
 * Intentionally dense with information but easy to scan — Stripe-tier whitespace.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell, Moon, Flame, Brain, Zap, RefreshCw, Sparkles, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { useLifeOSBrief, type LifeOSDomain, type LifeOSAdjustment } from "@/hooks/use-life-os-brief";
import { toast } from "sonner";

// ── Adjustment badge ──────────────────────────────────────────────────────────

const ADJ_CONFIG = {
  push:   { label: "PUSH",   color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
  hold:   { label: "HOLD",   color: "text-gold",        bg: "bg-gold/10",        border: "border-gold/30"        },
  deload: { label: "DELOAD", color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/30"   },
  swap:   { label: "SWAP",   color: "text-rose-400",    bg: "bg-rose-400/10",    border: "border-rose-400/30"    },
} as const;

// ── Domain card ───────────────────────────────────────────────────────────────

interface DomainCardProps {
  icon:   React.ReactNode;
  label:  string;
  domain: LifeOSDomain;
  tint?:  string; // Tailwind text colour class for the icon
}

const DomainCard = ({ icon, label, domain, tint = "text-gold" }: DomainCardProps) => (
  <div className="rounded-2xl border border-border/40 bg-card/60 p-3.5 flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5">
      <span className={cn("shrink-0", tint)}>{icon}</span>
      <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
    </div>
    <p className="text-[13.5px] font-semibold text-foreground leading-snug">{domain.action}</p>
    <p className="text-[11.5px] text-muted-foreground/70 leading-relaxed">{domain.detail}</p>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const LifeOSCard = () => {
  const { brief, isLoading, generating, genError, generate } = useLifeOSBrief();
  const [expanded, setExpanded] = useState(true);

  const handleGenerate = async (force: boolean) => {
    hapticImpact("medium");
    const result = await generate(force);
    if (!result) {
      toast.error(genError ?? "Couldn't generate brief — try again");
    }
  };

  // ── Skeleton ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/30 bg-card/40 p-4 space-y-3 animate-pulse">
        <div className="h-4 w-1/2 rounded-full bg-border/40" />
        <div className="h-3 w-3/4 rounded-full bg-border/30" />
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-border/20" />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state — no brief yet ──────────────────────────────────────────
  if (!brief && !generating) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-gold/20 bg-gradient-to-b from-gold/[0.04] to-transparent p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_14px_hsl(42_78%_54%/0.4)]">
            <Sparkles size={15} className="text-[hsl(260_18%_4%)]" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold/80">Life OS</p>
            <p className="text-sm font-semibold text-foreground">No plan for today yet</p>
          </div>
        </div>
        <p className="text-[12.5px] text-muted-foreground/70 mb-4 leading-relaxed">
          Generate your personalised daily optimization plan — Body, Recovery, Fuel, and Mind in one view.
        </p>
        <button
          type="button"
          onClick={() => handleGenerate(false)}
          className="w-full rounded-2xl bg-gradient-to-b from-[hsl(42_88%_62%)] to-[hsl(42_78%_48%)] text-[hsl(260_18%_4%)] font-black text-[13px] tracking-wide py-3 shadow-[0_6px_20px_-6px_hsl(42_78%_54%/0.6)] active:scale-[0.98] transition-transform"
        >
          Generate today's plan
        </button>
      </motion.div>
    );
  }

  // ── Generating spinner ──────────────────────────────────────────────────
  if (generating && !brief) {
    return (
      <div className="rounded-3xl border border-gold/20 bg-gradient-to-b from-gold/[0.04] to-transparent p-5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
          <RefreshCw size={15} className="text-gold animate-spin" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold/80">Life OS</p>
          <p className="text-sm text-muted-foreground">Analysing your week…</p>
        </div>
      </div>
    );
  }

  if (!brief) return null;

  const adj      = brief.adjustment as LifeOSAdjustment;
  const adjConf  = ADJ_CONFIG[adj?.label ?? "hold"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 h-24 opacity-60"
        style={{
          background:
            "radial-gradient(55% 100% at 50% 0%, hsl(42 78% 54% / 0.14), transparent 70%)",
        }}
      />

      <div className="relative rounded-3xl border border-gold/20 bg-gradient-to-b from-[hsl(42_78%_54%/0.05)] via-card/95 to-card shadow-[0_20px_56px_-28px_hsl(42_78%_54%/0.4)] overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => { hapticImpact("light"); setExpanded(e => !e); }}
          className="w-full flex items-center gap-3 px-5 pt-4 pb-3.5"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[hsl(42_88%_62%)] to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_14px_hsl(42_78%_54%/0.55)]">
            <Sparkles size={15} className="text-[hsl(260_18%_4%)]" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-gold/80">Life OS · Today</p>
            <p className="text-[14.5px] font-black text-foreground leading-tight truncate mt-0.5">
              {brief.focus}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Adjustment badge */}
            <span className={cn(
              "text-[9px] font-black px-2 py-0.5 rounded-full border tracking-widest",
              adjConf.color, adjConf.bg, adjConf.border,
            )}>
              {adjConf.label}
            </span>
            <ChevronDown
              size={14}
              className={cn(
                "text-muted-foreground/60 transition-transform duration-200",
                !expanded && "-rotate-90",
              )}
            />
          </div>
        </button>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="px-4 pb-4 space-y-3">
                {/* Why */}
                <p className="text-[12px] text-muted-foreground/70 leading-relaxed px-1">
                  {brief.why}
                </p>

                {/* 2×2 domain grid */}
                <div className="grid grid-cols-2 gap-2">
                  <DomainCard
                    icon={<Dumbbell size={13} />}
                    label="Body"
                    domain={brief.body}
                    tint="text-emerald-400"
                  />
                  <DomainCard
                    icon={<Moon size={13} />}
                    label="Recovery"
                    domain={brief.recovery}
                    tint="text-indigo-400"
                  />
                  <DomainCard
                    icon={<Flame size={13} />}
                    label="Fuel"
                    domain={brief.fuel}
                    tint="text-orange-400"
                  />
                  <DomainCard
                    icon={<Brain size={13} />}
                    label="Mind"
                    domain={brief.mind}
                    tint="text-violet-400"
                  />
                </div>

                {/* Adjustment card — full width */}
                {adj && (
                  <div className={cn(
                    "rounded-2xl border p-3.5 flex items-start gap-3",
                    adjConf.bg, adjConf.border,
                  )}>
                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5", adjConf.bg, "border", adjConf.border)}>
                      <Zap size={12} className={adjConf.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={cn("text-[9px] font-black uppercase tracking-widest", adjConf.color)}>
                          Adjustment — {adjConf.label}
                        </p>
                        {adj.readiness != null && (
                          <span className="text-[9px] font-bold text-muted-foreground/60 tabular-nums">
                            {adj.readiness}/100
                          </span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-foreground/80 leading-snug">{adj.detail}</p>
                    </div>
                  </div>
                )}

                {/* Footer: refresh + generated time */}
                <div className="flex items-center justify-between px-1 pt-0.5">
                  <p className="text-[10px] text-muted-foreground/40">
                    {brief.generated_at
                      ? `Generated ${new Date(brief.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Generated today"}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleGenerate(true)}
                    disabled={generating}
                    aria-label="Regenerate Life OS brief"
                    className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-gold transition-colors py-1"
                  >
                    <RefreshCw size={10} className={cn(generating && "animate-spin")} />
                    Refresh
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default LifeOSCard;
