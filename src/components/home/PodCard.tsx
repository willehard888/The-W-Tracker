import { useState } from "react";
import { Users, Check, Plus, LogIn, Copy, Flame, Crown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePod } from "@/hooks/use-pod";
import { cn } from "@/lib/utils";
import { hapticImpact, hapticNotification } from "@/lib/haptics";

const ERR: Record<string, string> = {
  already_in_pod: "You're already in a pod. Leave it first.",
  pod_not_found: "No pod with that code.",
  pod_full: "That pod is full (5 max).",
  unauthorized: "Please sign in.",
};

const PodCard = () => {
  const { user } = useAuth();
  const { data, isLoading, refresh } = usePod();
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return <div className="h-24 rounded-3xl border border-border/40 bg-card/40 animate-pulse" />;
  }

  const run = async (fn: () => Promise<{ error: any }>) => {
    setBusy(true);
    hapticImpact("medium");
    try {
      const { error } = await fn();
      if (error) throw error;
      hapticNotification("success");
      setMode("idle"); setName(""); setCode("");
      refresh();
    } catch (e: any) {
      const key = e?.message?.match(/already_in_pod|pod_not_found|pod_full|unauthorized/)?.[0];
      toast.error(ERR[key] ?? e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  // ── No pod: build / join ─────────────────────────────────────────────
  if (!data) {
    return (
      <div className="rounded-3xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)]">
        <div className="flex items-center gap-2 mb-2">
          <Users size={12} className="text-gold" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85">Accountability pod</p>
        </div>
        <p className="text-[14px] font-bold leading-snug text-foreground">
          3–5 people who see your daily check-in.
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          They notice the day you don't show up. That's the whole point.
        </p>

        {mode === "idle" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("create")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold/15 border border-gold/35 px-3 py-2.5 text-[12px] font-black text-gold active:scale-[0.98] transition-transform"
            >
              <Plus size={13} /> Create
            </button>
            <button
              onClick={() => setMode("join")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-card/50 px-3 py-2.5 text-[12px] font-black text-foreground/85 active:scale-[0.98] transition-transform"
            >
              <LogIn size={13} /> Join with code
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Pod name"
              className="flex-1 min-w-0 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 text-[13px] outline-none focus:border-gold/50"
            />
            <button
              disabled={busy}
              onClick={() => run(async () => await supabase.rpc("create_pod", { p_name: name }))}
              className="shrink-0 rounded-xl bg-gold px-4 py-2.5 text-[12px] font-black text-primary-foreground disabled:opacity-60"
            >
              {busy ? "…" : "Create"}
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="CODE"
              className="flex-1 min-w-0 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 text-[13px] tracking-[0.2em] font-bold uppercase outline-none focus:border-gold/50"
            />
            <button
              disabled={busy}
              onClick={() => run(async () => await supabase.rpc("join_pod", { p_code: code }))}
              className="shrink-0 rounded-xl bg-gold px-4 py-2.5 text-[12px] font-black text-primary-foreground disabled:opacity-60"
            >
              {busy ? "…" : "Join"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Has pod: today status ────────────────────────────────────────────
  const members = data.members ?? [];
  const inCount = members.filter((m) => m.checked_in_today).length;
  const total = members.length;
  const me = members.find((m) => m.user_id === user?.id);
  const youMissing = me && !me.checked_in_today;
  const allIn = total > 0 && inCount === total;

  const line = allIn
    ? "Full house — the pod is perfect today. 🔥"
    : youMissing
    ? inCount > 0
      ? "You're the gap. Everyone else showed up."
      : "Be the one who starts it today."
    : inCount === 0
    ? "Nobody's in yet. Lead the pod."
    : `${total - inCount} still out. Pull them up.`;

  return (
    <div className="rounded-3xl border border-gold/25 bg-gradient-to-b from-gold/[0.06] via-card/95 to-card p-5 shadow-[0_18px_56px_-30px_hsl(var(--gold)/0.45)]">
      <div className="flex items-center gap-2 mb-3">
        <Users size={12} className="text-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold/85 truncate">
          {data.pod.name}
        </p>
        <span className="ml-auto text-[11px] font-black tabular-nums text-gold">
          {inCount}/{total} in
        </span>
      </div>

      {/* Member rings — checked-in = gold fill */}
      <div className="flex items-center gap-2.5 mb-3">
        {members.map((m) => (
          <div key={m.user_id} className="flex flex-col items-center gap-1 min-w-0">
            <div
              className={cn(
                "relative h-11 w-11 rounded-full flex items-center justify-center text-[13px] font-black border-2 overflow-hidden",
                m.checked_in_today
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border/50 bg-card/60 text-muted-foreground/70",
                m.user_id === user?.id && "ring-2 ring-gold/40 ring-offset-1 ring-offset-background",
              )}
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (m.username?.charAt(0) || "?").toUpperCase()
              )}
              {m.checked_in_today && (
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-gold flex items-center justify-center border border-background">
                  <Check size={9} className="text-primary-foreground" strokeWidth={3.5} />
                </span>
              )}
            </div>
            <span className="text-[8.5px] text-muted-foreground truncate max-w-[44px]">
              {m.user_id === user?.id ? "You" : m.username}
            </span>
          </div>
        ))}
        {total < 5 && (
          <button
            onClick={() => {
              navigator.clipboard?.writeText(data.pod.invite_code).catch(() => {});
              toast.success("Invite code copied", { description: data.pod.invite_code });
            }}
            className="flex flex-col items-center gap-1"
          >
            <span className="h-11 w-11 rounded-full border-2 border-dashed border-gold/40 flex items-center justify-center text-gold">
              <Plus size={16} />
            </span>
            <span className="text-[8.5px] text-gold/80">Invite</span>
          </button>
        )}
      </div>

      <p className={cn("text-[12.5px] font-bold leading-snug", youMissing ? "text-[hsl(var(--streak-orange))]" : "text-foreground/85")}>
        {youMissing && <Flame size={12} className="inline mr-1 -mt-0.5 text-[hsl(var(--streak-orange))]" />}
        {line}
      </p>

      <button
        onClick={() => {
          navigator.clipboard?.writeText(data.pod.invite_code).catch(() => {});
          toast.success("Invite code copied", { description: `Share "${data.pod.invite_code}" to add a pod-mate` });
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 hover:text-gold transition-colors"
      >
        <Copy size={10} /> Code {data.pod.invite_code}
        {data.pod.owner_id === user?.id && <Crown size={10} className="text-gold/70 ml-0.5" />}
      </button>
    </div>
  );
};

export default PodCard;
