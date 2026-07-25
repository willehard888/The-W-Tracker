import { useEffect, useState } from "react";
import { Heart, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useHealthKit } from "@/hooks/use-healthkit";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { track, FUNNEL } from "@/lib/analytics";

/**
 * "Connect Apple Health" CTA — for Coach landing or Profile Settings tab.
 *
 * Three states:
 *   1. Not available (web/Android/pre-install) → hidden entirely
 *   2. Not yet connected → CTA button
 *   3. Connected → "Verified Performer" stat card
 */
const HealthKitConnectCard = () => {
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
    supabase.rpc("user_verified_performer_stats" as any, { _user_id: user.id })
      .then(({ data }) => {
        if (data) setStats(data as any);
      })
      .catch(() => { /* table may not exist yet on pre-migration DBs */ });
  }, [user?.id, syncing]);

  if (available === false) return null;       // wrong platform, hide
  if (available === null) return null;        // still probing, hide

  const isConnected = (stats?.verified_count ?? 0) > 0;

  const handleConnect = async () => {
    const ok = await connect();
    if (ok) {
      void track(FUNNEL.healthkitConnected); // funnel step 2
      toast.success("Apple Health connected", {
        description: "Future check-ins will be automatically verified.",
      });
    } else if (error) {
      toast.error("Couldn't connect", { description: error });
    }
  };

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart size={14} className="text-rose-400" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">
            Apple Health
          </p>
        </div>
        <p className="text-[13px] font-bold leading-tight mb-1">
          Verify your check-ins automatically
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug mb-3">
          Connect HealthKit — we'll cross-check your workouts and steps against
          actual Apple Health data. Verified check-ins earn the
          "Verified Performer" badge.
        </p>
        <Button
          variant="ember"
          size="default"
          loading={syncing}
          onClick={handleConnect}
          className="w-full"
        >
          <Heart size={14} /> Connect Apple Health
        </Button>
      </div>
    );
  }

  // Connected — show verification stats
  return (
    <div className="rounded-2xl border border-xp-green/30 bg-gradient-to-b from-xp-green/[0.06] to-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={14} className="text-xp-green" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-xp-green">
          {stats?.is_verified_performer ? "Verified Performer ✓" : "Apple Health · Connected"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Tile
          label="Verified"
          value={`${stats?.verified_count ?? 0}/${stats?.total_checkins ?? 0}`}
          sub="last 14 days"
        />
        <Tile
          label="Verification rate"
          value={`${stats?.verified_pct ?? 0}%`}
          sub={stats?.is_verified_performer ? "Badge active" : "≥70% earns badge"}
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        loading={syncing}
        onClick={() => { void syncToday(); }}
        className="w-full mt-3 text-[11px]"
      >
        <Check size={11} /> Sync now
      </Button>
    </div>
  );
};

const Tile = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div className="rounded-xl border border-border/40 bg-card/40 px-3 py-2.5">
    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-0.5">
      {label}
    </p>
    <p className="text-base font-display font-black text-foreground tabular-nums leading-none mb-1">
      {value}
    </p>
    <p className="text-[10px] text-muted-foreground leading-snug">{sub}</p>
  </div>
);

export default HealthKitConnectCard;
