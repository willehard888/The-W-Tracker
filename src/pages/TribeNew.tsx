import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Users, Lock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TribeNew = () => {
  const { profile, isApexSubscriber } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // All tribes are private — approval-based join only.
  const visibility = "private" as const;
  const [submitting, setSubmitting] = useState(false);
  const [nameStatus, setNameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  const tier = profile?.status_tier;
  const canCreate =
    isApexSubscriber || tier === "apex" || tier === "legend";

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
        .from("tribes" as any)
        .select("id")
        .ilike("name", trimmed)
        .limit(1);
      const taken = ((data as any) ?? []).length > 0;
      setNameStatus(taken ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [name]);

  if (!canCreate) {
    return (
      <div className="min-h-full px-4 pt-6 safe-top text-center">
        <Lock size={32} className="mx-auto mb-3 text-[hsl(18_95%_58%)]" />
        <h1 className="font-display font-black text-xl mb-2">
          Apex tier required
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Tribes are founded by the top 10%. Earn Apex or unlock it instantly.
        </p>
        <Button onClick={() => navigate("/paywall")}>Unlock Apex</Button>
      </div>
    );
  }

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
    const { data, error } = await supabase.rpc("create_tribe" as any, {
      p_name: trimmed,
      p_description: description.trim() || null,
      p_visibility: visibility,
      p_cover_url: null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tribe created!");
    navigate(`/tribes/${data}`);
  };

  return (
    <div className="min-h-full pb-8 px-4 pt-4 safe-top">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-xs text-muted-foreground mb-4"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <h1 className="font-display text-2xl font-black mb-1">Create a Tribe</h1>
      <p className="text-xs text-muted-foreground mb-6">
        Up to 3 tribes per Apex founder. Names must be unique. Every tribe is private — members fuel the shared flame with their streaks.
      </p>

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
                nameStatus === "available" && "border-[hsl(152_68%_46%)]/60",
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {nameStatus === "checking" && (
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              )}
              {nameStatus === "available" && (
                <Check size={14} className="text-[hsl(152_68%_46%)]" />
              )}
              {nameStatus === "taken" && (
                <X size={14} className="text-destructive" />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-muted-foreground">{name.length}/40</p>
            {nameStatus === "available" && (
              <p className="text-[10px] font-bold text-[hsl(152_68%_46%)]">Available</p>
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
            Privacy
          </label>
          <div className="rounded-xl border border-gold/40 bg-gold/8 p-3 flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-gold/15 border border-gold/35 flex items-center justify-center shrink-0">
              <Lock size={14} className="text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-gold">Private by design</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                Every tribe is invite-only. New members must be approved by the founder. Your tribe's collective streak grows the flame everyone sees.
              </p>
            </div>
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
