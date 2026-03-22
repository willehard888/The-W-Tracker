import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Moon, Dumbbell, Snowflake, Apple, Droplets,
  Brain, Smartphone, Camera, ChevronLeft, Zap, Plus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";

interface ToggleItemProps {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  active: boolean;
  onToggle: () => void;
  bonus?: string;
}

const ToggleItem = ({ icon: Icon, label, sublabel, active, onToggle, bonus }: ToggleItemProps) => (
  <button
    onClick={onToggle}
    className={cn(
      "flex items-center gap-3 w-full rounded-xl border p-4 transition-all duration-200 text-left active:scale-[0.97]",
      active ? "border-gold/40 bg-gold/5" : "border-border bg-card hover:bg-secondary/50"
    )}
  >
    <div className={cn(
      "flex h-10 w-10 items-center justify-center rounded-lg shrink-0 transition-colors",
      active ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"
    )}>
      <Icon size={20} />
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn("font-semibold text-sm", active && "text-gold")}>{label}</p>
      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
    </div>
    {bonus && active && (
      <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">{bonus}</span>
    )}
    <div className={cn(
      "h-5 w-5 rounded-full border-2 transition-all duration-200 shrink-0 flex items-center justify-center",
      active ? "border-gold bg-gold" : "border-muted-foreground/30"
    )}>
      {active && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
    </div>
  </button>
);

