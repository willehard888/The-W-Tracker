import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, HeartPulse, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SEGMENT_ACTIVE, SEGMENT_IDLE, SEGMENT_TRACK } from "@/components/ui/segment";
import { Block } from "@/components/skeletons/PageSkeleton";
import { cn } from "@/lib/utils";
import { hapticSelection } from "@/lib/haptics";
import { getPlatform } from "@/lib/platform";
import { disableMealWrite, enableMealWrite, hasMealWriteConsent } from "@/lib/health/meal-write";
import PageBar from "@/components/ui/page-bar";
import NutritionSheet from "@/components/nutrition/NutritionSheet";
import NutritionInfoSheet from "@/components/nutrition/NutritionInfoSheet";
import NumField from "@/components/nutrition/NumField";
import TargetsProposal from "@/components/nutrition/TargetsProposal";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import { useNutritionTargets } from "@/hooks/use-nutrition-targets";
import { fmtKcal } from "@/lib/nutrition/format";
import { parseQty } from "@/lib/nutrition/resolve-grams";
import { computeTargets, type Sex } from "@/lib/nutrition/targets";
import type { ActivityLevel } from "@/lib/nutrition/types";

const ACTIVITY: readonly { key: ActivityLevel; label: string }[] = [
  { key: "sedentary", label: "Desk" },
  { key: "light", label: "Light" },
  { key: "moderate", label: "Moderate" },
  { key: "active", label: "Active" },
  { key: "very_active", label: "Athlete" },
];
const GOAL_LABEL: Record<string, string> = {
  fat_loss: "Fat loss",
  strength: "Strength",
  hypertrophy: "Muscle",
  endurance: "Endurance",
  longevity: "Longevity",
  focus: "Focus",
  all: "All-round",
};
const METHOD_LABEL: Record<string, string> = { mifflin: "Mifflin-St Jeor", katch: "Katch-McArdle", manual: "set by hand" };

const isActivity = (v: unknown): v is ActivityLevel => ACTIVITY.some((a) => a.key === v);
const asSex = (v: string | null | undefined): Sex | null => (v === "male" || v === "female" ? v : v === "other" ? "other" : null);
type Fields = { kcal: string; protein: string; carbs: string; fat: string };
const num = (s: string) => parseQty(s);

/**
 * The number the diary measures against. The profile is read, never
 * written, here; the proposal is math the user confirms, and the manual
 * fields are always one tap away so a missing profile is never a dead end.
 */
