import { useState } from "react";
import { sportById } from "@/lib/sports";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import AthleteProfileOnboarding from "@/components/coach/AthleteProfileOnboarding";
import { ProfileSkeleton as PageSkeleton } from "@/components/skeletons/PageSkeleton";

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between py-2.5 border-b border-border/30 last:border-0">
    <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className="text-sm text-foreground text-right max-w-[60%] truncate">{value}</span>
  </div>
);

const TONES: Record<string, string> = {
  drill_sergeant: "Drill sergeant",
  calm_mentor: "Calm mentor",
  scientist: "Scientist",
  hype: "Hype coach",
};
const GOALS: Record<string, string> = {
  all: "All-around",
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  endurance: "Endurance",
  fat_loss: "Fat loss",
  longevity: "Longevity",
  focus: "Focus",
};
// Mental-focus tag → human label, mirrors the onboarding step.
const MENTAL_FOCUS_LABEL: Record<string, string> = {
  anxiety: "Anxiety",
  low_mood: "Low mood",
  focus: "Focus",
  sleep: "Sleep",
  burnout: "Burnout",
  none: "None",
};
// 1–5 emoji rows reused for the read-only stress / mood display.
const STRESS_EMOJI = ["😌", "🙂", "😐", "😬", "😫"];
const MOOD_EMOJI   = ["😢", "😕", "😐", "🙂", "😄"];

const formatScale = (
  value: number | null | undefined,
  emojis: readonly string[],
) => (value && value >= 1 && value <= 5 ? `${emojis[value - 1]} ${value}/5` : "—");

const AthleteProfileSettings = () => {
  const navigate = useNavigate();
  const { profile, isLoading, refetch } = useAthleteProfile();
  const [editing, setEditing] = useState(false);

  if (isLoading) return <PageSkeleton />;

  if (editing || !profile?.onboarded) {
    return (
      <div className="min-h-full">
        <PageBar title="Athlete profile" onBack={() => (editing ? setEditing(false) : navigate(-1))} />
        <AthleteProfileOnboarding onDone={() => { setEditing(false); refetch(); }} />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <PageBar
        title="Athlete profile"
        onBack={() => navigate(-1)}
        action={
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Edit">
            <Pencil size={16} />
          </Button>
        }
      />

      <div className="px-4 pt-4 pb-6 space-y-5">
        {profile.i_am && (
          <div className="rounded-2xl px-4 py-4 border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.05)]">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold mb-1">Identity</p>
            <p className="text-sm leading-relaxed">{profile.i_am}</p>
          </div>
        )}

        <Section title="Body">
          <Row label="Age" value={profile.age ? `${profile.age}` : "—"} />
          <Row label="Sex" value={(profile.sex ?? "—").replace("_"," ")} />
          <Row label="Height" value={profile.height_cm ? `${profile.height_cm} cm` : "—"} />
          <Row label="Weight" value={profile.weight_kg ? `${profile.weight_kg} kg` : "—"} />
        </Section>

        <Section title="Goal">
          <Row label="Primary" value={GOALS[profile.primary_goal ?? ""] ?? "—"} />
          <Row label="Sports" value={(profile.sports ?? []).length ? (profile.sports ?? []).map((id) => sportById(id).label).join(", ") : "—"} />
          <Row label="Horizon" value={profile.target_horizon_weeks ? `${profile.target_horizon_weeks} weeks` : "—"} />
        </Section>

        <Section title="Schedule">
          <Row label="Timezone" value={profile.timezone ?? "—"} />
        </Section>

        <Section title="Constraints">
          <Row label="Injuries" value={(profile.injuries ?? []).join(", ") || "None"} />
          <Row label="Diet" value={(profile.dietary ?? []).join(", ") || "Omnivore"} />
          <Row label="Equipment" value={(profile.equipment ?? []).join(", ") || "Bodyweight only"} />
        </Section>

        {/* Mind & life — holistic well-being fields (migration 20260511181220).
            Null-safe access because columns may not exist on legacy rows
            (the holistic migration wasn't always applied on Lovable-imported
            profiles). Defaults render as "—" rather than crashing the page. */}
        <Section title="Mind & life">
          <Row label="Hobbies" value={(profile.hobbies ?? []).length > 0 ? (profile.hobbies ?? []).join(", ") : "—"} />
          <Row label="Stress" value={formatScale(profile.stress_baseline ?? null, STRESS_EMOJI)} />
          <Row label="Mood"   value={formatScale(profile.mood_baseline ?? null, MOOD_EMOJI)} />
          <Row
            label="Focus areas"
            value={
              (profile.mental_health_focus ?? []).length > 0
                ? (profile.mental_health_focus ?? [])
                    .map((m) => MENTAL_FOCUS_LABEL[m] ?? m)
                    .join(", ")
                : "—"
            }
          />
          <Row label="Life context" value={profile.life_context || "—"} />
        </Section>

        <Section title="Coach style">
          <Row label="Tone" value={profile.tone_pref ? (TONES[profile.tone_pref] ?? "—") : "—"} />
          <Row label="Language" value={profile.language_pref ? profile.language_pref.toUpperCase() : "—"} />
        </Section>

        <Button variant="ember" size="lg" className="w-full" onClick={() => setEditing(true)}>
          <Pencil size={14} /> Edit profile
        </Button>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground/70 mb-1.5 px-1">{title}</p>
    <div className="rounded-2xl bg-card/40 border border-border/30 px-4">{children}</div>
  </div>
);

export default AthleteProfileSettings;
