import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, TrendingUp, TrendingDown, Moon, Flame, BookHeart, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useJourney, weeklyXp, type JourneyReflection } from "@/hooks/use-journey";
import { useWhealthSnapshots } from "@/hooks/use-whealth-snapshots";
import { useLiveWhealthIndex } from "@/hooks/use-live-whealth-index";
import PillarSheet from "@/components/journey/PillarSheet";
import type { PillarScores } from "@/lib/whealth-index";
import { useRecentNights } from "@/hooks/use-night-metrics";
import WhealthIndexCard from "@/components/journey/WhealthIndexCard";
import CoachSeesCard from "@/components/journey/CoachSeesCard";
import StoryShareModal from "@/components/StoryShareModal";
import Sparkline from "@/components/coach/Sparkline";
import AnimatedNumber from "@/components/AnimatedNumber";
import EmptyState from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const MOOD_EMOJI = ["😢", "😕", "😐", "🙂", "😄"];

/**
 * /journey — the Growth Mirror. Renders longitudinal data the app already
 * stores but never showed back: the daily win/friction reflection diary (was
 * write-only), the XP-per-week trajectory, and the sleep trend — plus a "how
 * far you've come" delta strip. Answers the one question a self-improvement app
 * must answer: "am I actually becoming who I set out to be?"
 */
