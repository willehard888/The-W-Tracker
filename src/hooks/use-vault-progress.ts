import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialAccess } from "@/hooks/use-trial-access";

export type VaultProgressRow = {
  article_id: string;
  completed_at: string;
  quiz_score: number | null;
};

export const useVaultProgress = () => {
  const { user, isPremium } = useAuth();
  // Trialists can read lessons (has_active_access RLS) — fetch their progress
  // too so completed rows render; writes stay premium-gated server-side.
  const { isInTrial } = useTrialAccess();
  return useQuery({
    queryKey: ["vault-progress", user?.id],
    enabled: !!user?.id && (!!isPremium || isInTrial),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_lesson_progress")
        .select("article_id, completed_at, quiz_score")
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
