import { useEffect, useRef, useState } from "react";
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
  Check,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtInt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import PageBar from "@/components/ui/page-bar";
import { useVaultArticles, type VaultArticle } from "@/hooks/use-vault-articles";
import { useVaultProgress } from "@/hooks/use-vault-progress";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { EVIDENCE_LABEL } from "@/components/vault/EvidenceChip";
import { RECIPE_COUNT } from "@/data/library-counts";
import VaultArticleSheet from "@/components/vault/VaultArticleSheet";
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

/**
 * The library, one shelf, covers lead. The opening line is the reader's own
 * count; the covers are the categories (no frame around them); the pieces
 * inside a category are hairline rows.
 */
const Vault = () => {
  const navigate = useNavigate();
  const { isPremium, subscriptionLoading } = useAuth();
  // Trial = full access (the header pill literally promises "Full access ·
  // Nd"). Server RLS agrees since vault_trial_access — has_active_access
  // covers members AND trialists, same gate the AI Coach uses.
  const { isInTrial } = useTrialAccess();
  const hasVaultAccess = isPremium || isInTrial;
  // `wasRead` is the row's state when its sheet opened: a row that turns read
  // while the sheet is up gets its commit-pop when the sheet closes, not
  // while it is hidden behind it.
  const [openArticle, setOpenArticle] = useState<{ article: VaultArticle; accent: string; wasRead: boolean } | null>(
    null,
  );
  const [poppedId, setPoppedId] = useState<string | null>(null);

  // One cached query for the beat and every category (react-query dedups).
  const { data: allVaultArticles, isLoading } = useVaultArticles();
  const { data: progress } = useVaultProgress();
  const readIds = new Set((progress ?? []).map((p) => p.article_id));
  const readIdsRef = useRef(readIds);
  readIdsRef.current = readIds;

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
      setOpenArticle({ article, accent, wasRead: readIdsRef.current.has(article.id) });
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("lesson");
      return next;
    }, { replace: true });
  }, [lessonSlug, allVaultArticles, setSearchParams]);

  if (!hasVaultAccess) return null;

  const total = allVaultArticles?.length ?? 0;
  const read = (allVaultArticles ?? []).filter((a) => readIds.has(a.id)).length;
  const left = total - read;

  const closeArticle = () => {
    if (openArticle && !openArticle.wasRead && readIds.has(openArticle.article.id)) setPoppedId(openArticle.article.id);
    setOpenArticle(null);
  };

  return (
    <div className="min-h-full">
      <PageBar title="Vault" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6">
        {/* Opening beat — the reader's own count, then one whisper of type. */}
        <header className="home-rise">
          {isLoading ? (
            <div className="h-7 w-3/4 rounded-lg bg-card/40 skeleton-block" />
          ) : (
            <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
              {read > 0 ? (
                <>
                  <span className="text-gold glow-gold-text tabular-nums">{fmtInt(read)}</span> read.{" "}
                  {left > 0 ? `${fmtInt(left)} to go.` : "The whole shelf."}
                </>
              ) : total > 0 ? (
                `${fmtInt(total)} pieces. Start anywhere.`
              ) : (
                "Start anywhere."
              )}
            </h2>
          )}
          <p className="text-[12px] text-muted-foreground leading-relaxed mt-2">
            Every piece is graded by evidence tier and cites its research. New protocols ship regularly.
          </p>
        </header>

        {/* The shelf — covers are the categories. No frame, no strip below. */}
        <div className="mt-5 space-y-3">
          {CATEGORIES.map((cat, i) => (
            <div key={cat.id} className="animate-fade-in-up" style={{ animationDelay: `${120 + i * 45}ms` }}>
              <VaultCategoryBlock
                category={cat}
                poppedId={poppedId}
                onOpenArticle={(a) => {
                  hapticImpact("light");
                  setOpenArticle({ article: a, accent: cat.accent, wasRead: readIds.has(a.id) });
                }}
              />
            </div>
          ))}
        </div>

        {/* No hardcoded price — a US/UK member paid a different number than the
            euro list price, and the store price is the only truth. */}
        <p className="mt-8 text-center text-[11px] text-muted-foreground/70">Premium member</p>

        <VaultArticleSheet
          article={openArticle?.article ?? null}
          accent={openArticle?.accent ?? "hsl(var(--gold))"}
          open={!!openArticle}
          onClose={closeArticle}
        />
      </div>
    </div>
  );
};

