import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Users, Lock, Globe, Check, X } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-copy";
import { cn } from "@/lib/utils";
import { backOr } from "@/lib/nav";
import TribeFireLite from "@/components/TribeFireLite";
import { tierPalette } from "@/lib/tribe-streak";
import { TRIBE_ACTIVITY_GROUPS } from "@/lib/tribe-activities";

const LABEL = "text-[11px] font-bold text-muted-foreground";

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
      const taken = (data ?? []).length > 0;
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
      // p_description/p_cover_url are optional with SQL default null — omitting
      // them (undefined) is equivalent to the explicit nulls sent before.
      const { data, error } = await supabase.rpc("create_tribe", {
        p_name: trimmed,
        p_description: description.trim() || undefined,
        p_visibility: visibility,
      });
      if (error) {
        toast.error(friendlyError(error));
        return;
      }
      // Best-effort activity tag — never block navigation on it.
      // (supabase.rpc returns errors, it doesn't throw — check explicitly.)
      if (activity && data) {
        const { error: actErr } = await supabase.rpc("set_tribe_activity", {
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

  const isCreatorActivity = TRIBE_ACTIVITY_GROUPS
    .find((g) => g.label === "Learn & Grow")
    ?.items.some((i) => i.name === activity);

  return (
    <div className="min-h-full">
      <PageBar onBack={() => backOr(navigate, "/squad?tab=tribes")} />

      <div className="px-4 pt-3 pb-6">
      <header className="home-rise">
        <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">Light a new fire.</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Name it, say what it's about, choose who can join.</p>
      </header>

      {/* Live preview — the tribe takes shape as you type */}
      <div className="home-rise home-rise-1 mt-4 mb-5">
        <div className="relative rounded-3xl border border-gold/30 bg-gradient-to-b from-gold/[0.09] via-card/95 to-card overflow-hidden shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.5)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,hsl(var(--gold)/0.12)_0%,transparent_65%)]"
          />
          <div className="relative flex flex-col items-center text-center px-5 pt-5 pb-5">
            <TribeFireLite tier={3} palette={tierPalette(3)} variant="standard" size={75} className="mb-1" />
            <p className={cn(
              "font-display text-xl font-black tracking-tight leading-tight",
              name.trim() ? "text-foreground" : "text-muted-foreground/75",
            )}>
              {name.trim() || "Your tribe"}
            </p>
            <p className={cn(LABEL, "mt-1.5 inline-flex items-center gap-1")}>
              {activity && <>{activity} · </>}
              {visibility === "public" ? <><Globe size={11} aria-hidden /> Open to anyone</> : <><Lock size={11} aria-hidden /> Approval to join</>}
            </p>
            {description.trim() && (
              <p className="text-[12px] text-muted-foreground leading-snug mt-2 max-w-[260px] line-clamp-2">{description.trim()}</p>
            )}
          </div>
        </div>
      </div>

      <div className="home-rise home-rise-2 space-y-5">
        <div>
          <label className={cn(LABEL, "mb-1.5 block")}>Name</label>
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
                <Loader2 aria-hidden size={14} className="animate-spin text-muted-foreground" />
              )}
              {nameStatus === "available" && (
                <Check aria-hidden size={14} className="text-xp-green" />
              )}
              {nameStatus === "taken" && (
                <X size={14} className="text-destructive" />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-muted-foreground tabular-nums">{name.length}/40</p>
            {nameStatus === "available" && (
              <p className="text-[11px] font-bold text-xp-green">Available</p>
            )}
            {nameStatus === "taken" && (
              <p className="text-[11px] font-bold text-destructive">Already taken</p>
            )}
            {nameStatus === "invalid" && name.trim().length > 0 && (
              <p className="text-[11px] font-bold text-muted-foreground">3–40 chars</p>
            )}
          </div>
        </div>

        <div>
          <label className={cn(LABEL, "mb-1.5 block")}>What it's about</label>
          <div className="space-y-3">
            {TRIBE_ACTIVITY_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[11px] text-muted-foreground/75 mb-1.5">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(({ name, icon: Icon }) => (
                    <Button
                      key={name}
                      type="button"
                      variant={activity === name ? "gold-outline" : "outline"}
                      size="pill"
                      onClick={() => setActivity(name === activity ? "" : name)}
                    >
                      <Icon size={12} strokeWidth={2.4} />
                      {name}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">From training to meditation, workshops to book clubs — helps people discover your tribe.</p>
          {isCreatorActivity && (
            <div className="mt-2 surface-card surface-card-quiet px-3 py-2.5">
              <p className={LABEL}>Built for creators</p>
              <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
                Host workshops and courses with event series: up to 24 sessions with
                meeting links, RSVPs and reminders, right inside your tribe.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className={cn(LABEL, "mb-1.5 block")}>Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="What does your tribe stand for?"
          />
          <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
            {description.length}/200
          </p>
        </div>

        <div>
          <label className={cn(LABEL, "mb-1.5 block")}>Who can join</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: "public", icon: Globe, t: "Open", d: "Anyone can join instantly" },
              { v: "private", icon: Lock, t: "Approval", d: "You approve each member" },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setVisibility(o.v)}
                aria-pressed={visibility === o.v}
                className={cn(
                  "press min-h-11 rounded-xl border p-3 text-left transition-colors",
                  visibility === o.v ? "border-gold/50 bg-gold/[0.07]" : "border-border/60 bg-card/40",
                )}
              >
                <o.icon size={15} className={visibility === o.v ? "text-gold" : "text-muted-foreground"} aria-hidden />
                <p className={cn("text-[12px] font-black mt-1.5", visibility === o.v ? "text-gold" : "text-foreground")}>{o.t}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{o.d}</p>
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleCreate}
          loading={submitting}
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
          <Users aria-hidden size={16} />
          Create tribe
        </Button>
      </div>
      </div>
    </div>
  );
};

export default TribeNew;
