import { forwardRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Block } from "@/components/skeletons/PageSkeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import { useCreateProgram } from "@/hooks/use-focus-session";
import { BLOCK_EXPERIENCE, createBeginnerProgram, nextBeginnerBlock } from "@/lib/beginner-program";

interface Props { onGenerated: () => void }

const GOAL_LABEL: Record<string, string> = {
  all: "All-around",
  strength: "Raw strength",
  hypertrophy: "Build muscle",
  fat_loss: "Fat loss",
  endurance: "Endurance",
  longevity: "Longevity",
  focus: "Sharpen focus",
};

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]; // Sun..Sat

const SESSION_MINUTES = [30, 45, 60, 75, 90] as const;

/**
 * The coach's week: one session for each training day in the profile, built
 * on the phone by the same engine that builds a single day. Instant, no model,
 * and every day and movement in it can be changed by hand afterwards.
 */
const ProgramOnboarding = ({ onGenerated }: Props) => {
  const navigate = useNavigate();
  const { profile, isLoading, upsert } = useAthleteProfile();
  const createProgram = useCreateProgram();
  const [building, setBuilding] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const goalLabel = GOAL_LABEL[profile?.primary_goal ?? "all"] ?? "All-around";
  const days = profile?.training_days_pref ?? [1, 2, 4, 5];
  const sessionMin = profile?.preferred_session_length_min ?? 45;
  // Presets are stored as keys ("full_gym"); the summary reads them as words.
  const equipment = (profile?.equipment ?? []).join(", ").replace(/_/g, " ") || "Bodyweight";
  const injuries = profile?.injuries ?? [];

  // Saved to the athlete profile at once: the week builder reads it from
  // there, and so does the focus-session sheet's default.
  const setSessionLength = (m: number) => {
    if (m === sessionMin) return;
    hapticImpact("light");
    upsert({ preferred_session_length_min: m }).catch((e) => toast.error(friendlyError(e, "Couldn't save the session length")));
  };

  const generate = async () => {
    setBuilding(true);
    setLastError(null);
    hapticImpact("medium");
    try {
      // A first-timer gets the written 8-week path instead of a built week:
      // the same few movements, loaded slowly, is the right start for someone
      // new to a barbell.
      if (profile?.training_experience === "never_trained") {
        // The newest BEGINNER block, not the newest program: a session for
        // today or a hand-built week in between used to send a beginner back
        // to block one.
        const { data: lastBlock } = await supabase
          .from("coach_programs")
          .select("experience")
          .eq("user_id", profile.user_id)
          .in("experience", Object.values(BLOCK_EXPERIENCE))
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const block = nextBeginnerBlock(lastBlock?.experience);
        if (block) {
          await createBeginnerProgram({
            userId: profile.user_id,
            block,
            goal: profile.primary_goal,
            equipment: profile.equipment,
            injuries: profile.injuries,
          });
          hapticNotification("success");
          toast.success(block === 1 ? "Your first block is ready." : "Block two is ready.");
          onGenerated();
          return;
        }
        // Both written blocks are behind them: the week builder takes over,
        // still under the novice rules.
      }
      await createProgram.mutateAsync({ kind: "week" });
      hapticNotification("success");
      onGenerated();
    } catch (e) {
      hapticNotification("error");
      const msg = e instanceof Error ? e.message : "";
      // The INSERT policy is has_active_access: a lapsed trial lands here.
      if (/row-level security|premium/i.test(msg)) {
        toast.error("Building a week is a Premium feature.", {
          action: { label: "Unlock", onClick: () => navigate("/paywall") },
        });
      } else {
        setLastError(friendlyError(e, "Couldn't build the week. Try again."));
      }
    } finally {
      setBuilding(false);
    }
  };

  // The profile decides which of the two states below is true, so wait for it
  // rather than flashing a summary of defaults on the way to the setup door.
  if (isLoading) {
    return (
      <div className="px-1 pt-2 pb-8 space-y-4">
        <Block height={56} />
        <Block height={148} delay={80} />
      </div>
    );
  }

  // Nothing to build from yet. The summary below is the profile, and with no
  // profile every value in it is a default the athlete never chose.
  if (!profile?.onboarded) {
    return (
      <div className="px-1 pt-2 pb-8">
        <h2 className="font-display text-2xl font-black tracking-tight leading-tight">Coach needs to meet you first</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6 leading-relaxed">
          Your goal, the days you train, what you lift with, anything that hurts. Two minutes, once. Every week after
          that is built from it.
        </p>
        <Button variant="ember" size="lg" className="w-full" onClick={() => { hapticImpact("light"); navigate("/coach/profile"); }}>
          Set up my athlete profile
        </Button>
      </div>
    );
  }

  return (
    <div className="px-1 pt-2 pb-8">
      <h2 className="font-display text-2xl font-black tracking-tight leading-tight">Build my week</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5 leading-relaxed">
        One session for each of your training days. It runs for four weeks, and the loads follow what you log.
      </p>

      <div className="rounded-2xl border border-[hsl(var(--gold)/0.3)] bg-gradient-to-b from-[hsl(var(--gold)/0.06)] to-card/40 p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-label font-bold text-gold">From your athlete profile</p>
          <button type="button" onClick={() => navigate("/coach/profile")}
            className="text-label font-bold text-muted-foreground inline-flex items-center gap-1 hover:text-foreground transition-colors">
            <Settings2 aria-hidden size={11} /> Edit
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
          <Row k="Goal"      v={goalLabel} />
          <Row k="Session"   v={`${sessionMin} min`} />
          <Row k="Schedule"  v={`${days.length} day${days.length === 1 ? "" : "s"}/wk`} extra={<DayDots active={days} />} wide />
          <Row k="Equipment" v={equipment} wide />
          {injuries.length > 0 && <Row k="Injuries" v={injuries.join(", ")} wide />}
        </dl>
      </div>

      <Field label="Session length">
        <div className="flex flex-wrap gap-1.5">
          {SESSION_MINUTES.map((m) => (
            <Chip key={m} active={sessionMin === m} onClick={() => setSessionLength(m)}>{m} min</Chip>
          ))}
        </div>
        <p className="text-label text-muted-foreground/75 mt-1.5">Every training day is planned to fit this.</p>
      </Field>

      {lastError && (
        <p role="alert" className="mt-5 rounded-2xl border border-destructive/50 bg-destructive/10 p-3.5 text-dense text-foreground/90 leading-snug">
          {lastError}
        </p>
      )}

      <Button variant="ember" size="lg" className="w-full mt-6" disabled={building} onClick={generate}>
        {building && <Loader2 aria-hidden size={16} className="animate-spin" />}
        Build my week
      </Button>
      <p className="text-label text-muted-foreground/75 text-center mt-3">
        Any day can become a rest day, and any movement can be swapped, after it is built.
      </p>
    </div>
  );
};

