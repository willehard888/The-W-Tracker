import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, ChevronRight, Loader2, Shuffle } from "lucide-react";
import { toast } from "@/lib/toast";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { SEGMENT_TRACK, SEGMENT_ACTIVE, SEGMENT_IDLE, SEGMENT_BUTTON } from "@/components/ui/segment";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification, hapticSelection } from "@/lib/haptics";
import { friendlyError } from "@/lib/error-copy";
import { formatRest } from "@/lib/training/runner";
import { localDateKey } from "@/lib/date";
import { resolveIllustration } from "@/lib/exercise-match";
import { goldThumb } from "@/components/coach/gold-lines";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import { useRecentWorkoutLogs } from "@/hooks/use-workout-log";
import { fmtKg } from "@/components/coach/session/SetRow";
import { sessionMinutes, useBuildFocusSession, useMuscleBalance, useSwapExercise, type BuiltSession, type Feel, type Focus, type SessionBlock } from "@/hooks/use-focus-session";
import { track, FUNNEL } from "@/lib/analytics";

// A row opens the movement full size — the animated demonstration, the steps,
// the cues — so nobody has to know an exercise by its name. The preview pulls
// the coaching prose (130 KB); a builder nobody taps a row in pays nothing.
const ExercisePreviewSheet = lazy(() =>
  import("@/components/coach/ExercisePreviewSheet").then((m) => ({ default: m.ExercisePreviewSheet })),
);

/**
 * Train today — say what you want (the muscles, the minutes, how it should
 * feel) and get the session. Builds in a moment from the safe, drawable pool;
 * the preview costs nothing, Start stores a one-day program row and opens the
 * runner on it. With `onUse` the same sheet fills a day of a program instead:
 * the preview is handed back and nothing is stored here.
 */

const FOCUS: { key: Focus; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "back", label: "Back" },
  { key: "shoulders", label: "Shoulders" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "legs", label: "Legs" },
  { key: "glutes", label: "Glutes" },
  { key: "core", label: "Core" },
];
const PRESETS: { label: string; focus: Focus[] }[] = [
  { label: "Push", focus: ["chest", "shoulders", "triceps"] },
  { label: "Pull", focus: ["back", "biceps"] },
  { label: "Full body", focus: ["chest", "back", "legs"] },
];
const MINUTES = [30, 45, 60, 75, 90] as const;
const FEEL: { key: Feel; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "normal", label: "Normal" },
  { key: "hard", label: "Hard" },
];
const labelOf = (f: Focus) => FOCUS.find((x) => x.key === f)?.label ?? f;
const MAX_PICK = 3;
const nearestMinutes = (m: number) =>
  MINUTES.reduce((best, x) => (Math.abs(x - m) < Math.abs(best - m) ? x : best), 45 as number);

const sameSet = (a: Focus[], b: Focus[]) => a.length === b.length && a.every((f) => b.includes(f));

