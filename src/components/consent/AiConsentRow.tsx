import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { aiConsentPatch, hasAiConsent } from "@/lib/ai-consent";
import { hapticImpact } from "@/lib/haptics";

/**
 * Withdrawing (or granting) the AI consent from Settings — the escape hatch the
 * consent sheet promises. Optimistic with a revert, like the notification
 * toggles: the switch must answer the thumb, and a failed write must not leave
 * the UI claiming something the server does not agree with.
 */
const AiConsentRow = () => {
  const { user, profile, refreshProfile } = useAuth();
  const stored = hasAiConsent(profile?.ai_consent_version);
  const [on, setOn] = useState(stored);
  const [saving, setSaving] = useState(false);
  // Follow the profile when it changes elsewhere (the sheet, another device).
  if (!saving && on !== stored) setOn(stored);

  const toggle = async (next: boolean) => {
    if (!user) return;
    hapticImpact("light");
    setOn(next);
    setSaving(true);
    const { error } = await supabase.from("profiles").update(aiConsentPatch(next)).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      setOn(!next);
      toast.error("Couldn't save that. Try again.");
      return;
    }
    await refreshProfile();
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <Sparkles size={15} className="text-muted-foreground shrink-0" aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-note font-semibold leading-tight">AI coaching</span>
        <span className="block text-meta text-muted-foreground leading-snug mt-0.5">
          Sends what you log to OpenAI and Google models to coach you
        </span>
      </span>
      <Switch checked={on} disabled={saving} onCheckedChange={(v) => void toggle(v)} aria-label="AI coaching" />
    </div>
  );
};

export default AiConsentRow;
