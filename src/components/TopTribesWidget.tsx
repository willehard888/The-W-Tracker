import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Crown, Medal, Award, Users, Zap, ChevronRight, Loader2 } from "lucide-react";

interface Row {
  tribe_id: string;
  name: string;
  member_count: number;
  score: number;
  rank: number;
  visibility: string;
}

const TopTribesWidget = () => {
  const navigate = useNavigate();
  const { profile, isApexSubscriber } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Tribe creation was opened to every member server-side (20260616160000 —
  // can_create_tribe is now just "signed in"), so the old Elite-only client
  // gate silently hid the CTA from users who CAN create.
  const canCreate = !!profile;

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc("get_tribe_leaderboard" as any, {
        p_period: "weekly",
        p_limit: 5,
      });
      if (!error && data) {
        const normalized = (data as any[]).map((r) => ({
          ...r,
          score: Number(r.score) || 0,
          rank: Number(r.rank) || 0,
          member_count: Number(r.member_count) || 0,
        }));
        setRows(normalized);
      }
      setLoading(false);
    };
    load();
  }, []);

  const formatScore = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `${n}`;

  return (
    <div className="rounded-2xl border border-[hsl(18_95%_58%)]/30 bg-gradient-to-br from-[hsl(18_95%_58%)]/[0.06] via-card to-card p-4 animate-reveal animate-reveal-delay-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Crown size={15} className="text-[hsl(18_95%_58%)] shrink-0" />
          <h2 className="font-display font-bold text-base tracking-tight truncate">Top Tribes</h2>
          <span className="shrink-0 text-[9px] uppercase tracking-widest font-black text-muted-foreground px-1.5 py-0.5 rounded-full border border-border/60 bg-secondary/50">
            Weekly
          </span>
        </div>
        <button
          onClick={() => navigate("/tribes/leaderboard")}
          className="shrink-0 whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-[hsl(18_95%_58%)] inline-flex items-center gap-0.5"
        >
          Full board <ChevronRight size={10} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={14} className="animate-spin text-[hsl(18_95%_58%)]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground mb-2">
            {canCreate ? "No tribes ranked yet — be the first founder." : "No tribes ranked yet."}
          </p>
          <button
            onClick={() => navigate(canCreate ? "/tribes/new" : "/tribes")}
            className="text-[11px] font-black uppercase tracking-widest text-[hsl(18_95%_58%)] inline-flex items-center gap-1"
          >
            {canCreate ? "Found a tribe" : "Browse tribes"} <ChevronRight size={12} />
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const Icon = r.rank === 1 ? Crown : r.rank === 2 ? Medal : r.rank === 3 ? Award : null;
            const color =
              r.rank === 1
                ? "hsl(42 78% 54%)"
                : r.rank === 2
                ? "hsl(0 0% 78%)"
                : r.rank === 3
                ? "hsl(28 60% 52%)"
                : "hsl(var(--muted-foreground))";
            return (
              <button
                key={r.tribe_id}
                onClick={() => navigate(`/tribes/${r.tribe_id}`)}
                className="w-full text-left flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/60 p-2.5 hover:border-[hsl(18_95%_58%)]/30 transition-colors active:scale-[0.99]"
              >
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border"
                  style={{
                    background: `linear-gradient(135deg, ${color}25, ${color}0a)`,
                    borderColor: `${color}55`,
                  }}
                >
                  {Icon ? (
                    <Icon size={14} style={{ color }} strokeWidth={2.4} />
                  ) : (
                    <span className="text-[10px] font-black tabular-nums" style={{ color }}>
                      {r.rank}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black truncate leading-tight">{r.name}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Users size={9} /> {r.member_count}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-black tabular-nums" style={{ color }}>
                  <Zap size={9} fill="currentColor" strokeWidth={0} />
                  {formatScore(r.score)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TopTribesWidget;
