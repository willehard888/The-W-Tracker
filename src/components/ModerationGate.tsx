import { AnimatePresence, motion } from "framer-motion";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Portal } from "@/components/ui/Portal";
import type { ModerationState } from "@/hooks/use-moderation";

interface Props {
  state: ModerationState;
  message?: string | null;
  thumbnailUrl?: string | null;
  onCancel?: () => void;
  onDismiss?: () => void;
}

export default function ModerationGate({
  state,
  message,
  thumbnailUrl,
  onCancel,
  onDismiss,
}: Props) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (state !== "reviewing") {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 5_000);
    return () => clearTimeout(t);
  }, [state]);

  const visible =
    state === "validating" ||
    state === "reviewing" ||
    state === "blocked" ||
    state === "error";

  return (
    <Portal>
    <AnimatePresence>
      {visible && (
        <motion.div
          key="moderation-gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 p-6"
        >
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            {thumbnailUrl && (
              <div className="mb-4 aspect-square w-full overflow-hidden rounded-xl border border-border/50">
                <img
                  src={thumbnailUrl}
                  alt="Pending review"
                  className={`h-full w-full object-cover transition ${
                    state === "blocked" ? "opacity-40 grayscale" : ""
                  }`}
                />
              </div>
            )}

            <div className="flex items-start gap-3">
              {state === "validating" || state === "reviewing" ? (
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-gold" />
              ) : state === "blocked" ? (
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              ) : (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              )}
              <div className="flex-1">
                <p className="font-semibold leading-tight">
                  {state === "validating" && "Checking image…"}
                  {state === "reviewing" && (slow ? "Taking longer than usual…" : "Reviewing your proof…")}
                  {state === "blocked" && "Content rejected"}
                  {state === "error" && "Something went wrong"}
                </p>
                {message && (
                  <p className="mt-1 text-sm text-muted-foreground">{message}</p>
                )}
              </div>
            </div>

            {(state === "blocked" || state === "error") && onDismiss && (
              <button
                onClick={onDismiss}
                className="press mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition"
              >
                Try another photo
              </button>
            )}

            {state === "reviewing" && slow && onCancel && (
              <button
                onClick={onCancel}
                className="mt-5 w-full rounded-lg border border-border py-2.5 text-sm text-muted-foreground transition"
              >
                Cancel
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </Portal>
  );
}
