import { fmtDate, fmtInt } from "@/lib/format";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { useAuth } from "@/contexts/AuthContext";
import { useJourney, weeklyXp, type JourneyReflection } from "@/hooks/use-journey";
import { useWhealthSnapshots } from "@/hooks/use-whealth-snapshots";
import { useLiveWhealthIndex } from "@/hooks/use-live-whealth-index";
import PillarSheet from "@/components/journey/PillarSheet";
import type { PillarScores } from "@/lib/whealth-index";
import { useRecentNights } from "@/hooks/use-night-metrics";
import WhealthIndexCard, { PILLAR_META } from "@/components/journey/WhealthIndexCard";
import CoachSeesCard from "@/components/journey/CoachSeesCard";
import StoryShareModal from "@/components/StoryShareModal";
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import { DoorRow } from "@/components/coach/rows";
import { Button } from "@/components/ui/button";
import { backOr } from "@/lib/nav";
import { hapticSelection } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const MOOD_WORD = ["Rough", "Low", "Flat", "Good", "Great"];

/**
 * /journey — the growth mirror. The beat carries how long you have been
 * showing up, the Whealth Index is the one spectacle, the pillars are doors
 * into what drives them, and the trends and the reflection diary are
 * hairline rows underneath. Answers the one question a self-improvement
 * app must answer: "am I actually becoming who I set out to be?"
 */
