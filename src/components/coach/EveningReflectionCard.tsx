import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Check, Sparkles, ChevronDown } from "lucide-react";
import { useTodayReflection } from "@/hooks/use-coach-reflection";
import { Button } from "@/components/ui/button";
import { hapticImpact } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const Scale = ({
  label,
  value,
  onChange,
  max = 5,
  hints,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  max?: number;
  hints?: [string, string];
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {value != null && <span className="text-[12px] font-black text-gold">{value}/{max}</span>}
    </div>
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const active = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => { hapticImpact("light"); onChange(n); }}
            className={cn(
              "flex-1 h-9 rounded-lg text-[12px] font-black transition-all border",
              active
                ? "bg-gradient-to-b from-[hsl(42_88%_62%)] to-[hsl(42_78%_48%)] text-[hsl(260_18%_4%)] border-[hsl(42_78%_48%)] shadow-[0_2px_8px_-2px_hsl(var(--gold)/0.6)]"
                : "bg-card/40 border-border/40 text-muted-foreground/60 hover:border-border/80",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
    {hints && (
      <div className="flex justify-between text-[10px] text-muted-foreground/60">
        <span>{hints[0]}</span><span>{hints[1]}</span>
      </div>
    )}
  </div>
);

const EveningReflectionCard = () => {
  const { reflection, isLoading, submit } = useTodayReflection();
  const [open, setOpen] = useState(false);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [win, setWin] = useState("");
  const [friction, setFriction] = useState("");

  useEffect(() => {
    if (reflection) {
      setEnergy(reflection.energy_1to5);
      setSleep(reflection.sleep_quality_1to5 ?? null);
      setMood(reflection.mood_1to5 ?? null);
      setRpe(reflection.rpe_1to10 ?? null);
      setWin(reflection.win ?? "");
      setFriction(reflection.friction ?? "");
    }
  }, [reflection]);

  if (isLoading) return null;

  const done = !!reflection;

  const canSubmit = energy != null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    submit.mutate({
      energy_1to5: energy!,
      sleep_quality_1to5: sleep,
      mood_1to5: mood,
      rpe_1to10: rpe,
      win: win.trim() || null,
      friction: friction.trim() || null,
    });
    setOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/40 bg-gradient-to-b from-[hsl(255_15%_8%)] to-[hsl(255_18%_5%)] overflow-hidden shadow-[0_8px_24px_-12px_hsl(0_0%_0%/0.6)]"
    >
      <button
        type="button"
        onClick={() => { hapticImpact("light"); setOpen((v) => !v); }}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
            done ? "bg-gradient-to-br from-xp-green/30 to-xp-green/20 text-xp-green" : "bg-card/60 text-gold",
          )}>
            {done ? <Check size={16} /> : <Moon size={16} />}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black tracking-tight">
              {done ? "Tonight's reflection logged" : "Evening reflection"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {done ? "Tomorrow's plan will adapt to it." : "30 seconds — feeds tomorrow's plan."}
            </p>
          </div>
        </div>
        <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/30">
              <Scale label="Energy now" value={energy} onChange={setEnergy} hints={["fried", "wired"]} />
              <Scale label="Sleep last night" value={sleep} onChange={setSleep} hints={["poor", "great"]} />
              <Scale label="Mood today" value={mood} onChange={setMood} hints={["low", "high"]} />
              <Scale label="Session RPE" value={rpe} onChange={setRpe} max={10} hints={["easy", "max"]} />

              <div className="space-y-1.5">
                <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">One win</span>
                <input
                  value={win}
                  onChange={(e) => setWin(e.target.value.slice(0, 200))}
                  placeholder="What worked today?"
                  className="w-full rounded-lg bg-card/60 border border-border/50 px-3 py-2 text-sm focus:outline-none focus:border-gold/60"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">One friction</span>
                <input
                  value={friction}
                  onChange={(e) => setFriction(e.target.value.slice(0, 200))}
                  placeholder="What got in the way?"
                  className="w-full rounded-lg bg-card/60 border border-border/50 px-3 py-2 text-sm focus:outline-none focus:border-gold/60"
                />
              </div>

              <Button
                variant="ember"
                size="sm"
                className="w-full"
                disabled={!canSubmit}
                loading={submit.isPending}
                onClick={handleSubmit}
              >
                <Sparkles size={14} className="mr-1.5" />
                {done ? "Update reflection" : "Log reflection"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EveningReflectionCard;
