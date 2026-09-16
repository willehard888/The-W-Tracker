import { backOr } from "@/lib/nav";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import EmptyState from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import PageBar from "@/components/ui/page-bar";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";
import { useVaultArticles, type VaultArticleSummary } from "@/hooks/use-vault-articles";
import { useVaultProgress } from "@/hooks/use-vault-progress";
import { useTrialAccess } from "@/hooks/use-trial-access";
import type { PracticeResult } from "@/hooks/use-vault-practice";
import { EVIDENCE_LABEL } from "@/components/vault/EvidenceChip";
import { RECIPE_COUNT } from "@/data/library-counts";
import VaultArticleSheet from "@/components/vault/VaultArticleSheet";
import VaultCover from "@/components/vault/VaultCover";
import TodayPractice from "@/components/vault/TodayPractice";
import PathSheet from "@/components/vault/PathSheet";
import MasterSheet from "@/components/vault/MasterSheet";
import { VAULT_PATHS, PATH_BY_SLUG, DIMENSION_LABEL, type VaultDimension, type VaultPath } from "@/data/vault-paths";
import { VAULT_MASTERS, MASTER_BY_SLUG, type VaultMaster } from "@/data/vault-masters";
import { pathProgress } from "@/lib/vault-loop";
import { track, FUNNEL } from "@/lib/analytics";
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
    id: "wisdom",
    title: "Wisdom",
    tagline: "Twenty-one thinkers, one loop",
    description:
      "The ideas that changed how people live, each with a private reflection, a short practice and a question afterwards. The nine-source course, then Frankl, the Stoics, Aristotle, Campbell, Nietzsche, Greene, Goggins, Thich Nhat Hanh, Kabat-Zinn, Attia, Robbins and two Jung pieces. The chip rates the practice, never the worldview.",
    icon: BookOpen,
    accent: "hsl(350 60% 64%)",
  },
  {
    id: "inner-work",
    title: "Inner Work",
    tagline: "Identity, energy, self-talk",
    description:
      "The honest version of manifestation, energy and self-image work: what research supports (mental contrasting, imagery, self-talk), what is speculative, and how to use both to become who you are training to be.",
    icon: Sparkles,
    accent: "hsl(45 90% 58%)",
  },
  {
    id: "longevity",
    title: "Longevity",
    tagline: "Healthspan, the long game",
    description:
      "The 100-Year Athlete: healthspan over lifespan, ranked by mortality evidence. Aerobic fitness, strength, protein, sleep, metabolic health and connection, with an honest walk through the supplement graveyard.",
    icon: Hourglass,
    accent: "hsl(168 70% 45%)",
  },
  {
    id: "recovery",
    title: "Recovery and Sleep",
    tagline: "Sleep, light, cold, heat",
    description:
      "What recovery is made of: the sleep window, the morning light that times it, the caffeine cut-off that protects it, and cold and heat used at the right hour.",
    icon: Moon,
    accent: "hsl(220 80% 65%)",
  },
  {
    id: "training",
    title: "Strength and Conditioning",
    tagline: "Lifts, zone 2, VO₂max",
    description:
      "Programming principles that hold across decades of research: progressive overload, a zone 2 base, the 4×4 interval, planned deloads, the daily step floor and eight minutes of mobility.",
    icon: Dumbbell,
    accent: "hsl(var(--ember))",
  },
  {
    id: "mind",
    title: "Mind and Emotional Skill",
    tagline: "Breath, reframing, focus",
    description:
      "Practical, well-evidenced tools for the mind: the physiological sigh, box breathing, mindfulness, cognitive reframing, deep work and a five-minute journal.",
    icon: Brain,
    accent: "hsl(280 70% 65%)",
  },
  {
    id: "nervous-system",
    title: "Nervous System",
    tagline: "Polyvagal, NSDR, HRV",
    description:
      "Down-regulate a nervous system that runs hot: the polyvagal map, NSDR, coherent breathing at the resonance frequency, the dive reflex, and four self-hypnosis scripts.",
    icon: WindIcon,
    accent: "hsl(190 80% 60%)",
  },
  {
    id: "recipes",
    title: "Nutrition",
    tagline: "Protein, fuel, timing",
    description:
      "Evidence-led performance nutrition: protein dosing, fuelling around training, the Mediterranean pattern, caffeine timing, hydration and the gut. The meal-prep recipes live one row down.",
    icon: Utensils,
    accent: "hsl(152 68% 50%)",
  },
];

