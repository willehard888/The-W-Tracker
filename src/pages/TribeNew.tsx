import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Users, Lock, Globe, Check, X } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { cn } from "@/lib/utils";
import TribeFireLite from "@/components/TribeFireLite";
import { tierPalette } from "@/lib/tribe-streak";
import { TRIBE_ACTIVITY_GROUPS } from "@/lib/tribe-activities";

const TribeNew = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");
  // Open to everyone: public = anyone joins instantly, private = approve.
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [submitting, setSubmitting] = useState(false);
  const [nameStatus, setNameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  // Debounced name availability check
  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setNameStatus("idle");
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 40) {
      setNameStatus("invalid");
      return;
    }
    setNameStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("tribes")
        .select("id")
        .ilike("name", trimmed)
        .limit(1);
      const taken = ((data as any) ?? []).length > 0;
      setNameStatus(taken ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [name]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 40) {
      toast.error("Name must be 3–40 characters");
      return;
    }
    if (nameStatus === "taken") {
      toast.error("Tribe name already taken — try another");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("create_tribe" as any, {
        p_name: trimmed,
        p_description: description.trim() || null,
        p_visibility: visibility,
        p_cover_url: null,
      });
      if (error) {
        toast.error(friendlyError(error));
        return;
      }
      // Best-effort activity tag — never block navigation on it.
      // (supabase.rpc returns errors, it doesn't throw — check explicitly.)
      if (activity && data) {
        const { error: actErr } = await supabase.rpc("set_tribe_activity" as any, {
          p_tribe: data,
          p_activity: activity,
        });
        if (actErr) console.warn("[tribe] set_tribe_activity failed", actErr);
      }
      toast.success("Tribe created!");
      navigate(`/tribes/${data}`);
    } catch (e: any) {
      toast.error(friendlyError(e, "Could not create the tribe. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full pb-10 px-4 pt-3">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 rounded-full bg-card/70 border border-border/60 flex items-center justify-center text-muted-foreground active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-display text-base font-black tracking-tight">Create a Tribe</h1>
      </div>

      {/* Live preview — the tribe takes shape as you type */}
      <div className="relative rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/[0.09] via-card/95 to-card overflow-hidden mb-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.5)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 60% at 50% 0%, hsl(var(--gold) / 0.12) 0%, transparent 65%)" }}
        />
        <div className="relative flex flex-col items-center text-center px-5 pt-5 pb-5">
          <TribeFireLite tier={3} palette={tierPalette(3)} variant="standard" size={75} className="mb-1" />
          <p className={cn(
            "font-display text-xl font-black tracking-tight leading-tight",
            name.trim() ? "text-foreground" : "text-muted-foreground/50",
          )}>
            {name.trim() || "Your tribe"}
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
            {activity && (
              <span className="text-[10px] font-black uppercase tracking-wider text-gold bg-gold/10 border border-gold/25 rounded-full px-2 py-0.5">
                {activity}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-secondary/40 border border-border/50 rounded-full px-2 py-0.5">
              {visibility === "public" ? <><Globe size={9} /> Open</> : <><Lock size={9} /> Approval</>}
            </span>
          </div>
          {description.trim() && (
            <p className="text-[11px] text-muted-foreground leading-snug mt-2 max-w-[260px] line-clamp-2">{description.trim()}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-black tracking-widest uppercase text-muted-foreground mb-1.5 block">
            Name
          </label>
          <div className="relative">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="The Iron Brotherhood"
              className={cn(
                "pr-10",
                nameStatus === "taken" && "border-destructive/60",
                nameStatus === "available" && "border-xp-green/60",
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {nameStatus === "checking" && (
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              )}
              {nameStatus === "available" && (
                <Check size={14} className="text-xp-green" />
              )}
              {nameStatus === "taken" && (
                <X size={14} className="text-destructive" />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-muted-foreground">{name.length}/40</p>
            {nameStatus === "available" && (
              <p className="text-[10px] font-bold text-xp-green">Available</p>
            )}
            {nameStatus === "taken" && (
              <p className="text-[10px] font-bold text-destructive">Already taken</p>
            )}
            {nameStatus === "invalid" && name.trim().length > 0 && (
              <p className="text-[10px] font-bold text-muted-foreground">3–40 chars</p>
            )}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-black tracking-widest uppercase text-muted-foreground mb-1.5 block">
            What's it about
          </label>
          <div className="space-y-3">
            {TRIBE_ACTIVITY_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground/60 mb-1.5">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setActivity(name === activity ? "" : name)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-all active:scale-95",
                        activity === name
                          ? "bg-gold text-primary-foreground border-transparent"
                          : "bg-secondary/40 border-border/50 text-muted-foreground",
                      )}
                    >
                      <Icon size={12} strokeWidth={2.4} />
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">From training to meditation, workshops to book clubs — helps people discover your tribe.</p>
          {TRIBE_ACTIVITY_GROUPS.find((g) => g.label === "Learn & Grow")?.items.some((i) => i.name === activity) && (
            <div className="mt-2 rounded-lg border border-gold/35 bg-gold/[0.06] px-3 py-2">
              <p className="text-[10px] font-bold text-gold">Built for creators</p>
              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                Host workshops and courses with event series — up to 24 sessions with
                meeting links, RSVPs and reminders, right inside your tribe.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-[11px] font-black tracking-widest uppercase text-muted-foreground mb-1.5 block">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="What does your tribe stand for?"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            {description.length}/200
          </p>
        </div>

        <div>
          <label className="text-[11px] font-black tracking-widest uppercase text-muted-foreground mb-1.5 block">
            Who can join
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: "public", icon: Globe, t: "Open", d: "Anyone can join instantly" },
              { v: "private", icon: Lock, t: "Approval", d: "You approve each member" },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setVisibility(o.v)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                  visibility === o.v ? "border-gold/50 bg-gold/[0.07]" : "border-border/60 bg-card/40",
                )}
              >
                <o.icon size={15} className={visibility === o.v ? "text-gold" : "text-muted-foreground"} />
                <p className={cn("text-[12px] font-black mt-1.5", visibility === o.v ? "text-gold" : "text-foreground")}>{o.t}</p>
                <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{o.d}</p>
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleCreate}
          disabled={
            submitting ||
            name.trim().length < 3 ||
            nameStatus === "taken" ||
            nameStatus === "checking"
          }
          variant="ember"
          className="w-full"
          size="lg"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
          Create Tribe
        </Button>
      </div>
    </div>
  );
};

export default TribeNew;