const NutritionTargets = () => {
  const navigate = useNavigate();
  const { profile, isLoading: profileLoading } = useAthleteProfile();
  const { targets, isLoading: targetsLoading, save, saving } = useNutritionTargets();

  const [activityChoice, setActivityChoice] = useState<ActivityLevel | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [errors, setErrors] = useState<Partial<Fields>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [healthOn, setHealthOn] = useState(() => hasMealWriteConsent());

  if (profileLoading || targetsLoading) {
    return (
      <div className="min-h-full">
        <PageBar title="Nutrition targets" onBack={() => navigate(-1)} />
        <div className="px-4 pt-4 pb-8">
          <Block height={28} className="w-3/4 !rounded-lg" />
          <Block height={44} delay={40} className="mt-4" />
          <Block height={52} delay={80} className="mt-4" />
          <Block height={220} delay={120} className="mt-4 !rounded-2xl" />
        </div>
      </div>
    );
  }

  const activity: ActivityLevel = activityChoice ?? (isActivity(targets?.activity_level) ? targets.activity_level : "light");
  const sex = asSex(profile?.sex);
  const result = computeTargets({
    age: profile?.age ?? null,
    sex,
    height_cm: profile?.height_cm ?? null,
    weight_kg: profile?.weight_kg ?? null,
    body_fat_pct: profile?.body_fat_pct ?? null,
    activity_level: activity,
    primary_goal: profile?.primary_goal ?? null,
  });
  const sexAssumed = sex === null || sex === "other";
  const adjusting = fields !== null || !result.ok;

  const openAdjust = () => {
    const src = result.ok
      ? { kcal: result.kcal, protein: result.protein_g, carbs: result.carbs_g, fat: result.fat_g }
      : targets
        ? { kcal: targets.kcal, protein: targets.protein_g, carbs: targets.carbs_g, fat: targets.fat_g }
        : null;
    setFields(src ? { kcal: String(src.kcal), protein: String(src.protein), carbs: String(src.carbs), fat: String(src.fat) } : { kcal: "", protein: "", carbs: "", fat: "" });
  };
  const current: Fields = fields ?? (targets
    ? { kcal: String(targets.kcal), protein: String(targets.protein_g), carbs: String(targets.carbs_g), fat: String(targets.fat_g) }
    : { kcal: "", protein: "", carbs: "", fat: "" });
  const setField = (k: keyof Fields, v: string) => {
    setFields({ ...current, [k]: v });
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const macroKcal = 4 * (num(current.protein) ?? 0) + 4 * (num(current.carbs) ?? 0) + 9 * (num(current.fat) ?? 0);

  const commit = async (patch: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; method: string }) => {
    try {
      await save({ ...patch, activity_level: activity });
      navigate(-1);
    } catch {
      /* the hook already toasted */
    }
  };
  const useProposal = () => {
    if (!result.ok) return;
    void commit({ kcal: result.kcal, protein_g: result.protein_g, carbs_g: result.carbs_g, fat_g: result.fat_g, method: result.method });
  };
  const saveManual = () => {
    const next: Partial<Fields> = {};
    const vals = { kcal: num(current.kcal), protein: num(current.protein), carbs: num(current.carbs), fat: num(current.fat) };
    if (vals.kcal === null || vals.kcal < 800) next.kcal = "Enter a daily kcal target (at least 800)";
    if (vals.protein === null) next.protein = "Enter grams";
    if (vals.carbs === null) next.carbs = "Enter grams";
    if (vals.fat === null) next.fat = "Enter grams";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void commit({ kcal: vals.kcal as number, protein_g: vals.protein as number, carbs_g: vals.carbs as number, fat_g: vals.fat as number, method: "manual" });
  };

  const toggleHealth = async (on: boolean) => {
    if (!on) {
      disableMealWrite();
      setHealthOn(false);
      return;
    }
    const granted = await enableMealWrite();
    setHealthOn(granted);
    if (!granted) toast("Apple Health didn't allow it", { description: "Turn on Nutrition for Whealth Factory in Health › Sharing." });
  };

  const profileLine = [
    profile?.weight_kg != null ? `${profile.weight_kg} kg` : null,
    profile?.height_cm != null ? `${profile.height_cm} cm` : null,
    profile?.age != null ? String(profile.age) : null,
    profile?.primary_goal ? GOAL_LABEL[profile.primary_goal] ?? profile.primary_goal : null,
  ].filter(Boolean);

  return (
    <div className="min-h-full">
      <PageBar title="Nutrition targets" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6 space-y-6">
        <div className="animate-reveal">
          <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
            {targets ? (
              <>
                Measuring against <span className="tabular-nums">{fmtKcal(targets.kcal)}</span> kcal.
              </>
            ) : (
              "Set what a good day looks like."
            )}
          </h2>
          <div className="mt-3 flex items-center gap-3 min-h-11">
            <p className="flex-1 min-w-0 text-[13px] text-muted-foreground truncate tabular-nums">
              {profileLine.length > 0 ? profileLine.join(" · ") : "Profile not filled in yet"}
            </p>
            <button
              type="button"
              onClick={() => navigate("/coach/profile")}
              className="shrink-0 min-h-11 inline-flex items-center gap-0.5 text-[13px] font-bold text-foreground active:opacity-70"
            >
              Edit profile <ChevronRight size={14} aria-hidden />
            </button>
          </div>
        </div>

        <div className="animate-reveal animate-reveal-delay-1">
          <p className="text-[12px] font-bold text-muted-foreground mb-1.5">Activity</p>
          <div className={SEGMENT_TRACK} role="group" aria-label="Activity level">
            {ACTIVITY.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-pressed={activity === a.key}
                onClick={() => {
                  hapticSelection();
                  setActivityChoice(a.key);
                }}
                className={cn("flex-1 h-11 rounded-lg text-[11px] font-black transition-all active:scale-[0.97]", activity === a.key ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="animate-reveal animate-reveal-delay-2 space-y-4">
          <TargetsProposal result={result} sexAssumed={result.ok && sexAssumed} onUse={useProposal} onAdjust={openAdjust} busy={saving} />

          {adjusting && (
            <div className="surface-card surface-card-quiet p-4 space-y-3 animate-reveal">
              <p className="text-[15px] font-bold">{result.ok ? "Adjust by hand" : "Type your targets"}</p>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Calories" unit="kcal" mode="numeric" required value={current.kcal} onChange={(v) => setField("kcal", v)} error={errors.kcal} />
                <NumField label="Protein" unit="g" mode="numeric" required value={current.protein} onChange={(v) => setField("protein", v)} error={errors.protein} />
                <NumField label="Carbs" unit="g" mode="numeric" required value={current.carbs} onChange={(v) => setField("carbs", v)} error={errors.carbs} />
                <NumField label="Fat" unit="g" mode="numeric" required value={current.fat} onChange={(v) => setField("fat", v)} error={errors.fat} />
              </div>
              <p className="text-[12px] text-muted-foreground tabular-nums" aria-live="polite">
                = {fmtKcal(macroKcal)} kcal from macros
              </p>
              <Button size="lg" className="w-full" onClick={saveManual} loading={saving} disabled={saving}>
                Save targets
              </Button>
            </div>
          )}
        </div>

        {targets && (
          <div className="animate-reveal animate-reveal-delay-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12px] font-bold text-muted-foreground">Current targets</p>
              <p className="text-[12px] text-muted-foreground">
                In force since {targets.effective_from ? format(parseISO(targets.effective_from), "MMM d") : "today"}
              </p>
            </div>
            <p className="mt-1 text-[15px] font-bold tabular-nums">
              {fmtKcal(targets.kcal)} kcal · P {Math.round(targets.protein_g)} · C {Math.round(targets.carbs_g)} · F {Math.round(targets.fat_g)}
            </p>
            <p className="text-[12px] text-muted-foreground">{METHOD_LABEL[targets.method] ?? targets.method}</p>
          </div>
        )}

        <div className="animate-reveal animate-reveal-delay-4 surface-card surface-card-quiet overflow-hidden divide-y divide-border/30">
          {getPlatform() === "ios" && (
            <div className="flex items-center gap-3 px-4 py-3 min-h-11">
              <HeartPulse aria-hidden size={14} className="text-muted-foreground shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold">Save meals to Apple Health</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">Calories, protein, carbs, fat, water, caffeine</span>
              </span>
              <Switch checked={healthOn} onCheckedChange={(v) => void toggleHealth(v)} aria-label="Save meals to Apple Health" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-11 text-left hover:bg-card/60 transition-colors active:scale-[0.99]"
          >
            <Info aria-hidden size={14} className="text-muted-foreground shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold">How estimates work · Data sources</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">What the numbers can and cannot tell you</span>
            </span>
            <ChevronRight aria-hidden size={14} className="text-muted-foreground/75 shrink-0" />
          </button>
        </div>
      </div>

      <NutritionSheet open={infoOpen} onClose={() => setInfoOpen(false)} title="About the numbers" label="How estimates work and data sources">
        <NutritionInfoSheet />
      </NutritionSheet>
    </div>
  );
};

export default NutritionTargets;
