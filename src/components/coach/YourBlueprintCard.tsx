import { useNavigate } from "react-router-dom";
import { Sparkles, ChevronRight, Target, Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";

/**
 * YourBlueprintCard — a compact, read-only summary of the user's W Coach
 * profile, surfaced on the Profile page.
 *
 * Renders the highest-signal fields the user has set during onboarding:
 *   • Primary goal             → "Goal: Strength"
 *   • Coach tone preference    → "Voice: Calm mentor"
 *   • Up to 3 hobby chips      → "Reading · Outdoors · Family"
 *   • Life context (truncated) → italicised quote line, if set
 *
 * Tapping the card navigates to `/coach/profile` (the existing
 * AthleteProfileSettings route in ModalStack), where every field can be
 * edited. If the user hasn't onboarded yet, render null — the card is
 * additive and we don't want an empty placeholder on the profile page.
 *
 * Why this lives on Profile: the Profile tab is where users go to inspect
 * "who they are" inside the app. Until now, that was only their rank,
 * tier, and badges — i.e. their public game-face. The blueprint card
 * surfaces the Coach's private picture of them too, so the app stops
 * feeling like the Coach is a separate product.
 */

// Mirror of the GOALS / TONES maps from AthleteProfileOnboarding — kept
// small so this file stays self-contained.
const GOAL_LABEL: Record<string, string> = {
  all:         "All-round",
  strength:    "Strength",
  hypertrophy: "Hypertrophy",
  endurance:   "Endurance",
  fat_loss:    "Fat loss",
  longevity:   "Longevity",
  focus:       "Focus",
};

const TONE_LABEL: Record<string, string> = {
  drill_sergeant: "Drill sergeant",
  calm_mentor:    "Calm mentor",
  scientist:      "Scientist",
  hype:           "Hype",
};

interface YourBlueprintCardProps {
  className?: string;
}

const YourBlueprintCard = ({ className }: YourBlueprintCardProps) => {
  const navigate = useNavigate();
  const { profile, isLoading } = useAthleteProfile();

  // Loading state — render nothing rather than a skeleton; the page has
  // enough above-the-fold content already.
  if (isLoading || !profile || !profile.onboarded) return null;

  const goalLabel = profile.primary_goal ? GOAL_LABEL[profile.primary_goal] : null;
  const toneLabel = profile.tone_pref ? TONE_LABEL[profile.tone_pref] : null;
  const hobbies = profile.hobbies?.slice(0, 3) ?? [];
  const lifeContext = profile.life_context?.trim();
  const why = profile.i_am?.trim();

  return (
    <button
      type="button"
      onClick={() => navigate("/coach/profile")}
      className={cn(
        "w-full text-left rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/[0.05] via-card/95 to-card",
        "p-5 active:scale-[0.99] transition-transform shadow-[0_18px_48px_-24px_hsl(var(--gold)/0.4)]",
        className,
      )}
      aria-label="Edit your W Coach blueprint"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-gold to-[hsl(42_78%_42%)] flex items-center justify-center shrink-0 shadow-[0_0_14px_hsl(var(--gold)/0.4)]">
          <Sparkles size={16} className="text-[hsl(260_18%_4%)]" strokeWidth={2.6} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-gold/80">
            Your blueprint
          </p>
          <p className="text-sm font-bold text-foreground">
            How the Coach sees you
          </p>
        </div>
        <ChevronRight size={16} className="text-gold/60 shrink-0 mt-1.5" aria-hidden />
      </div>

      {/* The "why" — the identity the user is training toward. Headline of the
          card because it's the whole point; goal/voice/joy are the supporting
          detail. Falls back gracefully when not yet authored. */}
      {why && (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/70 mb-1">
            Who I'm becoming
          </p>
          <p className="font-display text-[17px] font-black leading-snug tracking-tight text-foreground">
            {why}
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {goalLabel && (
          <Row icon={<Target size={11} />} label="Goal" value={goalLabel} />
        )}
        {toneLabel && (
          <Row icon={<MessageCircle size={11} />} label="Voice" value={toneLabel} />
        )}
      </div>

      {hobbies.length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">
            <Heart size={12} className="text-gold/70" aria-hidden /> Joy
          </span>
          {hobbies.map((h) => (
            <span
              key={h}
              className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-card/80 border border-border/60 text-foreground/90"
            >
              {h}
            </span>
          ))}
        </div>
      )}

      {lifeContext && (
        <p className="mt-3 text-[12px] italic text-muted-foreground/85 leading-relaxed border-l-2 border-gold/40 pl-3 line-clamp-2">
          "{lifeContext}"
        </p>
      )}
    </button>
  );
};

const Row = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="rounded-2xl border border-border/40 bg-card/60 px-3 py-2 min-w-0">
    <div className="flex items-center gap-1 text-muted-foreground/70 mb-0.5">
      <span className="text-gold/80 shrink-0">{icon}</span>
      <p className="text-[10px] font-black uppercase tracking-[0.22em]">{label}</p>
    </div>
    <p className="text-[12px] font-bold text-foreground/95 leading-tight truncate">{value}</p>
  </div>
);

export default YourBlueprintCard;
