import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Utensils,
  Dumbbell,
  Moon,
  Brain,
  Wind as WindIcon,
  Sparkles,
  ArrowLeft,
  Crown,
  Clock,
  Flame,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVaultArticles, type VaultArticle } from "@/hooks/use-vault-articles";
import EvidenceChip from "@/components/vault/EvidenceChip";
import VaultArticleSheet from "@/components/vault/VaultArticleSheet";
import { hapticImpact } from "@/lib/haptics";

interface VaultCategory {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: typeof Utensils;
  accent: string;
}

const CATEGORIES: VaultCategory[] = [
  {
    id: "recipes",
    title: "Performance Nutrition",
    tagline: "Fuel · macros · meal prep",
    description:
      "Macro-balanced, evidence-led nutrition: protein dosing, workout fueling, the Mediterranean pattern, and caffeine timing — drawn from peer-reviewed sports nutrition, not diet trends.",
    icon: Utensils,
    accent: "hsl(142 70% 50%)",
  },
  {
    id: "training",
    title: "Strength & Conditioning",
    tagline: "Lifts · zone 2 · VO₂max",
    description:
      "Programming principles that hold across decades of S&C research: progressive overload, Zone 2 base, the Norwegian 4×4, and proper deload periodisation.",
    icon: Dumbbell,
    accent: "hsl(18 95% 58%)",
  },
  {
    id: "recovery",
    title: "Recovery & Sleep",
    tagline: "Sleep · light · cold",
    description:
      "What actually works for recovery and sleep architecture: 7–9 h dose, morning light anchor, caffeine cut-off, and cold exposure timing without sabotaging strength gains.",
    icon: Moon,
    accent: "hsl(220 80% 65%)",
  },
  {
    id: "mind",
    title: "Mind & Emotional Skill",
    tagline: "Breath · CBT · MBSR",
    description:
      "Practical, well-evidenced cognitive and breath tools: box breathing, the physiological sigh, mindfulness, and CBT-style cognitive reframing.",
    icon: Brain,
    accent: "hsl(280 70% 65%)",
  },
  {
    id: "nervous-system",
    title: "Nervous System Regulation",
    tagline: "Polyvagal · NSDR · HRV",
    description:
      "Down-regulate a chronically activated nervous system: polyvagal toolkit, NSDR/Yoga Nidra, coherent breathing at the resonance frequency, and the mammalian dive reflex.",
    icon: WindIcon,
    accent: "hsl(190 80% 60%)",
  },
];

