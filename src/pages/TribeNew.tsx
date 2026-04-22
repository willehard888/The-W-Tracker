import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Users, Lock, Globe } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TribeNew = () => {
  const { profile, isApexSubscriber } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [submitting, setSubmitting] = useState(false);

  const tier = profile?.status_tier;
  const canCreate =
    isApexSubscriber || tier === "apex" || tier === "legend";

  if (!canCreate) {
    return (
      <div className="min-h-full px-4 pt-6 safe-top text-center">
        <Lock size={32} className="mx-auto mb-3 text-[hsl(18_95%_58%)]" />
        <h1 className="font-display font-black text-xl mb-2">
          Apex tier required
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Tribes are founded by the top 1%. Earn Apex or unlock it instantly.
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
        Up to 3 tribes per Apex founder.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-black tracking-widest uppercase text-muted-foreground mb-1.5 block">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="The Iron Brotherhood"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            {name.length}/40
          </p>
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
            Visibility
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { v: "public", icon: Globe, label: "Public", desc: "Anyone can join" },
                { v: "private", icon: Lock, label: "Private", desc: "Approve members" },
              ] as const
            ).map(({ v, icon: Icon, label, desc }) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all",
                  visibility === v
                    ? "border-[hsl(18_95%_58%)]/60 bg-[hsl(18_95%_58%)]/8"
                    : "border-border bg-secondary/30",
                )}
              >
                <Icon
                  size={14}
                  className={
                    visibility === v ? "text-[hsl(18_95%_58%)]" : "text-muted-foreground"
                  }
                />
                <p className="font-black text-xs mt-1">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleCreate}
          disabled={submitting || name.trim().length < 3}
          className="w-full bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold text-background font-black"
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
