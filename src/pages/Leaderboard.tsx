import { Trophy, Lock, Crown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Leaderboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: leaders } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, xp, level, streak, user_id")
        .order("xp", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const myRank = leaders?.findIndex((l) => l.user_id === profile?.user_id);
  const totalUsers = leaders?.length || 1;
  const percentile = myRank !== undefined && myRank >= 0 ? Math.max(1, Math.round(((totalUsers - myRank) / totalUsers) * 100)) : 50;

  const isElite = profile?.is_elite;

  const rankColors: Record<number, string> = {
    0: "text-gold glow-gold-text",
    1: "text-foreground/70",
    2: "text-amber-700",
  };

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <div className="animate-reveal mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-xs text-muted-foreground mt-1">Top performers. Real discipline.</p>
      </div>

      {/* Your Position */}
      {profile && (
        <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/30 bg-gold/5 p-4 mb-4 glow-gold-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold font-display font-bold">
                #{myRank !== undefined ? myRank + 1 : "?"}
              </div>
              <div>
                <p className="font-semibold text-sm">Your Position</p>
                <p className="text-xs text-muted-foreground">You're ahead of <span className="text-gold font-semibold">{percentile}%</span> of users</p>
              </div>
            </div>
            <TrendingUp size={20} className="text-gold" />
          </div>
        </div>
      )}

      {/* Top 3 */}
      <div className="space-y-2 animate-reveal animate-reveal-delay-2">
        {leaders?.slice(0, 3).map((user, i) => (
          <div
            key={user.user_id}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4",
              i === 0 ? "border-gold/30 bg-card glow-gold-sm" : "border-border bg-card"
            )}
          >
            <div className={cn("font-display font-black text-xl w-8 text-center tabular-nums", rankColors[i] || "text-muted-foreground")}>
              {i === 0 ? <Crown size={22} className="text-gold mx-auto" /> : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">@{user.username}</p>
              <p className="text-xs text-muted-foreground">Level {user.level} • {user.streak}d streak</p>
            </div>
            <div className="text-right">
              <p className={cn("font-display font-bold text-sm tabular-nums", i === 0 && "text-gold")}>{user.xp.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">XP</p>
            </div>
          </div>
        ))}
      </div>

      {/* Locked / Full list */}
      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        {isElite ? (
          <div className="space-y-2">
            {leaders?.slice(3).map((user, i) => (
              <div key={user.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="font-display font-black text-xl w-8 text-center text-muted-foreground tabular-nums">{i + 4}</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">@{user.username}</p>
                  <p className="text-xs text-muted-foreground">Level {user.level}</p>
                </div>
                <p className="font-display font-bold text-sm tabular-nums">{user.xp.toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            <div className="space-y-2 opacity-20 pointer-events-none">
              {(leaders?.slice(3, 7) || []).map((user, i) => (
                <div key={user.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="font-display font-black text-xl w-8 text-center text-muted-foreground tabular-nums">{i + 4}</div>
                  <div className="flex-1"><p className="font-semibold text-sm">@{user.username}</p></div>
                  <p className="font-display font-bold text-sm tabular-nums">{user.xp.toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/90 backdrop-blur-sm border border-gold/20">
                <Lock size={28} className="text-gold" />
                <p className="font-display font-bold text-sm">Unlock Full Leaderboard</p>
                <p className="text-xs text-muted-foreground text-center max-w-[200px]">Go Elite to see all rankings</p>
                <Button variant="gold" size="default" onClick={() => navigate("/paywall")}>
                  <Trophy size={16} />
                  Go Elite — €15.99/kk
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
