import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Utensils,
  Dumbbell,
  Moon,
  Brain,
  Wind as WindIcon,
  Sparkles,
  Hourglass,
  ArrowLeft,
  Crown,
  Clock,
  Flame,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/ui/empty-state";
import { useVaultArticles, type VaultArticle } from "@/hooks/use-vault-articles";
import { useVaultProgress } from "@/hooks/use-vault-progress";
import { useTrialAccess } from "@/hooks/use-trial-access";
import EvidenceChip from "@/components/vault/EvidenceChip";
import { RECIPE_COUNT } from "@/data/library-counts";
import VaultArticleSheet from "@/components/vault/VaultArticleSheet";
import CourseProgressRing from "@/components/vault/CourseProgressRing";
import VaultCover from "@/components/vault/VaultCover";
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
    accent: "hsl(152 68% 50%)",
  },
  {
    id: "training",
    title: "Strength & Conditioning",
    tagline: "Lifts · zone 2 · VO₂max",
    description:
      "Programming principles that hold across decades of S&C research: progressive overload, Zone 2 base, the Norwegian 4×4, and proper deload periodisation.",
    icon: Dumbbell,
    accent: "hsl(var(--ember))",
  },
  {
    id: "longevity",
    title: "Longevity",
    tagline: "Healthspan · VO₂max · the long game",
    description:
      "The 100-Year Athlete: healthspan over lifespan, ranked by mortality evidence — VO₂max, strength, protein, sleep, metabolic health and connection, with an honest walk through the supplement graveyard.",
    icon: Hourglass,
    accent: "hsl(168 70% 45%)",
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
  {
    id: "inner-work",
    title: "Inner Work",
    tagline: "Identity · energy · manifestation",
    description:
      "The honest version of manifestation, energy and self-image work: what research supports (mental contrasting, imagery, self-talk), what is speculative — and how to use both to become who you're training to be.",
    icon: Sparkles,
    accent: "hsl(45 90% 58%)",
  },
];

