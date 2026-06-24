import { useState } from "react";
import { Calendar, MapPin, Users, Plus, X, Trash2, Check, Clock, Flame, Video } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { toast } from "sonner";
import { useTribeEvents, useTribeEventActions, type TribeEvent, type RsvpStatus } from "@/hooks/use-tribe-events";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { TRIBE_ACTIVITY_GROUPS, activityIcon } from "@/lib/tribe-activities";

const ERR: Record<string, string> = {
  not_member: "Join the tribe to do that.",
  event_full: "This event is full.",
  title_required: "Give the event a title.",
  unauthorized: "Please sign in.",
  forbidden: "Only the host can do that.",
};
const errMsg = (e: any) =>
  ERR[e?.message?.match(/not_member|event_full|title_required|unauthorized|forbidden/)?.[0] ?? ""] ?? e?.message ?? "Something went wrong";

/** Tribe events / meetups — schedule, RSVP, show up. */
const TribeEvents = ({ tribeId, isMember, currentUserId }: { tribeId: string; isMember: boolean; currentUserId?: string }) => {
  const { data: events, isLoading } = useTribeEvents(tribeId);
  const { createEvent, rsvp, deleteEvent } = useTribeEventActions(tribeId);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

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
          {events!.map((ev, i) => {
            const start = new Date(ev.starts_at);
            const full = ev.capacity != null && ev.going_count >= ev.capacity && ev.my_status !== "going";
            const isNext = i === 0;
            const rel = isToday(start) ? "Today" : isTomorrow(start) ? "Tomorrow" : null;
            const pct = ev.capacity ? Math.min(100, (ev.going_count / ev.capacity) * 100) : 0;
            return (
              <div key={ev.id} className={cn(
                "relative rounded-2xl overflow-hidden border bg-gradient-to-br from-[hsl(18_95%_58%)]/[0.05] via-card/70 to-card",
                isNext ? "border-[hsl(18_95%_58%)]/40 shadow-[0_10px_34px_-18px_hsl(18_95%_58%/0.6)]" : "border-border/60",
              )}>
                {/* Ember left accent */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[hsl(18_95%_58%)] to-gold" />
                <div className="p-3.5 pl-4">
                  {isNext && (
                    <div className="inline-flex items-center gap-1 mb-2 px-2 py-0.5 rounded-full bg-[hsl(18_95%_58%)]/15 border border-[hsl(18_95%_58%)]/35">
                      <Flame size={9} className="text-[hsl(18_95%_58%)]" fill="currentColor" />
                      <span className="text-[8.5px] font-black uppercase tracking-widest text-[hsl(18_95%_58%)]">Next up</span>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                  {/* Premium date tile */}
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
                          <a
                            href={ev.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => hapticImpact("light")}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-black bg-[hsl(18_95%_58%)] text-background active:scale-95 transition-transform"
                          >
                            <Video size={12} /> Join
                          </a>
                        )}
                        <button
                          disabled={busy === ev.id || full}
                          onClick={() => onRsvp(ev, "going")}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-black transition-all active:scale-95 disabled:opacity-50",
                            ev.my_status === "going" ? "bg-gold text-primary-foreground" : "bg-secondary/50 border border-border/50 text-foreground/70",
                          )}
                        >
                          <Check size={12} /> {full ? "Full" : "Going"}
                        </button>
                        <button
                          disabled={busy === ev.id}
                          onClick={() => onRsvp(ev, "maybe")}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-[11px] font-black transition-all active:scale-95 disabled:opacity-50",
                            ev.my_status === "maybe" ? "bg-gold/20 border border-gold/40 text-gold" : "bg-secondary/50 border border-border/50 text-foreground/70",
                          )}
                        >
                          Maybe
                        </button>
                        {ev.host_id === currentUserId && (
                          <button
                            disabled={busy === ev.id}
                            onClick={() => onDelete(ev)}
                            className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/60 active:scale-95"
                            aria-label="Delete event"
                          >
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
          })}
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
        />
      )}
    </div>
  );
};

const CreateEventSheet = ({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (e: { title: string; activity?: string; description?: string; place?: string; meeting_url?: string | null; starts_at: string; duration_min?: number; capacity?: number | null }) => Promise<void>;
}) => {
  const [title, setTitle] = useState("");
  const [activity, setActivity] = useState("");
  const [mode, setMode] = useState<"in_person" | "online">("in_person");
  const [place, setPlace] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (title.trim().length < 2) { toast.error("Give it a title."); return; }
    if (!when) { toast.error("Pick a date & time."); return; }
    if (mode === "online" && meetingUrl.trim() && !/^https?:\/\//i.test(meetingUrl.trim())) {
      toast.error("Paste a full link (https://…)"); return;
    }
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

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 mx-auto w-full max-w-md rounded-t-3xl border-t border-gold/25 bg-card max-h-[88vh] overflow-y-auto p-4 pb-8 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-black tracking-tight">Host a meetup</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="space-y-2.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Title — e.g. Saturday run · Morning meditation · React workshop" className={field} />
          <div className="space-y-2">
            {TRIBE_ACTIVITY_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[8.5px] font-black tracking-widest uppercase text-muted-foreground/55 mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(({ name, icon: Icon }) => (
                    <button key={name} onClick={() => setActivity(name === activity ? "" : name)}
                      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-all active:scale-95",
                        activity === name ? "bg-gold text-primary-foreground border-transparent" : "bg-secondary/40 border-border/50 text-muted-foreground")}>
                      <Icon size={12} strokeWidth={2.4} /> {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
          {/* In person / Online */}
          <div className="grid grid-cols-2 gap-2">
            {([["in_person", "In person", MapPin], ["online", "Online", Video]] as const).map(([m, label, Icon]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
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
            <input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="Paste link — Google Meet, Teams, Zoom…" className={field} />
          )}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Duration (min)</label>
              <input type="number" value={duration} min={10} step={5} onChange={(e) => setDuration(parseInt(e.target.value || "60", 10))} className={field} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Capacity (opt.)</label>
              <input type="number" value={capacity} min={1} placeholder="∞" onChange={(e) => setCapacity(e.target.value)} className={field} />
            </div>
          </div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={280} placeholder="Details (optional)" rows={2} className={cn(field, "resize-none")} />
          <button disabled={busy} onClick={submit}
            className="w-full rounded-xl bg-gold py-3 text-[13px] font-black text-primary-foreground disabled:opacity-60 active:scale-[0.99] transition-transform">
            {busy ? "Posting…" : "Post meetup"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TribeEvents;