const WISDOM_ACCENT = "hsl(350 60% 64%)";

/** Each dimension borrows the accent of the shelf it is closest to; gold stays the hero's. */
const DIMENSION_ACCENT: Record<VaultDimension, string> = {
  body: "hsl(168 70% 45%)",
  mind: "hsl(280 70% 65%)",
  discipline: "hsl(var(--ember))",
  character: WISDOM_ACCENT,
  purpose: "hsl(220 80% 65%)",
  mastery: "hsl(190 80% 60%)",
};

/**
 * The Vault: a map, then a library. Today's practice opens it (one thinker,
 * one piece, one question); the six paths and the twenty masters are the
 * map; the covers below are the shelf as it was. Pieces open in a sheet;
 * paths and masters open in their own sheets and hand off to the piece.
 */
const Vault = () => {
  const navigate = useNavigate();
  const { isPremium } = useAuth();
  // Trial = full access (the header pill literally promises "Full access ·
  // Nd"). Server RLS agrees since vault_trial_access — has_active_access
  // covers members AND trialists, same gate the AI Coach uses.
  // Gate on `useTrialAccess().loading`, not AuthContext's `subscriptionLoading`:
  // that one clears after an 8 s race even when the profile is still null, and
  // in that state this effect bounced a PAYING member to the paywall on a slow
  // cold start. `loading` here is true until the answer exists — the same flag
  // ProtectedRoute waits on.
  const { isInTrial, loading: accessLoading } = useTrialAccess();
  const hasVaultAccess = isPremium || isInTrial;
  // `wasRead` is the row's state when its sheet opened: a row that turns read
  // while the sheet is up gets its commit-pop when the sheet closes, not
  // while it is hidden behind it.
  const [openArticle, setOpenArticle] = useState<{ article: VaultArticleSummary; accent: string; wasRead: boolean } | null>(
    null,
  );
  const [openPath, setOpenPath] = useState<VaultPath | null>(null);
  const [openMaster, setOpenMaster] = useState<VaultMaster | null>(null);
  const [poppedId, setPoppedId] = useState<string | null>(null);
  // A badge earned inside the sheet waits until the sheet closes: the unlock
  // modal (z-modal) sits under the sheet (z-celebration).
  const [pendingBadge, setPendingBadge] = useState<PracticeResult["newBadge"]>(null);
  const [unlockedBadge, setUnlockedBadge] = useState<PracticeResult["newBadge"]>(null);

  // One cached query for the beat and every category (react-query dedups).
  const { data: allVaultArticles, isLoading } = useVaultArticles();
  const { data: progress } = useVaultProgress();
  const readIds = useMemo(() => new Set((progress ?? []).map((p) => p.article_id)), [progress]);
  const practicedSlugs = useMemo(() => {
    const byId = new Map((allVaultArticles ?? []).map((a) => [a.id, a.slug]));
    const s = new Set<string>();
    for (const p of progress ?? []) if (p.practiced_at) { const slug = byId.get(p.article_id); if (slug) s.add(slug); }
    return s;
  }, [progress, allVaultArticles]);
  const readIdsRef = useRef(readIds);
  readIdsRef.current = readIds;

  useEffect(() => {
    if (accessLoading) return;
    if (!hasVaultAccess) navigate("/paywall", { replace: true });
  }, [hasVaultAccess, accessLoading, navigate]);

  useEffect(() => {
    if (hasVaultAccess) void track(FUNNEL.vaultOpened);
  }, [hasVaultAccess]);

  const accentFor = useCallback(
    (a: VaultArticleSummary) => CATEGORIES.find((c) => c.id === a.category_id)?.accent ?? "hsl(45 90% 58%)",
    [],
  );

  /** Open a piece by slug from anywhere: today's door, a path, a master, a deep link. */
  const openBySlug = useCallback(
    (slug: string) => {
      const article = allVaultArticles?.find((a) => a.slug === slug);
      if (!article) return;
      setOpenPath(null);
      setOpenMaster(null);
      setPoppedId(null);
      setOpenArticle({ article, accent: accentFor(article), wasRead: readIdsRef.current.has(article.id) });
    },
    [allVaultArticles, accentFor],
  );

  // ?lesson= / ?path= / ?master= deep links (Home, the coach, the next-piece
  // button) — open once the library resolves, then strip the param so
  // closing the sheet or going back doesn't reopen it.
  const [searchParams, setSearchParams] = useSearchParams();
  const lessonSlug = searchParams.get("lesson");
  const pathSlug = searchParams.get("path");
  const masterSlug = searchParams.get("master");
  useEffect(() => {
    if (!allVaultArticles) return;
    if (!lessonSlug && !pathSlug && !masterSlug) return;
    if (lessonSlug) openBySlug(lessonSlug);
    else if (pathSlug && PATH_BY_SLUG[pathSlug]) setOpenPath(PATH_BY_SLUG[pathSlug]);
    else if (masterSlug && MASTER_BY_SLUG[masterSlug]) setOpenMaster(MASTER_BY_SLUG[masterSlug]);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("lesson");
      next.delete("path");
      next.delete("master");
      return next;
    }, { replace: true });
  }, [lessonSlug, pathSlug, masterSlug, allVaultArticles, openBySlug, setSearchParams]);

  if (!hasVaultAccess) return null;

  const total = allVaultArticles?.length ?? 0;
  const read = (allVaultArticles ?? []).filter((a) => readIds.has(a.id)).length;
  const left = total - read;
  const practicedCount = practicedSlugs.size;

  const closeArticle = () => {
    if (openArticle && !openArticle.wasRead && readIds.has(openArticle.article.id)) setPoppedId(openArticle.article.id);
    setOpenArticle(null);
    if (pendingBadge) {
      setUnlockedBadge(pendingBadge);
      setPendingBadge(null);
    }
  };

  const onPracticed = (r: PracticeResult) => {
    if (r.newBadge) setPendingBadge(r.newBadge);
    const path = openArticle ? VAULT_PATHS.find((p) => p.steps.includes(openArticle.article.slug)) : undefined;
    if (path && path.steps.every((s) => s === openArticle!.article.slug || practicedSlugs.has(s))) {
      void track(FUNNEL.pathCompleted, { path: path.slug });
    }
  };

  return (
    <div className="min-h-full">
      <PageBar title="Vault" onBack={() => backOr(navigate, "/")} />

      <div className="px-4 pt-4 pb-6">
        {/* Opening beat — the reader's own count, then one whisper of type. */}
        <header className="home-rise">
          {isLoading ? (
            <div className="h-7 w-3/4 rounded-lg bg-card/40 skeleton-block" />
          ) : (
            <h2 className="font-display font-black text-beat leading-[1.04] tracking-tight">
              {practicedCount > 0 ? (
                <>
                  <span className="text-gold glow-gold-text tabular-nums">{fmtInt(practicedCount)}</span>
                  {practicedCount === 1 ? " practice run." : " practices run."} {fmtInt(read)} read.
                </>
              ) : read > 0 ? (
                <>
                  <span className="text-gold glow-gold-text tabular-nums">{fmtInt(read)}</span> read.{" "}
                  {left > 0 ? `${fmtInt(left)} to go.` : "The whole shelf."}
                </>
              ) : total > 0 ? (
                `${fmtInt(total)} pieces. Start with today.`
              ) : (
                "Start with today."
              )}
            </h2>
          )}
          <p className="text-meta text-muted-foreground leading-relaxed mt-2">
            Ideas you use, not content you consume: understand, reflect, practise, integrate. The practice is what counts.
          </p>
        </header>

        {/* Today — one thinker, one piece, one question. The hero. */}
        <div className="home-rise home-rise-1 mt-6">
          <TodayPractice onOpen={openBySlug} />
        </div>

        {/* Paths — six doors in a row, one per dimension. */}
        <section className="home-rise home-rise-2 mt-7" aria-label="Paths">
          <h3 className="font-display text-head font-black tracking-tight leading-none">Paths</h3>
          <p className="text-meta text-muted-foreground mt-1">Pieces in walking order around one change. The next step is always the first you have not practised.</p>
          <div className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {VAULT_PATHS.map((p) => {
              const pp = pathProgress(p.steps, practicedSlugs);
              const accent = DIMENSION_ACCENT[p.dimension];
              return (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => {
                    hapticImpact("light");
                    setOpenPath(p);
                  }}
                  className="press snap-start shrink-0 w-[152px] rounded-2xl border border-border/50 bg-card/40 p-3.5 text-left"
                  style={{ borderColor: pp.complete ? `${accent}66` : undefined }}
                >
                  <span className="block text-label font-bold" style={{ color: accent }}>
                    {DIMENSION_LABEL[p.dimension]}
                  </span>
                  <span className="mt-1 block font-display text-read font-black tracking-tight leading-tight min-h-[2.4em]">
                    {p.title}
                  </span>
                  <span className="mt-2 block text-label text-muted-foreground tabular-nums">
                    {pp.complete ? "Walked" : `${pp.done} of ${pp.total} practised`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Masters — the thinkers as lenses. Type only; a name and its tradition. */}
        <section className="home-rise home-rise-3 mt-7" aria-label="Masters">
          <h3 className="font-display text-head font-black tracking-tight leading-none">Masters</h3>
          <p className="text-meta text-muted-foreground mt-1">Twenty thinkers, each a lens. Tap a name for their ideas and what kind of claim they make.</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-5">
            {VAULT_MASTERS.map((m) => {
              const mine = (allVaultArticles ?? []).filter((a) => a.master_slug === m.slug);
              const done = mine.filter((a) => practicedSlugs.has(a.slug)).length;
              return (
                <li key={m.slug} className="border-b border-border/35">
                  <button
                    type="button"
                    onClick={() => {
                      hapticImpact("light");
                      setOpenMaster(m);
                    }}
                    className="w-full py-2.5 text-left"
                  >
                    <span className="block font-display text-dense font-black tracking-tight leading-tight truncate">{m.name}</span>
                    <span className="block text-label text-muted-foreground leading-snug truncate" style={done ? { color: WISDOM_ACCENT } : undefined}>
                      {done ? `${done} practised` : m.tradition}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* The shelf — covers are the categories. No frame, no strip below. */}
        <section className="mt-8" aria-label="The shelf">
          <h3 className="font-display text-head font-black tracking-tight leading-none">The shelf</h3>
          <p className="text-meta text-muted-foreground mt-1">Every piece is graded by evidence tier and cites its research.</p>
          <div className="mt-4 space-y-3">
            {CATEGORIES.map((cat, i) => (
              <div key={cat.id} className={cn(i < 4 && "animate-fade-in-up")} style={i < 4 ? { animationDelay: `${120 + i * 45}ms` } : undefined}>
                <VaultCategoryBlock
                  category={cat}
                  poppedId={poppedId}
                  practicedSlugs={practicedSlugs}
                  onOpenArticle={(a) => {
                    hapticImpact("light");
                    setPoppedId(null);
                    setOpenArticle({ article: a, accent: cat.accent, wasRead: readIds.has(a.id) });
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* No hardcoded price — a US/UK member paid a different number than the
            euro list price, and the store price is the only truth. */}
        <p className="mt-8 text-center text-label text-muted-foreground/75">{isPremium ? "Premium member" : "Full access during your trial"}</p>

        <VaultArticleSheet
          article={openArticle?.article ?? null}
          accent={openArticle?.accent ?? "hsl(var(--gold))"}
          open={!!openArticle}
          onClose={closeArticle}
          onOpenSlug={openBySlug}
          onPracticed={onPracticed}
        />
        <PathSheet
          path={openPath}
          accent={openPath ? DIMENSION_ACCENT[openPath.dimension] : WISDOM_ACCENT}
          open={!!openPath}
          onClose={() => setOpenPath(null)}
          articles={allVaultArticles ?? []}
          practiced={practicedSlugs}
          onOpenSlug={openBySlug}
        />
        <MasterSheet
          master={openMaster}
          accent={WISDOM_ACCENT}
          open={!!openMaster}
          onClose={() => setOpenMaster(null)}
          articles={allVaultArticles ?? []}
          practiced={practicedSlugs}
          onOpenSlug={openBySlug}
        />
        <BadgeUnlockModal badge={unlockedBadge} onClose={() => setUnlockedBadge(null)} />
      </div>
    </div>
  );
};

const VaultCategoryBlock = ({
  category,
  poppedId,
  practicedSlugs,
  onOpenArticle,
}: {
  category: VaultCategory;
  poppedId: string | null;
  practicedSlugs: ReadonlySet<string>;
  onOpenArticle: (a: VaultArticleSummary) => void;
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
          <p className="absolute top-3 right-3 z-10 text-label font-bold tabular-nums text-white/80">
            {readCount} of {articles.length} read
          </p>
        )}
        <div className="absolute inset-x-0 bottom-0 z-10 p-4 pr-10">
          <p className="flex items-center gap-1.5 text-label font-semibold mb-1" style={{ color: category.accent }}>
            <Icon size={12} strokeWidth={2.6} aria-hidden />
            {category.tagline}
          </p>
          <p className="font-display text-head font-black leading-none tracking-tight text-white drop-shadow-[0_2px_8px_hsl(0_0%_0%/0.6)]">
            {category.title}
          </p>
        </div>
        <ChevronRight
          size={16}
          className={cn("absolute bottom-4 right-4 z-10 text-white/75 transition-transform", expanded && "rotate-90")}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="px-1 divide-y divide-border/35">
          <p className="py-3 text-meta text-muted-foreground leading-snug">{category.description}</p>

          {/* Recipes category → the full meal-prep recipe collection (poster
              style + batch scaler). A quiet row leading the pieces. */}
          {category.id === "recipes" && (
            <button type="button" onClick={() => navigate("/recipes")} className="w-full flex items-center gap-3 py-3 text-left">
              <Utensils size={16} className="text-muted-foreground shrink-0" aria-hidden />
              <span className="flex-1 min-w-0">
                <span className="block text-dense font-bold leading-tight">Meal-prep recipes</span>
                <span className="block text-meta text-muted-foreground leading-snug mt-0.5">
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
            <ErrorState size="compact" title="Couldn't load articles" onRetry={refetch} />
          )}

          {!isLoading && !error && articles.length === 0 && (
            <EmptyState size="compact" icon={BookOpen} title="No articles yet" />
          )}

          {!isLoading &&
            articles.map((a) => {
              const isRead = readIds.has(a.id);
              const isPracticed = practicedSlugs.has(a.slug);
              const master = a.master_slug ? MASTER_BY_SLUG[a.master_slug] : undefined;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onOpenArticle(a)}
                  className={cn("w-full flex items-start gap-3 py-3 text-left", poppedId === a.id && "commit-pop")}
                >
                  {a.lesson_number != null && (
                    <span
                      className="w-5 shrink-0 font-display text-dense font-black tabular-nums leading-tight"
                      style={{ color: category.accent }}
                    >
                      {a.lesson_number}
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block font-display text-dense font-black tracking-tight leading-tight">{a.title}</span>
                    {a.subtitle && (
                      <span className="block text-meta text-muted-foreground leading-snug mt-0.5 truncate">{a.subtitle}</span>
                    )}
                    <span className="text-label font-bold text-muted-foreground block mt-1.5" style={isRead ? { color: category.accent } : undefined}>
                      {isPracticed ? "Practised" : `${EVIDENCE_LABEL[a.evidence_tier]} · ${a.read_time_min} min`}
                      {master ? ` · ${master.name}` : ""}
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
