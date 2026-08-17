import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Zap, Target, CheckCircle2, Clock, Flame } from "lucide-react";

interface Quest {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  emoji: string;
  checkFn: (checkinData: any) => boolean;
}

const ALL_QUESTS: Quest[] = [
  { id: "cold_shower", title: "Ice Warrior", description: "Take a cold shower today", xpReward: 15, emoji: "🧊", checkFn: (d) => d.coldShower },
  { id: "double_meditation", title: "Zen Master", description: "Meditate morning AND evening", xpReward: 20, emoji: "🧘", checkFn: (d) => d.meditationAm && d.meditationPm },
  { id: "hydration_max", title: "Hydration King", description: "Drink 4L+ water today", xpReward: 15, emoji: "💧", checkFn: (d) => d.hydration >= 4 },
  { id: "no_phone", title: "Digital Detox", description: "No phone morning AND evening", xpReward: 20, emoji: "📵", checkFn: (d) => d.noPhoneAm && d.noPhonePm },
  { id: "perfect_sleep", title: "Sleep Champion", description: "Get exactly 8-9 hours of sleep", xpReward: 15, emoji: "😴", checkFn: (d) => d.sleep >= 8 && d.sleep <= 9 },
  { id: "full_nutrition", title: "Fuel Machine", description: "Healthy food + protein intake", xpReward: 15, emoji: "🥗", checkFn: (d) => d.healthyFood && d.protein },
  { id: "combat_workout", title: "Fighter Spirit", description: "Do a combat sport workout", xpReward: 25, emoji: "🥊", checkFn: (d) => d.sportCategory === "combat" },
  { id: "extra_grind", title: "Double Session", description: "Complete an extra workout", xpReward: 20, emoji: "💪", checkFn: (d) => d.extraWorkout },
  { id: "early_bird", title: "Early Bird", description: "Sleep 7h+ and no phone in the morning", xpReward: 15, emoji: "🌅", checkFn: (d) => d.sleep >= 7 && d.noPhoneAm },
  { id: "total_discipline", title: "Total Discipline", description: "Complete 8+ tasks in one day", xpReward: 30, emoji: "👑", checkFn: (d) => d.completedCount >= 8 },
  { id: "bookworm", title: "Bookworm", description: "Read for 30 minutes today", xpReward: 15, emoji: "📖", checkFn: (d) => d.reading },
];

// Seeded random based on date to get consistent daily quests
const getDailyQuests = (): Quest[] => {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  
  // Simple seeded shuffle
  const shuffled = [...ALL_QUESTS];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, 3);
};

interface DailyQuestsProps {
  checkinData: {
    sleep: number;
    sportCategory: string;
    extraWorkout: boolean;
    coldShower: boolean;
    healthyFood: boolean;
    protein: boolean;
    meditationAm: boolean;
    meditationPm: boolean;
    hydration: number;
    noPhoneAm: boolean;
    noPhonePm: boolean;
    completedCount: number;
    reading: boolean;
  };
  onBonusXpChange: (bonusXp: number) => void;
}

const DailyQuests = ({ checkinData, onBonusXpChange }: DailyQuestsProps) => {
  // Re-seed quests when the local calendar date changes. Without this,
  // an app left open over midnight kept showing yesterday's quest list.
  const todayKey = new Date().toDateString();
  const dailyQuests = useMemo(() => getDailyQuests(), [todayKey]);

  const questStatuses = useMemo(() => {
    return dailyQuests.map((quest) => ({
      ...quest,
      completed: quest.checkFn(checkinData),
    }));
  }, [dailyQuests, checkinData]);

  const totalBonus = questStatuses.filter((q) => q.completed).reduce((sum, q) => sum + q.xpReward, 0);

  useEffect(() => {
    onBonusXpChange(totalBonus);
  }, [totalBonus, onBonusXpChange]);

  const completedCount = questStatuses.filter((q) => q.completed).length;

  return (
    <div className="rounded-xl border border-gold/20 bg-gold/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gold/15 flex items-center justify-center">
            <Target size={16} className="text-gold" />
          </div>
          <div>
            <p className="font-display font-bold text-sm tracking-tight">Daily Quests</p>
            <p className="text-[10px] text-muted-foreground">Bonus objectives — refreshes daily</p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20">
          <Flame size={12} className="text-gold" />
          <span className="text-[10px] font-bold text-gold">{completedCount}/3</span>
        </div>
      </div>

      <div className="space-y-2">
        {questStatuses.map((quest) => (
          <div
            key={quest.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 transition-all duration-300",
              quest.completed
                ? "border-gold/30 bg-gold/10"
                : "border-border/50 bg-card/50"
            )}
          >
            <span className="text-lg w-7 text-center">{quest.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-xs font-bold",
                quest.completed ? "text-purple-300" : "text-foreground"
              )}>
                {quest.title}
              </p>
              <p className="text-[10px] text-muted-foreground">{quest.description}</p>
            </div>
            {quest.completed ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gold">+{quest.xpReward}</span>
                <CheckCircle2 size={14} className="text-gold" />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-muted-foreground">+{quest.xpReward}</span>
                <Clock size={14} className="text-muted-foreground/40" />
              </div>
            )}
          </div>
        ))}
      </div>

      {totalBonus > 0 && (
        <div className="mt-3 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-gold/10 border border-gold/20">
          <Zap size={12} className="text-gold" />
          <span className="text-xs font-bold text-gold">Quest Bonus: +{totalBonus} XP</span>
        </div>
      )}
    </div>
  );
};

export default DailyQuests;
