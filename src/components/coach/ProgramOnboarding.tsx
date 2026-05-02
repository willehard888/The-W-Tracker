import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronRight, Dumbbell, Loader2, Sparkles, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

interface Props {
  onGenerated: () => void;
}

const GOALS = [
  { id: "build_muscle", label: "Build muscle" },
  { id: "fat_loss", label: "Fat loss" },
  { id: "endurance", label: "Endurance" },
  { id: "strength", label: "Raw strength" },
  { id: "discipline", label: "Discipline reset" },
  { id: "general", label: "General health" },
];

const EQUIPMENT = [
  { id: "full_gym", label: "Full gym" },
  { id: "home_dumbbells", label: "Dumbbells at home" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "bodyweight", label: "Bodyweight only" },
];

const FOCUS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes", "Conditioning"];

const EXPERIENCE = [
  { id: "beginner", label: "Beginner", sub: "<6 months" },
  { id: "intermediate", label: "Intermediate", sub: "6 mo – 3 yr" },
  { id: "advanced", label: "Advanced", sub: "3+ years" },
];

const ProgramOnboarding = ({ onGenerated }: Props) => {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<string | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [days, setDays] = useState(4);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [bodyFocus, setBodyFocus] = useState<string[]>([]);
  const [constraints, setConstraints] = useState("");
  const [generating, setGenerating] = useState(false);

  const goalLabel = GOALS.find((g) => g.id === goal)?.label ?? "";
  const equipLabel = EQUIPMENT.find((e) => e.id === equipment)?.label ?? "";

  const canNext = [
    !!goal,
    !!experience,
    !!equipment,
    true,
  ][step];

  const next = () => {
    if (!canNext) return;
    hapticImpact("light");
    setStep((s) => Math.min(3, s + 1));
  };
  const back = () => {
    hapticImpact("light");
    setStep((s) => Math.max(0, s - 1));
  };

  const generate = async () => {
    if (!goal || !experience || !equipment) return;
    setGenerating(true);
    hapticImpact("medium");
    try {
      const { data, error } = await supabase.functions.invoke("coach-generate-program", {
        body: {
          goal: goalLabel,
          experience,
          days_per_week: days,
          equipment: equipLabel,
          body_focus: bodyFocus,
          constraints,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      hapticNotification("success");
      toast.success("Your 4-week program is ready.");
      onGenerated();
    } catch (e: any) {
      hapticNotification("error");
      toast.error(e?.message ?? "Couldn't generate program. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="relative mb-6">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full blur-2xl"
            style={{
              background: "radial-gradient(circle, hsl(var(--gold)/0.55) 0%, transparent 70%)",
            }}
          />
          <div className="relative h-20 w-20 rounded-3xl flex items-center justify-center bg-gradient-to-br from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold-dark))] shadow-[0_8px_28px_hsl(var(--gold)/0.5)]">
            <Sparkles size={32} className="text-background animate-pulse" strokeWidth={2.6} />
          </div>
        </div>
        <h2 className="font-display text-2xl font-black mb-2">Coach is designing your block</h2>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Building 4 progressive weeks tuned to your goal, schedule and last 30 days of data. Takes
          about 20 seconds.
        </p>
        <Loader2 size={20} className="animate-spin text-gold mt-6" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-6 max-w-md mx-auto w-full">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mb-5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === step ? "w-7 bg-gold" : i < step ? "w-3 bg-gold/60" : "w-3 bg-border",
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.22 }}
        >
          {step === 0 && (
            <>
              <p className="text-[10px] font-black tracking-[0.22em] uppercase text-gold mb-1">
                Step 1 of 4
              </p>
              <h2 className="font-display text-2xl font-black tracking-tight mb-1">
                What's the goal?
              </h2>
              <p className="text-xs text-muted-foreground mb-5">
                Pick the outcome that matters most this block.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      hapticImpact("light");
                      setGoal(g.id);
                    }}
                    className={cn(
                      "rounded-xl px-3 py-3 text-left text-sm font-bold border transition-all",
                      goal === g.id
                        ? "bg-gold/15 border-gold text-foreground shadow-[0_0_18px_hsl(var(--gold)/0.35)]"
                        : "bg-card/60 border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Target size={14} className={cn("mb-1", goal === g.id ? "text-gold" : "text-muted-foreground")} />
                    {g.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-[10px] font-black tracking-[0.22em] uppercase text-gold mb-1">
                Step 2 of 4
              </p>
              <h2 className="font-display text-2xl font-black tracking-tight mb-1">
                Your level & schedule
              </h2>
              <p className="text-xs text-muted-foreground mb-5">
                Honest answer wins — Coach calibrates volume and intensity to it.
              </p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {EXPERIENCE.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      hapticImpact("light");
                      setExperience(e.id);
                    }}
                    className={cn(
                      "rounded-xl py-3 text-center border transition-all",
                      experience === e.id
                        ? "bg-gold/15 border-gold shadow-[0_0_18px_hsl(var(--gold)/0.35)]"
                        : "bg-card/60 border-border/60",
                    )}
                  >
                    <p className={cn("text-sm font-black", experience === e.id ? "text-foreground" : "text-muted-foreground")}>
                      {e.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{e.sub}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl bg-card/60 border border-border/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                    Training days per week
                  </p>
                  <p className="font-display text-2xl font-black text-gold leading-none">{days}</p>
                </div>
                <input
                  type="range"
                  min={2}
                  max={6}
                  step={1}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full accent-[hsl(var(--gold))]"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-[10px] font-black tracking-[0.22em] uppercase text-gold mb-1">
                Step 3 of 4
              </p>
              <h2 className="font-display text-2xl font-black tracking-tight mb-1">
                What do you train with?
              </h2>
              <p className="text-xs text-muted-foreground mb-5">
                Coach will only program what you can actually execute.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {EQUIPMENT.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      hapticImpact("light");
                      setEquipment(e.id);
                    }}
                    className={cn(
                      "rounded-xl px-3 py-3 text-left text-sm font-bold border transition-all",
                      equipment === e.id
                        ? "bg-gold/15 border-gold shadow-[0_0_18px_hsl(var(--gold)/0.35)]"
                        : "bg-card/60 border-border/60 text-muted-foreground",
                    )}
                  >
                    <Dumbbell size={14} className={cn("mb-1", equipment === e.id ? "text-gold" : "text-muted-foreground")} />
                    {e.label}
                  </button>
                ))}
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Optional emphasis (pick any)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FOCUS.map((f) => {
                  const on = bodyFocus.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        hapticImpact("light");
                        setBodyFocus((prev) =>
                          prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
                        );
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-black tracking-wider border transition-all",
                        on
                          ? "bg-gold text-background border-gold"
                          : "bg-card/60 text-muted-foreground border-border/60",
                      )}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-[10px] font-black tracking-[0.22em] uppercase text-gold mb-1">
                Step 4 of 4
              </p>
              <h2 className="font-display text-2xl font-black tracking-tight mb-1">
                Anything to flag?
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Injuries, deload weeks, time pressure, hard days. Optional.
              </p>
              <textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="e.g. lower-back tweak — avoid heavy deadlifts; can't train Wednesdays"
                rows={4}
                className="w-full resize-none rounded-xl border border-border/60 bg-card/60 px-3.5 py-3 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30"
              />

              <div className="mt-5 rounded-2xl border border-gold/30 bg-gradient-to-b from-gold/[0.10] to-card p-4">
                <p className="text-[10px] font-black tracking-[0.22em] uppercase text-gold mb-2">
                  Coach will design
                </p>
                <ul className="text-xs space-y-1 text-foreground/85">
                  <li>• 4-week progressive block · {days} sessions/wk</li>
                  <li>• Goal: {goalLabel || "—"}</li>
                  <li>• Equipment: {equipLabel || "—"}</li>
                  {bodyFocus.length > 0 && <li>• Focus: {bodyFocus.join(", ")}</li>}
                  <li>• Recovery, nutrition & weekly targets included</li>
                </ul>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Nav */}
      <div className="flex items-center gap-2 mt-6">
        {step > 0 && (
          <Button variant="ghost" onClick={back} className="flex-1">
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button variant="gold" onClick={next} disabled={!canNext} className="flex-1">
            Continue <ChevronRight size={16} />
          </Button>
        ) : (
          <Button variant="gold" onClick={generate} className="flex-1 font-black">
            <Zap size={16} /> Generate program
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProgramOnboarding;
