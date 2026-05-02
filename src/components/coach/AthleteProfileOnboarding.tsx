import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hapticImpact } from "@/lib/haptics";
import { useAthleteProfile, type ToneId, type GoalId } from "@/hooks/use-athlete-profile";
import { toast } from "sonner";

interface Props { onDone: () => void }

const GOALS: { id: GoalId; label: string; sub: string }[] = [
  { id: "strength",   label: "Get stronger",   sub: "Lift heavier, build power" },
  { id: "hypertrophy",label: "Build muscle",   sub: "Visible size, lean mass" },
  { id: "endurance",  label: "Endurance",      sub: "Run, ride, last longer" },
  { id: "fat_loss",   label: "Lose fat",       sub: "Lean down, keep muscle" },
  { id: "longevity",  label: "Longevity",      sub: "Health-span, energy 20y out" },
  { id: "focus",      label: "Sharpen focus",  sub: "Mind, deep work, sleep" },
];

const TONES: { id: ToneId; label: string; sub: string }[] = [
  { id: "drill_sergeant", label: "Drill sergeant", sub: "Blunt. Push hard. No excuses." },
  { id: "calm_mentor",    label: "Calm mentor",    sub: "Steady, supportive, precise." },
  { id: "scientist",      label: "Scientist",      sub: "Evidence, mechanisms, numbers." },
  { id: "hype",           label: "Hype coach",     sub: "Energy. Wins. Momentum." },
];

const DAYS = ["S","M","T","W","T","F","S"];

const EQUIPMENT = ["Barbell","Dumbbells","Pull-up bar","Bands","Bike","Treadmill","Sauna","Cold plunge","Bodyweight only"];
const DIET = ["Omnivore","Vegetarian","Vegan","Lactose-free","Gluten-free","Halal","Keto"];
const INJURIES = ["Lower back","Knee","Shoulder","Hip","Wrist","Elbow","Neck"];

