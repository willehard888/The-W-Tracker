import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type VaultQuizQ = { q: string; choices: string[]; correct: number; explain: string };

export type VaultArticle = {
  id: string;
  category_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  evidence_tier: "strong" | "promising" | "speculative";
  read_time_min: number;
  protocol: {
    duration?: string;
    intensity?: string;
    frequency?: string;
    prerequisites?: string;
  };
  benefits: string[];
  risks: string[];
  body_md: string;
  references_json: { author: string; title: string; year?: number; url?: string }[];
  display_order: number;
  lesson_number: number | null;
  course_role: "foundations" | "protocol" | "recap";
  why_it_matters: string | null;
  try_today: string[];
  key_takeaways: string[];
  quiz: VaultQuizQ[];
  /** The practice loop (migration 20260917100001): a master, a question in, a question out. */
  master_slug: string | null;
  reflect_prompt: string | null;
  integrate_prompt: string | null;
  practice_minutes: number | null;
};

/**
 * What the index needs — and nothing it does not. The list used to select
 * every column, so opening the Vault downloaded all 70 articles' `body_md`,
 * `quiz` and references (173 kB measured in prod) to paint titles and
 * summaries (19 kB), and the headline sat as a skeleton for ~1.5 s. The
 * article sheet fetches its own body by id through `useVaultArticle`.
 */
export type VaultArticleSummary = Pick<
  VaultArticle,
  "id" | "category_id" | "slug" | "title" | "subtitle" | "summary" | "evidence_tier"
  | "read_time_min" | "display_order" | "lesson_number" | "course_role"
  | "master_slug" | "reflect_prompt" | "practice_minutes"
>;

const SUMMARY_COLUMNS =
  "id, category_id, slug, title, subtitle, summary, evidence_tier, read_time_min, display_order, lesson_number, course_role, master_slug, reflect_prompt, practice_minutes";

/** The index fetcher, shared with the shell's idle prefetch (keys must match). */
export const vaultArticlesKey = (userId: string | undefined, categoryId?: string) =>
  ["vault-articles", categoryId ?? "all", userId] as const;

export const fetchVaultArticleSummaries = async (categoryId?: string): Promise<VaultArticleSummary[]> => {
  let q = supabase
    .from("vault_articles")
    .select(SUMMARY_COLUMNS)
    .order("category_id", { ascending: true })
    .order("lesson_number", { ascending: true, nullsFirst: false })
    .order("display_order", { ascending: true });
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data, error } = await q;
  if (error) {
    console.error("[vault] fetch error", error);
    throw error;
  }
  return (data ?? []) as VaultArticleSummary[];
};

export const useVaultArticles = (categoryId?: string) => {
  const { user, isPremium } = useAuth();
  // The store trial grants membership like a purchase: isPremium is the gate,
  // and the server's has_active_access RLS reads the same flag.
  return useQuery({
    queryKey: vaultArticlesKey(user?.id, categoryId),
    enabled: !!user?.id && !!isPremium,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchVaultArticleSummaries(categoryId),
  });
};

/** One article in full — body, protocol, quiz, references — for the sheet. */
export const useVaultArticle = (id: string | null | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["vault-article", id, user?.id],
    enabled: !!id && !!user?.id,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_articles")
        .select(
          "id, category_id, slug, title, subtitle, summary, evidence_tier, read_time_min, protocol, benefits, risks, body_md, references_json, display_order, lesson_number, course_role, why_it_matters, try_today, key_takeaways, quiz, master_slug, reflect_prompt, integrate_prompt, practice_minutes",
        )
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as VaultArticle;
    },
  });
};