const VaultCategoryBlock = ({
  category,
  poppedId,
  onOpenArticle,
}: {
  category: VaultCategory;
  poppedId: string | null;
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
  const readIds = new Set((progress ?? []).map((p) => p.article_id));
  const readCount = articles.filter((a) => readIds.has(a.id)).length;

  return (
    <div>
      {/* The cover IS the category: art, name, a read count. Tap to open the shelf. */}
      <button
        type="button"
        onClick={() => {
          hapticImpact("light");
          setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
        className="relative block w-full aspect-[16/7] rounded-2xl overflow-hidden text-left"
      >
        <VaultCover id={category.id} accent={category.accent} />
        {articles.length > 0 && (
          <p className="absolute top-3 right-3 z-10 text-[11px] font-bold tabular-nums text-white/80">
            {readCount} of {articles.length} read
          </p>
        )}
        <div className="absolute inset-x-0 bottom-0 z-10 p-4 pr-10">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold mb-1" style={{ color: category.accent }}>
            <Icon size={12} strokeWidth={2.6} aria-hidden />
            {category.tagline}
          </p>
          <p className="font-display text-[19px] font-black leading-none tracking-tight text-white drop-shadow-[0_2px_8px_hsl(0_0%_0%/0.6)]">
            {category.title}
          </p>
        </div>
        <ChevronRight
          size={16}
          className={cn("absolute bottom-4 right-4 z-10 text-white/70 transition-transform", expanded && "rotate-90")}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="px-1 divide-y divide-border/35">
          <p className="py-3 text-[12px] text-muted-foreground leading-snug">{category.description}</p>

          {/* Recipes category → the full meal-prep recipe collection (poster
              style + batch scaler). A quiet row leading the pieces. */}
          {category.id === "recipes" && (
            <button type="button" onClick={() => navigate("/recipes")} className="w-full flex items-center gap-3 py-3 text-left">
              <Utensils size={16} className="text-muted-foreground shrink-0" aria-hidden />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold leading-tight">Meal-prep recipes</span>
                <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">
                  {RECIPE_COUNT} high-protein recipes · scale 1×–5× · storage &amp; reheat
                </span>
              </span>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" aria-hidden />
            </button>
          )}

          {isLoading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="py-3">
                <div className="h-9 rounded-lg bg-card/40 skeleton-block" />
              </div>
            ))}

          {!isLoading && error && (
            <div className="py-4 text-center">
              {/* Real retry — this page has no pull-to-refresh, so the old
                  "Pull to refresh" copy asked for something impossible. */}
              <p className="text-[12px] text-rose-400/90 mb-2">Couldn't load articles.</p>
              <Button variant="gold-outline" size="sm" className="min-h-11" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          )}

          {!isLoading && !error && articles.length === 0 && (
            <EmptyState size="compact" icon={BookOpen} title="No articles yet" />
          )}

          {!isLoading &&
            articles.map((a) => {
              const isRead = readIds.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onOpenArticle(a)}
                  className={cn("w-full flex items-start gap-3 py-3 text-left", poppedId === a.id && "commit-pop")}
                >
                  {a.lesson_number != null && (
                    <span
                      className="w-5 shrink-0 font-display text-[13px] font-black tabular-nums leading-tight"
                      style={{ color: category.accent }}
                    >
                      {a.lesson_number}
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block font-display text-[13px] font-black tracking-tight leading-tight">{a.title}</span>
                    {a.subtitle && (
                      <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5 truncate">{a.subtitle}</span>
                    )}
                    <span className="eyebrow-sm block mt-1.5" style={isRead ? { color: category.accent } : undefined}>
                      {EVIDENCE_LABEL[a.evidence_tier]} · {a.read_time_min} min
                    </span>
                  </span>
                  {isRead ? (
                    <Check size={14} className="shrink-0 mt-0.5" style={{ color: category.accent }} aria-hidden />
                  ) : (
                    <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                  )}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default Vault;
