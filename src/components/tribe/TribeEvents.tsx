import { useMemo, useState } from "react";
import { Calendar, MapPin, Users, Plus, X, Trash2, Check, Clock, Flame, Video, Layers, ChevronDown } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { format, isToday, isTomorrow } from "date-fns";
import { toast } from "sonner";
import { useTribeEvents, useTribeEventActions, type TribeEvent, type RsvpStatus } from "@/hooks/use-tribe-events";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { useCommitPop } from "@/hooks/use-commit-pop";
import { safeHttpUrl } from "@/lib/safe-url";
import { TRIBE_ACTIVITY_GROUPS, activityIcon, activityDefaults } from "@/lib/tribe-activities";

const ERR: Record<string, string> = {
  not_member: "Join the tribe to do that.",
  event_full: "This event is full.",
  title_required: "Give the event a title.",
  unauthorized: "Please sign in.",
  forbidden: "Only the host can do that.",
};
const errMsg = (e: any) =>
  ERR[e?.message?.match(/not_member|event_full|title_required|unauthorized|forbidden/)?.[0] ?? ""] ?? e?.message ?? "Something went wrong";

interface SeriesItem {
  kind: "series";
  id: string;
  title: string;
  activity: string | null;
  host_id: string;
  sessions: TribeEvent[];
}
type EventListItem = { kind: "single"; event: TribeEvent } | SeriesItem;

