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
};

export const useVaultArticles = (categoryId?: string) => {
  const { user, isPremium } = useAuth();
  return useQuery({
    queryKey: ["vault-articles", categoryId ?? "all", user?.id],
    enabled: !!user?.id && !!isPremium,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      let q = supabase
        .from("vault_articles")
        .select(
          "id, category_id, slug, title, subtitle, summary, evidence_tier, read_time_min, protocol, benefits, risks, body_md, references_json, display_order, lesson_number, course_role, why_it_matters, try_today, key_takeaways, quiz",
        )
        .order("category_id", { ascending: true })
        .order("lesson_number", { ascending: true, nullsFirst: false })
        .order("display_order", { ascending: true });
      if (categoryId) q = q.eq("category_id", categoryId);
      const { data, error } = await q;
      if (error) {
        console.error("[vault] fetch error", error);
        throw error;
      }
      return (data ?? []) as VaultArticle[];
    },
  });
};