export const Thumb = ({ slug, name }: { slug: string; name: string }) => {
  const ill = resolveIllustration(slug, name);
  return (
    <div className="h-11 w-11 rounded-lg overflow-hidden shrink-0 bg-black border border-border flex items-center justify-center">
      {ill ? (
        <img src={goldThumb(ill.idNum)} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-0.5" />
      ) : (
        <span className="text-label font-black text-muted-foreground">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fill a program day instead of starting a session: the preview is handed back, nothing is stored. */
  onUse?: (day: BuiltSession) => void;
  title?: string;
}

const FocusSessionSheet = ({ open, onClose, onUse, title = "Train today" }: Props) => {
  const navigate = useNavigate();
  const { profile } = useAthleteProfile();
  const build = useBuildFocusSession();
  const swap = useSwapExercise();
  const [focus, setFocus] = useState<Focus[]>([]);
  const [minutes, setMinutes] = useState<number>(() => {
    const m = Number(profile?.preferred_session_length_min);
    return m > 0 ? nearestMinutes(m) : 45;
  });
  const [feel, setFeel] = useState<Feel>("normal");
  // The muscle groups the athlete has been skipping: offered, never imposed.
  const neglected = useMuscleBalance(open);
  // The newest top set per movement (the balance hook already loads these):
  // the preview says "last time" where there is one, and the builder has
  // kept those lifts in their slots so the loads carry on.
  const recentLogs = useRecentWorkoutLogs();
  const lastBySlug = new Map<string, { weight: number | null; reps: number | null; logged_on: string }>();
  for (const r of recentLogs.data ?? []) {
    if (r.exercise_slug && !lastBySlug.has(r.exercise_slug)) lastBySlug.set(r.exercise_slug, { weight: r.weight, reps: r.reps, logged_on: r.logged_on });
  }
  const daysAgo = (day: string) => {
    const d = Math.round((Date.parse(`${localDateKey()}T00:00:00Z`) - Date.parse(`${day.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
    return d <= 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;
  };
  const novice = profile?.training_experience === "never_trained";
  const [seed, setSeed] = useState(1);
  const [preview, setPreview] = useState<BuiltSession | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [swapping, setSwapping] = useState<string | null>(null);
  // The movement opened full size from its row (null while the sheet closes).
  const [shown, setShown] = useState<SessionBlock | null>(null);

  const toggle = (f: Focus) => {
    hapticSelection();
    setPreview(null);
    setFocus((cur) => cur.includes(f) ? cur.filter((x) => x !== f) : cur.length >= MAX_PICK ? cur : [...cur, f]);
  };
  const preset = (fs: Focus[]) => { hapticSelection(); setPreview(null); setFocus(fs); };

  const fail = (e: unknown) => {
    const status = (e as { status?: number })?.status ?? 0;
    const msg = e instanceof Error ? e.message : "";
    if (status === 403 || /membership/i.test(msg)) {
      toast.error("Sessions are part of the membership.", { action: { label: "Unlock", onClick: () => navigate("/paywall") } });
    } else if (status === 400 && /profile/i.test(msg)) {
      toast.error("Coach needs your athlete profile first.", { action: { label: "Set up", onClick: () => navigate("/coach/profile") } });
    } else {
      toast.error(friendlyError(e, "Couldn't build the session. Try again."));
    }
  };

  const seedKey = (n: number) => `${localDateKey()}:${n}`;

  const buildPreview = async (n = seed) => {
    if (focus.length === 0) return;
    hapticImpact("light");
    try {
      const res = await build.mutateAsync({ focus, minutes, feel, seed: seedKey(n), commit: false });
      if (res.day) { setPreview(res.day); setDayIndex(res.dayIndex); }
    } catch (e) { fail(e); }
  };
  const shuffle = () => { const n = seed + 1; setSeed(n); void buildPreview(n); };

  // One row for another of the same pattern; the rest of the session stays.
  const swapRow = async (slug: string) => {
    if (!preview || swapping) return;
    hapticImpact("light");
    setSwapping(slug);
    try {
      const cur = preview.blocks.find((b) => b.slug === slug);
      const res = await swap.mutateAsync({ focus, minutes, feel, seed: seedKey(seed), slug, sets: cur?.sets, exclude: preview.blocks.map((b) => b.slug) });
      setPreview((cur) => {
        if (!cur) return cur;
        const blocks = cur.blocks.map((b) => (b.slug === slug ? res.block : b));
        return { ...cur, blocks, duration_min: sessionMinutes(blocks) };
      });
    } catch (e) {
      toast.error(friendlyError(e, "No other movement fits there."));
    } finally { setSwapping(null); }
  };

  const start = async () => {
    hapticImpact("medium");
    if (onUse && preview) {
      onUse(preview);
      onClose();
      return;
    }
    try {
      const slugs = preview?.blocks.map((b) => b.slug);
      const res = await build.mutateAsync({ focus, minutes, feel, seed: seedKey(seed), commit: true, slugs });
      if (!res.program) throw new Error("No session came back");
      hapticNotification("success");
      onClose();
      navigate(`/coach/session/1/${res.dayIndex}?p=${res.program.id}`);
    } catch (e) { fail(e); }
  };

  const busy = build.isPending;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={title}
      title={title}
      subtitle="Tap any movement to see how it's done."
      height="tall"
    >
      <div className="space-y-5 pb-2">
        <div>
          <p className="text-label font-bold text-muted-foreground mb-2">Focus · up to {MAX_PICK}</p>
          <div className="flex flex-wrap gap-1.5">
            {FOCUS.map((f) => (
              <Button
                key={f.key}
                type="button"
                size="pill"
                variant={focus.includes(f.key) ? "gold-outline" : "outline"}
                aria-pressed={focus.includes(f.key)}
                onClick={() => toggle(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {neglected.length > 0 && (
              <Button
                type="button"
                size="pill"
                variant={sameSet(focus, neglected) ? "gold-outline" : "ghost"}
                className="text-muted-foreground"
                onClick={() => {
                  preset(neglected);
                  void track(FUNNEL.balanceSuggestionUsed, { focus: neglected, surface: "sheet" });
                }}
              >
                Catch up
              </Button>
            )}
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                size="pill"
                variant={sameSet(focus, p.focus) ? "gold-outline" : "ghost"}
                className="text-muted-foreground"
                onClick={() => preset(p.focus)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {neglected.length > 0 && (
            <p className="text-meta text-muted-foreground mt-2 leading-snug">
              Not trained lately: {neglected.map(labelOf).join(", ").toLowerCase()}. Catch up picks them.
            </p>
          )}
        </div>

        <div>
          <p className="text-label font-bold text-muted-foreground mb-2">Minutes</p>
          <div className={SEGMENT_TRACK}>
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => { setPreview(null); setMinutes(m); }}
                className={cn(
                  SEGMENT_BUTTON, "min-h-9 relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] tabular-nums",
                  minutes === m ? SEGMENT_ACTIVE : SEGMENT_IDLE,
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-label font-bold text-muted-foreground mb-2">How it should feel</p>
          <div className={SEGMENT_TRACK}>
            {FEEL.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={feel === f.key}
                disabled={f.key === "hard" && novice}
                onClick={() => { setPreview(null); setFeel(f.key); }}
                className={cn(
                  SEGMENT_BUTTON, "min-h-9 relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] disabled:opacity-40",
                  feel === f.key ? SEGMENT_ACTIVE : SEGMENT_IDLE,
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-meta text-muted-foreground mt-2 leading-snug">
            {feel === "light" ? "One set fewer, well short of failure." : feel === "hard" ? "Same movements, a notch closer to failure." : "The dose your goal calls for."}
          </p>
        </div>

        {!preview && (
          <Button variant="ember" size="lg" className="w-full" disabled={focus.length === 0 || busy} onClick={() => buildPreview()}>
            {busy ? <Loader2 aria-hidden size={16} className="animate-spin" /> : "Build my session"}
          </Button>
        )}

        {preview && (
          <div className="home-rise">
            <div className="flex items-baseline justify-between gap-3">
              <p className="h-card">{preview.focus}</p>
              <p className="text-meta text-muted-foreground tabular-nums shrink-0">
                {preview.duration_min} min · {preview.blocks.length} exercises
              </p>
            </div>
            <ul className="mt-3 divide-y divide-border/35 border-y border-border/35">
              {preview.blocks.map((b, i) => (
                <li key={b.slug} className={cn("flex items-center gap-1", i < 4 && "animate-fade-in-up")} style={i < 4 ? { animationDelay: `${i * 45}ms` } : undefined}>
                  {/* Two sibling controls, never one inside the other: the row
                      shows the movement, the ⇄ swaps it. */}
                  <button
                    type="button"
                    onClick={() => setShown(b)}
                    aria-label={`See ${b.name}`}
                    className="press-row flex-1 min-w-0 min-h-11 flex items-center gap-3 py-2.5 text-left"
                  >
                    <Thumb slug={b.slug} name={b.name} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-note font-bold leading-tight truncate">{b.name}</span>
                      <span className="block text-meta text-muted-foreground mt-0.5 tabular-nums">
                        {b.sets} × {b.reps} · RPE {b.rpe} · rest {formatRest(b.rest_sec)}
                      </span>
                      {(() => {
                        const last = lastBySlug.get(b.slug);
                        return last && (last.weight != null || last.reps != null) ? (
                          <span className="block text-label text-muted-foreground/75 mt-0.5 tabular-nums">
                            Last {last.weight != null ? fmtKg(Number(last.weight)) : ""}{last.weight != null && last.reps != null ? " × " : ""}{last.reps != null ? `${last.reps}${last.weight == null ? " reps" : ""}` : ""} · {daysAgo(last.logged_on)}
                          </span>
                        ) : null;
                      })()}
                    </span>
                    <ChevronRight aria-hidden size={14} className="text-muted-foreground/75 shrink-0" />
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    aria-label={`Swap ${b.name}`}
                    disabled={busy || !!swapping}
                    onClick={() => swapRow(b.slug)}
                  >
                    {swapping === b.slug ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <ArrowLeftRight aria-hidden size={16} />}
                  </Button>
                </li>
              ))}
            </ul>
            {(() => {
              const trained = preview.blocks.filter((b) => lastBySlug.has(b.slug)).length;
              return (
                <p className="text-label text-muted-foreground mt-2 tabular-nums">
                  {trained > 0
                    ? `${trained} of ${preview.blocks.length} movements you've trained before — loads follow your log.`
                    : "New movements: the first session sets the loads, the next one builds on them."}
                </p>
              );
            })()}
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" size="lg" className="shrink-0 text-muted-foreground" disabled={busy} onClick={shuffle} aria-label="Shuffle the session">
                <Shuffle aria-hidden size={16} /> Shuffle
              </Button>
              {/* Not while a swap is in flight: Start would store the list from before it. */}
              <Button variant="ember" size="lg" className="flex-1" disabled={busy || !!swapping} onClick={start}>
                {busy ? <Loader2 aria-hidden size={16} className="animate-spin" /> : onUse ? "Use this session" : "Start session"}
              </Button>
            </div>
          </div>
        )}
      </div>
      {shown && (
        <Suspense fallback={null}>
          <ExercisePreviewSheet
            open={!!shown}
            onClose={() => setShown(null)}
            block={shown}
            source="builder"
            onSwap={!busy && !swapping ? () => swapRow(shown.slug) : undefined}
          />
        </Suspense>
      )}
    </BottomSheet>
  );
};

export default FocusSessionSheet;
