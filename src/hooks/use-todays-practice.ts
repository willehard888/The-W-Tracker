import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useVaultArticles, type VaultArticleSummary } from "@/hooks/use-vault-articles";
import { useVaultProgress } from "@/hooks/use-vault-progress";
import { useRecentCheckins } from "@/hooks/use-recent-checkins";
import { localDayIndex } from "@/lib/daily-rotation";
import { pickTodaysPractice, signalsFromCheckins } from "@/lib/vault-recommend";
import { pathProgress } from "@/lib/vault-loop";
import { MASTER_BY_SLUG, type VaultMaster } from "@/data/vault-masters";
import type { VaultPath } from "@/data/vault-paths";

/**
 * Today in the Vault: one piece, chosen from the member's own week. Every
 * input is a query the app already keeps warm (the library summaries are
 * prefetched on idle; check-ins and progress are cached), so Home pays no
 * extra round trip for it.
 */
export interface TodaysPractice {
  article: VaultArticleSummary;
  path: VaultPath;
  master: VaultMaster | null;
  reason: string;
  /** A practice was recorded today (local day) — the ritual is done. */
  doneToday: boolean;
  /** Where the member is on the path this piece belongs to. */
  progress: { done: number; total: number };
}

const isLocalToday = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

export const useTodaysPractice = (): { pick: TodaysPractice | null; loading: boolean } => {
  const { profile } = useAuth();
  const { data: articles, isLoading: articlesLoading } = useVaultArticles();
  const { data: progress } = useVaultProgress();
  const { data: checkins } = useRecentCheckins(7);

  return useMemo(() => {
    if (!articles?.length) return { pick: null, loading: articlesLoading };
    const bySlug = new Map(articles.map((a) => [a.slug, a]));
    const byId = new Map(articles.map((a) => [a.id, a]));
    const practicedSlugs = new Set<string>();
    let doneToday = false;
    for (const p of progress ?? []) {
      if (!p.practiced_at) continue;
      const a = byId.get(p.article_id);
      if (a) practicedSlugs.add(a.slug);
      if (isLocalToday(p.practiced_at)) doneToday = true;
    }
    const signals = signalsFromCheckins(checkins ?? [], profile?.streak ?? 0, practicedSlugs);
    const picked = pickTodaysPractice(signals, localDayIndex());
    const article = picked ? bySlug.get(picked.slug) : undefined;
    if (!picked || !article) return { pick: null, loading: false };
    const pp = pathProgress(picked.path.steps, practicedSlugs);
    return {
      loading: false,
      pick: {
        article,
        path: picked.path,
        master: article.master_slug ? (MASTER_BY_SLUG[article.master_slug] ?? null) : null,
        reason: picked.reason,
        doneToday,
        progress: { done: pp.done, total: pp.total },
      },
    };
  }, [articles, articlesLoading, progress, checkins, profile?.streak]);
};