const Row = ({ k, v, wide, extra }: { k: string; v: string; wide?: boolean; extra?: React.ReactNode }) => (
  <div className={cn("flex flex-col gap-0.5", wide && "col-span-2")}>
    <dt className="text-label font-bold text-muted-foreground">{k}</dt>
    <dd className="text-foreground/90 font-medium flex items-center gap-2">{v}{extra}</dd>
  </div>
);

const DayDots = ({ active }: { active: number[] }) => (
  <span className="inline-flex gap-0.5 ml-1">
    {DAY_LETTERS.map((l, i) => (
      <span key={i} className={cn(
        "w-3.5 h-3.5 rounded-[5px] text-label font-black flex items-center justify-center",
        active.includes(i) ? "bg-[hsl(var(--gold)/0.8)] text-background" : "bg-card/60 text-muted-foreground/75",
      )}>{l}</span>
    ))}
  </span>
);

const Field = forwardRef<HTMLDivElement, { label: string; children: React.ReactNode }>(
  ({ label, children }, ref) => (
    <div ref={ref}>
      <label className="text-label font-bold text-muted-foreground mb-2 block">{label}</label>
      {children}
    </div>
  ),
);
Field.displayName = "Field";

const Chip = forwardRef<HTMLButtonElement, { active: boolean; onClick: () => void; children: React.ReactNode }>(
  ({ active, onClick, children }, ref) => (
    <button ref={ref} type="button" onClick={onClick}
      className={cn(
        "rounded-full border transition-colors px-3 py-1.5 text-xs",
        active
          ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold))] font-bold"
          : "border-border/40 bg-card/40 text-muted-foreground"
      )}>
      {children}
    </button>
  ),
);
Chip.displayName = "Chip";

export default ProgramOnboarding;
