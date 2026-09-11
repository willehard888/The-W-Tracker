import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { Calendar, MapPin, Users, Plus, X, Trash2, Check, Clock, Video, Layers, ChevronDown } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import EmptyState from "@/components/ui/empty-state";
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

const LABEL = "text-[11px] font-bold text-muted-foreground";
const EMBER = "text-[hsl(var(--ember))]";

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

  // Group a series' sessions under one row; one-off events stand alone. Events
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
    <div>
      <div className="flex items-center justify-between mb-1 px-0.5">
        <h2 className="font-display font-black text-[15px] tracking-tight">Meetups</h2>
        {isMember && (
          <Button
            variant="gold-outline"
            size="pill"
            onClick={() => { hapticImpact("light"); setShowCreate(true); }}
          >
            <Plus aria-hidden size={13} /> Host
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="h-16 skeleton-block rounded-xl" />
      ) : (events?.length ?? 0) === 0 ? (
        <EmptyState
          size="compact"
          icon={Calendar}
          title="No meetups yet"
          description={isMember ? "Host the first one. A run, a lift, a session. Your tribe shows up." : "Join the tribe to host and join meetups."}
        />
      ) : (
        <div className="divide-y divide-border/35 border-t border-border/35">
          {items.map((it, i) =>
            it.kind === "single" ? (
              <EventRow
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
              <SeriesRow
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

/** The date column: weekday, the day number, month. Ember on the next one up. */
const DateStamp = ({ start, hot }: { start: Date; hot: boolean }) => (
  <div className="shrink-0 w-11 flex flex-col items-center leading-none">
    <span className={LABEL}>{format(start, "EEE")}</span>
    <span className={cn("font-display font-black text-2xl tabular-nums my-0.5", hot ? EMBER : "text-foreground")}>{format(start, "d")}</span>
    <span className={LABEL}>{format(start, "MMM")}</span>
  </div>
);

/** One stand-alone meetup row. */
const EventRow = ({ ev, isNext, isMember, currentUserId, busy, onRsvp, onDelete }: {
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
  const ActIcon = ev.activity ? activityIcon(ev.activity) : null;
  // RSVP used to change variant and nothing else — the choice landed with no
  // movement at all. These pop the button the user actually chose.
  const goingPop = useCommitPop(ev.my_status === "going");
  const maybePop = useCommitPop(ev.my_status === "maybe");
  return (
    <div className="py-4 flex items-start gap-3">
      <DateStamp start={start} hot={isNext} />
      <div className="flex-1 min-w-0">
        {(ActIcon || rel) && (
          <div className="flex items-center gap-2 text-[11px] font-bold">
            {ActIcon && <span className="inline-flex items-center gap-1 text-muted-foreground"><ActIcon size={11} strokeWidth={2.6} aria-hidden /> {ev.activity}</span>}
            {rel && <span className={EMBER}>{rel}</span>}
          </div>
        )}
        <p className="font-display font-black text-[15px] tracking-tight truncate mt-0.5">{ev.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden /> {format(start, "HH:mm")} · {ev.duration_min}m</span>
          {ev.place && <span className="inline-flex items-center gap-1 truncate"><MapPin size={11} aria-hidden /> {ev.place}</span>}
          {ev.meeting_url && <span className={cn("inline-flex items-center gap-1 font-bold", EMBER)}><Video size={11} aria-hidden /> Online</span>}
          <span className="inline-flex items-center gap-1 tabular-nums"><Users size={11} aria-hidden /> {ev.going_count}{ev.capacity ? `/${ev.capacity}` : ""} going</span>
        </div>
        {ev.description && <p className="text-[12px] text-foreground/75 leading-snug mt-1.5">{ev.description}</p>}
        {isMember && (
          <div className="mt-2 flex items-center gap-1.5">
            {/* Ember is reserved for the one thing you'd actually tap next
                (opening the meeting); the RSVP pair shares one selected look,
                so which one is lit is the only signal that matters. */}
            {safeHttpUrl(ev.meeting_url) && (
              <Button asChild variant="ember" size="sm" className="min-h-11">
                <a href={safeHttpUrl(ev.meeting_url)} target="_blank" rel="noopener noreferrer">
                  <Video aria-hidden size={12} /> Join
                </a>
              </Button>
            )}
            <Button
              variant={ev.my_status === "going" ? "gold-outline" : "outline"}
              size="sm"
              className={cn("min-h-11", goingPop && "commit-pop")}
              disabled={busy === ev.id || full}
              onClick={() => onRsvp(ev, "going")}
            >
              <Check aria-hidden size={12} /> {full ? "Full" : "Going"}
            </Button>
            <Button
              variant={ev.my_status === "maybe" ? "gold-outline" : "outline"}
              size="sm"
              className={cn("min-h-11", maybePop && "commit-pop")}
              disabled={busy === ev.id}
              onClick={() => onRsvp(ev, "maybe")}
            >
              Maybe
            </Button>
            {ev.host_id === currentUserId && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto text-muted-foreground/75"
                disabled={busy === ev.id}
                onClick={() => onDelete(ev)}
                aria-label="Delete event"
              >
                <Trash2 aria-hidden size={14} />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/** A multi-session series (course / workshop run / program): one row, its
 *  sessions listed under it. Collapsed by default to the next 3 sessions. */
const SeriesRow = ({ series, isNext, isMember, currentUserId, busy, onRsvp, onDeleteSeries }: {
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
    <div className="py-4">
      <div className="flex items-start gap-3">
        <DateStamp start={new Date(series.sessions[0].starts_at)} hot={isNext} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Layers size={11} strokeWidth={2.6} aria-hidden /> {series.sessions.length}-part series</span>
            {series.activity && <span className="inline-flex items-center gap-1"><ActIcon size={11} strokeWidth={2.6} aria-hidden /> {series.activity}</span>}
          </div>
          <p className="font-display font-black text-[15px] tracking-tight truncate mt-0.5">{series.title}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
            {series.sessions.length} sessions{isMember ? ` · you're in for ${goingCount}` : ""}
          </p>
        </div>
        {isHost && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground/75"
            disabled={busy === series.id}
            onClick={onDeleteSeries}
            aria-label="Delete series"
          >
            <Trash2 aria-hidden size={14} />
          </Button>
        )}
      </div>

      <div className="mt-2 ml-14 divide-y divide-border/25">
        {shown.map((s, idx) => {
          const start = new Date(s.starts_at);
          const rel = isToday(start) ? "Today" : isTomorrow(start) ? "Tomorrow" : null;
          return (
            <div key={s.id} className="flex items-center gap-2.5 py-2">
              <span className="shrink-0 w-5 text-[11px] font-bold text-muted-foreground tabular-nums">{s.session_index ?? idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold truncate tabular-nums">{format(start, "EEE d MMM · HH:mm")}</p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden /> {s.duration_min}m</span>
                  {s.place && <span className="inline-flex items-center gap-1 truncate"><MapPin size={11} aria-hidden /> {s.place}</span>}
                  {s.meeting_url && <span className={cn("inline-flex items-center gap-1 font-bold", EMBER)}><Video size={11} aria-hidden /> Online</span>}
                  {rel && <span className={cn("font-bold", EMBER)}>{rel}</span>}
                </div>
              </div>
              {isMember && (
                <div className="flex items-center gap-1 shrink-0">
                  {s.meeting_url && (
                    <Button asChild variant="ember" size="icon-sm" className="min-h-11 min-w-11">
                      <a href={safeHttpUrl(s.meeting_url)} target="_blank" rel="noopener noreferrer" aria-label="Join">
                        <Video aria-hidden size={12} />
                      </a>
                    </Button>
                  )}
                  <SessionRsvp s={s} busy={busy === s.id} onRsvp={onRsvp} />
                </div>
              )}
            </div>
          );
        })}
        {hidden > 0 && (
          <Button variant="ghost" size="sm" className="w-full min-h-11 text-muted-foreground" onClick={() => setExpanded(true)}>
            <ChevronDown aria-hidden size={13} /> Show {hidden} more session{hidden === 1 ? "" : "s"}
          </Button>
        )}
      </div>
    </div>
  );
};

/** One session's Going toggle, with the same pop as the single-event row. */
const SessionRsvp = ({ s, busy, onRsvp }: { s: TribeEvent; busy: boolean; onRsvp: (ev: TribeEvent, status: RsvpStatus) => void }) => {
  const pop = useCommitPop(s.my_status === "going");
  return (
    <Button
      variant={s.my_status === "going" ? "gold-outline" : "outline"}
      size="sm"
      className={cn("min-h-11 px-2.5", pop && "commit-pop")}
      disabled={busy}
      onClick={() => onRsvp(s, "going")}
    >
      {s.my_status === "going" ? <Check aria-hidden size={12} /> : "Going"}
    </Button>
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
  const input = "h-11 rounded-xl text-[13px]";
  const sessionCount = sessions.filter((s) => s.trim()).length;

  return (
    <BottomSheet
      open
      onClose={onClose}
      label="Host a meetup"
      title="Host a meetup"
      footer={
        <Button variant="ember" size="lg" className="w-full" loading={busy} onClick={submit}>
          {kind === "series" ? `Post series${sessionCount ? ` · ${sessionCount} session${sessionCount === 1 ? "" : "s"}` : ""}` : "Post meetup"}
        </Button>
      }
    >
      <div className="pt-1">

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
              className="min-h-11"
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
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder={titlePlaceholder} className={input} />
          <div className="space-y-2">
            {TRIBE_ACTIVITY_GROUPS.map((group) => (
              <div key={group.label}>
                <p className={cn(LABEL, "mb-1")}>{group.label}</p>
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
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={input} />
          ) : (
            <div className="space-y-1.5">
              <label className={cn(LABEL, "block")}>Sessions</label>
              {sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="shrink-0 w-5 text-[11px] font-bold text-muted-foreground tabular-nums text-center">{i + 1}</span>
                  <Input type="datetime-local" value={s}
                    onChange={(e) => setSessions((prev) => prev.map((x, idx) => idx === i ? e.target.value : x))}
                    className={cn(input, "flex-1")} />
                  {sessions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground/75"
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
                  className="w-full min-h-11"
                  onClick={() => setSessions((prev) => [...prev, ""])}
                >
                  <Plus aria-hidden size={13} /> Add session
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
                className="min-h-11"
                onClick={() => { setMode(m); setModeTouched(true); }}
              >
                <Icon size={14} /> {label}
              </Button>
            ))}
          </div>
          {mode === "in_person" ? (
            <Input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder="Place — e.g. Central Park, main gate" className={input} />
          ) : (
            <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="Paste link — Google Meet, Teams, Zoom…" className={cn(field, linkInvalid && "border-destructive/60")} />
          )}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={cn(LABEL, "mb-1 block")}>Duration (min)</label>
              <Input type="number" value={duration} min={10} step={5} onChange={(e) => { setDuration(parseInt(e.target.value || "60", 10)); setDurationTouched(true); }} className={input} />
            </div>
            {kind === "single" && (
              <div className="flex-1">
                <label className={cn(LABEL, "mb-1 block")}>Capacity (optional)</label>
                <Input type="number" value={capacity} min={1} placeholder="No limit" onChange={(e) => setCapacity(e.target.value)} className={input} />
              </div>
            )}
          </div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={280} placeholder="Details (optional)" rows={2} className={cn(field, "resize-none")} />
        </div>
      </div>
    </BottomSheet>
  );
};

export default TribeEvents;
