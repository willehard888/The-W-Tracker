import { useEffect, useState } from "react";
import { Heart, Check, ShieldCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useHealthKit } from "@/hooks/use-healthkit";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { hasHealthConsent, hasStaleHealthConsent } from "@/lib/health/health-consent";
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
    let alive = true;
    void supabase.rpc("user_verified_performer_stats", { _user_id: user.id })
      .then(
        ({ data }) => { if (alive && data) setStats(data as unknown as NonNullable<typeof stats>); },
        () => { /* table may not exist yet on pre-migration DBs */ },
      );
    return () => { alive = false; };
  }, [user?.id, syncing]);

  // Who has been feeding Health, and whether anything came through at all.
  //
  // Judged on the STORED rows from the last three days, not on the freshest
  // in-session read: on a new morning, before the first steps, today's read is
  // all-null — and judging on it alone made the card announce "Nothing came
  // through from Health, check Settings" over yesterday's 9 000 stored steps.
  // A quiet morning is not a broken connection. The in-session read can only
  // ADD sources to the line; it cannot empty it.
  useEffect(() => {
    if (!user?.id || !connected) return;
    let alive = true;
    const since = new Date();
    since.setDate(since.getDate() - 3);
    void supabase
      .from("health_sync_snapshots")
      .select("snapshot_date, steps, workout_count, sleep_hours, active_kcal, sources")
      .eq("user_id", user.id)
      .gte("snapshot_date", since.toISOString().slice(0, 10))
      .order("snapshot_date", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (!alive) return;
        const rows = data ?? [];
        const withData = rows.filter((r) => r.steps != null || r.workout_count != null || r.sleep_hours != null || r.active_kcal != null);
        const stored = new Set<string>();
        for (const r of withData) for (const src of (r.sources as string[] | null) ?? []) stored.add(src);
        for (const src of lastSnapshot?.sources ?? []) stored.add(src);
        const liveHasData = !!lastSnapshot && (lastSnapshot.steps != null || lastSnapshot.workout_count != null
          || lastSnapshot.sleep_hours != null || lastSnapshot.active_kcal != null);
        setToday({ sources: Array.from(stored).sort(), hasData: withData.length > 0 || liveHasData });
      });
    return () => { alive = false; };
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
    const reconnect = hasStaleHealthConsent();
    return (
      <div className="surface-card surface-card-quiet p-4">
        <p className="text-[14px] font-bold leading-tight">
          {reconnect ? "Apple Health can give more now" : "Verify your check-ins automatically"}
        </p>
        <p className="text-[12px] text-muted-foreground leading-snug mt-1">
          {reconnect
            ? "This update reads workouts, steps, distance and body metrics on top of sleep — allow the new types once and every watch that syncs to Health (Garmin, Polar, Oura, Apple Watch) feeds your check-ins."
            : "Connect Apple Health and every workout, night of sleep and step count your watch records — Garmin, Polar, Oura, Apple Watch — confirms your check-in for you. Verified check-ins earn the \"Verified Performer\" badge."}
        </p>
        <Button variant="secondary" loading={syncing} onClick={handleConnect} className="w-full mt-3">
          <Heart aria-hidden size={14} /> {reconnect ? "Allow the new types" : "Connect Apple Health"}
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

  // Connected — who is feeding it, and the verification line. Before the
  // first row of the day lands the line says so instead of guessing.
  const via = today?.sources.length ? today.sources.join(" · ") : "Health · syncing";
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
