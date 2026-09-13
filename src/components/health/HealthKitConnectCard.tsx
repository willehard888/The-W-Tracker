import { useEffect, useState } from "react";
import { Heart, Check, ShieldCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useHealthKit } from "@/hooks/use-healthkit";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { hasHealthConsent } from "@/lib/health/health-consent";
import { track, FUNNEL } from "@/lib/analytics";

/**
 * "Connect Apple Health" — a quiet support row for Home, Coach and Profile.
 *
 * Four states:
 *   1. Not available (web/Android/pre-install) → hidden entirely
 *   2. Not yet connected → the ask + button
 *   3. Connected, data flowing → the source apps + verification line + Sync
 *   4. Connected, nothing came through → the one honest sentence and where
 *      to look. iOS never reveals a READ denial to the app; an empty read
 *      after consent is the only signal there is.
 *
 * "Connected" is the consent flag, not `verified_count > 0` — that number is
 * zero for the whole first day after connecting, and the card was re-asking a
 * user who had already said yes.
 */
const HealthKitConnectCard = ({ onConnected }: { onConnected?: () => void } = {}) => {
  const { available, connect, syncToday, syncing, error, lastSnapshot } = useHealthKit();
  const { user } = useAuth();
  const [connected, setConnected] = useState(() => hasHealthConsent());
  const [stats, setStats] = useState<{
    total_checkins: number;
    verified_count: number;
    verified_pct: number;
    is_verified_performer: boolean;
  } | null>(null);
  const [today, setToday] = useState<{ sources: string[]; hasData: boolean } | null>(null);

  // Verification stats (server-computed over the last 14 days).
  useEffect(() => {
    if (!user?.id) return;
    void supabase.rpc("user_verified_performer_stats", { _user_id: user.id })
      .then(
        ({ data }) => { if (data) setStats(data as unknown as NonNullable<typeof stats>); },
        () => { /* table may not exist yet on pre-migration DBs */ },
      );
  }, [user?.id, syncing]);

  // Today's row — who contributed. The hook's last snapshot is freshest; the
  // stored row covers a cold open before any sync has run this session.
  useEffect(() => {
    if (!user?.id || !connected) return;
    if (lastSnapshot) {
      const hasData = lastSnapshot.steps != null || lastSnapshot.workout_count != null
        || lastSnapshot.sleep_hours != null || lastSnapshot.active_kcal != null;
      setToday({ sources: lastSnapshot.sources, hasData });
      return;
    }
    void supabase
      .from("health_sync_snapshots")
      .select("steps, workout_count, sleep_hours, active_kcal, sources")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setToday({ sources: [], hasData: false }); return; }
        const hasData = data.steps != null || data.workout_count != null || data.sleep_hours != null || data.active_kcal != null;
        setToday({ sources: (data.sources as string[] | null) ?? [], hasData });
      });
  }, [user?.id, connected, lastSnapshot]);

  if (available === false) return null;       // wrong platform, hide
  if (available === null) return null;        // still probing, hide

  const handleConnect = async () => {
    void track(FUNNEL.healthkitPromptShown); // measure the ask, not just the yes
    const ok = await connect();
    if (ok) {
      void track(FUNNEL.healthkitConnected); // funnel step 2
      setConnected(true);
      toast.success("Apple Health connected", {
        description: "Your check-ins verify themselves from here on.",
      });
      // Deterministic notify: the iOS permission sheet is an in-app UIKit
      // modal, so window focus/visibility events are NOT guaranteed to fire —
      // callers polling localStorage on focus would keep showing the CTA.
      onConnected?.();
    } else if (error) {
      toast.error("Couldn't connect", { description: error });
    }
  };

  if (!connected) {
    return (
      <div className="surface-card surface-card-quiet p-4">
        <p className="text-[14px] font-bold leading-tight">Verify your check-ins automatically</p>
        <p className="text-[12px] text-muted-foreground leading-snug mt-1">
          Connect Apple Health and every workout, night of sleep and step count
          your watch records — Garmin, Polar, Oura, Apple Watch — confirms your
          check-in for you. Verified check-ins earn the "Verified Performer" badge.
        </p>
        <Button variant="secondary" loading={syncing} onClick={handleConnect} className="w-full mt-3">
          <Heart aria-hidden size={14} /> Connect Apple Health
        </Button>
      </div>
    );
  }

  // Connected but the read came back empty: say so, and say where to look.
  if (today && !today.hasData && !syncing) {
    return (
      <div className="surface-card surface-card-quiet px-4 py-3 flex items-center gap-3">
        <WifiOff size={16} className="text-muted-foreground shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold leading-tight">Nothing came through from Health</p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            Check Settings → Health → Data Access &amp; Devices → Whealth Factory, then sync.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="min-h-11 shrink-0 text-[12px]" loading={syncing} onClick={() => { void syncToday(); }}>
          <Check aria-hidden size={11} /> Sync
        </Button>
      </div>
    );
  }

  // Connected — who is feeding it, and the verification line.
  const via = today?.sources.length ? today.sources.join(" · ") : "Apple Health";
  return (
    <div className="surface-card surface-card-quiet px-4 py-3 flex items-center gap-3">
      <ShieldCheck size={16} className="text-xp-green shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight truncate">
          {stats?.is_verified_performer ? "Verified Performer" : via}
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 tabular-nums truncate">
          {stats?.is_verified_performer ? `${via} · ` : ""}
          {stats?.verified_count ?? 0}/{stats?.total_checkins ?? 0} verified in 14 days
          {stats?.is_verified_performer ? "" : " · 70% earns the badge"}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="min-h-11 shrink-0 text-[12px]" loading={syncing} onClick={() => { void syncToday(); }}>
        <Check aria-hidden size={11} /> Sync
      </Button>
    </div>
  );
};

export default HealthKitConnectCard;