const Vault = () => {
  const navigate = useNavigate();
  const { isPremium, subscriptionLoading, profile } = useAuth();
  const [openArticle, setOpenArticle] = useState<{ article: VaultArticle; accent: string } | null>(
    null,
  );

  useEffect(() => {
    if (subscriptionLoading) return;
    if (!isPremium) navigate("/paywall", { replace: true });
  }, [isPremium, subscriptionLoading, navigate]);

  if (!isPremium) return null;

  const firstName =
    (profile as any)?.username || (profile as any)?.display_name || null;

  return (
    <div className="min-h-screen pb-12 px-4 pt-4 safe-top">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 animate-reveal">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 rounded-full flex items-center justify-center bg-card/70 border border-border/60 backdrop-blur active:scale-95 transition"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/40 shadow-[0_0_18px_hsl(var(--gold)/0.25)]">
          <Crown size={11} className="text-gold" strokeWidth={2.6} />
          <span className="text-[10px] font-black tracking-[0.22em] uppercase text-gold">
            Premium
          </span>
        </div>
      </div>

      {/* Hero */}
      <div className="relative mb-6 animate-reveal animate-reveal-delay-1 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-b from-gold/[0.14] via-card/95 to-card shadow-[0_30px_80px_-20px_hsl(var(--gold)/0.45),0_0_60px_hsl(var(--gold)/0.18),inset_0_1px_0_hsl(var(--gold)/0.55)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-4 h-48"
          style={{
            background:
              "radial-gradient(ellipse 65% 85% at 50% 100%, hsl(var(--gold) / 0.5) 0%, hsl(var(--gold) / 0.18) 40%, transparent 75%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--gold)) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />

        <div className="relative px-5 pt-7 pb-5 text-center">
          <div className="mx-auto mb-3 relative w-fit">
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl blur-xl opacity-80"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--gold)/0.55) 0%, transparent 70%)",
              }}
            />
            <div className="relative h-16 w-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold-dark))] shadow-[0_8px_24px_hsl(var(--gold)/0.45),inset_0_1px_0_hsl(0_0%_100%/0.4)]">
              <Sparkles size={30} className="text-background" strokeWidth={2.4} />
            </div>
          </div>

          {firstName && (
            <p className="text-[10px] font-black tracking-[0.22em] uppercase text-gold mb-1">
              Welcome in, {firstName}
            </p>
          )}
          <h1 className="font-display text-[34px] leading-[0.95] font-black tracking-tight mb-2">
            The{" "}
            <span className="bg-gradient-to-b from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold))] bg-clip-text text-transparent drop-shadow-[0_0_18px_hsl(var(--gold)/0.5)]">
              Vault
            </span>
          </h1>
          <p className="text-[12.5px] text-muted-foreground max-w-[310px] mx-auto leading-relaxed">
            A curated, evidence-led library of protocols across nutrition, training,
            recovery and nervous-system regulation — every article cited.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Articles", value: "20" },
              { label: "Categories", value: "5" },
              { label: "Citations", value: "60+" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-background/50 border border-gold/20 px-2 py-2"
              >
                <p className="font-display text-base font-black text-gold leading-none">
                  {s.value}
                </p>
                <p className="text-[9px] tracking-widest uppercase text-muted-foreground mt-1">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="mb-5 rounded-2xl border border-gold/25 bg-gradient-to-r from-gold/10 via-card/80 to-card px-4 py-3 animate-reveal animate-reveal-delay-2 flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-gold/15 border border-gold/40">
          <Flame size={16} className="text-gold" strokeWidth={2.6} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black tracking-wider uppercase text-gold mb-0.5">
            Founding-member library
          </p>
          <p className="text-[12px] text-foreground/85 leading-snug">
            New protocols ship regularly. Every article is graded by evidence tier
            (strong / promising / speculative) and references the underlying research.
          </p>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3 animate-reveal animate-reveal-delay-3">
        {CATEGORIES.map((cat) => (
          <VaultCategoryBlock
            key={cat.id}
            category={cat}
            onOpenArticle={(a) => {
              hapticImpact("light");
              setOpenArticle({ article: a, accent: cat.accent });
            }}
          />
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-[10px] tracking-widest uppercase text-muted-foreground/70">
          Premium member · €17.99/mo or yearly
        </p>
      </div>

      <VaultArticleSheet
        article={openArticle?.article ?? null}
        accent={openArticle?.accent ?? "hsl(var(--gold))"}
        open={!!openArticle}
        onClose={() => setOpenArticle(null)}
      />
    </div>
  );
};

const VaultCategoryBlock = ({
  category,
  onOpenArticle,
}: {
  category: VaultCategory;
  onOpenArticle: (a: VaultArticle) => void;
}) => {
  const Icon = category.icon;
  const [expanded, setExpanded] = useState(false);
  const { data: articles, isLoading } = useVaultArticles(expanded ? category.id : undefined);

  return (
    <div
      className="relative w-full text-left rounded-2xl overflow-hidden border border-border/70 bg-card/80 transition-all duration-200"
      style={{
        background: `linear-gradient(135deg, ${category.accent}15, hsl(var(--card)) 65%)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-50"
        style={{
          background: `radial-gradient(circle, ${category.accent}55 0%, transparent 70%)`,
        }}
      />

      <button
        type="button"
        onClick={() => {
          hapticImpact("light");
          setExpanded((v) => !v);
        }}
        className="relative w-full p-4 text-left"
      >
        <div className="flex items-start gap-3.5">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: `linear-gradient(135deg, ${category.accent}33, ${category.accent}10)`,
              borderColor: `${category.accent}55`,
              boxShadow: `0 0 18px ${category.accent}30`,
            }}
          >
            <Icon size={22} style={{ color: category.accent }} strokeWidth={2.4} />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-black tracking-[0.18em] uppercase mb-1"
              style={{ color: category.accent }}
            >
              {category.tagline}
            </p>
            <p className="font-display text-base font-black leading-tight tracking-tight mb-1">
              {category.title}
            </p>
            <p className="text-[12px] text-muted-foreground leading-snug">
              {category.description}
            </p>
          </div>

          <ChevronRight
            size={18}
            className={cn(
              "shrink-0 mt-1 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="relative px-4 pb-4 pt-1 space-y-2 border-t border-border/30">
          {isLoading && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-card/40 border border-border/40 animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && (articles ?? []).length === 0 && (
            <p className="text-[11px] text-muted-foreground py-3 text-center">No articles yet.</p>
          )}

          {!isLoading &&
            (articles ?? []).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenArticle(a)}
                className="w-full text-left rounded-xl border border-border/50 bg-background/40 hover:border-border hover:bg-background/60 p-3 transition active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[13.5px] font-black tracking-tight leading-tight">
                      {a.title}
                    </p>
                    {a.subtitle && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {a.subtitle}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <EvidenceChip tier={a.evidence_tier} />
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-card/80 border border-border/50 text-[8.5px] font-black tracking-[0.16em] uppercase text-muted-foreground">
                        <Clock size={8} strokeWidth={3} />
                        {a.read_time_min} min
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-1" />
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default Vault;
