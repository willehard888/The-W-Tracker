import { useState } from "react";
import { Calendar, MapPin, Users, Plus, X, Trash2, Check, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTribeEvents, useTribeEventActions, type TribeEvent, type RsvpStatus } from "@/hooks/use-tribe-events";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

const ERR: Record<string, string> = {
  not_member: "Join the tribe to do that.",
  event_full: "This event is full.",
  title_required: "Give the event a title.",
  unauthorized: "Please sign in.",
  forbidden: "Only the host can do that.",
};
const errMsg = (e: any) =>
  ERR[e?.message?.match(/not_member|event_full|title_required|unauthorized|forbidden/)?.[0] ?? ""] ?? e?.message ?? "Something went wrong";

const ACTIVITIES = ["Run", "Gym", "Yoga", "Ride", "Swim", "Hike", "Combat", "Walk", "Other"];

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
        <div className="space-y-2.5">
          {events!.map((ev) => {
            const start = new Date(ev.starts_at);
            const full = ev.capacity != null && ev.going_count >= ev.capacity && ev.my_status !== "going";
            return (
              <div key={ev.id} className="rounded-2xl border border-border/60 bg-card/40 p-3.5">
                <div className="flex items-start gap-3">
                  {/* Date tile */}
                  <div className="shrink-0 w-12 rounded-xl bg-gold/10 border border-gold/25 flex flex-col items-center justify-center py-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-gold/80 leading-none">{format(start, "MMM")}</span>
                    <span className="font-display font-black text-lg leading-none text-gold tabular-nums">{format(start, "d")}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ev.activity && (
                        <span className="text-[8.5px] font-black uppercase tracking-wider text-gold bg-gold/10 border border-gold/25 rounded px-1.5 py-0.5">{ev.activity}</span>
                      )}
                      <p className="font-display font-black text-[14px] tracking-tight truncate">{ev.title}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock size={11} /> {format(start, "EEE HH:mm")} · {ev.duration_min}m</span>
                      {ev.place && <span className="inline-flex items-center gap-1 truncate"><MapPin size={11} /> {ev.place}</span>}
                      <span className="inline-flex items-center gap-1"><Users size={11} /> {ev.going_count}{ev.capacity ? `/${ev.capacity}` : ""} going</span>
                    </div>
                    {ev.description && <p className="text-[11.5px] text-foreground/75 leading-snug mt-1.5">{ev.description}</p>}

                    {isMember && (
                      <div className="mt-2.5 flex items-center gap-1.5">
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
  onCreate: (e: { title: string; activity?: string; description?: string; place?: string; starts_at: string; duration_min?: number; capacity?: number | null }) => Promise<void>;
}) => {
  const [title, setTitle] = useState("");
  const [activity, setActivity] = useState("");
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (title.trim().length < 2) { toast.error("Give it a title."); return; }
    if (!when) { toast.error("Pick a date & time."); return; }
    setBusy(true);
    await onCreate({
      title, activity: activity || undefined, description: desc || undefined, place: place || undefined,
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Title — e.g. Saturday long run" className={field} />
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITIES.map((a) => (
              <button key={a} onClick={() => setActivity(a === activity ? "" : a)}
                className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold border transition-all active:scale-95",
                  activity === a ? "bg-gold text-primary-foreground border-transparent" : "bg-secondary/40 border-border/50 text-muted-foreground")}>
                {a}
              </button>
            ))}
          </div>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
          <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder="Place — e.g. Central Park, main gate" className={field} />
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
