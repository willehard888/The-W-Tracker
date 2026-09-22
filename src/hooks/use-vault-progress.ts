import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type VaultProgressRow = {
  article_id: string;
  completed_at: string;
  quiz_score: number | null;
  practiced_at: string | null;
  integrated_at: string | null;
};

export const useVaultProgress = () => {
  const { user, isPremium } = useAuth();
  // The store trial grants membership (is_elite) like a purchase, so isPremium
  // is the whole gate; the server's has_active_access RLS agrees.
  return useQuery({
    queryKey: ["vault-progress", user?.id],
    enabled: !!user?.id && !!isPremium,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_lesson_progress")
        .select("article_id, completed_at, quiz_score, practiced_at, integrated_at")
        .eq("user_id", user!.id);
      if (error) {
        console.error("[vault-progress] fetch error", error);
        throw error;
      }
      return (data ?? []) as VaultProgressRow[];
    },
  });
};

export const useCompleteLesson = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      articleId,
      quizScore,
    }: {
      articleId: string;
      quizScore: number | null;
    }) => {
      if (!user?.id) throw new Error("not signed in");
      const { error } = await supabase
        .from("vault_lesson_progress")
        .upsert(
          {
            user_id: user.id,
            article_id: articleId,
            quiz_score: quizScore,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,article_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-progress", user?.id] });
    },
  });
};
