import { useMemo, useState } from "react";
import { Calendar, MapPin, Users, Plus, X, Trash2, Check, Clock, Flame, Video, Layers, ChevronDown } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { toast } from "sonner";
import { useTribeEvents, useTribeEventActions, type TribeEvent, type RsvpStatus } from "@/hooks/use-tribe-events";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
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

  const onDeleteSeries = async (s: SeriesItem) => {
    if (!window.confirm(`Delete the whole "${s.title}" series and all its sessions?`)) return;
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

  const onDelete = async (ev: TribeEvent) => {
    if (!window.confirm("Delete this event?")) return;
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
          <button
            onClick={() => { hapticImpact("light"); setShowCreate(true); }}
            className="inline-flex items-center gap-1 rounded-full bg-gold/15 border border-gold/35 px-3 py-1.5 text-[11px] font-black text-gold active:scale-95 transition-transform"
          >
            <Plus size={13} /> Host
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="h-20 rounded-2xl bg-card/40 border border-border/50 animate-pulse" />
      ) : (events?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 text-center">
          <Calendar size={24} className="text-gold/60 mx-auto mb-2" />
          <p className="text-[13px] font-bold text-foreground">No meetups yet</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
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
                onDelete={onDelete}
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
                onDeleteSeries={() => onDeleteSeries(it)}
              />
            ),
          )}
        </div>
      )}

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
  return (
    <div className={cn(
      "relative rounded-2xl overflow-hidden border bg-gradient-to-br from-[hsl(18_95%_58%)]/[0.05] via-card/70 to-card",
      isNext ? "border-[hsl(18_95%_58%)]/40 shadow-[0_10px_34px_-18px_hsl(18_95%_58%/0.6)]" : "border-border/60",
    )}>
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[hsl(18_95%_58%)] to-gold" />
      <div className="p-3.5 pl-4">
        {isNext && (
          <div className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded-full bg-[hsl(18_95%_58%)]/15 border border-[hsl(18_95%_58%)]/35">
            <Flame size={9} className="text-[hsl(18_95%_58%)]" fill="currentColor" />
            <span className="text-[8.5px] font-black uppercase tracking-widest text-[hsl(18_95%_58%)]">Next up</span>
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-14 rounded-xl bg-gradient-to-b from-gold/20 to-gold/[0.04] border border-gold/30 flex flex-col items-center justify-center py-2 shadow-[0_4px_14px_-8px_hsl(var(--gold)/0.6)]">
            <span className="text-[8.5px] font-black uppercase tracking-wider text-gold/70 leading-none">{format(start, "EEE")}</span>
            <span className="font-display font-black text-2xl leading-none text-gold tabular-nums my-0.5">{format(start, "d")}</span>
            <span className="text-[8.5px] font-black uppercase tracking-wider text-gold/70 leading-none">{format(start, "MMM")}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {ev.activity && (() => {
                const ActIcon = activityIcon(ev.activity);
                return (
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider text-gold bg-gold/10 border border-gold/25 rounded px-1.5 py-0.5">
                    <ActIcon size={9} strokeWidth={2.6} /> {ev.activity}
                  </span>
                );
              })()}
              {rel && (
                <span className="text-[8.5px] font-black uppercase tracking-wider text-[hsl(18_95%_58%)] bg-[hsl(18_95%_58%)]/10 border border-[hsl(18_95%_58%)]/25 rounded px-1.5 py-0.5">{rel}</span>
              )}
            </div>
            <p className="font-display font-black text-[15px] tracking-tight truncate mt-0.5">{ev.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock size={11} /> {format(start, "EEE HH:mm")} · {ev.duration_min}m</span>
              {ev.place && <span className="inline-flex items-center gap-1 truncate"><MapPin size={11} /> {ev.place}</span>}
              {ev.meeting_url && <span className="inline-flex items-center gap-1 text-[hsl(18_95%_58%)] font-bold"><Video size={11} /> Online</span>}
              <span className="inline-flex items-center gap-1"><Users size={11} /> {ev.going_count}{ev.capacity ? `/${ev.capacity}` : ""} going</span>
            </div>
            {ev.capacity != null && (
              <div className="mt-2 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}
            {ev.description && <p className="text-[11.5px] text-foreground/75 leading-snug mt-1.5">{ev.description}</p>}
            {isMember && (
              <div className="mt-2.5 flex items-center gap-1.5">
                {ev.meeting_url && (
                  <a href={ev.meeting_url} target="_blank" rel="noopener noreferrer" onClick={() => hapticImpact("light")}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-black bg-[hsl(18_95%_58%)] text-background active:scale-95 transition-transform">
                    <Video size={12} /> Join
                  </a>
                )}
                <button disabled={busy === ev.id || full} onClick={() => onRsvp(ev, "going")}
                  className={cn("inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-black transition-all active:scale-95 disabled:opacity-50",
                    ev.my_status === "going" ? "bg-gold text-primary-foreground" : "bg-secondary/50 border border-border/50 text-foreground/70")}>
                  <Check size={12} /> {full ? "Full" : "Going"}
                </button>
                <button disabled={busy === ev.id} onClick={() => onRsvp(ev, "maybe")}
                  className={cn("rounded-lg px-3 py-1.5 text-[11px] font-black transition-all active:scale-95 disabled:opacity-50",
                    ev.my_status === "maybe" ? "bg-gold/20 border border-gold/40 text-gold" : "bg-secondary/50 border border-border/50 text-foreground/70")}>
                  Maybe
                </button>
                {ev.host_id === currentUserId && (
                  <button disabled={busy === ev.id} onClick={() => onDelete(ev)}
                    className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/60 active:scale-95" aria-label="Delete event">
                    <Trash2 size={14} />
                  </button>
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
      "relative rounded-2xl overflow-hidden border bg-gradient-to-br from-gold/[0.06] via-card/70 to-card",
      isNext ? "border-gold/45 shadow-[0_10px_34px_-18px_hsl(var(--gold)/0.6)]" : "border-border/60",
    )}>
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-gold to-[hsl(18_95%_58%)]" />
      <div className="p-3.5 pl-4">
        <div className="flex items-start gap-2.5">
          <div className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-gold/25 to-[hsl(18_95%_58%)]/15 border border-gold/35 flex items-center justify-center">
            <Layers size={17} className="text-gold" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-widest text-gold bg-gold/12 border border-gold/30 rounded px-1.5 py-0.5">
                <ActIcon size={9} strokeWidth={2.6} /> {series.sessions.length}-part series
              </span>
              {series.activity && (
                <span className="text-[8.5px] font-black uppercase tracking-wider text-muted-foreground">{series.activity}</span>
              )}
            </div>
            <p className="font-display font-black text-[15px] tracking-tight truncate mt-0.5">{series.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {series.sessions.length} sessions{isMember ? ` · you're in for ${goingCount}` : ""}
            </p>
          </div>
          {isHost && (
            <button disabled={busy === series.id} onClick={onDeleteSeries}
              className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/60 active:scale-95" aria-label="Delete series">
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          {shown.map((s, idx) => {
            const start = new Date(s.starts_at);
            const rel = isToday(start) ? "Today" : isTomorrow(start) ? "Tomorrow" : null;
            return (
              <div key={s.id} className="flex items-center gap-2.5 rounded-xl bg-secondary/30 border border-border/40 px-2.5 py-2">
                <div className="shrink-0 h-7 w-7 rounded-lg bg-gold/15 border border-gold/25 flex items-center justify-center">
                  <span className="text-[10px] font-black text-gold tabular-nums">{s.session_index ?? idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold truncate">{format(start, "EEE d MMM · HH:mm")}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock size={9} /> {s.duration_min}m</span>
                    {s.place && <span className="inline-flex items-center gap-1 truncate"><MapPin size={9} /> {s.place}</span>}
                    {s.meeting_url && <span className="inline-flex items-center gap-1 text-[hsl(18_95%_58%)] font-bold"><Video size={9} /> Online</span>}
                    {rel && <span className="font-black uppercase tracking-wider text-[hsl(18_95%_58%)]">{rel}</span>}
                  </div>
                </div>
                {isMember && (
                  <div className="flex items-center gap-1 shrink-0">
                    {s.meeting_url && (
                      <a href={s.meeting_url} target="_blank" rel="noopener noreferrer" onClick={() => hapticImpact("light")}
                        className="h-7 w-7 rounded-lg flex items-center justify-center bg-[hsl(18_95%_58%)] text-background active:scale-95" aria-label="Join">
                        <Video size={12} />
                      </a>
                    )}
                    <button disabled={busy === s.id} onClick={() => onRsvp(s, "going")}
                      className={cn("h-7 px-2.5 rounded-lg text-[10px] font-black transition-all active:scale-95 disabled:opacity-50",
                        s.my_status === "going" ? "bg-gold text-primary-foreground" : "bg-secondary/60 border border-border/50 text-foreground/70")}>
                      {s.my_status === "going" ? <Check size={12} /> : "Going"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {hidden > 0 && (
            <button onClick={() => setExpanded(true)}
              className="w-full inline-flex items-center justify-center gap-1 rounded-xl bg-secondary/20 border border-border/40 py-1.5 text-[11px] font-bold text-muted-foreground active:scale-[0.99]">
              <ChevronDown size={13} /> Show {hidden} more session{hidden === 1 ? "" : "s"}
            </button>
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

  const field = "w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 text-[13px] outline-none focus:border-gold/50";
  const sessionCount = sessions.filter((s) => s.trim()).length;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 mx-auto w-full max-w-md rounded-t-3xl border-t border-gold/25 bg-card max-h-[88vh] overflow-y-auto p-4 pb-8 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-black tracking-tight">Host a meetup</h2>
          <button aria-label="Close" onClick={onClose} className="h-8 w-8 min-h-11 min-w-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"><X size={16} /></button>
        </div>

        {/* Single event vs multi-session series */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([["single", "Single", Calendar], ["series", "Series", Layers]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={cn("flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[12px] font-bold transition-all active:scale-[0.98]",
                kind === k ? "border-gold/50 bg-gold/10 text-gold" : "border-border/50 bg-background/40 text-muted-foreground")}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {kind === "series" && (
          <p className="text-[10.5px] text-muted-foreground -mt-1 mb-2.5 leading-snug">
            A multi-part run — a course, a workshop series, a program. Add every session date; place &amp; link below apply to them all.
          </p>
        )}

        <div className="space-y-2.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder={titlePlaceholder} className={field} />
          <div className="space-y-2">
            {TRIBE_ACTIVITY_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[8.5px] font-black tracking-widest uppercase text-muted-foreground/55 mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(({ name, icon: Icon }) => (
                    <button key={name} onClick={() => pickActivity(name)}
                      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-all active:scale-95",
                        activity === name ? "bg-gold text-primary-foreground border-transparent" : "bg-secondary/40 border-border/50 text-muted-foreground")}>
                      <Icon size={12} strokeWidth={2.4} /> {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {kind === "single" ? (
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
          ) : (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Sessions</label>
              {sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="shrink-0 h-7 w-7 rounded-lg bg-gold/15 border border-gold/25 flex items-center justify-center text-[10px] font-black text-gold tabular-nums">{i + 1}</span>
                  <input type="datetime-local" value={s}
                    onChange={(e) => setSessions((prev) => prev.map((x, idx) => idx === i ? e.target.value : x))}
                    className={cn(field, "flex-1")} />
                  {sessions.length > 1 && (
                    <button type="button" onClick={() => setSessions((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/60 active:scale-95" aria-label="Remove session">
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
              {sessions.length < 24 && (
                <button type="button" onClick={() => setSessions((prev) => [...prev, ""])}
                  className="w-full inline-flex items-center justify-center gap-1 rounded-xl bg-secondary/30 border border-border/40 py-2 text-[11px] font-bold text-gold active:scale-[0.99]">
                  <Plus size={13} /> Add session
                </button>
              )}
            </div>
          )}

          {/* In person / Online */}
          <div className="grid grid-cols-2 gap-2">
            {([["in_person", "In person", MapPin], ["online", "Online", Video]] as const).map(([m, label, Icon]) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setModeTouched(true); }}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[12px] font-bold transition-all active:scale-[0.98]",
                  mode === m ? "border-gold/50 bg-gold/10 text-gold" : "border-border/50 bg-background/40 text-muted-foreground",
                )}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          {mode === "in_person" ? (
            <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder="Place — e.g. Central Park, main gate" className={field} />
          ) : (
            <input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="Paste link — Google Meet, Teams, Zoom…" className={cn(field, linkInvalid && "border-destructive/60")} />
          )}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Duration (min)</label>
              <input type="number" value={duration} min={10} step={5} onChange={(e) => { setDuration(parseInt(e.target.value || "60", 10)); setDurationTouched(true); }} className={field} />
            </div>
            {kind === "single" && (
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Capacity (opt.)</label>
                <input type="number" value={capacity} min={1} placeholder="∞" onChange={(e) => setCapacity(e.target.value)} className={field} />
              </div>
            )}
          </div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={280} placeholder="Details (optional)" rows={2} className={cn(field, "resize-none")} />
          <button disabled={busy} onClick={submit}
            className="w-full rounded-xl bg-gold py-3 text-[13px] font-black text-primary-foreground disabled:opacity-60 active:scale-[0.99] transition-transform">
            {busy ? "Posting…" : kind === "series" ? `Post series${sessionCount ? ` · ${sessionCount} session${sessionCount === 1 ? "" : "s"}` : ""}` : "Post meetup"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TribeEvents;
