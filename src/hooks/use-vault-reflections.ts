import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * A member's private answers to a piece's two questions. Own rows only
 * (RLS); nothing here is ever read for another user, posted, or sent to
 * the coach. The cache key includes the article so opening a piece reads
 * only its two rows.
 */
export type ReflectionStage = "reflect" | "integrate";

export interface VaultReflection {
  stage: ReflectionStage;
  answer: string;
  updated_at: string;
}

export const reflectionsKey = (userId: string | undefined, articleId: string | null | undefined) =>
  ["vault-reflections", userId, articleId] as const;

export const useVaultReflections = (articleId: string | null | undefined) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: reflectionsKey(user?.id, articleId),
    enabled: !!user?.id && !!articleId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<VaultReflection[]> => {
      const { data, error } = await supabase
        .from("vault_reflections")
        .select("stage, answer, updated_at")
        .eq("user_id", user!.id)
        .eq("article_id", articleId!);
      if (error) throw error;
      return (data ?? []) as VaultReflection[];
    },
  });
};

/** Save (or replace) one answer. Empty text deletes the row. */
export const useSaveReflection = (articleId: string | null | undefined) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stage, answer }: { stage: ReflectionStage; answer: string }) => {
      if (!user?.id || !articleId) throw new Error("not signed in");
      const text = answer.trim().slice(0, 1200);
      if (!text) {
        const { error } = await supabase
          .from("vault_reflections")
          .delete()
          .eq("user_id", user.id)
          .eq("article_id", articleId)
          .eq("stage", stage);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("vault_reflections")
        .upsert(
          { user_id: user.id, article_id: articleId, stage, answer: text, updated_at: new Date().toISOString() },
          { onConflict: "user_id,article_id,stage" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reflectionsKey(user?.id, articleId) });
    },
  });
};
