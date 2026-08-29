import { forwardRef, useEffect, useState } from "react";
import { SPORTS } from "@/lib/sports";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Sparkles, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { useAthleteProfile, type ToneId, type GoalId } from "@/hooks/use-athlete-profile";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";

const DRAFT_KEY = "w_coach_onboarding_draft_v2";
const STEP_KEY = "w_coach_onboarding_step_v2";

interface Props { onDone: () => void }

const GOALS: { id: GoalId; label: string; sub: string; emoji: string }[] = [
  { id: "all",        label: "All-around",     sub: "Strong, lean, sharp — balanced progress everywhere", emoji: "⚡" },
  { id: "strength",   label: "Get stronger",   sub: "Lift heavier, build raw power", emoji: "🏋️" },
  { id: "hypertrophy",label: "Build muscle",   sub: "Visible size, lean mass", emoji: "💪" },
  { id: "fat_loss",   label: "Lose fat",       sub: "Lean down, keep muscle", emoji: "🔥" },
  { id: "endurance",  label: "Endurance",      sub: "Run, ride, last longer", emoji: "🏃" },
  { id: "longevity",  label: "Longevity",      sub: "Health-span, energy 20y out", emoji: "🌱" },
  { id: "focus",      label: "Sharpen focus",  sub: "Mind, deep work, sleep", emoji: "🧠" },
];

const TONES: { id: ToneId; label: string; sub: string }[] = [
  { id: "calm_mentor",    label: "Calm mentor",    sub: "Steady, supportive, precise" },
  { id: "drill_sergeant", label: "Drill sergeant", sub: "Blunt. No excuses." },
  { id: "scientist",      label: "Scientist",      sub: "Evidence, mechanisms, numbers" },
  { id: "hype",           label: "Hype coach",     sub: "Energy. Wins. Momentum." },
];


// 4 environment presets replace the previous 9-item granular list.
// User feedback: "tee välinevalinnasta todella simppeli esim full gym jne."
// The AI program generator expands these into fine-grained equipment lists
// via expandEquipmentPresets() in src/lib/coach/equipment-presets.ts.
const EQUIPMENT_PRESETS: { id: string; label: string; emoji: string; sub: string }[] = [
  { id: "full_gym",      label: "Full gym",           emoji: "🏋️", sub: "Barbells, racks, machines" },
  { id: "home_minimal",  label: "Home minimal",       emoji: "🏠", sub: "Bodyweight + dumbbells + bands" },
  { id: "outdoor",       label: "Outdoor / running",  emoji: "🌳", sub: "Runs, hikes, calisthenics" },
  { id: "combat_sport",  label: "Combat / sport gym", emoji: "🥊", sub: "Bags, mats, partner work" },
];
const DIET = ["Omnivore","Vegetarian","Vegan","Lactose-free","Gluten-free","Halal","Keto"];
const INJURIES = ["Lower back","Knee","Shoulder","Hip","Wrist","Elbow","Neck"];


