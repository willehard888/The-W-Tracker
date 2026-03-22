import { Swords, Lock, Trophy, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pastBattles = [
  { opponent: "grind_master", result: "won", xpGained: 150, date: "2 days ago" },
  { opponent: "cold_steel", result: "lost", xpGained: 0, date: "5 days ago" },
  { opponent: "wake_early_23", result: "won", xpGained: 120, date: "1 week ago" },
];

const Battles = () => {
  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <div className="animate-reveal mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Battles</h1>
        <p className="text-xs text-muted-foreground mt-1">Challenge others. Prove your discipline.</p>
      </div>

      {/* Challenge CTA */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/20 bg-card p-6 text-center mb-6">
        <div className="h-16 w-16 rounded-full gradient-gold flex items-center justify-center glow-gold mx-auto mb-4">
          <Swords size={30} className="text-primary-foreground" />
        </div>
        <h2 className="font-display font-bold text-lg mb-1">1v1 Discipline Battle</h2>
        <p className="text-sm text-muted-foreground mb-4">Challenge a friend or random opponent. Winner takes XP.</p>
        <Button variant="gold" size="lg" className="w-full max-w-xs">
          <Swords size={18} />
          Create Battle
        </Button>
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
          <Lock size={10} /> Requires Elite subscription
        </p>
      </div>

      {/* Battle History */}
      <div className="animate-reveal animate-reveal-delay-2">
        <h2 className="font-display font-bold text-sm mb-3 tracking-tight">Battle History</h2>
        <div className="space-y-2">
          {pastBattles.map((battle, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                battle.result === "won" ? "bg-gold/15 text-gold" : "bg-destructive/15 text-destructive"
              )}>
                {battle.result === "won" ? <Trophy size={18} /> : <Swords size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">vs @{battle.opponent}</p>
                <p className="text-xs text-muted-foreground">{battle.date}</p>
              </div>
              <div className="text-right">
                <p className={cn(
                  "text-sm font-bold font-display",
                  battle.result === "won" ? "text-gold" : "text-destructive"
                )}>
                  {battle.result === "won" ? `+${battle.xpGained} XP` : "Defeat"}
                </p>
                <p className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  battle.result === "won" ? "text-gold/60" : "text-destructive/60"
                )}>
                  {battle.result}
                </p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Battles;
