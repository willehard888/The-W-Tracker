import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, ThumbsUp, ThumbsDown } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { ErrorState } from "@/components/ui/error-state";
import { SettingsSkeleton } from "@/components/skeletons/PageSkeleton";
import { backOr } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { fetchPilotOverview, fetchFeedback, setFeedbackStatus, type FeedbackRow } from "@/lib/pilot/rpc";
import { promptById } from "@/lib/pilot/prompts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * The pilot, on one screen.
 *
 * A fourth admin page behind the existing AdminRoute gate. The client check is
 * cosmetic, as it is on the other three — admin_pilot_overview RAISEs for
 * anybody who is not an admin, and pilot_feedback's RLS policy does the same
 * for the rows.
 *
 * Borderless, like Leaderboard and Messages: hairline rows, type on the page.
 * A founder reading twenty pieces of feedback wants them close together, and a
 * card around each one would put fourteen pixels of border between every
 * sentence somebody took the trouble to write.
 */

const FILTERS: Array<{ v: string; label: string }> = [
  { v: "all", label: "All" },
  { v: "bug", label: "Bugs" },
  { v: "volunteered", label: "Volunteered" },
  { v: "checkpoint", label: "Checkpoint" },
  { v: "contextual", label: "Contextual" },
];

const STATUS_NEXT: Record<string, string> = {
  new: "reviewed",
  reviewed: "actioned",
  actioned: "new",
  wontfix: "new",
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="text-label text-muted-foreground truncate">{label}</p>
    <p className="text-dense font-semibold tabular-nums">{value}</p>
  </div>
);

/** The option a tester picked, shown as the words they actually saw. */
const choiceLabel = (row: FeedbackRow): string | null => {
  if (!row.choice) return null;
  const p = promptById(row.prompt_id);
  return p?.choice?.options.find((o) => o.v === row.choice)?.label ?? row.choice;
};