// Mind & life step (migration 20260511181220).
const HOBBIES = [
  "Reading", "Music", "Gaming", "Outdoors",
  "Cooking", "Creative work", "Family", "Social", "Sport",
];
const MENTAL_FOCUS: { id: string; label: string }[] = [
  { id: "anxiety",  label: "Anxiety"   },
  { id: "low_mood", label: "Low mood"  },
  { id: "focus",    label: "Focus"     },
  { id: "sleep",    label: "Sleep"     },
  { id: "burnout",  label: "Burnout"   },
  { id: "none",     label: "None"      },
];
const STRESS_EMOJI = ["😌", "🙂", "😐", "😬", "😫"];
const MOOD_EMOJI   = ["😢", "😕", "😐", "🙂", "😄"];

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

  const STEPS = [
    // 0 — goal first (most important)
    {
      title: "What do you want?",
      sub: "Pick your main focus. The Coach builds everything around this.",
      content: (
        <div className="space-y-2">
          {GOALS.map(g => (
            <button key={g.id} type="button"
              onClick={() => { hapticImpact("light"); set({ primary_goal: g.id }); }}
              className={cn(
                "w-full text-left rounded-2xl px-4 py-3.5 border transition-all flex items-center gap-3",
                draft.primary_goal === g.id
                  ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)] shadow-[0_0_24px_-8px_hsl(var(--gold)/0.6)]"
                  : "surface-card"
              )}>
              <span className="text-2xl">{g.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-bold">{g.label}</div>
                <div className="text-xs text-muted-foreground leading-tight">{g.sub}</div>
              </div>
            </button>
          ))}

          {/* Sports — the coach's standing sport context ("lajivalmennus").
              Separate from hobbies on purpose: hobbies steer recovery framing,
              sports steer programming. */}
          <div className="pt-3">
            <p className="eyebrow mb-2">What do you train? <span className="normal-case tracking-normal font-semibold text-muted-foreground/70">(pick any)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {SPORTS.map((sp) => (
                <button key={sp.id} type="button"
                  onClick={() => { hapticImpact("light"); toggle("sports", sp.id); }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-full border text-[12px] font-bold transition-all",
                    (draft.sports ?? []).includes(sp.id)
                      ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.1)] text-foreground"
                      : "surface-card text-muted-foreground"
                  )}>
                  {sp.emoji} {sp.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    // 1 — body (steppers, much faster than sliders)
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
                <Chip key={s.id} small active={draft.sex === s.id} onClick={() => set({ sex: s.id })}>
                  {s.l}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      ),
    },
    // 2 — Mind & life (holistic well-being capture)
    {
      title: "Mind & life",
      sub: "Helps the Coach see the whole you — physical, mental, emotional.",
      content: (
        <div className="space-y-5">
          <Field label="What do you do for joy?">
            <div className="flex flex-wrap gap-1.5">
              {HOBBIES.map(h => (
                <Chip
                  key={h}
                  small
                  active={draft.hobbies.includes(h)}
                  onClick={() => toggle("hobbies", h)}
                >
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
              className="w-full resize-none surface-inset rounded-2xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1">{(draft.life_context ?? "").length}/160</p>
          </Field>

          <Field label="Stress lately">
            <div className="flex justify-between gap-1.5">
              {STRESS_EMOJI.map((emoji, i) => {
                const value = i + 1;
                const active = draft.stress_baseline === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { hapticImpact("light"); set({ stress_baseline: value }); }}
                    className={cn(
                      "flex-1 h-12 rounded-xl text-xl border transition-all",
                      active
                        ? "bg-[hsl(var(--gold)/0.15)] border-[hsl(var(--gold)/0.55)]"
                        : "surface-card",
                    )}
                    aria-label={`Stress level ${value} of 5`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1">Calm → overwhelmed</p>
          </Field>

          <Field label="Mood lately">
            <div className="flex justify-between gap-1.5">
              {MOOD_EMOJI.map((emoji, i) => {
                const value = i + 1;
                const active = draft.mood_baseline === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { hapticImpact("light"); set({ mood_baseline: value }); }}
                    className={cn(
                      "flex-1 h-12 rounded-xl text-xl border transition-all",
                      active
                        ? "bg-[hsl(var(--gold)/0.15)] border-[hsl(var(--gold)/0.55)]"
                        : "surface-card",
                    )}
                    aria-label={`Mood level ${value} of 5`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1">Down → energised</p>
          </Field>

          <Field label="Anything to focus on? Optional, private.">
            <div className="flex flex-wrap gap-1.5">
              {MENTAL_FOCUS.map(m => (
                <Chip
                  key={m.id}
                  small
                  active={draft.mental_health_focus.includes(m.id)}
                  onClick={() => toggle("mental_health_focus", m.id)}
                >
                  {m.label}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      ),
    },
    // 3 — constraints (optional, can skip)
    {
      title: "Anything to work around?",
      sub: "Optional. Tap what applies — or skip ahead.",
      content: (
        <div className="space-y-5">
          <Field label="Where do you train?">
            <div className="grid grid-cols-2 gap-2">
              {EQUIPMENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { hapticImpact("light"); toggle("equipment", p.id); }}
                  className={cn(
                    "rounded-2xl border px-3 py-2.5 text-left transition-all active:scale-[0.97]",
                    draft.equipment.includes(p.id)
                      ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)]"
                      : "surface-card hover:bg-card/60",
                  )}
                >
                  <div className="text-lg mb-0.5">{p.emoji}</div>
                  <div className="text-[12px] font-bold leading-tight">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{p.sub}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Pick any that apply — the program adapts to what you actually have.
            </p>
          </Field>
          <Field label="Injuries / no-go zones">
            <div className="flex flex-wrap gap-1.5">
              {INJURIES.map(i => (
                <Chip key={i} small active={draft.injuries.includes(i)} onClick={() => toggle("injuries", i)}>{i}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Diet">
            <div className="flex flex-wrap gap-1.5">
              {DIET.map(d => (
                <Chip key={d} small active={draft.dietary.includes(d)} onClick={() => toggle("dietary", d)}>{d}</Chip>
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
        <div className="space-y-2">
          {TONES.map(t => (
            <button key={t.id} type="button"
              onClick={() => { hapticImpact("light"); set({ tone_pref: t.id }); }}
              className={cn(
                "w-full text-left rounded-2xl px-4 py-3 border transition-all",
                draft.tone_pref === t.id
                  ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)]"
                  : "surface-card"
              )}>
              <div className="text-sm font-bold">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.sub}</div>
            </button>
          ))}
          <Field label="Your why — who are you becoming?">
            <textarea
              rows={2}
              value={draft.i_am}
              onChange={e => set({ i_am: e.target.value.slice(0, 160) })}
              placeholder="e.g. The dad my kids see show up strong every day. Someone who keeps promises to himself."
              className="w-full resize-none surface-inset rounded-2xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              {draft.i_am.length}/160 · This is what every check-in is really for.
            </p>
          </Field>
        </div>
      ),
    },
  ];

  const last = step === STEPS.length - 1;
  const cur = STEPS[step];
  // Steps: 0=goal, 1=body, 2=mind&life, 3=constraints, 4=tone. The "Your
  // week" step (exact training days / session length / wake & sleep) was
  // removed on founder request — too precise to plan honestly, and it made
  // the coach prescribe workouts at exact clock times.
  const optional = step === 3;

  const next = async () => {
    if (last) {
      try {
        await upsert({ ...draft, onboarded: true } as any);
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
    <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
      {/* progress */}
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
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold">Step {step + 1} of {STEPS.length}</p>
      </div>
      <h2 className="font-display text-2xl font-black tracking-tight leading-tight">{cur.title}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">{cur.sub}</p>

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

      <div className="flex gap-2 mt-7 sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-background via-background/95 to-transparent">
        {step > 0 && (
          <Button variant="ghost" size="lg" onClick={() => { hapticImpact("light"); setStep(s => s - 1); }}>
            <ChevronLeft size={16} /> Back
          </Button>
        )}
        <Button variant="ember" size="lg" className="flex-1" loading={isSaving} onClick={next}>
          {last ? "Lock it in" : optional ? "Continue" : "Next"} {!last && <ChevronRight size={16} />}
        </Button>
      </div>
    </div>
  );
};

const Field = forwardRef<HTMLDivElement, { label: string; children: React.ReactNode }>(
  ({ label, children }, ref) => (
    <div ref={ref}>
      <label className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      {children}
    </div>
  ),
);
Field.displayName = "Field";

const Chip = forwardRef<HTMLButtonElement, { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }>(
  ({ active, onClick, children, small }, ref) => (
    <button ref={ref} type="button" onClick={onClick}
      className={cn(
        "rounded-full border transition-all capitalize",
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        active
          ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold))] font-bold"
          : "surface-card text-muted-foreground"
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
      <label className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      <div className="flex items-center gap-2 surface-card surface-card-quiet px-2 py-2">
        <button type="button" onClick={dec}
          className="h-10 w-10 surface-card surface-card-quiet rounded-xl flex items-center justify-center active:scale-95 transition">
          <Minus size={16} />
        </button>
        <div className="flex-1 text-center">
          <span className="font-display text-2xl font-black tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground ml-1.5">{unit}</span>
        </div>
        <button type="button" onClick={inc}
          className="h-10 w-10 surface-card surface-card-quiet rounded-xl flex items-center justify-center active:scale-95 transition">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

export default AthleteProfileOnboarding;
