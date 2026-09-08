import { useState } from "react";
import { sportById } from "@/lib/sports";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import { Block } from "@/components/skeletons/PageSkeleton";
import { FactRow, DoorRow } from "@/components/coach/rows";
import { backOr } from "@/lib/nav";
import { fmtUnit } from "@/lib/format";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import AthleteProfileOnboarding, {
  GOALS, EXPERIENCE, TONES, EQUIPMENT_PRESETS, MENTAL_FOCUS, STRESS_WORDS, MOOD_WORDS,
} from "@/components/coach/AthleteProfileOnboarding";

const labelOf = (list: readonly { id: string; label: string }[], id: string | null | undefined) =>
  list.find((o) => o.id === id)?.label;

/** "Tense · 4/5", or the dash when never answered. */
const scale = (value: number | null | undefined, words: readonly string[]) =>
  value && value >= 1 && value <= 5 ? `${words[value - 1]} · ${value}/5` : "—";

const list = (ids: readonly string[] | null | undefined, map?: (id: string) => string) =>
  ids?.length ? ids.map((id) => (map ? map(id) : id)).join(", ") : null;

// How the experience answer reads inside the beat sentence: the option labels
// are first person ("I know my way around"), the beat is the coach's.
const EXPERIENCE_BEAT: Record<string, string> = {
  never_trained: "Starting from the beginning",
  under_6_months: "A few months in",
  experienced: "Experienced",
};

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-[11px] font-bold text-muted-foreground mb-1">{title}</h2>
    <div className="divide-y divide-border/35 border-t border-border/35">{children}</div>
  </section>
);

const AthleteProfileSettings = () => {
  const navigate = useNavigate();
  const { profile, isLoading, refetch } = useAthleteProfile();
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-full">
        <PageBar title="Athlete profile" onBack={() => backOr(navigate, "/coach")} />
        <div className="px-4 pt-4 space-y-4">
          <Block height={72} />
          <Block height={180} delay={80} />
          <Block height={140} delay={160} />
        </div>
      </div>
    );
  }

  if (editing || !profile?.onboarded) {
    return (
      <div className="min-h-full">
        <PageBar title="Athlete profile" onBack={() => (editing ? setEditing(false) : backOr(navigate, "/coach"))} />
        <AthleteProfileOnboarding onDone={() => { setEditing(false); refetch(); }} />
      </div>
    );
  }

  // BEAT: the athlete in one line. Goal · experience · days a week.
  const days = profile.training_days_pref?.length ?? 0;
  const beat = [
    labelOf(GOALS, profile.primary_goal),
    EXPERIENCE_BEAT[profile.training_experience ?? ""],
    days > 0 ? `${days} ${days === 1 ? "day" : "days"} a week` : null,
  ].filter(Boolean).map((s) => `${s}.`).join(" ") || "Your athlete profile.";

  return (
    <div className="min-h-full">
      <PageBar
        title="Athlete profile"
        onBack={() => backOr(navigate, "/coach")}
        action={
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Edit">
            <Pencil size={16} />
          </Button>
        }
      />

      <div className="px-4 pt-3 pb-6">
        <header className="home-rise">
          <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">{beat}</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">What the coach is coaching.</p>
          {profile.i_am && (
            <blockquote className="mt-4 font-display text-[17px] font-bold leading-snug tracking-tight">
              “{profile.i_am}”
            </blockquote>
          )}
        </header>

        <div className="home-rise home-rise-1 mt-6 space-y-6">
          <Group title="Body">
            <FactRow k="Age" v={profile.age ? `${profile.age}` : "—"} />
            <FactRow k="Sex" v={(profile.sex ?? "—").replace("_", " ")} />
            <FactRow k="Height" v={profile.height_cm ? fmtUnit(profile.height_cm, "cm") : "—"} />
            <FactRow k="Weight" v={profile.weight_kg ? fmtUnit(profile.weight_kg, "kg") : "—"} />
          </Group>

          <Group title="Goal">
            <FactRow k="Primary" v={labelOf(GOALS, profile.primary_goal) ?? "—"} />
            <FactRow k="Experience" v={labelOf(EXPERIENCE, profile.training_experience) ?? "—"} />
            <FactRow k="Sports" v={list(profile.sports, (id) => sportById(id).label) ?? "—"} />
            <FactRow k="Horizon" v={profile.target_horizon_weeks ? `${profile.target_horizon_weeks} weeks` : "—"} />
          </Group>

          <Group title="Constraints">
            <FactRow k="Injuries" v={list(profile.injuries) ?? "None"} />
            <FactRow k="Diet" v={list(profile.dietary) ?? "Omnivore"} />
            <FactRow k="Training at" v={list(profile.equipment, (id) => labelOf(EQUIPMENT_PRESETS, id) ?? id) ?? "Bodyweight only"} />
          </Group>

          {/* Mind & life — holistic well-being fields (migration 20260511181220).
              Null-safe access because columns may not exist on legacy rows
              (the holistic migration wasn't always applied on Lovable-imported
              profiles). Defaults render as "—" rather than crashing the page. */}
          <Group title="Mind & life">
            <FactRow k="Hobbies" v={list(profile.hobbies) ?? "—"} />
            <FactRow k="Stress" v={scale(profile.stress_baseline, STRESS_WORDS)} />
            <FactRow k="Mood" v={scale(profile.mood_baseline, MOOD_WORDS)} />
            <FactRow k="Focus areas" v={list(profile.mental_health_focus, (id) => labelOf(MENTAL_FOCUS, id) ?? id) ?? "—"} />
            <FactRow k="Life context" v={profile.life_context || "—"} />
          </Group>

          <Group title="Coach">
            <FactRow k="Tone" v={labelOf(TONES, profile.tone_pref) ?? "—"} />
            <FactRow k="Language" v={profile.language_pref ? profile.language_pref.toUpperCase() : "—"} />
            <FactRow k="Timezone" v={profile.timezone ?? "—"} />
          </Group>
        </div>

        <div className="home-rise home-rise-2 mt-4 border-t border-border/35">
          <DoorRow icon={Pencil} label="Edit profile" sub="Every answer, one step at a time." onClick={() => setEditing(true)} />
        </div>
      </div>
    </div>
  );
};

export default AthleteProfileSettings;