const Vault = () => {
  const navigate = useNavigate();
  const { isPremium, subscriptionLoading, profile } = useAuth();
  // Trial = full access (the header pill literally promises "Full access ·
  // Nd"). Server RLS agrees since vault_trial_access — has_active_access
  // covers members AND trialists, same gate the AI Coach uses.
  const { isInTrial } = useTrialAccess();
  const hasVaultAccess = isPremium || isInTrial;
  const [openArticle, setOpenArticle] = useState<{ article: VaultArticle; accent: string } | null>(
    null,
  );

  // Hero stats derived from the real library so they never drift as content
  // ships. Same cached query the category sections use (react-query dedups).
  const { data: allVaultArticles } = useVaultArticles();

  useEffect(() => {
    if (subscriptionLoading) return;
    if (!hasVaultAccess) navigate("/paywall", { replace: true });
  }, [hasVaultAccess, subscriptionLoading, navigate]);

  // ?lesson=<slug> deep link (Daily Insight card and coach references) — open
  // the article sheet once the library resolves, then strip the param so
  // closing the sheet or going back doesn't reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonSlug = searchParams.get("lesson");
  useEffect(() => {
    if (!lessonSlug || !allVaultArticles) return;
    const article = allVaultArticles.find((a) => a.slug === lessonSlug);
    if (article) {
      const accent =
        CATEGORIES.find((c) => c.id === article.category_id)?.accent ?? "hsl(45 90% 58%)";
      setOpenArticle({ article, accent });
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("lesson");
      return next;
    }, { replace: true });
  }, [lessonSlug, allVaultArticles, setSearchParams]);

  if (!hasVaultAccess) return null;

  const firstName =
    profile?.username || profile?.display_name || null;

  // Real counts; fall back to a dash until the cached list resolves (avoids a
  // "0" flash) rather than to hardcoded numbers that would drift.
  const articleCount = allVaultArticles?.length ?? null;
  const citationCount =
    allVaultArticles?.reduce((n, a) => n + (a.references_json?.length ?? 0), 0) ?? null;
  const heroStats = [
    { label: "Articles", value: articleCount != null ? String(articleCount) : "—" },
    { label: "Categories", value: String(CATEGORIES.length) },
    { label: "Citations", value: citationCount != null ? `${citationCount}` : "—" },
  ];

  return (
    <div className="min-h-full pb-12 px-4 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 animate-reveal">
        <button
          onClick={() => navigate(-1)}
          className="shrink-0 -ml-1 h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground active:scale-90 active:text-foreground transition-transform"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/40 shadow-[0_0_18px_hsl(var(--gold)/0.25)]">
          <Crown size={11} className="text-gold" strokeWidth={2.6} />
          <span className="text-[11px] font-black tracking-[0.22em] uppercase text-gold">
            Premium
          </span>
        </div>
      </div>

      {/* Hero — clean & precise (calm canvas, one gold accent, sharp type) */}
      <div className="relative mb-5 animate-reveal animate-reveal-delay-1 surface-card px-5 pt-7 pb-5 text-center">
        <div className="mx-auto mb-3 h-14 w-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold-dark))] shadow-[0_6px_20px_-6px_hsl(var(--gold)/0.5)]">
          <Sparkles size={26} className="text-background" strokeWidth={2.4} />
        </div>

        {firstName && (
          <p className="text-[11px] font-black tracking-[0.22em] uppercase text-gold/80 mb-1.5">
            Welcome in, {firstName}
          </p>
        )}
        <h1 className="font-display text-2xl leading-none font-black tracking-tight mb-2">
          The <span className="text-gradient-gold">Vault</span>
        </h1>
        <p className="text-[12px] text-muted-foreground max-w-[300px] mx-auto leading-relaxed">
          A curated, evidence-led library of protocols across nutrition, training,
          recovery, nervous-system regulation and inner work — every article cited.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {heroStats.map((s) => (
            <div key={s.label} className="rounded-xl bg-secondary/30 border border-border/50 px-2 py-2">
              <p className="font-display text-base font-black text-gold leading-none tabular-nums">
                {s.value}
              </p>
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Banner — calm, single hairline */}
      <div className="mb-5 surface-card px-4 py-3 animate-reveal animate-reveal-delay-2 flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-gold/10 border border-gold/30">
          <Flame size={15} className="text-gold" strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black tracking-[0.22em] uppercase text-gold/85 mb-0.5">
            Founding-member library
          </p>
          <p className="text-[12px] text-muted-foreground leading-snug">
            New protocols ship regularly. Every article is graded by evidence tier
            and references the underlying research.
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
        {/* No hardcoded price — a US/UK member paid a different number than the
            euro list price, and the store price is the only truth. */}
        <p className="text-[11px] tracking-widest uppercase text-muted-foreground/70">
          Premium member
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
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  // Fetch all articles once (cached) and filter locally — avoids per-category refetches
  // and ensures content is ready the moment the user expands a category.
  const { data: allArticles, isLoading, error, refetch } = useVaultArticles();
  const { data: progress } = useVaultProgress();
  const articles = (allArticles ?? []).filter((a) => a.category_id === category.id);
  const completedIds = new Set((progress ?? []).map((p) => p.article_id));
  const doneCount = articles.filter((a) => completedIds.has(a.id)).length;

  return (
    <div className="relative w-full text-left rounded-2xl overflow-hidden border border-border/60 bg-card/40 transition-colors duration-200">
      <button
        type="button"
        onClick={() => {
          hapticImpact("light");
          setExpanded((v) => !v);
        }}
        className="relative block w-full text-left active:scale-[0.995] transition-transform"
      >
        {/* Premium cover banner — hand-crafted SVG art per category */}
        <div className="relative aspect-[16/7] overflow-hidden">
          <VaultCover id={category.id} accent={category.accent} />
          <div className="absolute top-3 right-3 z-10">
            <CourseProgressRing done={doneCount} total={articles.length} color={category.accent} />
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={13} style={{ color: category.accent }} strokeWidth={2.6} />
              <p className="text-[11px] font-black tracking-[0.22em] uppercase" style={{ color: category.accent }}>
                {category.tagline}
              </p>
            </div>
            <p className="font-display text-[19px] font-black leading-none tracking-tight text-white drop-shadow-[0_2px_8px_hsl(0_0%_0%/0.6)]">
              {category.title}
            </p>
          </div>
        </div>

        {/* Description + expand caret */}
        <div className="flex items-center gap-2 px-4 py-3">
          <p className="text-[12px] text-muted-foreground leading-snug flex-1">
            {category.description}
          </p>
          <ChevronRight
            size={15}
            className={cn("text-muted-foreground shrink-0 transition-transform", expanded && "rotate-90")}
          />
        </div>
      </button>

      {expanded && (
        <div className="relative px-4 pb-4 pt-1 space-y-2 border-t border-border/30">
          {/* Recipes category → the full meal-prep recipe collection (poster
              style + batch scaler). Leads the section above the articles. */}
          {category.id === "recipes" && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate("/recipes"); }}
              className="w-full text-left rounded-xl border border-gold/35 bg-gradient-to-br from-gold/[0.1] via-card/90 to-card p-3.5 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0">
                  <Utensils size={18} className="text-[hsl(260_18%_4%)]" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold/85 mb-0.5">Meal-prep recipes</p>
                  <p className="text-[12px] font-bold leading-tight">{RECIPE_COUNT} high-protein recipes · scale 1×–5× · storage &amp; reheat</p>
                </div>
                <ChevronRight size={16} className="text-gold shrink-0" />
              </div>
            </button>
          )}

          {isLoading && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-card/40 border border-border/40 skeleton-block" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="py-3 text-center">
              {/* Real retry — this page has no pull-to-refresh, so the old
                  "Pull to refresh" copy asked for something impossible. */}
              <p className="text-[12px] text-rose-400/90 mb-2">Couldn't load articles.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-1.5 text-[12px] font-bold text-gold active:scale-95 transition"
              >
                Try again
              </button>
            </div>
          )}

          {!isLoading && !error && articles.length === 0 && (
            <EmptyState size="compact" icon={BookOpen} title="No articles yet" />
          )}

          {!isLoading &&
            articles.map((a) => {
              const done = completedIds.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenArticle(a);
                  }}
                  className="w-full text-left rounded-xl border border-border/50 bg-background/40 hover:border-border hover:bg-background/60 p-3 transition active:scale-[0.99]"
                  style={
                    done
                      ? {
                          borderColor: `${category.accent}55`,
                          background: `linear-gradient(135deg, ${category.accent}10, hsl(var(--background) / 0.4) 80%)`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {a.lesson_number && (
                          <span
                            className="text-[10px] font-black tabular-nums tracking-wider uppercase shrink-0"
                            style={{ color: category.accent }}
                          >
                            L{a.lesson_number}
                          </span>
                        )}
                        <p className="font-display text-[13px] font-black tracking-tight leading-tight">
                          {a.title}
                        </p>
                      </div>
                      {a.subtitle && (
                        <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                          {a.subtitle}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <EvidenceChip tier={a.evidence_tier} />
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-card/80 border border-border/50 text-[10px] font-black tracking-[0.22em] uppercase text-muted-foreground">
                          <Clock size={10} strokeWidth={3} />
                          {a.read_time_min} min
                        </span>
                        {done && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black tracking-[0.22em] uppercase"
                            style={{
                              background: `${category.accent}22`,
                              color: category.accent,
                              border: `1px solid ${category.accent}55`,
                            }}
                          >
                            ✓ Done
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default Vault;
