import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Loader2, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { SEGMENT_TRACK, SEGMENT_ACTIVE, SEGMENT_IDLE } from "@/components/ui/segment";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification, hapticSelection } from "@/lib/haptics";
import { friendlyError } from "@/lib/error-copy";
import { formatRest } from "@/lib/training/runner";
import { resolveIllustration } from "@/lib/exercise-match";
import { illustrationThumb } from "@/data/exercises-illustrated";
import { GOLD_LINES } from "@/components/coach/gold-lines";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import { sessionMinutes, useBuildFocusSession, useSwapExercise, type BuiltSession, type Focus } from "@/hooks/use-focus-session";

/**
 * Train today — pick the muscles, get the session. Builds in a moment from
 * the same drawable pool the 4-week program uses; the preview costs nothing,
 * Start stores a one-day program row and opens the runner on it. The 4-week
 * program is untouched either way.
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
const MAX_PICK = 3;
const nearestMinutes = (m: number) =>
  MINUTES.reduce((best, x) => (Math.abs(x - m) < Math.abs(best - m) ? x : best), 45 as number);

const sameSet = (a: Focus[], b: Focus[]) => a.length === b.length && a.every((f) => b.includes(f));

const Thumb = ({ slug, name }: { slug: string; name: string }) => {
  const ill = resolveIllustration(slug, name);
  return (
    <div className="h-11 w-11 rounded-lg overflow-hidden shrink-0 bg-black border border-border flex items-center justify-center">
      {ill ? (
        <img src={illustrationThumb(ill.idNum)} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-0.5" style={{ filter: GOLD_LINES }} />
      ) : (
        <span className="text-micro font-black text-muted-foreground">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
};

interface Props { open: boolean; onClose: () => void }

const FocusSessionSheet = ({ open, onClose }: Props) => {
  const navigate = useNavigate();
  const { profile } = useAthleteProfile();
  const build = useBuildFocusSession();
  const swap = useSwapExercise();
  const [focus, setFocus] = useState<Focus[]>([]);
  const [minutes, setMinutes] = useState<number>(() => {
    const m = Number(profile?.preferred_session_length_min);
    return m > 0 ? nearestMinutes(m) : 45;
  });
  const [seed, setSeed] = useState(1);
  const [preview, setPreview] = useState<BuiltSession | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [swapping, setSwapping] = useState<string | null>(null);

  const toggle = (f: Focus) => {
    hapticSelection();
    setPreview(null);
    setFocus((cur) => cur.includes(f) ? cur.filter((x) => x !== f) : cur.length >= MAX_PICK ? cur : [...cur, f]);
  };
  const preset = (fs: Focus[]) => { hapticSelection(); setPreview(null); setFocus(fs); };

  const fail = (e: unknown) => {
    hapticNotification("error");
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

  const seedKey = (n: number) => `${new Date().toISOString().slice(0, 10)}:${n}`;

  const buildPreview = async (n = seed) => {
    if (focus.length === 0) return;
    hapticImpact("light");
    try {
      const res = await build.mutateAsync({ focus, minutes, seed: seedKey(n), commit: false });
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
      const res = await swap.mutateAsync({ focus, minutes, seed: seedKey(seed), slug, sets: cur?.sets, exclude: preview.blocks.map((b) => b.slug) });
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
    try {
      const slugs = preview?.blocks.map((b) => b.slug);
      const res = await build.mutateAsync({ focus, minutes, seed: seedKey(seed), commit: true, slugs });
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
      label="Train today"
      title="Train today"
      subtitle="Pick what you want to hit. The session builds itself."
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
        </div>

        <div>
          <p className="text-label font-bold text-muted-foreground mb-2">Minutes</p>
          <div className={SEGMENT_TRACK}>
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => { hapticSelection(); setPreview(null); setMinutes(m); }}
                className={cn(
                  "relative before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] flex-1 min-h-9 rounded-lg text-meta font-black transition-colors tabular-nums",
                  minutes === m ? SEGMENT_ACTIVE : SEGMENT_IDLE,
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {!preview && (
          <Button variant="ember" size="lg" className="w-full" disabled={focus.length === 0 || busy} onClick={() => buildPreview()}>
            {busy ? <Loader2 aria-hidden size={16} className="animate-spin" /> : "Build my session"}
          </Button>
        )}

        {preview && (
          <div className="home-rise">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display font-black text-lead tracking-tight leading-tight">{preview.focus}</p>
              <p className="text-meta text-muted-foreground tabular-nums shrink-0">
                {preview.duration_min} min · {preview.blocks.length} exercises
              </p>
            </div>
            <ul className="mt-3 divide-y divide-border/35 border-y border-border/35">
              {preview.blocks.map((b, i) => (
                <li key={b.slug} className={cn("flex items-center gap-3 py-2.5", i < 4 && "animate-fade-in-up")} style={i < 4 ? { animationDelay: `${i * 45}ms` } : undefined}>
                  <Thumb slug={b.slug} name={b.name} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-note font-bold leading-tight truncate">{b.name}</span>
                    <span className="block text-meta text-muted-foreground mt-0.5 tabular-nums">
                      {b.sets} × {b.reps} · rest {formatRest(b.rest_sec)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    aria-label={`Swap ${b.name}`}
                    disabled={busy || !!swapping}
                    onClick={() => swapRow(b.slug)}
                  >
                    {swapping === b.slug ? <Loader2 aria-hidden size={15} className="animate-spin" /> : <ArrowLeftRight aria-hidden size={15} />}
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" size="lg" className="shrink-0 text-muted-foreground" disabled={busy} onClick={shuffle} aria-label="Shuffle the session">
                <Shuffle aria-hidden size={16} /> Shuffle
              </Button>
              <Button variant="ember" size="lg" className="flex-1" disabled={busy} onClick={start}>
                {busy ? <Loader2 aria-hidden size={16} className="animate-spin" /> : "Start session"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default FocusSessionSheet;
