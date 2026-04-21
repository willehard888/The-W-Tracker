import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateThumbnail,
  getFriendlyMessage,
  validateFile,
} from "@/lib/moderation-preflight";

export type ModerationKind = "proof" | "feed_post";
export type ModerationState =
  | "idle"
  | "validating"
  | "reviewing"
  | "ok"
  | "blocked"
  | "error";

export interface ModerationOutcome {
  action: "allow" | "flag" | "block";
  blocked: boolean;
  severity?: "low" | "medium" | "high" | "critical";
  reason?: string;
  friendlyMessage?: string;
  categories?: string[];
  cacheHit?: boolean;
}

interface ModerateImageArgs {
  file: File;
  kind: ModerationKind;
  contentId?: string | null;
}

interface ModerateTextArgs {
  text: string;
  kind: ModerationKind;
  contentId?: string | null;
}

export function useModeration() {
  const [state, setState] = useState<ModerationState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
    setMessage(null);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState("idle");
    setMessage(null);
  }, []);

  const moderateImage = useCallback(
    async ({ file, kind, contentId }: ModerateImageArgs): Promise<ModerationOutcome> => {
      setState("validating");
      setMessage(null);

      const v = validateFile(file);
      if (!v.ok) {
        setState("blocked");
        setMessage(v.reason ?? "Invalid file");
        return {
          action: "block",
          blocked: true,
          reason: v.reason,
          friendlyMessage: v.reason,
        };
      }

      let thumbnail;
      try {
        thumbnail = await generateThumbnail(file, 256);
      } catch (e) {
        setState("error");
        setMessage("Could not process image");
        return {
          action: "block",
          blocked: true,
          reason: "thumbnail_failed",
          friendlyMessage: "Could not process this image. Try another.",
        };
      }

      setState("reviewing");
      setMessage("Reviewing your proof…");

      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 12_000);

      try {
        const { data, error } = await supabase.functions.invoke("moderate-content", {
          body: {
            kind,
            content_id: contentId ?? null,
            image_b64: thumbnail.b64,
            image_hash: thumbnail.hash,
          },
        });
        clearTimeout(timeout);

        if (error) {
          // Edge function returned non-2xx — fail-closed for image proofs.
          setState("blocked");
          const friendly = "Moderation is temporarily unavailable. Please try again.";
          setMessage(friendly);
          return {
            action: "block",
            blocked: true,
            reason: "edge_error",
            friendlyMessage: friendly,
          };
        }

        const action = (data?.action ?? "allow") as "allow" | "flag" | "block";
        const categories: string[] = data?.categories ?? [];
        const friendly =
          action === "block"
            ? getFriendlyMessage(categories, data?.reason)
            : undefined;

        if (action === "block") {
          setState("blocked");
          setMessage(friendly ?? "Content rejected.");
        } else {
          setState("ok");
          setMessage(null);
        }

        return {
          action,
          blocked: action === "block",
          severity: data?.severity,
          reason: data?.reason,
          friendlyMessage: friendly,
          categories,
          cacheHit: data?.cache_hit,
        };
      } catch (e: any) {
        clearTimeout(timeout);
        setState("blocked");
        const friendly = "Moderation timed out. Please try again.";
        setMessage(friendly);
        return {
          action: "block",
          blocked: true,
          reason: "timeout",
          friendlyMessage: friendly,
        };
      } finally {
        abortRef.current = null;
      }
    },
    [],
  );

  const moderateText = useCallback(
    async ({ text, kind, contentId }: ModerateTextArgs): Promise<ModerationOutcome> => {
      setState("reviewing");
      setMessage("Checking content…");
      try {
        const { data, error } = await supabase.functions.invoke("moderate-content", {
          body: { kind, content_id: contentId ?? null, text },
        });
        if (error) {
          // Fail-open for text-only.
          setState("ok");
          setMessage(null);
          return { action: "allow", blocked: false };
        }
        const action = (data?.action ?? "allow") as "allow" | "flag" | "block";
        const categories: string[] = data?.categories ?? [];
        const friendly =
          action === "block" ? getFriendlyMessage(categories, data?.reason) : undefined;
        if (action === "block") {
          setState("blocked");
          setMessage(friendly ?? "Content rejected.");
        } else {
          setState("ok");
          setMessage(null);
        }
        return {
          action,
          blocked: action === "block",
          severity: data?.severity,
          reason: data?.reason,
          friendlyMessage: friendly,
          categories,
          cacheHit: data?.cache_hit,
        };
      } catch {
        // Fail-open for text-only.
        setState("ok");
        setMessage(null);
        return { action: "allow", blocked: false };
      }
    },
    [],
  );

  return { state, message, moderateImage, moderateText, reset, cancel };
}