const Journey = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data, isLoading } = useJourney(56);

  const reflections = data?.reflections ?? [];
  const checkins = data?.checkins ?? [];

  const xpWeeksAll = useMemo(() => weeklyXp(checkins), [checkins]);

  // COMPLETE weeks only for the trend math: the last bucket is the current,
  // partial week and the first is clipped by the 56-day window. Comparing them
  // raw showed "XP/week −90%" every Monday morning. Need ≥2 complete weeks.
  const xpWeeks = useMemo(
    () => (xpWeeksAll.length >= 4 ? xpWeeksAll.slice(1, -1) : xpWeeksAll.slice(0, -1)),
    [xpWeeksAll],
  );
  const xpDelta =
    xpWeeks.length >= 2 ? xpWeeks[xpWeeks.length - 1] - xpWeeks[0] : null;
  const xpPct =
    xpWeeks.length >= 2 && xpWeeks[0] > 0
      ? Math.round(((xpWeeks[xpWeeks.length - 1] - xpWeeks[0]) / xpWeeks[0]) * 100)
      : null;

  const sleepSeries = useMemo(
    () => checkins.map((c) => c.sleep).filter((v) => v > 0),
    [checkins],
  );
  const sleepDelta = useMemo(() => {
    const s = checkins.filter((c) => c.sleep > 0);
    if (s.length < 8) return null;
    const first = s.slice(0, 7);
    const last = s.slice(-7);
    const avg = (xs: typeof s) => xs.reduce((a, b) => a + b.sleep, 0) / xs.length;
    return avg(last) - avg(first);
  }, [checkins]);

  // Whealth OS: nightly snapshots (history + coach observations) + the LIVE
  // on-device computation (same pure core) so the index moves the moment you
  // check in. Live preferred for current values; snapshots power the trend.
  const { data: snapshots } = useWhealthSnapshots(28);
  const { data: liveIndex } = useLiveWhealthIndex();
  const latestSnap = snapshots?.[0];
  const priorSnap = snapshots && snapshots.length > 1 ? snapshots[snapshots.length - 1] : undefined;
  const heroOverall = liveIndex?.overall ?? latestSnap?.overall ?? null;
  const heroPillars = liveIndex?.overall != null ? liveIndex.pillars : latestSnap?.pillars;
  const overallHistory = useMemo(
    () => [...(snapshots ?? [])].reverse().map((s) => s.overall),
    [snapshots],
  );
  const [openPillar, setOpenPillar] = useState<keyof PillarScores | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const { data: nights } = useRecentNights(30);
  const rhrSeries = useMemo(
    () =>
      [...(nights ?? [])]
        .reverse() // oldest → newest for the sparkline
        .map((n) => n.resting_hr)
        .filter((v): v is number => v != null && v > 0),
    [nights],
  );
  const rhrDelta = useMemo(() => {
    if (rhrSeries.length < 8) return null;
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return avg(rhrSeries.slice(-7)) - avg(rhrSeries.slice(0, 7));
  }, [rhrSeries]);

  const bestStreak = profile?.longest_streak ?? 0;
  const daysTracked = checkins.length;

  // bestStreak included: a returning user with a lifetime streak but no recent
  // window data must see their record, NOT "your journey starts today" stacked
  // on top of the delta strip.
  const hasAnyData = daysTracked > 0 || reflections.length > 0 || bestStreak > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
            <Compass size={14} className="text-gold" />
          </div>
          <h1 className="font-display text-base font-black">Your Journey</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto momentum-scroll px-4 pt-4 pb-8 space-y-4">
        {!isLoading && !hasAnyData && (
          <EmptyState
            icon={Compass}
            title="Your journey starts today"
            description="Check in and reflect daily — this is where you'll watch yourself become who you set out to be."
          />
        )}

        {/* WHEALTH INDEX — live on-device score, six honest pillars, trend */}
        {heroOverall != null && heroPillars && (
          <WhealthIndexCard
            overall={heroOverall}
            pillars={heroPillars}
            priorPillars={priorSnap?.pillars}
            priorOverall={priorSnap?.overall}
            priorDate={priorSnap?.snapshotDate}
            live={liveIndex?.overall != null}
            history={overallHistory}
            onPillarTap={setOpenPillar}
            onShare={() => setShareOpen(true)}
          />
        )}

        {shareOpen && heroOverall != null && heroPillars && (
          <StoryShareModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            variant="whealth"
            whealthData={{ overall: heroOverall, pillars: heroPillars }}
          />
        )}

        {openPillar && (
          <PillarSheet
            pillar={openPillar}
            score={heroPillars?.[openPillar] ?? null}
            parts={liveIndex?.breakdown?.[openPillar] ?? []}
            onClose={() => setOpenPillar(null)}
          />
        )}

        {/* What your coach sees — grounded observations + the 7-day focus */}
        {latestSnap && <CoachSeesCard snapshot={latestSnap} />}

        {/* Resting heart rate — real HealthKit recovery trend */}
        {rhrSeries.length >= 7 && (
          <TrendCard
            icon={HeartPulse}
            title="Resting heart rate"
            sub="HealthKit · lower is better"
            values={rhrSeries}
            delta={rhrDelta != null ? `${rhrDelta > 0 ? "+" : ""}${rhrDelta.toFixed(1)} bpm` : null}
            good={(rhrDelta ?? 0) <= 0}
          />
        )}

        {/* How far you've come — delta strip */}
        {(xpDelta != null || sleepDelta != null || bestStreak > 0) && (
          <div className="rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] to-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={12} className="text-gold" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">
                How far you've come
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <DeltaTile
                icon={Flame}
                label="Best streak"
                value={<AnimatedNumber value={bestStreak} duration={800} />}
                unit="days"
              />
              {xpPct != null && (
                <DeltaTile
                  icon={TrendingUp}
                  label="XP / week"
                  value={<><span>{xpPct >= 0 ? "+" : ""}</span><AnimatedNumber value={xpPct} duration={800} /><span>%</span></>}
                  good={xpPct >= 0}
                />
              )}
              {sleepDelta != null && Math.abs(sleepDelta) >= 0.1 && (
                <DeltaTile
                  icon={Moon}
                  label="Sleep"
                  value={`${sleepDelta > 0 ? "+" : ""}${sleepDelta.toFixed(1)}h`}
                  good={sleepDelta > 0}
                />
              )}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground leading-snug">
              {daysTracked > 0
                ? `${daysTracked} days tracked · every check-in is a vote for who you're becoming.`
                : "Keep showing up — the proof compounds."}
            </p>
          </div>
        )}

        {/* XP-per-week trajectory */}
        {xpWeeks.length >= 2 && (
          <TrendCard
            icon={TrendingUp}
            title="Momentum"
            sub={`XP per week · ${xpWeeks.length} weeks`}
            values={xpWeeks}
            delta={xpDelta != null ? `${xpDelta >= 0 ? "+" : ""}${xpDelta.toLocaleString()} xp` : null}
            good={(xpDelta ?? 0) >= 0}
          />
        )}

        {/* Sleep trend */}
        {sleepSeries.length >= 5 && (
          <TrendCard
            icon={Moon}
            title="Recovery base"
            sub={`Sleep · last ${sleepSeries.length} nights logged`}
            values={sleepSeries}
            delta={sleepDelta != null && Math.abs(sleepDelta) >= 0.1 ? `${sleepDelta > 0 ? "+" : ""}${sleepDelta.toFixed(1)}h vs start` : null}
            good={(sleepDelta ?? 0) >= 0}
          />
        )}

        {/* The reflection diary — was write-only; now you can read your journey */}
        <div className="surface-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <BookHeart size={13} className="text-gold" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/80">
              Your reflections
            </p>
            {reflections.length > 0 && (
              <span className="ml-auto text-[11px] font-bold text-gold/80 tabular-nums">
                {reflections.length > 30 ? "last 30" : reflections.length}
              </span>
            )}
          </div>

          {reflections.length === 0 ? (
            <p className="text-[12px] text-muted-foreground leading-snug">
              Your daily wins and frictions will collect here — a private record of the person you're
              building. Add one from the Coach's evening reflection.
            </p>
          ) : (
            <div className="space-y-2.5">
              {reflections.slice(0, 30).map((r) => (
                <ReflectionRow key={r.reflection_date} r={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DeltaTile = ({
  icon: Icon,
  label,
  value,
  unit,
  good,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  unit?: string;
  good?: boolean;
}) => (
  <div className="surface-card px-2.5 py-2.5 text-center">
    <Icon
      size={12}
      className={cn(
        "mx-auto mb-1",
        good === undefined ? "text-gold/70" : good ? "text-xp-green" : "text-[hsl(var(--ember))]",
      )}
    />
    <p className="font-display text-lg font-black tabular-nums leading-none">{value}</p>
    {unit && <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{unit}</p>}
    <p className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider mt-1">{label}</p>
  </div>
);

const TrendCard = ({
  icon: Icon,
  title,
  sub,
  values,
  delta,
  good,
}: {
  icon: React.ElementType;
  title: string;
  sub: string;
  values: number[];
  delta: string | null;
  good: boolean;
}) => (
  <div className="surface-card p-4">
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-gold" />
        <div>
          <p className="text-[13px] font-black leading-tight">{title}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{sub}</p>
        </div>
      </div>
      {delta && (
        <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-black tabular-nums", good ? "text-xp-green" : "text-[hsl(var(--ember))]")}>
          {good ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {delta}
        </span>
      )}
    </div>
    <Sparkline values={values} className="w-full h-10" />
  </div>
);

const relDate = (iso: string): string => {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  const days = Math.round((today.setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const ReflectionRow = ({ r }: { r: JourneyReflection }) => {
  const mood = r.mood_1to5 != null ? MOOD_EMOJI[Math.min(4, Math.max(0, r.mood_1to5 - 1))] : null;
  const hasBody = !!(r.win?.trim() || r.friction?.trim());
  return (
    <div className="surface-card px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1">
        {mood && <span className="text-sm leading-none">{mood}</span>}
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          {relDate(r.reflection_date)}
        </span>
      </div>
      {!hasBody ? (
        <p className="text-[11px] text-muted-foreground/70 italic">Checked in.</p>
      ) : (
        <div className="space-y-1">
          {r.win?.trim() && (
            <p className="text-[12px] leading-snug">
              <span className="text-gold font-black">Win · </span>
              <span className="text-foreground/90">{r.win.trim()}</span>
            </p>
          )}
          {r.friction?.trim() && (
            <p className="text-[12px] leading-snug">
              <span className="text-muted-foreground font-black">Friction · </span>
              <span className="text-foreground/80">{r.friction.trim()}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Journey;
