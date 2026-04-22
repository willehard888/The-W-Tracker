import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReferralStats {
  signupCount: number;
  convertedCount: number;
  pendingCount: number;
  monthlyEarnedEuros: number;
  lifetimeEarnedEuros: number;
  milestonesHit: string[];
  apexCreditsUntil: string | null;
  legendPinned: boolean;
  daysAsApex: number;
}

const PRICE_PER_CONVERSION = 4.99;

export function useReferralStats(userId?: string) {
  return useQuery<ReferralStats>({
    queryKey: ["referral-stats", userId],
    queryFn: async () => {
      if (!userId) {
        return {
          signupCount: 0,
          convertedCount: 0,
          pendingCount: 0,
          monthlyEarnedEuros: 0,
          lifetimeEarnedEuros: 0,
          milestonesHit: [],
          apexCreditsUntil: null,
          legendPinned: false,
          daysAsApex: 0,
        };
      }

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [{ data: refs }, { data: profile }] = await Promise.all([
        supabase
          .from("referrals")
          .select("id, converted, converted_at, created_at")
          .eq("referrer_id", userId),
        supabase
          .from("profiles")
          .select("referral_milestones_hit, apex_credits_until, legend_pinned")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const rows = refs ?? [];
      const signupCount = rows.length;
      const converted = rows.filter((r: any) => r.converted);
      const convertedCount = converted.length;
      const convertedThisMonth = converted.filter(
        (r: any) => r.converted_at && new Date(r.converted_at) >= monthStart,
      ).length;

      const milestonesHit: string[] = Array.isArray(
        (profile as any)?.referral_milestones_hit,
      )
        ? ((profile as any).referral_milestones_hit as any[]).map(String)
        : [];

      const apexCreditsUntil = (profile as any)?.apex_credits_until ?? null;
      const legendPinned = !!(profile as any)?.legend_pinned;
      const daysAsApex = apexCreditsUntil
        ? Math.max(0, Math.ceil((new Date(apexCreditsUntil).getTime() - Date.now()) / 86_400_000))
        : 0;

      return {
        signupCount,
        convertedCount,
        pendingCount: signupCount - convertedCount,
        monthlyEarnedEuros: Math.round(convertedThisMonth * PRICE_PER_CONVERSION * 100) / 100,
        lifetimeEarnedEuros: Math.round(convertedCount * PRICE_PER_CONVERSION * 100) / 100,
        milestonesHit,
        apexCreditsUntil,
        legendPinned,
        daysAsApex,
      };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useTopInviters(limit = 10) {
  return useQuery({
    queryKey: ["top-inviters", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_inviters", {
        p_limit: limit,
      });
      if (error) {
        console.error("get_top_inviters error:", error);
        return [];
      }
      return (data ?? []) as Array<{
        user_id: string;
        username: string;
        avatar_url: string | null;
        status_tier: string;
        converted_count: number;
        signup_count: number;
      }>;
    },
    staleTime: 60_000,
  });
}
