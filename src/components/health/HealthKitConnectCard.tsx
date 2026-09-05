import { useEffect, useState } from "react";
import { Heart, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useHealthKit } from "@/hooks/use-healthkit";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { track, FUNNEL } from "@/lib/analytics";

/**
 * "Connect Apple Health" — a quiet support row for Home, Coach and Profile.
 *
 * Three states:
 *   1. Not available (web/Android/pre-install) → hidden entirely
 *   2. Not yet connected → the ask + button
 *   3. Connected → the verification line + sync
 */
const HealthKitConnectCard = ({ onConnected }: { onConnected?: () => void } = {}) => {
  const { available, connect, syncToday, syncing, error } = useHealthKit();
  const { user } = useAuth();
  const [stats, setStats] = useState<{
    total_checkins: number;
    verified_count: number;
    verified_pct: number;
    is_verified_performer: boolean;
  } | null>(null);

  // Read verification stats (server-computed over last 14 days).
  useEffect(() => {
    if (!user?.id) return;
    void supabase.rpc("user_verified_performer_stats", { _user_id: user.id })
      .then(
        ({ data }) => { if (data) setStats(data as unknown as NonNullable<typeof stats>); },
        () => { /* table may not exist yet on pre-migration DBs */ },
      );
  }, [user?.id, syncing]);

  if (available === false) return null;       // wrong platform, hide
  if (available === null) return null;        // still probing, hide

  const isConnected = (stats?.verified_count ?? 0) > 0;

  const handleConnect = async () => {
    void track(FUNNEL.healthkitPromptShown); // measure the ask, not just the yes
    const ok = await connect();
    if (ok) {
      void track(FUNNEL.healthkitConnected); // funnel step 2
      toast.success("Apple Health connected", {
        description: "Future check-ins will be automatically verified.",
      });
      // Deterministic notify: the iOS permission sheet is an in-app UIKit
      // modal, so window focus/visibility events are NOT guaranteed to fire —
      // callers polling localStorage on focus would keep showing the CTA.
      onConnected?.();
    } else if (error) {
      toast.error("Couldn't connect", { description: error });
    }
  };

  if (!isConnected) {
    return (
      <div className="surface-card surface-card-quiet p-4">
        <p className="text-[14px] font-bold leading-tight">Verify your check-ins automatically</p>
        <p className="text-[12px] text-muted-foreground leading-snug mt-1">
          Connect HealthKit — we'll cross-check your workouts and steps against
          actual Apple Health data. Verified check-ins earn the
          "Verified Performer" badge.
        </p>
        <Button variant="secondary" loading={syncing} onClick={handleConnect} className="w-full mt-3">
          <Heart size={14} /> Connect Apple Health
        </Button>
      </div>
    );
  }

  // Connected — the verification line, one row.
  return (
    <div className="surface-card surface-card-quiet px-4 py-3 flex items-center gap-3">
      <ShieldCheck size={16} className="text-xp-green shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight truncate">
          {stats?.is_verified_performer ? "Verified Performer" : "Apple Health connected"}
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 tabular-nums">
          {stats?.verified_count ?? 0}/{stats?.total_checkins ?? 0} verified in 14 days · {stats?.verified_pct ?? 0}%
          {stats?.is_verified_performer ? "" : " · 70% earns the badge"}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="min-h-11 shrink-0 text-[12px]" loading={syncing} onClick={() => { void syncToday(); }}>
        <Check size={11} /> Sync
      </Button>
    </div>
  );
};

export default HealthKitConnectCard;
