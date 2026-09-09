import { forwardRef, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { SPORTS } from "@/lib/sports";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, Minus, Plus, Check,
  Zap, Dumbbell, BicepsFlexed, Flame, Footprints, Leaf, Brain,
  Sprout, TrendingUp, Medal,
  Feather, Megaphone, FlaskConical,
  Home, Trees, Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { useCommitPop } from "@/hooks/use-commit-pop";
import { useAthleteProfile, type ToneId, type GoalId, type TrainingExperience } from "@/hooks/use-athlete-profile";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";

const DRAFT_KEY = "w_coach_onboarding_draft_v2";
const STEP_KEY = "w_coach_onboarding_step_v2";

interface Props { onDone: () => void }

type Option<Id extends string = string> = { id: Id; label: string; sub: string; icon: LucideIcon };

// The option lists are exported: the read view (/coach/profile) renders the
// same labels, so the two screens can never drift apart.
export const GOALS: Option<GoalId>[] = [
  { id: "all",        label: "All-around",     sub: "Strong, lean, sharp — balanced progress everywhere", icon: Zap },
  { id: "strength",   label: "Get stronger",   sub: "Lift heavier, build raw power", icon: Dumbbell },
  { id: "hypertrophy",label: "Build muscle",   sub: "Visible size, lean mass", icon: BicepsFlexed },
  { id: "fat_loss",   label: "Lose fat",       sub: "Lean down, keep muscle", icon: Flame },
  { id: "endurance",  label: "Endurance",      sub: "Run, ride, last longer", icon: Footprints },
  { id: "longevity",  label: "Longevity",      sub: "Health-span, energy 20y out", icon: Leaf },
  { id: "focus",      label: "Sharpen focus",  sub: "Mind, deep work, sleep", icon: Brain },
];

/**
 * The question the coach was missing entirely.
 *
 * It knew an athlete's body-fat percentage but not whether they had ever done a
 * squat, so it handed complete beginners four to six barbell lifts a day. This
 * answer decides whether someone starts on the written 8-week path or goes
 * straight to the AI generator.
 */
export const EXPERIENCE: Option<TrainingExperience>[] = [
  { id: "never_trained",  label: "New to the gym",       sub: "Never trained, or it has been years — we start from the beginning", icon: Sprout },
  { id: "under_6_months", label: "Some experience",      sub: "A few months in. You know the machines, still finding your footing", icon: TrendingUp },
  { id: "experienced",    label: "I know my way around", sub: "Comfortable with the main lifts and training on your own", icon: Medal },
];

export const TONES: Option<ToneId>[] = [
  { id: "calm_mentor",    label: "Calm mentor",    sub: "Steady, supportive, precise", icon: Feather },
  { id: "drill_sergeant", label: "Drill sergeant", sub: "Blunt. No excuses.", icon: Megaphone },
  { id: "scientist",      label: "Scientist",      sub: "Evidence, mechanisms, numbers", icon: FlaskConical },
  { id: "hype",           label: "Hype coach",     sub: "Energy. Wins. Momentum.", icon: Flame },
];

// 4 environment presets replace the previous 9-item granular list.
// User feedback: "tee välinevalinnasta todella simppeli esim full gym jne."
// The AI program generator expands these into fine-grained equipment lists
// via expandEquipmentPresets() in src/lib/coach/equipment-presets.ts.
export const EQUIPMENT_PRESETS: Option[] = [
  { id: "full_gym",      label: "Full gym",           sub: "Barbells, racks, machines", icon: Dumbbell },
  { id: "home_minimal",  label: "Home minimal",       sub: "Bodyweight + dumbbells + bands", icon: Home },
  { id: "outdoor",       label: "Outdoor / running",  sub: "Runs, hikes, calisthenics", icon: Trees },
  { id: "combat_sport",  label: "Combat / sport gym", sub: "Bags, mats, partner work", icon: Swords },
];
const DIET = ["Omnivore","Vegetarian","Vegan","Lactose-free","Gluten-free","Halal","Keto"];
const INJURIES = ["Lower back","Knee","Shoulder","Hip","Wrist","Elbow","Neck"];

// Mind & life step (migration 20260511181220).
const HOBBIES = [
  "Reading", "Music", "Gaming", "Outdoors",
  "Cooking", "Creative work", "Family", "Social", "Sport",
];
export const MENTAL_FOCUS: { id: string; label: string }[] = [
  { id: "anxiety",  label: "Anxiety"   },
  { id: "low_mood", label: "Low mood"  },
  { id: "focus",    label: "Focus"     },
  { id: "sleep",    label: "Sleep"     },
  { id: "burnout",  label: "Burnout"   },
  { id: "none",     label: "None"      },
];
/** The 1–5 scales in words, index = value − 1. Shared with the read view. */
export const STRESS_WORDS = ["Calm", "Settled", "Steady", "Tense", "Overwhelmed"];
export const MOOD_WORDS   = ["Down", "Low", "Flat", "Good", "Energised"];

const loadDraft = (): any | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const loadStep = (): number => {
  try { return Number(localStorage.getItem(STEP_KEY) ?? 0) || 0; } catch { return 0; }
};

const AthleteProfileOnboarding = ({ onDone }: Props) => {
  const { profile, upsert, isSaving } = useAthleteProfile();
  const [step, setStep] = useState<number>(() => loadStep());
  const [draft, setDraft] = useState<any>(() => {
    const saved = loadDraft();
    return saved ?? {
      age: profile?.age ?? 30,
      sex: profile?.sex ?? "prefer_not_say",
      height_cm: profile?.height_cm ?? 180,
      weight_kg: profile?.weight_kg ?? 80,
      primary_goal: profile?.primary_goal ?? "all",
      // No default. An unanswered experience question must stay unanswered —
      // guessing "experienced" here would put a first-timer under a barbell.
      training_experience: profile?.training_experience ?? null,
      target_horizon_weeks: profile?.target_horizon_weeks ?? 12,
      wake_time: profile?.wake_time?.slice(0,5) ?? "07:00",
      sleep_time: profile?.sleep_time?.slice(0,5) ?? "23:00",
      training_days_pref: profile?.training_days_pref ?? [1,2,4,5],
      injuries: profile?.injuries ?? [],
      dietary: profile?.dietary ?? [],
      equipment: profile?.equipment ?? [],
      sports: profile?.sports ?? [],
      tone_pref: profile?.tone_pref ?? "calm_mentor",
      preferred_session_length_min: profile?.preferred_session_length_min ?? 45,
      i_am: profile?.i_am ?? "",
      // Holistic (migration 20260511181220): mind / life context.
      hobbies: profile?.hobbies ?? [],
      life_context: profile?.life_context ?? "",
      stress_baseline: profile?.stress_baseline ?? null,
      mood_baseline: profile?.mood_baseline ?? null,
      mental_health_focus: profile?.mental_health_focus ?? [],
    };
  });

  // Persist draft + step on every change so user never loses progress.
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, [draft]);
  useEffect(() => {
    try { localStorage.setItem(STEP_KEY, String(step)); } catch {}
  }, [step]);

  const set = (patch: any) => setDraft((d: any) => ({ ...d, ...patch }));
  const toggle = (key: string, val: any) => {
    const arr: any[] = draft[key] ?? [];
    set({ [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] });
  };
  const pick = (key: string, val: any) => { hapticImpact("light"); set({ [key]: val }); };

  const STEPS = [
    // 0 — goal first (most important)
    {
      title: "What do you want?",
      sub: "Pick your main focus. The Coach builds everything around this.",
      content: (
        <div>
          <div className="space-y-1">
            {GOALS.map(g => (
              <OptionRow key={g.id} {...g} active={draft.primary_goal === g.id} onClick={() => pick("primary_goal", g.id)} />
            ))}
          </div>

          {/* Sports — the coach's standing sport context ("lajivalmennus").
              Separate from hobbies on purpose: hobbies steer recovery framing,
              sports steer programming. */}
          <div className="pt-5">
            <Field label="What do you train? Pick any.">
              <div className="flex flex-wrap gap-1.5">
                {SPORTS.map((sp) => (
                  <Chip key={sp.id} active={(draft.sports ?? []).includes(sp.id)} onClick={() => { hapticImpact("light"); toggle("sports", sp.id); }}>
                    {sp.label}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
        </div>
      ),
    },
    // 1 — experience. Asked early because it decides which kind of program
    // gets built at all, not just how hard it is.
    {
      title: "Have you trained before?",
      sub: "There is no wrong answer here. It decides where we start you.",
      // Not optional: a null answer reads as "experienced" downstream, which is
      // exactly the person the written beginner path exists to catch.
      required: true,
      content: (
        <div className="space-y-1">
          {EXPERIENCE.map(e => (
            <OptionRow key={e.id} {...e} active={draft.training_experience === e.id} onClick={() => pick("training_experience", e.id)} />
          ))}
          {draft.training_experience === "never_trained" && (
            <p className="text-[12px] text-muted-foreground leading-snug pt-2 px-3">
              You will start on a written 8-week plan: three sessions a week, a handful of
              movements, and proper coaching on every one of them. Your coach takes over once
              they feel familiar.
            </p>
          )}
        </div>
      ),
    },
    // 2 — body (steppers, much faster than sliders)
    {
      title: "Your body",
      sub: "Used to dose protein, sleep targets, training intensity.",
      content: (
        <div className="space-y-4">
          <Stepper label="Age" unit="yrs" value={draft.age} min={16} max={80} step={1}
            onChange={v => set({ age: v })} />
          <Stepper label="Height" unit="cm" value={draft.height_cm} min={140} max={220} step={1}
            onChange={v => set({ height_cm: v })} />
          <Stepper label="Weight" unit="kg" value={draft.weight_kg} min={40} max={180} step={1}
            onChange={v => set({ weight_kg: v })} />
          <Field label="Sex">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                {id:"male",l:"Male"},{id:"female",l:"Female"},
                {id:"other",l:"Other"},{id:"prefer_not_say",l:"Skip"}
              ].map(s => (
                <Chip key={s.id} active={draft.sex === s.id} onClick={() => set({ sex: s.id })}>
                  {s.l}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      ),
    },
    // 3 — Mind & life (holistic well-being capture)
    {
      title: "Mind & life",
      sub: "Helps the Coach see the whole you — physical, mental, emotional.",
      content: (
        <div className="space-y-5">
          <Field label="What do you do for joy?">
            <div className="flex flex-wrap gap-1.5">
              {HOBBIES.map(h => (
                <Chip key={h} active={draft.hobbies.includes(h)} onClick={() => toggle("hobbies", h)}>
                  {h}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="A line about your life right now">
            <textarea
              rows={2}
              value={draft.life_context ?? ""}
              onChange={e => set({ life_context: e.target.value.slice(0, 160) })}
              placeholder="e.g. New baby, working remote, training around 6am only."
              className="w-full resize-none surface-inset rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1 tabular-nums">{(draft.life_context ?? "").length}/160</p>
          </Field>

          <Field label="Stress lately">
            <Scale name="Stress level" value={draft.stress_baseline} words={STRESS_WORDS} onChange={v => pick("stress_baseline", v)} />
          </Field>

          <Field label="Mood lately">
            <Scale name="Mood level" value={draft.mood_baseline} words={MOOD_WORDS} onChange={v => pick("mood_baseline", v)} />
          </Field>

          <Field label="Anything to focus on? Optional, private.">
            <div className="flex flex-wrap gap-1.5">
              {MENTAL_FOCUS.map(m => (
                <Chip key={m.id} active={draft.mental_health_focus.includes(m.id)} onClick={() => toggle("mental_health_focus", m.id)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      ),
    },
    // 4 — constraints (optional, can skip)
    {
      title: "Anything to work around?",
      sub: "Optional. Tap what applies — or skip ahead.",
      optional: true,
      content: (
        <div className="space-y-5">
          <Field label="Where do you train? Pick any.">
            <div className="space-y-1">
              {EQUIPMENT_PRESETS.map((p) => (
                <OptionRow key={p.id} {...p} active={draft.equipment.includes(p.id)} onClick={() => { hapticImpact("light"); toggle("equipment", p.id); }} />
              ))}
            </div>
          </Field>
          <Field label="Injuries / no-go zones">
            <div className="flex flex-wrap gap-1.5">
              {INJURIES.map(i => (
                <Chip key={i} active={draft.injuries.includes(i)} onClick={() => toggle("injuries", i)}>{i}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Diet">
            <div className="flex flex-wrap gap-1.5">
              {DIET.map(d => (
                <Chip key={d} active={draft.dietary.includes(d)} onClick={() => toggle("dietary", d)}>{d}</Chip>
              ))}
            </div>
          </Field>
        </div>
      ),
    },
    // 5 — tone
    {
      title: "Coach voice",
      sub: "How should I talk to you? Change anytime.",
      content: (
        <div className="space-y-5">
          <div className="space-y-1">
            {TONES.map(t => (
              <OptionRow key={t.id} {...t} active={draft.tone_pref === t.id} onClick={() => pick("tone_pref", t.id)} />
            ))}
          </div>
          <Field label="Your why — who are you becoming?">
            <textarea
              rows={2}
              value={draft.i_am}
              onChange={e => set({ i_am: e.target.value.slice(0, 160) })}
              placeholder="e.g. The dad my kids see show up strong every day. Someone who keeps promises to himself."
              className="w-full resize-none surface-inset rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1 tabular-nums">
              {draft.i_am.length}/160 · This is what every check-in is really for.
            </p>
          </Field>
        </div>
      ),
    },
  ];

  const last = step === STEPS.length - 1;
  const cur = STEPS[step];
  // Steps: 0=goal, 1=experience, 2=body, 3=mind&life, 4=constraints, 5=tone.
  // The "Your week" step (exact training days / session length / wake & sleep)
  // was removed on founder request — too precise to plan honestly, and it made
  // the coach prescribe workouts at exact clock times.
  //
  // Which step is skippable is a property of the step, not a hardcoded index.
  // It used to be `step === 3`, which silently pointed at the wrong step the
  // moment a step was inserted ahead of it.
  const optional = !!(cur as { optional?: boolean }).optional;
  const blocked = !!(cur as { required?: boolean }).required && !draft.training_experience;

  const next = async () => {
    if (last) {
      try {
        await upsert({ ...draft, onboarded: true });
        try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(STEP_KEY); } catch {}
        toast.success("Profile saved. Coach is now personal.");
        onDone();
      } catch (e: any) {
        toast.error(friendlyError(e, "Failed to save profile"));
      }
    } else {
      hapticImpact("light");
      setStep(s => s + 1);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-2 pb-8">
      {/* BEAT: the progress and the question. The step title is the display line. */}
      <header className="home-rise">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="flex-1 flex gap-1"
            role="progressbar"
            aria-label="Profile setup"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
          >
            {STEPS.map((_, i) => (
              <div key={i} className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                i <= step ? "bg-gold" : "bg-border/40"
              )} />
            ))}
          </div>
          <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{step + 1}/{STEPS.length}</span>
        </div>
        <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">{cur.title}</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground mb-5">{cur.sub}</p>
      </header>

      <div className="home-rise home-rise-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.2 }}
          >
            {cur.content}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-2 mt-7 sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-background via-background/95 to-transparent">
        {step > 0 && (
          <Button variant="ghost" size="lg" onClick={() => { hapticImpact("light"); setStep(s => s - 1); }}>
            <ChevronLeft size={16} /> Back
          </Button>
        )}
        <Button variant="ember" size="lg" className="flex-1" loading={isSaving} disabled={blocked} onClick={next}>
          {last ? "Lock it in" : optional ? "Continue" : "Next"} {!last && <ChevronRight size={16} />}
        </Button>
      </div>
    </div>
  );
};

/**
 * One choice as a 44 pt row: icon, label, line, and a check that lands with
 * the app's commit-pop. Only the chosen row carries a border, and it is gold.
 */
const OptionRow = ({
  icon: Icon, label, sub, active, onClick,
}: {
  icon: LucideIcon; label: string; sub?: string; active: boolean; onClick: () => void;
}) => {
  const popping = useCommitPop(active);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "w-full min-h-11 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        active ? "border-gold/70 bg-gold/[0.06]" : "border-transparent",
      )}
    >
      <Icon size={16} className={cn("shrink-0", active ? "text-gold" : "text-muted-foreground")} aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold leading-tight">{label}</span>
        {sub && <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{sub}</span>}
      </span>
      <span
        className={cn(
          "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center",
          active ? "border-gold bg-gold text-background" : "border-muted-foreground/35",
          popping && "commit-pop",
        )}
        aria-hidden
      >
        {active && <Check size={12} strokeWidth={3} />}
      </span>
    </button>
  );
};

/** A 1–5 scale as five 44 pt numerals; the ends are named beneath. */
const Scale = ({
  name, value, words, onChange,
}: {
  name: string; value: number | null; words: readonly string[]; onChange: (v: number) => void;
}) => (
  <div>
    <div className="grid grid-cols-5 gap-1.5">
      {words.map((word, i) => {
        const v = i + 1;
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-label={`${name} ${v} of 5, ${word}`}
            aria-pressed={active}
            onClick={() => onChange(v)}
            className={cn(
              "h-11 rounded-xl border font-display font-black text-[15px] tabular-nums transition-colors",
              active ? "border-gold/70 bg-gold/[0.08] text-gold" : "border-border/50 text-muted-foreground",
            )}
          >
            {v}
          </button>
        );
      })}
    </div>
    <p className="mt-1 flex justify-between text-[11px] text-muted-foreground/70">
      <span>{words[0]}</span>
      <span>{words[words.length - 1]}</span>
    </p>
  </div>
);

const Field = forwardRef<HTMLDivElement, { label: string; children: React.ReactNode }>(
  ({ label, children }, ref) => (
    <div ref={ref}>
      <label className="block text-[11px] font-bold text-muted-foreground mb-2">{label}</label>
      {children}
    </div>
  ),
);
Field.displayName = "Field";

// 36 px tall so a wrapped row stays a row; the invisible ::before brings the
// hit area to the 44 pt floor.
const Chip = forwardRef<HTMLButtonElement, { active: boolean; onClick: () => void; children: React.ReactNode }>(
  ({ active, onClick, children }, ref) => (
    <button ref={ref} type="button" aria-pressed={active} onClick={onClick}
      className={cn(
        "relative h-9 rounded-full border px-3 text-xs font-semibold transition-colors before:absolute before:-inset-1 before:content-['']",
        active
          ? "border-gold/70 bg-gold/[0.08] text-gold"
          : "border-border/50 text-muted-foreground"
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
      <label className="block text-[11px] font-bold text-muted-foreground mb-2">{label}</label>
      {/* No box around the number: the value is the type moment, the two
          44 pt rings are the only chrome. */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={dec} aria-label={`Decrease ${label.toLowerCase()}`}
          className="h-11 w-11 shrink-0 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground">
          <Minus size={16} />
        </button>
        <div className="flex-1 text-center">
          <span className="font-display text-2xl font-black tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground ml-1.5">{unit}</span>
        </div>
        <button type="button" onClick={inc} aria-label={`Increase ${label.toLowerCase()}`}
          className="h-11 w-11 shrink-0 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

export default AthleteProfileOnboarding;