const AthleteProfileOnboarding = ({ onDone }: Props) => {
  const { profile, upsert, isSaving } = useAthleteProfile();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<any>({
    age: profile?.age ?? 30,
    sex: profile?.sex ?? "prefer_not_say",
    height_cm: profile?.height_cm ?? 180,
    weight_kg: profile?.weight_kg ?? 80,
    primary_goal: profile?.primary_goal ?? "strength",
    target_horizon_weeks: profile?.target_horizon_weeks ?? 12,
    wake_time: profile?.wake_time ?? "07:00",
    sleep_time: profile?.sleep_time ?? "23:00",
    training_days_pref: profile?.training_days_pref ?? [1,2,4,5],
    injuries: profile?.injuries ?? [],
    dietary: profile?.dietary ?? [],
    equipment: profile?.equipment ?? [],
    tone_pref: profile?.tone_pref ?? "calm_mentor",
    preferred_session_length_min: profile?.preferred_session_length_min ?? 45,
    i_am: profile?.i_am ?? "",
  });

  const set = (patch: any) => setDraft((d: any) => ({ ...d, ...patch }));
  const toggle = (key: string, val: any) => {
    const arr: any[] = draft[key] ?? [];
    set({ [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] });
  };

  const STEPS = [
    // 0 — body
    {
      title: "About your body",
      sub: "Used to dose protein, sleep targets, training intensity.",
      content: (
        <div className="space-y-5">
          <Field label={`Age · ${draft.age}`}>
            <input type="range" min={16} max={80} value={draft.age}
              onChange={e => set({ age: Number(e.target.value) })}
              className="w-full accent-[hsl(var(--gold))]" />
          </Field>
          <Field label={`Height · ${draft.height_cm} cm`}>
            <input type="range" min={140} max={220} value={draft.height_cm}
              onChange={e => set({ height_cm: Number(e.target.value) })}
              className="w-full accent-[hsl(var(--gold))]" />
          </Field>
          <Field label={`Weight · ${draft.weight_kg} kg`}>
            <input type="range" min={40} max={180} value={draft.weight_kg}
              onChange={e => set({ weight_kg: Number(e.target.value) })}
              className="w-full accent-[hsl(var(--gold))]" />
          </Field>
          <Field label="Sex">
            <div className="grid grid-cols-2 gap-2">
              {["male","female","other","prefer_not_say"].map(s => (
                <Chip key={s} active={draft.sex === s} onClick={() => set({ sex: s })}>
                  {s.replace("_"," ")}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      ),
    },
    // 1 — goal
    {
      title: "Your primary goal",
      sub: "The Coach optimises every mission for this.",
      content: (
        <div className="space-y-2">
          {GOALS.map(g => (
            <button key={g.id} type="button"
              onClick={() => { hapticImpact("light"); set({ primary_goal: g.id }); }}
              className={cn(
                "w-full text-left rounded-2xl px-4 py-3 border transition-all",
                draft.primary_goal === g.id
                  ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)] shadow-[0_0_24px_-8px_hsl(var(--gold)/0.6)]"
                  : "border-border/40 bg-card/40"
              )}>
              <div className="text-sm font-bold">{g.label}</div>
              <div className="text-xs text-muted-foreground">{g.sub}</div>
            </button>
          ))}
          <Field label={`Target horizon · ${draft.target_horizon_weeks} weeks`}>
            <input type="range" min={4} max={52} value={draft.target_horizon_weeks}
              onChange={e => set({ target_horizon_weeks: Number(e.target.value) })}
              className="w-full accent-[hsl(var(--gold))]" />
          </Field>
        </div>
      ),
    },
    // 2 — schedule
    {
      title: "Your week",
      sub: "Coach times missions to your real schedule.",
      content: (
        <div className="space-y-5">
          <Field label="Wake time">
            <Input type="time" value={draft.wake_time}
              onChange={e => set({ wake_time: e.target.value })} />
          </Field>
          <Field label="Sleep time">
            <Input type="time" value={draft.sleep_time}
              onChange={e => set({ sleep_time: e.target.value })} />
          </Field>
          <Field label="Preferred training days">
            <div className="flex justify-between gap-1">
              {DAYS.map((d, i) => {
                const active = draft.training_days_pref.includes(i);
                return (
                  <button key={i} type="button"
                    onClick={() => {
                      hapticImpact("light");
                      const arr = draft.training_days_pref;
                      set({ training_days_pref: active ? arr.filter((x: number) => x !== i) : [...arr, i].sort() });
                    }}
                    className={cn(
                      "flex-1 h-10 rounded-xl text-xs font-bold border",
                      active
                        ? "bg-[hsl(var(--gold)/0.15)] border-[hsl(var(--gold)/0.5)] text-[hsl(var(--gold))]"
                        : "border-border/40 text-muted-foreground"
                    )}>
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={`Session length · ${draft.preferred_session_length_min} min`}>
            <input type="range" min={15} max={120} step={5} value={draft.preferred_session_length_min}
              onChange={e => set({ preferred_session_length_min: Number(e.target.value) })}
              className="w-full accent-[hsl(var(--gold))]" />
          </Field>
        </div>
      ),
    },
    // 3 — constraints
    {
      title: "Anything to work around?",
      sub: "Optional. The Coach will respect every choice.",
      content: (
        <div className="space-y-5">
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
          <Field label="Available equipment">
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT.map(e => (
                <Chip key={e} small active={draft.equipment.includes(e)} onClick={() => toggle("equipment", e)}>{e}</Chip>
              ))}
            </div>
          </Field>
        </div>
      ),
    },
    // 4 — tone
    {
      title: "How should the Coach speak to you?",
      sub: "You can change this anytime.",
      content: (
        <div className="space-y-2">
          {TONES.map(t => (
            <button key={t.id} type="button"
              onClick={() => { hapticImpact("light"); set({ tone_pref: t.id }); }}
              className={cn(
                "w-full text-left rounded-2xl px-4 py-3 border transition-all",
                draft.tone_pref === t.id
                  ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)]"
                  : "border-border/40 bg-card/40"
              )}>
              <div className="text-sm font-bold">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.sub}</div>
            </button>
          ))}
        </div>
      ),
    },
    // 5 — identity
    {
      title: "One sentence: who are you becoming?",
      sub: "The Coach uses this as your North Star.",
      content: (
        <div className="space-y-3">
          <textarea
            rows={3}
            value={draft.i_am}
            onChange={e => set({ i_am: e.target.value.slice(0, 160) })}
            placeholder="e.g. I'm a father of 2 building strength after 35 without losing weekends."
            className="w-full resize-none rounded-2xl border border-border/50 bg-card/60 px-3.5 py-3 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30"
          />
          <p className="text-[10px] text-muted-foreground/70">{draft.i_am.length}/160 — keep it sharp.</p>
        </div>
      ),
    },
  ];

  const last = step === STEPS.length - 1;
  const cur = STEPS[step];

  const next = async () => {
    if (last) {
      try {
        await upsert({ ...draft, onboarded: true } as any);
        toast.success("Profile saved. Coach is now personal.");
        onDone();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to save profile");
      }
    } else {
      hapticImpact("light");
      setStep(s => s + 1);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
      {/* progress */}
      <div className="flex gap-1 mb-6">
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
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.22 }}
        >
          {cur.content}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-2 mt-7 sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-background via-background/95 to-transparent">
        {step > 0 && (
          <Button variant="ghost" size="lg" onClick={() => setStep(s => s - 1)}>
            <ChevronLeft size={16} /> Back
          </Button>
        )}
        <Button variant="ember" size="lg" className="flex-1" loading={isSaving} onClick={next}>
          {last ? "Lock it in" : "Next"} {!last && <ChevronRight size={16} />}
        </Button>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
    {children}
  </div>
);

const Chip = ({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) => (
  <button type="button" onClick={onClick}
    className={cn(
      "rounded-full border transition-all capitalize",
      small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
      active
        ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold))] font-bold"
        : "border-border/40 bg-card/40 text-muted-foreground"
    )}>
    {children}
  </button>
);

export default AthleteProfileOnboarding;