const Journey = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data, isLoading, isError, refetch } = useJourney(56);

  // Stable identities: `?? []` minted a new array every render and every
  // memo below re-ran.
  const reflections = useMemo(() => data?.reflections ?? [], [data]);
  const checkins = useMemo(() => data?.checkins ?? [], [data]);

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
  const sleepAvg = sleepSeries.length ? sleepSeries.reduce((a, b) => a + b, 0) / sleepSeries.length : null;

  // Whealth OS: nightly snapshots (history + coach observations) + the LIVE
  // on-device computation (same pure core) so the index moves the moment you
  // check in. Live preferred for current values; snapshots power the trend.
  const { data: snapshots } = useWhealthSnapshots(28);
  const { data: liveIndex } = useLiveWhealthIndex();
  const latestSnap = snapshots?.[0];
  const priorSnap = snapshots && snapshots.length > 1 ? snapshots[snapshots.length - 1] : undefined;
  const priorDate = priorSnap ? fmtDate(priorSnap.snapshotDate + "T00:00:00") : undefined;
  const heroOverall = liveIndex?.overall ?? latestSnap?.overall ?? null;
  const heroPillars = liveIndex?.overall != null ? liveIndex.pillars : latestSnap?.pillars;
  const overallHistory = useMemo(
    () =>
      [...(snapshots ?? [])]
        .reverse()
        .map((s) => s.overall)
        .filter((v): v is number => v != null),
    [snapshots],
  );
  const [openPillar, setOpenPillar] = useState<keyof PillarScores | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const { data: nights } = useRecentNights(30);
  const rhrSeries = useMemo(
    () =>
      [...(nights ?? [])]
        .reverse() // oldest → newest
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
  // window data must see their record, NOT "your journey starts today".
  const hasAnyData = daysTracked > 0 || reflections.length > 0 || bestStreak > 0;
  const hasTrend = rhrSeries.length >= 7 || xpWeeks.length >= 2 || sleepSeries.length >= 5;
  const signed = (n: number, digits = 0) => `${n > 0 ? "+" : ""}${digits ? n.toFixed(digits) : fmtInt(n)}`;

  return (
    <div className="min-h-full">
      <PageBar title="Your journey" onBack={() => backOr(navigate, "/profile")} />

      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
            {isLoading || isError ? (
              "Your journey."
            ) : !hasAnyData ? (
              "Your journey starts today."
            ) : daysTracked > 0 ? (
              <><span className="text-gold glow-gold-text tabular-nums">{fmtInt(daysTracked)}</span> days of proof.</>
            ) : (
              "Back in the mirror."
            )}
          </h2>
          {!isLoading && !isError && (
            <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">
              {!hasAnyData
                ? "This is where you watch yourself become who you set out to be."
                : bestStreak > 0
                  ? `Best streak ${fmtInt(bestStreak)} ${bestStreak === 1 ? "day" : "days"}. Every check-in is a vote for who you're becoming.`
                  : "Every check-in is a vote for who you're becoming."}
            </p>
          )}
        </header>

        {/* THE WHEALTH INDEX — the one spectacle, framed with air. */}
        {heroOverall != null && heroPillars && (
          <div className="home-rise home-rise-1 mt-6">
            <WhealthIndexCard
              overall={heroOverall}
              priorOverall={priorSnap?.overall ?? undefined}
              priorDate={priorDate}
              live={liveIndex?.overall != null}
              history={overallHistory}
              onShare={() => setShareOpen(true)}
            />
          </div>
        )}

        {/* Six pillars, six doors into what drives each. */}
        {heroPillars && (
          <div className="home-rise home-rise-2 mt-5 divide-y divide-border/35 border-t border-border/35">
            {PILLAR_META.map(({ key, label }) => {
              const v = heroPillars[key];
              const pv = priorSnap?.pillars?.[key];
              const d = v != null && pv != null ? v - pv : null;
              return (
                <DoorRow
                  key={key}
                  label={label}
                  sub={
                    v == null
                      ? "Not enough data yet"
                      : `${v} of 100${d ? ` · ${d > 0 ? "up" : "down"} ${Math.abs(d)} since ${priorDate}` : ""}`
                  }
                  onClick={() => { hapticSelection(); setOpenPillar(key); }}
                />
              );
            })}
          </div>
        )}

        {shareOpen && heroOverall != null && heroPillars && (
          <StoryShareModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            variant="whealth"
            whealthData={{ overall: heroOverall, pillars: { ...heroPillars } }}
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
        {latestSnap && (
          <div className="home-rise home-rise-3 mt-5">
            <CoachSeesCard snapshot={latestSnap} />
          </div>
        )}

        {/* Trends: one hairline row each. */}
        {(isLoading || isError || hasTrend || !hasAnyData) && (
        <div className="home-rise home-rise-4 mt-5">
          {isLoading ? (
            <div className="h-24 rounded-xl bg-card/40 skeleton-block" />
          ) : isError ? (
            <ErrorState title="Couldn't load your journey" onRetry={refetch} />
          ) : !hasAnyData && !hasTrend ? (
            <EmptyState
              icon={Compass}
              title="Nothing to mirror yet"
              description="Check in tonight. The first point lands here."
              action={
                <Button variant="gold-outline" size="sm" className="min-h-11" onClick={() => navigate("/checkin")}>
                  Check in
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border/35 border-t border-border/35">
              {xpWeeks.length >= 2 && (
                <TrendRow
                  title="Momentum"
                  sub={`XP per week · ${xpWeeks.length} complete weeks`}
                  delta={xpPct != null ? `${signed(xpPct)}%` : xpDelta != null ? `${signed(xpDelta)} xp` : null}
                  good={(xpDelta ?? 0) >= 0}
                />
              )}
              {sleepSeries.length >= 5 && (
                <TrendRow
                  title="Recovery base"
                  sub={`Sleep · ${sleepAvg!.toFixed(1)} h average over ${sleepSeries.length} nights`}
                  delta={sleepDelta != null && Math.abs(sleepDelta) >= 0.1 ? `${signed(sleepDelta, 1)} h` : null}
                  good={(sleepDelta ?? 0) >= 0}
                />
              )}
              {rhrSeries.length >= 7 && (
                <TrendRow
                  title="Resting heart rate"
                  sub={`HealthKit · ${rhrSeries[rhrSeries.length - 1]} bpm last night, lower is better`}
                  delta={rhrDelta != null ? `${signed(rhrDelta, 1)} bpm` : null}
                  good={(rhrDelta ?? 0) <= 0}
                />
              )}
            </div>
          )}
        </div>
        )}

        {/* The reflection diary — was write-only; here you can read your journey. */}
        {!isLoading && !isError && hasAnyData && (
          <div className="home-rise home-rise-5 mt-6">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <h3 className="text-[13px] font-bold">Your reflections</h3>
              {reflections.length > 0 && (
                <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                  {reflections.length > 30 ? "last 30" : reflections.length}
                </span>
              )}
            </div>
            {reflections.length === 0 ? (
              <div className="border-t border-border/35">
                <DoorRow
                  label="Write tonight's reflection"
                  sub="Your wins and frictions collect here, a private record of the person you're building."
                  onClick={() => navigate("/coach/reflect")}
                />
              </div>
            ) : (
              <div className="divide-y divide-border/35 border-t border-border/35">
                {reflections.slice(0, 30).map((r, i) => (
                  <ReflectionRow key={r.reflection_date} r={r} lazy={i >= 8} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/** A trend as one hairline row: what it is, what it is made of, which way it moved. */
const TrendRow = ({ title, sub, delta, good }: { title: string; sub: string; delta: string | null; good: boolean }) => (
  <div className="py-3 flex items-center gap-3">
    <span className="flex-1 min-w-0">
      <span className="block text-[14px] font-semibold leading-tight">{title}</span>
      <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{sub}</span>
    </span>
    {delta && (
      <span className={cn("shrink-0 font-display text-[15px] font-black tabular-nums", good ? "text-xp-green" : "text-destructive")}>
        {delta}
      </span>
    )}
  </div>
);

const relDate = (iso: string): string => {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  const days = Math.round((today.setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return fmtDate(iso + "T00:00:00");
};

const ReflectionRow = ({ r, lazy }: { r: JourneyReflection; lazy: boolean }) => {
  const mood = r.mood_1to5 != null ? MOOD_WORD[Math.min(4, Math.max(0, r.mood_1to5 - 1))] : null;
  const win = r.win?.trim();
  const friction = r.friction?.trim();
  return (
    <div className="py-3" style={lazy ? { contentVisibility: "auto", containIntrinsicSize: "auto 64px" } : undefined}>
      <p className="text-[11px] font-bold text-muted-foreground">
        {relDate(r.reflection_date)}{mood && ` · ${mood}`}
      </p>
      {!win && !friction ? (
        <p className="text-[12px] text-muted-foreground/70 mt-0.5">Checked in.</p>
      ) : (
        <div className="mt-1 space-y-1">
          {win && (
            <p className="text-[13px] leading-snug">
              <span className="font-bold">Win · </span>
              <span className="text-foreground/90">{win}</span>
            </p>
          )}
          {friction && (
            <p className="text-[13px] leading-snug">
              <span className="font-bold text-muted-foreground">Friction · </span>
              <span className="text-foreground/80">{friction}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Journey;
