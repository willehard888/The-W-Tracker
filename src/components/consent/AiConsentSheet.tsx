import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/sheet-bottom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { aiConsentPatch } from "@/lib/ai-consent";
import { setAiConsentHost } from "@/lib/ai-consent-gate";
import { hapticImpact } from "@/lib/haptics";

/**
 * The one moment the app asks to send what a member logs to an AI model
 * (App Review 5.1.2(i)). Names the providers and the data, in the member's
 * words, before anything leaves. The server refuses without the answer, so
 * this sheet is the only way in — and declining leaves the rest of the app
 * (training, check-in, the diary by search, the Vault) untouched.
 *
 * Mounted once, lazily, by App: it registers with the consent gate, and any
 * code that is about to use AI calls `ensureAiConsent()`.
 */
const AiConsentSheet = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const answer = useRef<((granted: boolean) => void) | null>(null);
  // The gate reads the current value through a ref so it never holds a stale one.
  const version = useRef(profile?.ai_consent_version);
  version.current = profile?.ai_consent_version;

  const ask = useCallback(
    () => new Promise<boolean>((resolve) => {
      answer.current = resolve;
      setOpen(true);
    }),
    [],
  );

  useEffect(() => {
    setAiConsentHost({ version: () => version.current, ask });
    return () => setAiConsentHost(null);
  }, [ask]);

  const settle = (granted: boolean) => {
    answer.current?.(granted);
    answer.current = null;
    setOpen(false);
  };

  const choose = async (granted: boolean) => {
    if (!user) { settle(false); return; }
    hapticImpact("light");
    setSaving(true);
    // A decline is stored too: it is an answer, and it stops the app asking
    // again on every Coach open.
    const { error } = await supabase.from("profiles").update(aiConsentPatch(granted)).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save that. Try again.");
      settle(false);
      return;
    }
    await refreshProfile();
    settle(granted);
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => settle(false)}
      label="AI coaching"
      title="Your coach runs on AI"
      footer={
        <div className="space-y-2">
          <Button variant="ember" size="lg" className="w-full" disabled={saving} onClick={() => void choose(true)}>
            Allow AI coaching
          </Button>
          <Button variant="ghost" size="lg" className="w-full" disabled={saving} onClick={() => void choose(false)}>
            Not now
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-read leading-relaxed text-foreground/90">
        <p>
          To coach you, Whealth Factory sends what you log to AI models from OpenAI and Google, through our
          gateway OpenRouter: your profile basics, check-ins, sleep, training and Apple Health summaries,
          journal notes, your messages to the coach, and meal photos you scan.
        </p>
        <p>It is used only to answer you. It is never sold and never used for ads.</p>
        <p className="text-note text-muted-foreground">
          Photos and posts you share are also screened by automated AI moderation, which keeps the community
          safe and stays on.
        </p>
        <p className="text-note text-muted-foreground">
          You can change this any time in Profile.{" "}
          <Link to="/privacy" className="underline text-foreground/80">Privacy Policy</Link>
        </p>
      </div>
    </BottomSheet>
  );
};

export default AiConsentSheet;
