import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { track, FUNNEL } from "@/lib/analytics";
import { captureException } from "@/lib/observability";

/**
 * The practice, recorded server-side (record_vault_practice): one per piece,
 * XP for the first practice of each local day, level recomputed the way the
 * check-in does it. Then the Vault badges are re-validated from the same
 * rows and the first new one comes back for the unlock modal.
 */
export interface PracticeResult {
  practiced: boolean;
  already: boolean;
  xp_awarded: number;
  xp: number;
  level: number;
  newBadge: { name: string; icon: string; rarity: string; description?: string } | null;
}

export const useRecordPractice = () => {
  const { user, refreshProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ articleId, slug, master, path }: { articleId: string; slug: string; master?: string | null; path?: string | null }): Promise<PracticeResult> => {
      if (!user?.id) throw new Error("not signed in");
      const { data, error } = await supabase.rpc("record_vault_practice", {
        p_article_id: articleId,
        p_tz_offset_minutes: new Date().getTimezoneOffset(),
      });
      if (error) throw error;
      const result = data as unknown as Omit<PracticeResult, "newBadge">;
      let newBadge: PracticeResult["newBadge"] = null;
      if (!result.already) {
        void track(FUNNEL.vaultPracticed, { slug, master: master ?? null, path: path ?? null, xp: result.xp_awarded });
        const { data: badges, error: badgeErr } = await supabase.rpc("award_vault_badges");
        if (badgeErr) captureException(badgeErr, { where: "vault.awardBadges" });
        const first = (badges ?? [])[0];
        if (first) newBadge = { name: first.name, icon: first.icon, rarity: first.rarity, description: first.description ?? undefined };
      }
      return { ...result, newBadge };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["vault-progress", user?.id] });
      if (result.xp_awarded > 0) void refreshProfile?.();
    },
  });
};

/** Integration answered: stamp the progress row (the answer itself lives in vault_reflections). */
export const useMarkIntegrated = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ articleId }: { articleId: string }) => {
      if (!user?.id) throw new Error("not signed in");
      const { error } = await supabase
        .from("vault_lesson_progress")
        .upsert(
          { user_id: user.id, article_id: articleId, integrated_at: new Date().toISOString() },
          { onConflict: "user_id,article_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-progress", user?.id] }),
  });
};