const DailyCheckin = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const { data: lastCheckin } = useQuery({
    queryKey: ["last-checkin", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", user.id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const canCheckin = !lastCheckin || (Date.now() - new Date(lastCheckin.checked_in_at).getTime() > 24 * 60 * 60 * 1000);

  const getTimeUntilCheckin = () => {
    if (!lastCheckin || canCheckin) return null;
    const nextTime = new Date(lastCheckin.checked_in_at).getTime() + 24 * 60 * 60 * 1000;
    const diff = nextTime - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const [sleep, setSleep] = useState(8);
  const [workout, setWorkout] = useState(false);
  const [extraWorkout, setExtraWorkout] = useState(false);
  const [coldShower, setColdShower] = useState(false);
  const [healthyFood, setHealthyFood] = useState(false);
  const [protein, setProtein] = useState(false);
  const [meditationAm, setMeditationAm] = useState(false);
  const [meditationPm, setMeditationPm] = useState(false);
  const [hydration, setHydration] = useState(2);
  const [noPhoneAm, setNoPhoneAm] = useState(false);
  const [noPhonePm, setNoPhonePm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unlockedBadge, setUnlockedBadge] = useState<any>(null);

  const totalXp = [
    workout && 50,
    extraWorkout && 25,
    coldShower && 30,
    healthyFood && 20,
    protein && 15,
    meditationAm && 15,
    meditationPm && 15,
    noPhoneAm && 20,
    noPhonePm && 20,
    hydration >= 3 && 20,
    sleep >= 7 && sleep <= 9 && 25,
  ].filter(Boolean).reduce((a: number, b) => a + (b as number), 0);

  const handleSubmit = async () => {
    if (!user || submitting) return;
    setSubmitting(true);

    try {
      // Insert check-in
      await supabase.from("daily_checkins").insert({
        user_id: user.id,
        sleep_hours: sleep,
        workout,
        extra_workout: extraWorkout,
        cold_shower: coldShower,
        healthy_food: healthyFood,
        protein_intake: protein,
        meditation_morning: meditationAm,
        meditation_evening: meditationPm,
        hydration_liters: hydration,
        no_phone_morning: noPhoneAm,
        no_phone_evening: noPhonePm,
        xp_earned: totalXp,
      });

      // Update profile XP and streak
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        const newXp = profile.xp + totalXp;
        const newLevel = Math.floor(newXp / 500) + 1;
        const newStreak = profile.streak + 1;
        const longestStreak = Math.max(profile.longest_streak, newStreak);

        await supabase
          .from("profiles")
          .update({
            xp: newXp,
            level: newLevel,
            streak: newStreak,
            longest_streak: longestStreak,
          })
          .eq("user_id", user.id);

        // Check for streak badges
        const streakBadges = [
          { streak: 3, name: "3-Day Streak" },
          { streak: 7, name: "7-Day Streak" },
          { streak: 30, name: "30-Day Streak" },
        ];

        for (const sb of streakBadges) {
          if (newStreak >= sb.streak) {
            const { data: badge } = await supabase
              .from("badges")
              .select("*")
              .eq("name", sb.name)
              .single();

            if (badge) {
              const { data: existing } = await supabase
                .from("user_badges")
                .select("id")
                .eq("user_id", user.id)
                .eq("badge_id", badge.id)
                .single();

              if (!existing) {
                await supabase.from("user_badges").insert({
                  user_id: user.id,
                  badge_id: badge.id,
                });
                setUnlockedBadge(badge);
              }
            }
          }
        }
      }

      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["last-checkin"] });
      queryClient.invalidateQueries({ queryKey: ["user-badges"] });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  // 24h lock screen
  if (!canCheckin && !submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-24">
        <div className="animate-reveal">
          <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
            <Moon size={36} className="text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight mb-2">Already Logged Today</h1>
          <p className="text-muted-foreground text-sm mb-2">You can only check in once every 24 hours.</p>
          <p className="text-gold font-display text-lg font-bold mb-8">
            Next check-in in {getTimeUntilCheckin()}
          </p>
          <Button variant="gold-outline" size="lg" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <>
        <BadgeUnlockModal badge={unlockedBadge} onClose={() => setUnlockedBadge(null)} />
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <div className="animate-reveal">
            <div className="h-20 w-20 rounded-full gradient-gold flex items-center justify-center glow-gold mx-auto mb-6">
              <Zap size={36} className="text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl font-black tracking-tight mb-2">Day Logged</h1>
            <p className="text-gold font-display text-4xl font-black glow-gold-text mb-2">+{totalXp} XP</p>
            <p className="text-muted-foreground text-sm mb-8">Your discipline is building. Keep going.</p>
            <Button variant="gold-outline" size="lg" onClick={() => navigate("/")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen pb-28 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6 animate-reveal">
        <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Daily Execution</h1>
          <p className="text-xs text-muted-foreground">Log your day. Earn your status.</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20">
          <Zap size={14} className="text-gold" />
          <span className="text-sm font-bold text-gold tabular-nums">{totalXp}</span>
          <span className="text-xs text-gold/60">XP</span>
        </div>
      </div>

      {/* Sleep */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-border bg-card p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Moon size={20} /></div>
          <div><p className="font-semibold text-sm">Sleep</p><p className="text-xs text-muted-foreground">Optimal: 8–9 hours</p></div>
          <span className={cn("ml-auto text-2xl font-bold font-display tabular-nums", sleep >= 7 && sleep <= 9 ? "text-gold" : "text-muted-foreground")}>{sleep}h</span>
        </div>
        <input type="range" min={4} max={12} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} className="w-full accent-[hsl(var(--gold))] h-1.5" />
      </div>

      {/* Hydration */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-border bg-card p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400"><Droplets size={20} /></div>
          <div><p className="font-semibold text-sm">Hydration</p><p className="text-xs text-muted-foreground">Target: 3L+</p></div>
          <span className={cn("ml-auto text-2xl font-bold font-display tabular-nums", hydration >= 3 ? "text-gold" : "text-muted-foreground")}>{hydration}L</span>
        </div>
        <input type="range" min={0} max={5} step={0.5} value={hydration} onChange={(e) => setHydration(Number(e.target.value))} className="w-full accent-[hsl(var(--gold))] h-1.5" />
      </div>

      {/* Toggles */}
      <div className="space-y-2.5 animate-reveal animate-reveal-delay-2">
        <ToggleItem icon={Dumbbell} label="Workout" sublabel="Gym, combat sports, cardio" active={workout} onToggle={() => setWorkout(!workout)} bonus="+50 XP" />
        <ToggleItem icon={Plus} label="Extra Workout" sublabel="Second session today" active={extraWorkout} onToggle={() => setExtraWorkout(!extraWorkout)} bonus="+25 XP" />
        <ToggleItem icon={Snowflake} label="Cold Shower" sublabel="Build mental toughness" active={coldShower} onToggle={() => setColdShower(!coldShower)} bonus="+30 XP" />
        <ToggleItem icon={Apple} label="Healthy Food" sublabel="Clean meals all day" active={healthyFood} onToggle={() => setHealthyFood(!healthyFood)} bonus="+20 XP" />
        <ToggleItem icon={Apple} label="Protein Intake" sublabel="Hit your protein target" active={protein} onToggle={() => setProtein(!protein)} bonus="+15 XP" />
        <ToggleItem icon={Brain} label="Morning Meditation" sublabel="Start the day focused" active={meditationAm} onToggle={() => setMeditationAm(!meditationAm)} bonus="+15 XP" />
        <ToggleItem icon={Brain} label="Evening Meditation" sublabel="Reflect and wind down" active={meditationPm} onToggle={() => setMeditationPm(!meditationPm)} bonus="+15 XP" />
        <ToggleItem icon={Smartphone} label="No Phone After Waking" sublabel="30 min screen-free" active={noPhoneAm} onToggle={() => setNoPhoneAm(!noPhoneAm)} bonus="+20 XP" />
        <ToggleItem icon={Smartphone} label="No Phone Before Sleep" sublabel="30 min screen-free" active={noPhonePm} onToggle={() => setNoPhonePm(!noPhonePm)} bonus="+20 XP" />
      </div>

      {/* Proof Photo */}
      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        <button className="flex items-center gap-3 w-full rounded-xl border border-dashed border-border p-4 hover:bg-secondary/50 transition-colors active:scale-[0.97]">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Camera size={20} /></div>
          <div className="text-left"><p className="font-semibold text-sm">Upload Proof Photo</p><p className="text-xs text-muted-foreground">Optional — earns bonus XP</p></div>
        </button>
      </div>

      {/* Submit */}
      <div className="mt-6 animate-reveal animate-reveal-delay-4">
        <Button variant="gold" size="xl" className="w-full" onClick={handleSubmit} disabled={submitting}>
          <Zap size={20} />
          {submitting ? "Submitting..." : `Submit Day — Earn ${totalXp} XP`}
        </Button>
      </div>
    </div>
  );
};

export default DailyCheckin;
