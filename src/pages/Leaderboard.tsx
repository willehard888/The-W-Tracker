import { Trophy, Lock, Crown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const leaders = [
  { rank: 1, username: "disciplined_wolf", xp: 12450, level: 28, streak: 47 },
  { rank: 2, username: "grind_never_stops", xp: 11200, level: 26, streak: 39 },
  { rank: 3, username: "coldwater_king", xp: 10800, level: 25, streak: 35 },
  { rank: 4, username: "iron_mentality", xp: 9400, level: 22, streak: 31 },
  { rank: 5, username: "no_excuses_88", xp: 8750, level: 20, streak: 28 },
  { rank: 6, username: "wake_up_warrior", xp: 7600, level: 18, streak: 22 },
  { rank: 7, username: "elite_habits", xp: 6900, level: 16, streak: 19 },
];

const rankColors: Record<number, string> = {
  1: "text-gold glow-gold-text",
  2: "text-foreground/70",
  3: "text-amber-700",
};

const Leaderboard = () => {
  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <div className="animate-reveal mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-xs text-muted-foreground mt-1">Top performers. Real discipline. No shortcuts.</p>
      </div>

      {/* Your Position */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/30 bg-gold/5 p-4 mb-4 glow-gold-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold font-display font-bold">#42</div>
            <div>
              <p className="font-semibold text-sm">Your Position</p>
              <p className="text-xs text-muted-foreground">You're ahead of <span className="text-gold font-semibold">92%</span> of users</p>
            </div>
          </div>
          <TrendingUp size={20} className="text-gold" />
        </div>
      </div>

      {/* Leaders List */}
      <div className="space-y-2 animate-reveal animate-reveal-delay-2">
        {leaders.slice(0, 3).map((user) => (
          <div
            key={user.rank}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4",
              user.rank === 1
                ? "border-gold/30 bg-card glow-gold-sm"
                : "border-border bg-card"
            )}
          >
            <div className={cn("font-display font-black text-xl w-8 text-center tabular-nums", rankColors[user.rank] || "text-muted-foreground")}>
              {user.rank === 1 ? <Crown size={22} className="text-gold mx-auto" /> : user.rank}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">@{user.username}</p>
              <p className="text-xs text-muted-foreground">Level {user.level} • {user.streak}d streak</p>
            </div>
            <div className="text-right">
              <p className={cn("font-display font-bold text-sm tabular-nums", user.rank === 1 && "text-gold")}>{user.xp.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">XP</p>
            </div>
          </div>
        ))}
      </div>

      {/* Locked Section */}
      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        <div className="relative">
          <div className="space-y-2 opacity-20 pointer-events-none">
            {leaders.slice(3).map((user) => (
              <div key={user.rank} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="font-display font-black text-xl w-8 text-center text-muted-foreground tabular-nums">{user.rank}</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">@{user.username}</p>
                  <p className="text-xs text-muted-foreground">Level {user.level}</p>
                </div>
                <p className="font-display font-bold text-sm tabular-nums">{user.xp.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Lock Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/90 backdrop-blur-sm border border-gold/20">
              <Lock size={28} className="text-gold" />
              <p className="font-display font-bold text-sm">Unlock Full Leaderboard</p>
              <p className="text-xs text-muted-foreground text-center max-w-[200px]">Go Elite to see all rankings and compete globally</p>
              <Button variant="gold" size="default">
                <Trophy size={16} />
                Go Elite — €49/mo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
