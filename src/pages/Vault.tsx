import { backOr } from "@/lib/nav";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Utensils, ChevronRight, BookOpen } from "lucide-react";
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
import { RECIPE_COUNT } from "@/data/library-counts";
import VaultArticleSheet from "@/components/vault/VaultArticleSheet";
import VaultCover from "@/components/vault/VaultCover";
import TodayPractice from "@/components/vault/TodayPractice";
import PathSheet from "@/components/vault/PathSheet";
import MasterSheet from "@/components/vault/MasterSheet";
import VaultPieceRow, { pieceMeta } from "@/components/vault/VaultPieceRow";
import { CATEGORIES, DIMENSION_ACCENT, WISDOM_ACCENT, accentOf, type VaultCategory } from "@/components/vault/categories";
import { VAULT_PATHS, PATH_BY_SLUG, DIMENSION_LABEL, type VaultPath } from "@/data/vault-paths";
import { VAULT_MASTERS, MASTER_BY_SLUG, type VaultMaster } from "@/data/vault-masters";
import { pathProgress } from "@/lib/vault-loop";
import { track, FUNNEL } from "@/lib/analytics";
import { hapticImpact } from "@/lib/haptics";

/**
 * The Vault: a map, then a library. Today's practice opens it (one thinker,
 * one piece, one question); the six paths and the masters are the
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
  const { data: allVaultArticles, isLoading, error: loadError, refetch } = useVaultArticles();
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

  /** Open a piece by slug from anywhere: today's door, a path, a master, a deep link. */
  const openBySlug = useCallback(
    (slug: string) => {
      const article = allVaultArticles?.find((a) => a.slug === slug);
      if (!article) return;
      setOpenPath(null);
      setOpenMaster(null);
      setPoppedId(null);
      setOpenArticle({ article, accent: accentOf(article.category_id), wasRead: readIdsRef.current.has(article.id) });
    },
    [allVaultArticles],
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

        {loadError && !allVaultArticles ? (
          <div className="mt-8">
            <ErrorState title="Couldn't load the Vault" onRetry={refetch} />
          </div>
        ) : (
        <>
        {/* Today — one thinker, one piece, one question. The hero. */}
        <div className="home-rise home-rise-1 mt-6">
          <TodayPractice onOpen={openBySlug} />
        </div>

        {/* Paths — six doors in a row, one per dimension. */}
        <section className="home-rise home-rise-2 mt-7" aria-label="Paths">
          <h3 className="font-display text-head font-black tracking-tight leading-none">Paths</h3>
          <p className="text-meta text-muted-foreground mt-1">Pieces in walking order around one change. The next step is always the first you have not practised.</p>
          {/* scroll-px-4: mandatory snapping aligns a card to the scroller's
              edge, which is the SCREEN edge here (-mx-4) — without it the
              first card sat flush at x = 0, outside the page gutter. */}
          <div className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
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
          <p className="text-meta text-muted-foreground mt-1">{VAULT_MASTERS.length} thinkers, each a lens. Tap a name for their ideas and what kind of claim they make.</p>
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
        <section className="home-rise home-rise-4 mt-8" aria-label="The shelf">
          <h3 className="font-display text-head font-black tracking-tight leading-none">The shelf</h3>
          <p className="text-meta text-muted-foreground mt-1">Every piece is graded by evidence tier and cites its research.</p>
          <div className="mt-4 space-y-3">
            {CATEGORIES.map((cat) => (
              <VaultCategoryBlock
                key={cat.id}
                category={cat}
                articles={(allVaultArticles ?? []).filter((a) => a.category_id === cat.id)}
                loading={isLoading}
                readIds={readIds}
                poppedId={poppedId}
                practicedSlugs={practicedSlugs}
                onOpenArticle={(a) => {
                  hapticImpact("light");
                  setPoppedId(null);
                  setOpenArticle({ article: a, accent: cat.accent, wasRead: readIds.has(a.id) });
                }}
              />
            ))}
          </div>
        </section>
        </>
        )}

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
  articles,
  loading,
  readIds,
  poppedId,
  practicedSlugs,
  onOpenArticle,
}: {
  category: VaultCategory;
  /** This shelf's pieces, filtered from the page's one cached query. */
  articles: VaultArticleSummary[];
  loading: boolean;
  readIds: ReadonlySet<string>;
  poppedId: string | null;
  practicedSlugs: ReadonlySet<string>;
  onOpenArticle: (a: VaultArticleSummary) => void;
}) => {
  const Icon = category.icon;
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const readCount = articles.filter((a) => readIds.has(a.id)).length;
  const panelId = `vault-shelf-${category.id}`;

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
        aria-controls={panelId}
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
        <div id={panelId} className="px-1 divide-y divide-border/35">
          <p className="py-3 text-dense text-muted-foreground leading-snug">{category.description}</p>

          {/* Recipes category → the full meal-prep recipe collection (poster
              style + batch scaler). A quiet row leading the pieces. */}
          {category.id === "recipes" && (
            <button type="button" onClick={() => navigate("/recipes")} className="w-full flex items-center gap-3 py-3.5 text-left">
              <Utensils size={16} className="text-muted-foreground shrink-0" aria-hidden />
              <span className="flex-1 min-w-0">
                <span className="block font-display text-dense font-black tracking-tight leading-tight">Meal-prep recipes</span>
                <span className="block text-meta text-muted-foreground leading-snug mt-0.5">
                  {RECIPE_COUNT} high-protein recipes · scale 1×–5× · storage and reheat
                </span>
              </span>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" aria-hidden />
            </button>
          )}

          {loading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="py-3.5">
                <div className="h-9 rounded-lg bg-card/40 skeleton-block" />
              </div>
            ))}

          {!loading && articles.length === 0 && <EmptyState size="compact" icon={BookOpen} title="No articles yet" />}

          {!loading &&
            articles.map((a) => {
              const master = a.master_slug ? MASTER_BY_SLUG[a.master_slug] : undefined;
              return (
                <VaultPieceRow
                  key={a.id}
                  lead={
                    a.lesson_number != null ? (
                      <span className="w-5 shrink-0 font-display text-dense font-black tabular-nums leading-tight" style={{ color: category.accent }}>
                        {a.lesson_number}
                      </span>
                    ) : undefined
                  }
                  title={a.title}
                  subtitle={a.subtitle}
                  meta={pieceMeta(a, practicedSlugs.has(a.slug), master?.name)}
                  done={readIds.has(a.id)}
                  accent={category.accent}
                  className={poppedId === a.id ? "commit-pop" : undefined}
                  onClick={() => onOpenArticle(a)}
                />
              );
            })}
        </div>
      )}
    </div>
  );
};

export default Vault;