const AdminPilot = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");

  // The same door as the other admin pages (AdminMetrics): has_role answers,
  // anybody else is sent home. The RPCs enforce it again server-side.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    let alive = true;
    void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(
      ({ data }) => { if (alive) setIsAdmin(!!data); },
      () => { if (alive) setIsAdmin(false); },
    );
    return () => { alive = false; };
  }, [user]);

  const overview = useQuery({
    queryKey: ["admin-pilot-overview"],
    queryFn: () => fetchPilotOverview(null),
    retry: false,
    enabled: !!isAdmin,
  });
  const feedback = useQuery({
    queryKey: ["admin-pilot-feedback"],
    queryFn: () => fetchFeedback(200),
    retry: false,
    enabled: !!isAdmin,
  });

  const advance = async (row: FeedbackRow) => {
    await setFeedbackStatus(row.id, STATUS_NEXT[row.status] ?? "reviewed");
    void qc.invalidateQueries({ queryKey: ["admin-pilot-feedback"] });
    void qc.invalidateQueries({ queryKey: ["admin-pilot-overview"] });
  };

  const rows = (feedback.data ?? []).filter((r) => filter === "all" || r.kind === filter);
  const o = overview.data;
  const reach = o?.reach;

  if (isAdmin === null) return <SettingsSkeleton />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh">
      <PageBar title="Pilot" onBack={() => backOr(navigate, "/profile")} />

      {overview.isPending && <SettingsSkeleton />}

      {/* An admin page that renders zeroes when the RPC refused is worse than
          one that says it could not read. The most likely cause by far is that
          migration 20260925120000 has not been deployed. */}
      {overview.isError && (
        <div className="px-4 pt-6">
          <ErrorState
            title="Couldn't read the pilot"
            description="admin_pilot_overview did not answer. By far the likeliest cause is that migration 20260925120000 has not been deployed."
            onRetry={() => void overview.refetch()}
          />
        </div>
      )}

      {o && (
        <>
          <section className="px-4 pt-4">
            <p className="text-beat">
              {o.members} testers
              {o.cohort ? ` · ${o.cohort}` : ""}
              {o.median_day != null && o.observe_days ? ` · day ${o.median_day} of ${o.observe_days}` : ""}
            </p>
            <p className="text-meta text-muted-foreground mt-1">
              {o.in_window} in window · {o.feedback_new} new
              {o.bugs_open > 0 && <span className="text-destructive font-semibold"> · {o.bugs_open} bugs open</span>}
            </p>
          </section>

          {reach && (
            <section className="px-4 pt-5">
              <p className="text-label font-bold text-muted-foreground mb-2">Who has found what</p>
              <div className="grid grid-cols-3 gap-y-3 gap-x-2">
                <Stat label="Onboarding" value={`${reach.onboarded}/${o.members}`} />
                <Stat label="Check-in" value={`${reach.checked_in}/${o.members}`} />
                <Stat label="Trained" value={`${reach.trained}/${o.members}`} />
                <Stat label="AI Coach" value={`${reach.asked_coach}/${o.members}`} />
                <Stat label="Recovery" value={`${reach.recovered}/${o.members}`} />
                <Stat label="Reflection" value={`${reach.reflected}/${o.members}`} />
              </div>
            </section>
          )}

          <section className="px-4 pt-5">
            <p className="text-label font-bold text-muted-foreground mb-2">Health</p>
            <div className="grid grid-cols-3 gap-x-2">
              <Stat label="Opened, 3 d" value={`${reach?.opened_3d ?? 0}/${o.members}`} />
              <Stat label="Stalled sessions" value={String(o.stalled_sessions)} />
              <Stat
                label="Time to 1st check-in"
                value={o.ttv_minutes?.first_checkin != null ? `${Math.round(o.ttv_minutes.first_checkin)} min` : "—"}
              />
            </div>
            {/* Stated rather than implied: these are counts of people who have
                never done the thing, not people who stopped. The difference is
                what decides whether we ask them about it. */}
            <p className="text-label text-muted-foreground mt-2">
              A zero here is nobody finding it, not people dropping it — and those are the
              people we do not ask about it.
            </p>
          </section>
        </>
      )}

      <section className="pt-6">
        <div className="px-4 flex items-center gap-1.5 overflow-x-auto pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.v}
              type="button"
              aria-pressed={filter === f.v}
              onClick={() => setFilter(f.v)}
              className={cn(
                "press shrink-0 min-h-11 rounded-full border px-3 text-meta font-semibold",
                filter === f.v ? "border-gold text-gold" : "border-border/40 text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {feedback.isPending && (
          <p className="px-4 py-8 text-center text-muted-foreground">
            <Loader2 aria-hidden size={16} className="animate-spin inline" />
          </p>
        )}

        {feedback.isError && (
          <p className="px-4 py-8 text-center text-meta text-muted-foreground">
            Feedback could not be read.
          </p>
        )}

        {feedback.isSuccess && rows.length === 0 && (
          <p className="px-4 py-10 text-center text-meta text-muted-foreground">
            {filter === "all" ? "No feedback yet." : "Nothing with this filter."}
          </p>
        )}

        <div className="divide-y divide-border/35">
          {rows.map((r) => (
            <article key={r.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-meta text-muted-foreground truncate">
                  {r.pilot_day != null ? `p${r.pilot_day}` : "—"} · {r.prompt_id}
                  {r.app_version ? ` · ${r.app_version}` : ""}
                </p>
                <button
                  type="button"
                  onClick={() => void advance(r)}
                  className={cn(
                    "press shrink-0 min-h-11 text-meta font-bold",
                    r.status === "new" ? "text-gold" : "text-muted-foreground",
                  )}
                >
                  {r.status}
                </button>
              </div>

              <div className="mt-1 flex items-center gap-2">
                {r.rating != null && (
                  <span className="inline-flex items-center gap-1 text-meta font-semibold tabular-nums">
                    {r.rating >= 4 ? <ThumbsUp size={12} aria-hidden /> : r.rating <= 2 ? <ThumbsDown size={12} aria-hidden /> : null}
                    {r.rating}/5
                  </span>
                )}
                {choiceLabel(r) && <span className="text-dense">{choiceLabel(r)}</span>}
              </div>

              {r.comment && <p className="mt-1 text-body text-foreground whitespace-pre-wrap">{r.comment}</p>}

              <p className="mt-1 text-label text-muted-foreground">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminPilot;
