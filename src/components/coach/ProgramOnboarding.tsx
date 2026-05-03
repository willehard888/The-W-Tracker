import { forwardRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

interface Props {
  onGenerated: () => void;
}

const DRAFT_KEY = "w_coach_program_draft_v1";
const STEP_KEY = "w_coach_program_step_v1";

type GoalId =
  | "all"
  | "build_muscle"
  | "fat_loss"
  | "endurance"
  | "strength"
  | "discipline"
  | "general";

const GOALS: { id: GoalId; label: string; sub: string; emoji: string }[] = [
  { id: "all",          label: "All-around",      sub: "Strong, lean, sharp — balanced everywhere", emoji: "⚡" },
  { id: "build_muscle", label: "Build muscle",    sub: "Visible size, lean mass", emoji: "💪" },
  { id: "fat_loss",     label: "Fat loss",        sub: "Lean down, keep muscle", emoji: "🔥" },
  { id: "strength",     label: "Raw strength",    sub: "Lift heavier, build power", emoji: "🏋️" },
  { id: "endurance",    label: "Endurance",       sub: "Run, ride, last longer", emoji: "🏃" },
  { id: "discipline",   label: "Discipline reset", sub: "Rebuild the daily streak", emoji: "🧱" },
  { id: "general",      label: "General health",  sub: "Move well, feel sharp", emoji: "🌱" },
];

const EQUIPMENT = [
  { id: "full_gym",        label: "Full gym" },
  { id: "home_dumbbells",  label: "Dumbbells" },
  { id: "kettlebell",      label: "Kettlebell" },
  { id: "bodyweight",      label: "Bodyweight" },
];

const FOCUS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes", "Conditioning"];

const EXPERIENCE = [
  { id: "beginner",     label: "Beginner",     sub: "<6 mo" },
  { id: "intermediate", label: "Intermediate", sub: "6m–3y" },
  { id: "advanced",     label: "Advanced",     sub: "3y+" },
];

const loadDraft = (): any | null => {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const loadStep = (): number => {
  try { return Number(localStorage.getItem(STEP_KEY) ?? 0) || 0; } catch { return 0; }
};

const ProgramOnboarding = ({ onGenerated }: Props) => {
  const [step, setStep] = useState<number>(() => loadStep());
  const [draft, setDraft] = useState<any>(() => {
    const saved = loadDraft();
    return saved ?? {
      goal: "all" as GoalId,
      experience: "intermediate",
      days: 4,
      equipment: "full_gym",
      bodyFocus: [] as string[],
      constraints: "",
    };
  });
  const [generating, setGenerating] = useState(false);

  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {} }, [draft]);
  useEffect(() => { try { localStorage.setItem(STEP_KEY, String(step)); } catch {} }, [step]);

  const set = (patch: any) => setDraft((d: any) => ({ ...d, ...patch }));
  const toggleFocus = (f: string) => {
    const arr: string[] = draft.bodyFocus ?? [];
    set({ bodyFocus: arr.includes(f) ? arr.filter(x => x !== f) : [...arr, f] });
  };

  const goalLabel  = GOALS.find(g => g.id === draft.goal)?.label ?? "";
  const equipLabel = EQUIPMENT.find(e => e.id === draft.equipment)?.label ?? "";

  const STEPS = [
    {
      title: "What do you want?",
      sub: "Pick your main focus. Coach builds the block around this.",
      content: (
        <div className="space-y-2">
          {GOALS.map(g => (
            <button key={g.id} type="button"
              onClick={() => { hapticImpact("light"); set({ goal: g.id }); }}
              className={cn(
                "w-full text-left rounded-2xl px-4 py-3.5 border transition-all flex items-center gap-3",
                draft.goal === g.id
                  ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)] shadow-[0_0_24px_-8px_hsl(var(--gold)/0.6)]"
                  : "border-border/40 bg-card/40"
              )}>
              <span className="text-2xl">{g.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-bold">{g.label}</div>
                <div className="text-xs text-muted-foreground leading-tight">{g.sub}</div>
              </div>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Your level & schedule",
      sub: "Honest answer wins — Coach calibrates to it.",
      content: (
        <div className="space-y-5">
          <Field label="Experience">
            <div className="grid grid-cols-3 gap-1.5">
              {EXPERIENCE.map(e => (
                <Chip key={e.id} active={draft.experience === e.id}
                  onClick={() => set({ experience: e.id })}>
                  <span className="block text-sm font-bold">{e.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{e.sub}</span>
                </Chip>
              ))}
            </div>
          </Field>
          <Stepper label="Training days / week" unit="days" value={draft.days}
            min={2} max={6} step={1} onChange={v => set({ days: v })} />
        </div>
      ),
    },
    {
      title: "What do you train with?",
      sub: "Coach will only program what you can actually execute.",
      content: (
        <div className="space-y-5">
          <Field label="Equipment">
            <div className="grid grid-cols-2 gap-1.5">
              {EQUIPMENT.map(e => (
                <Chip key={e.id} active={draft.equipment === e.id}
                  onClick={() => set({ equipment: e.id })}>
                  {e.label}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Optional emphasis">
            <div className="flex flex-wrap gap-1.5">
              {FOCUS.map(f => (
                <Chip key={f} small active={draft.bodyFocus.includes(f)} onClick={() => toggleFocus(f)}>
                  {f}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      ),
    },
    {
      title: "Anything to flag?",
      sub: "Optional. Injuries, deloads, time pressure — or skip ahead.",
      content: (
        <div className="space-y-4">
          <textarea
            value={draft.constraints}
            onChange={e => set({ constraints: e.target.value.slice(0, 280) })}
            placeholder="e.g. lower-back tweak — avoid heavy deadlifts; can't train Wednesdays"
            rows={4}
            className="w-full resize-none rounded-2xl border border-border/50 bg-card/60 px-3.5 py-3 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30"
          />
          <p className="text-[10px] text-muted-foreground/70 -mt-3 text-right">{draft.constraints.length}/280</p>

          <div className="rounded-2xl border border-[hsl(var(--gold)/0.3)] bg-gradient-to-b from-[hsl(var(--gold)/0.08)] to-card/40 p-4">
            <p className="text-[10px] font-black tracking-[0.18em] uppercase text-gold mb-2">Coach will design</p>
            <ul className="text-xs space-y-1 text-foreground/85">
              <li>• 4-week progressive block · {draft.days} sessions/wk</li>
              <li>• Goal: {goalLabel}</li>
              <li>• Equipment: {equipLabel}</li>
              {draft.bodyFocus.length > 0 && <li>• Focus: {draft.bodyFocus.join(", ")}</li>}
              <li>• Recovery, nutrition & weekly targets included</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  const last = step === STEPS.length - 1;
  const cur = STEPS[step];
  const optional = step === 3;

  const generate = async () => {
    setGenerating(true);
    hapticImpact("medium");
    try {
      const { data, error } = await supabase.functions.invoke("coach-generate-program", {
        body: {
          goal: goalLabel,
          experience: draft.experience,
          days_per_week: draft.days,
          equipment: equipLabel,
          body_focus: draft.bodyFocus,
          constraints: draft.constraints,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(STEP_KEY); } catch {}
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

  const next = () => {
    if (last) { generate(); return; }
    hapticImpact("light");
    setStep(s => s + 1);
  };

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="relative mb-6">
          <div aria-hidden className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: "radial-gradient(circle, hsl(var(--gold)/0.55) 0%, transparent 70%)" }} />
          <div className="relative h-20 w-20 rounded-3xl flex items-center justify-center bg-gradient-to-br from-[hsl(var(--gold-light))] via-gold to-[hsl(var(--gold-dark))] shadow-[0_8px_28px_hsl(var(--gold)/0.5)]">
            <Sparkles size={32} className="text-background animate-pulse" strokeWidth={2.6} />
          </div>
        </div>
        <h2 className="font-display text-2xl font-black mb-2">Coach is designing your block</h2>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Building 4 progressive weeks tuned to your goal and last 30 days. ~20 seconds.
        </p>
        <Loader2 size={20} className="animate-spin text-gold mt-6" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
      <div className="flex gap-1 mb-5">
        {STEPS.map((_, i) => (
          <div key={i} className={cn(
            "flex-1 h-1 rounded-full transition-colors",
            i <= step ? "bg-[hsl(var(--gold))]" : "bg-border/40"
          )} />
        ))}
      </div>

      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={14} className="text-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gold">Step {step + 1} of {STEPS.length}</p>
      </div>
      <h2 className="font-display text-2xl font-black tracking-tight leading-tight">{cur.title}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">{cur.sub}</p>

      <AnimatePresence mode="wait">
        <motion.div key={step}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.2 }}>
          {cur.content}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-2 mt-7 sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-background via-background/95 to-transparent">
        {step > 0 && (
          <Button variant="ghost" size="lg" onClick={() => { hapticImpact("light"); setStep(s => s - 1); }}>
            <ChevronLeft size={16} /> Back
          </Button>
        )}
        <Button variant="ember" size="lg" className="flex-1" onClick={next}>
          {last ? <><Zap size={16} /> Generate program</> : <>{optional ? "Continue" : "Next"} <ChevronRight size={16} /></>}
        </Button>
      </div>
    </div>
  );
};

const Field = forwardRef<HTMLDivElement, { label: string; children: React.ReactNode }>(
  ({ label, children }, ref) => (
    <div ref={ref}>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      {children}
    </div>
  ),
);
Field.displayName = "Field";

const Chip = forwardRef<HTMLButtonElement, { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }>(
  ({ active, onClick, children, small }, ref) => (
    <button ref={ref} type="button" onClick={onClick}
      className={cn(
        "rounded-2xl border transition-all text-center",
        small ? "px-3 py-1.5 text-xs rounded-full" : "px-3 py-2.5 text-sm",
        active
          ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold))] font-bold"
          : "border-border/40 bg-card/40 text-muted-foreground"
      )}>
      {children}
    </button>
  ),
);
Chip.displayName = "Chip";

const Stepper = ({
  label, unit, value, min, max, step, onChange,
}: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) => {
  const dec = () => { hapticImpact("light"); onChange(Math.max(min, value - step)); };
  const inc = () => { hapticImpact("light"); onChange(Math.min(max, value + step)); };
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card/40 px-2 py-2">
        <button type="button" onClick={dec}
          className="h-10 w-10 rounded-xl bg-card/60 border border-border/40 flex items-center justify-center active:scale-95 transition">
          <Minus size={16} />
        </button>
        <div className="flex-1 text-center">
          <span className="font-display text-2xl font-black tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground ml-1.5">{unit}</span>
        </div>
        <button type="button" onClick={inc}
          className="h-10 w-10 rounded-xl bg-card/60 border border-border/40 flex items-center justify-center active:scale-95 transition">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

export default ProgramOnboarding;