/** Tribe events / meetups — schedule, RSVP, show up. */
const TribeEvents = ({ tribeId, isMember, currentUserId }: { tribeId: string; isMember: boolean; currentUserId?: string }) => {
  const { data: events, isLoading } = useTribeEvents(tribeId);
  const { createEvent, createSeries, deleteSeries, rsvp, deleteEvent } = useTribeEventActions(tribeId);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Styled confirm instead of window.confirm's grey system alert.
  const [confirmTarget, setConfirmTarget] = useState<
    | { kind: "event"; ev: TribeEvent }
    | { kind: "series"; series: SeriesItem }
    | null
  >(null);

  // Group a series' sessions under one card; one-off events stand alone. Events
  // arrive sorted by starts_at, so each series' sessions are already in order.
  const items = useMemo<EventListItem[]>(() => {
    const singles: EventListItem[] = [];
    const seriesMap = new Map<string, SeriesItem>();
    for (const ev of events ?? []) {
      if (ev.series_id) {
        let s = seriesMap.get(ev.series_id);
        if (!s) {
          s = { kind: "series", id: ev.series_id, title: ev.series_title ?? ev.title, activity: ev.activity, host_id: ev.host_id, sessions: [] };
          seriesMap.set(ev.series_id, s);
        }
        s.sessions.push(ev);
      } else {
        singles.push({ kind: "single", event: ev });
      }
    }
    const all: EventListItem[] = [...singles, ...seriesMap.values()];
    const firstStart = (it: EventListItem) => it.kind === "single" ? it.event.starts_at : it.sessions[0].starts_at;
    return all.sort((a, b) => firstStart(a).localeCompare(firstStart(b)));
  }, [events]);

  const doDeleteSeries = async (s: SeriesItem) => {
    setBusy(s.id);
    try { await deleteSeries(s.id); toast.success("Series deleted"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  const onRsvp = async (ev: TribeEvent, status: RsvpStatus) => {
    setBusy(ev.id);
    hapticImpact("light");
    try {
      await rsvp(ev.id, ev.my_status === status ? "declined" : status);
      hapticNotification("success");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  const doDelete = async (ev: TribeEvent) => {
    setBusy(ev.id);
    try { await deleteEvent(ev.id); toast.success("Event deleted"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-gold" />
          <h2 className="font-display font-black text-sm tracking-tight">Meetups & events</h2>
        </div>
        {isMember && (
          <Button
            variant="gold-outline"
            size="pill"
            onClick={() => { hapticImpact("light"); setShowCreate(true); }}
          >
            <Plus size={13} /> Host
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="h-20 surface-card skeleton-block" />
      ) : (events?.length ?? 0) === 0 ? (
        <div className="surface-card p-5 text-center">
          <Calendar size={24} className="text-gold/60 mx-auto mb-2" />
          <p className="text-[13px] font-bold text-foreground">No meetups yet</p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
            {isMember ? "Host the first one — a run, a lift, a session. Your tribe shows up." : "Join the tribe to host and join meetups."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it, i) =>
            it.kind === "single" ? (
              <EventCard
                key={it.event.id}
                ev={it.event}
                isNext={i === 0}
                isMember={isMember}
                currentUserId={currentUserId}
                busy={busy}
                onRsvp={onRsvp}
                onDelete={(ev) => setConfirmTarget({ kind: "event", ev })}
              />
            ) : (
              <SeriesCard
                key={it.id}
                series={it}
                isNext={i === 0}
                isMember={isMember}
                currentUserId={currentUserId}
                busy={busy}
                onRsvp={onRsvp}
                onDeleteSeries={() => setConfirmTarget({ kind: "series", series: it })}
              />
            ),
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget != null}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null); }}
        title={confirmTarget?.kind === "series" ? "Delete this series?" : "Delete this event?"}
        description={
          confirmTarget?.kind === "series"
            ? `"${confirmTarget.series.title}" and all its sessions will be removed for the whole tribe.`
            : "The meetup and its RSVPs will be removed for the whole tribe."
        }
        onConfirm={() => {
          if (confirmTarget?.kind === "series") void doDeleteSeries(confirmTarget.series);
          else if (confirmTarget) void doDelete(confirmTarget.ev);
          setConfirmTarget(null);
        }}
      />

      {showCreate && (
        <CreateEventSheet
          onClose={() => setShowCreate(false)}
          onCreate={async (e) => {
            try {
              await createEvent(e);
              hapticNotification("success");
              toast.success("Meetup posted 🔥");
              setShowCreate(false);
            } catch (err) { toast.error(errMsg(err)); }
          }}
          onCreateSeries={async (s) => {
            try {
              await createSeries(s);
              hapticNotification("success");
              toast.success(`${s.sessions.length}-session series posted 🔥`);
              setShowCreate(false);
            } catch (err) { toast.error(errMsg(err)); }
          }}
        />
      )}
    </div>
  );
};

/** One stand-alone meetup card. */
const EventCard = ({ ev, isNext, isMember, currentUserId, busy, onRsvp, onDelete }: {
  ev: TribeEvent;
  isNext: boolean;
  isMember: boolean;
  currentUserId?: string;
  busy: string | null;
  onRsvp: (ev: TribeEvent, status: RsvpStatus) => void;
  onDelete: (ev: TribeEvent) => void;
}) => {
  const start = new Date(ev.starts_at);
  const full = ev.capacity != null && ev.going_count >= ev.capacity && ev.my_status !== "going";
  const rel = isToday(start) ? "Today" : isTomorrow(start) ? "Tomorrow" : null;
  const pct = ev.capacity ? Math.min(100, (ev.going_count / ev.capacity) * 100) : 0;
  // RSVP used to change variant and nothing else — the choice landed with no
  // movement at all. These pop the button the user actually chose.
  const goingPop = useCommitPop(ev.my_status === "going");
  const maybePop = useCommitPop(ev.my_status === "maybe");
  return (
    <div className={cn(
      "surface-card overflow-hidden bg-gradient-to-br from-[hsl(var(--ember))]/[0.05] via-card/70 to-card",
      isNext ? "border-[hsl(var(--ember))]/40 shadow-[0_10px_34px_-18px_hsl(var(--ember)/0.6)]" : "border-border/60",
    )}>
      <div className="p-3.5">
        {isNext && (
          <div className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded-full bg-[hsl(var(--ember))]/15 border border-[hsl(var(--ember))]/35">
            <Flame size={11} className="text-[hsl(var(--ember))]" fill="currentColor" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[hsl(var(--ember))]">Next up</span>
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-14 rounded-xl bg-gradient-to-b from-gold/20 to-gold/[0.04] border border-gold/30 flex flex-col items-center justify-center py-2 shadow-[0_4px_14px_-8px_hsl(var(--gold)/0.6)]">
            <span className="text-[10px] font-black uppercase tracking-wider text-gold/70 leading-none">{format(start, "EEE")}</span>
            <span className="font-display font-black text-2xl leading-none text-gold tabular-nums my-0.5">{format(start, "d")}</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-gold/70 leading-none">{format(start, "MMM")}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {ev.activity && (() => {
                const ActIcon = activityIcon(ev.activity);
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gold bg-gold/10 border border-gold/25 rounded px-1.5 py-0.5">
                    <ActIcon size={11} strokeWidth={2.6} /> {ev.activity}
                  </span>
                );
              })()}
              {rel && (
                <span className="text-[10px] font-black uppercase tracking-wider text-[hsl(var(--ember))] bg-[hsl(var(--ember))]/10 border border-[hsl(var(--ember))]/25 rounded px-1.5 py-0.5">{rel}</span>
              )}
            </div>
            <p className="font-display font-black text-[15px] tracking-tight truncate mt-0.5">{ev.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock size={11} /> {format(start, "EEE HH:mm")} · {ev.duration_min}m</span>
              {ev.place && <span className="inline-flex items-center gap-1 truncate"><MapPin size={11} /> {ev.place}</span>}
              {ev.meeting_url && <span className="inline-flex items-center gap-1 text-[hsl(var(--ember))] font-bold"><Video size={11} /> Online</span>}
              <span className="inline-flex items-center gap-1"><Users size={11} /> {ev.going_count}{ev.capacity ? `/${ev.capacity}` : ""} going</span>
            </div>
            {ev.capacity != null && (
              <div className="mt-2 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--ember))] to-gold transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}
            {ev.description && <p className="text-[12px] text-foreground/75 leading-snug mt-1.5">{ev.description}</p>}
            {isMember && (
              <div className="mt-2.5 flex items-center gap-1.5">
                {/* One action, one selected-state, one quiet default. Ember is
                    reserved for the single thing you'd actually tap next
                    (opening the meeting); the RSVP pair shares one selected
                    look, so which one is lit is the only signal that matters.
                    This row previously carried three different languages —
                    flat ember, flat gold, tinted gold outline — side by side. */}
                {safeHttpUrl(ev.meeting_url) && (
                  <Button asChild variant="ember" size="sm">
                    <a href={safeHttpUrl(ev.meeting_url)} target="_blank" rel="noopener noreferrer">
                      <Video size={12} /> Join
                    </a>
                  </Button>
                )}
                <Button
                  variant={ev.my_status === "going" ? "gold-outline" : "outline"}
                  size="sm"
                  className={cn(goingPop && "commit-pop")}
                  disabled={busy === ev.id || full}
                  onClick={() => onRsvp(ev, "going")}
                >
                  <Check size={12} /> {full ? "Full" : "Going"}
                </Button>
                <Button
                  variant={ev.my_status === "maybe" ? "gold-outline" : "outline"}
                  size="sm"
                  className={cn(maybePop && "commit-pop")}
                  disabled={busy === ev.id}
                  onClick={() => onRsvp(ev, "maybe")}
                >
                  Maybe
                </Button>
                {ev.host_id === currentUserId && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto text-muted-foreground/60 relative before:absolute before:-inset-2 before:content-['']"
                    disabled={busy === ev.id}
                    onClick={() => onDelete(ev)}
                    aria-label="Delete event"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** A multi-session series (course / workshop run / program) — one card, all its
 *  sessions listed inside. Collapsed by default to the next 3 sessions. */
const SeriesCard = ({ series, isNext, isMember, currentUserId, busy, onRsvp, onDeleteSeries }: {
  series: SeriesItem;
  isNext: boolean;
  isMember: boolean;
  currentUserId?: string;
  busy: string | null;
  onRsvp: (ev: TribeEvent, status: RsvpStatus) => void;
  onDeleteSeries: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const ActIcon = activityIcon(series.activity);
  const isHost = series.host_id === currentUserId;
  const goingCount = series.sessions.filter((s) => s.my_status === "going").length;
  const shown = expanded ? series.sessions : series.sessions.slice(0, 3);
  const hidden = series.sessions.length - shown.length;
  return (
    <div className={cn(
      "surface-card overflow-hidden bg-gradient-to-br from-gold/[0.06] via-card/70 to-card",
      isNext ? "border-gold/45 shadow-[0_10px_34px_-18px_hsl(var(--gold)/0.6)]" : "border-border/60",
    )}>
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-gold/25 to-[hsl(var(--ember))]/15 border border-gold/35 flex items-center justify-center">
            <Layers size={17} className="text-gold" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gold bg-gold/12 border border-gold/30 rounded px-1.5 py-0.5">
                <ActIcon size={11} strokeWidth={2.6} /> {series.sessions.length}-part series
              </span>
              {series.activity && (
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{series.activity}</span>
              )}
            </div>
            <p className="font-display font-black text-[15px] tracking-tight truncate mt-0.5">{series.title}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {series.sessions.length} sessions{isMember ? ` · you're in for ${goingCount}` : ""}
            </p>
          </div>
          {isHost && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground/60 relative before:absolute before:-inset-2 before:content-['']"
              disabled={busy === series.id}
              onClick={onDeleteSeries}
              aria-label="Delete series"
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          {shown.map((s, idx) => {
            const start = new Date(s.starts_at);
            const rel = isToday(start) ? "Today" : isTomorrow(start) ? "Tomorrow" : null;
            return (
              <div key={s.id} className="flex items-center gap-2.5 surface-panel rounded-xl px-2.5 py-2">
                <div className="shrink-0 h-7 w-7 rounded-lg bg-gold/15 border border-gold/25 flex items-center justify-center">
                  <span className="text-[11px] font-black text-gold tabular-nums">{s.session_index ?? idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold truncate">{format(start, "EEE d MMM · HH:mm")}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock size={11} /> {s.duration_min}m</span>
                    {s.place && <span className="inline-flex items-center gap-1 truncate"><MapPin size={11} /> {s.place}</span>}
                    {s.meeting_url && <span className="inline-flex items-center gap-1 text-[hsl(var(--ember))] font-bold"><Video size={11} /> Online</span>}
                    {rel && <span className="font-black uppercase tracking-wider text-[hsl(var(--ember))]">{rel}</span>}
                  </div>
                </div>
                {isMember && (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Same language as the single-event row above: ember for
                        the one action, gold-outline for the selected state.
                        min-h/min-w (not the before:-inset trick) clears the
                        44pt floor here: PRIMARY_EMBER owns ::before for its
                        crown sheen and clips with overflow-hidden, so an
                        expanded pseudo-element would catch nothing and skew
                        the sheen geometry instead. */}
                    {s.meeting_url && (
                      <Button
                        asChild
                        variant="ember"
                        size="icon-sm"
                        className="min-h-11 min-w-11"
                      >
                        <a href={safeHttpUrl(s.meeting_url)} target="_blank" rel="noopener noreferrer" aria-label="Join">
                          <Video size={12} />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant={s.my_status === "going" ? "gold-outline" : "outline"}
                      size="sm"
                      className="relative px-2.5 before:absolute before:-inset-2 before:content-['']"
                      disabled={busy === s.id}
                      onClick={() => onRsvp(s, "going")}
                    >
                      {s.my_status === "going" ? <Check size={12} /> : "Going"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {hidden > 0 && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setExpanded(true)}>
              <ChevronDown size={13} /> Show {hidden} more session{hidden === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const CreateEventSheet = ({ onClose, onCreate, onCreateSeries }: {
  onClose: () => void;
  onCreate: (e: { title: string; activity?: string; description?: string; place?: string; meeting_url?: string | null; starts_at: string; duration_min?: number; capacity?: number | null }) => Promise<void>;
  onCreateSeries: (s: { title: string; activity?: string; description?: string; sessions: { starts_at: string; duration_min?: number; place?: string | null; meeting_url?: string | null }[] }) => Promise<void>;
}) => {
  const [kind, setKind] = useState<"single" | "series">("single");
  const [title, setTitle] = useState("");
  const [activity, setActivity] = useState("");
  const [mode, setMode] = useState<"in_person" | "online">("in_person");
  const [place, setPlace] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [when, setWhen] = useState("");
  const [sessions, setSessions] = useState<string[]>([""]); // series: datetime-local per session
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  // Track manual overrides so smart defaults never clobber a host's own choice.
  const [modeTouched, setModeTouched] = useState(false);
  const [durationTouched, setDurationTouched] = useState(false);

  // Picking an activity pre-fills mode + duration to fit it (Workshop → Online
  // 90m, Meditation → Online 30m, Hike → in-person 2h…), unless the host already
  // set those by hand. Tapping the same chip again clears the activity.
  const pickActivity = (name: string) => {
    if (name === activity) { setActivity(""); return; }
    setActivity(name);
    const d = activityDefaults(name);
    if (!modeTouched) setMode(d.mode);
    if (!durationTouched) setDuration(d.duration);
  };
  const titlePlaceholder = kind === "series"
    ? `Series title — e.g. ${activityDefaults(activity).titleHint}`
    : `Title — e.g. ${activityDefaults(activity).titleHint}`;

  const linkInvalid = mode === "online" && meetingUrl.trim() !== "" && !/^https?:\/\//i.test(meetingUrl.trim());

  const submit = async () => {
    if (title.trim().length < 2) { toast.error("Give it a title."); return; }
    if (linkInvalid) { toast.error("Paste a full link (https://…)"); return; }

    if (kind === "series") {
      const dates = sessions.map((s) => s.trim()).filter(Boolean);
      if (dates.length < 1) { toast.error("Add at least one session date."); return; }
      setBusy(true);
      await onCreateSeries({
        title, activity: activity || undefined, description: desc || undefined,
        sessions: dates.map((w) => ({
          starts_at: new Date(w).toISOString(),
          duration_min: duration,
          place: mode === "in_person" ? (place || null) : null,
          meeting_url: mode === "online" ? (meetingUrl.trim() || null) : null,
        })),
      });
      setBusy(false);
      return;
    }

    if (!when) { toast.error("Pick a date & time."); return; }
    setBusy(true);
    await onCreate({
      title, activity: activity || undefined, description: desc || undefined,
      place: mode === "in_person" ? (place || undefined) : undefined,
      meeting_url: mode === "online" ? (meetingUrl.trim() || null) : null,
      starts_at: new Date(when).toISOString(),
      duration_min: duration, capacity: capacity ? parseInt(capacity, 10) : null,
    });
    setBusy(false);
  };

  const field = "w-full surface-inset rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-gold/50";
  const sessionCount = sessions.filter((s) => s.trim()).length;

  return (
    <Portal>
    <div className="fixed inset-0 z-[var(--z-celebration)] flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 mx-auto w-full max-w-md rounded-t-3xl border-t border-gold/25 bg-card max-h-[88vh] overflow-y-auto p-4 pb-8 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-black tracking-tight">Host a meetup</h2>
          <Button
            variant="secondary"
            size="icon-sm"
            className="min-h-11 min-w-11 rounded-full text-muted-foreground"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        {/* Single event vs multi-session series. Selected state is gold-outline
            everywhere on this surface — same language as the RSVP row and the
            activity chips below, so "which one is picked" reads the same way
            wherever you are. */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([["single", "Single", Calendar], ["series", "Series", Layers]] as const).map(([k, label, Icon]) => (
            <Button
              key={k}
              type="button"
              variant={kind === k ? "gold-outline" : "outline"}
              onClick={() => setKind(k)}
            >
              <Icon size={14} /> {label}
            </Button>
          ))}
        </div>
        {kind === "series" && (
          <p className="text-[11px] text-muted-foreground -mt-1 mb-2.5 leading-snug">
            A multi-part run — a course, a workshop series, a program. Add every session date; place &amp; link below apply to them all.
          </p>
        )}

        <div className="space-y-2.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder={titlePlaceholder} className={field} />
          <div className="space-y-2">
            {TRIBE_ACTIVITY_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground/55 mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(({ name, icon: Icon }) => (
                    <Button
                      key={name}
                      variant={activity === name ? "gold-outline" : "outline"}
                      size="pill"
                      onClick={() => pickActivity(name)}
                    >
                      <Icon size={12} strokeWidth={2.4} /> {name}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {kind === "single" ? (
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
          ) : (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">Sessions</label>
              {sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="shrink-0 h-7 w-7 rounded-lg bg-secondary border border-border flex items-center justify-center text-[11px] font-black text-muted-foreground tabular-nums">{i + 1}</span>
                  <input type="datetime-local" value={s}
                    onChange={(e) => setSessions((prev) => prev.map((x, idx) => idx === i ? e.target.value : x))}
                    className={cn(field, "flex-1")} />
                  {sessions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground/60 relative before:absolute before:-inset-2 before:content-['']"
                      onClick={() => setSessions((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Remove session"
                    >
                      <X size={15} />
                    </Button>
                  )}
                </div>
              ))}
              {sessions.length < 24 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setSessions((prev) => [...prev, ""])}
                >
                  <Plus size={13} /> Add session
                </Button>
              )}
            </div>
          )}

          {/* In person / Online */}
          <div className="grid grid-cols-2 gap-2">
            {([["in_person", "In person", MapPin], ["online", "Online", Video]] as const).map(([m, label, Icon]) => (
              <Button
                key={m}
                type="button"
                variant={mode === m ? "gold-outline" : "outline"}
                onClick={() => { setMode(m); setModeTouched(true); }}
              >
                <Icon size={14} /> {label}
              </Button>
            ))}
          </div>
          {mode === "in_person" ? (
            <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder="Place — e.g. Central Park, main gate" className={field} />
          ) : (
            <input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="Paste link — Google Meet, Teams, Zoom…" className={cn(field, linkInvalid && "border-destructive/60")} />
          )}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Duration (min)</label>
              <input type="number" value={duration} min={10} step={5} onChange={(e) => { setDuration(parseInt(e.target.value || "60", 10)); setDurationTouched(true); }} className={field} />
            </div>
            {kind === "single" && (
              <div className="flex-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Capacity (opt.)</label>
                <input type="number" value={capacity} min={1} placeholder="∞" onChange={(e) => setCapacity(e.target.value)} className={field} />
              </div>
            )}
          </div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={280} placeholder="Details (optional)" rows={2} className={cn(field, "resize-none")} />
          {/* The sheet's one primary action, at the size the ember treatment was
              drawn for. It was a flat full-width bg-gold slab — the largest
              untreated surface in the tribe screens, and the loudest thing
              reading as unfinished next to the system's machined buttons. */}
          <Button variant="ember" size="lg" className="w-full" loading={busy} onClick={submit}>
            {kind === "series" ? `Post series${sessionCount ? ` · ${sessionCount} session${sessionCount === 1 ? "" : "s"}` : ""}` : "Post meetup"}
          </Button>
        </div>
      </div>
    </div>
    </Portal>
  );
};

export default TribeEvents;
