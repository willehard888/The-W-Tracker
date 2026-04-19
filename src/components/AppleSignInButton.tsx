import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { nativeAppleSignIn } from "@/lib/native-auth";
import { cn } from "@/lib/utils";

/**
 * Apple's official "Sign in with Apple" button styling.
 * - Pure black background, white text + glyph
 * - SF-style font stack (system font on iOS = SF Pro)
 * - 44pt minimum height (Apple HIG)
 * - Press animation that feels native (scale down briefly)
 * - Subtle shimmer on idle to feel alive
 *
 * The actual Apple authorization sheet is rendered by iOS itself
 * (via NativeAppleAuth.swift → ASAuthorizationController), so all
 * Face ID / Touch ID animations are 100% native — we only style the
 * trigger button to match Apple's HIG.
 */

interface AppleSignInButtonProps {
  externalLoading?: boolean;
  hideEmail?: boolean;
  className?: string;
}

const AppleSignInButton = ({
  externalLoading = false,
  hideEmail = false,
  className,
}: AppleSignInButtonProps) => {
  const [loading, setLoading] = useState(false);
  const isLoading = loading || externalLoading;

  const handleAppleSignIn = async () => {
    if (isLoading) return;
    setLoading(true);
    try {
      const { error } = await nativeAppleSignIn({ hideEmail });
      if (error) {
        const message =
          error.message === "APPLE_CANCELLED"
            ? ""
            : error.message || "Apple sign-in failed. Please try again.";
        if (message) toast.error(message);
      }
    } catch (e: any) {
      console.error("Apple sign in error:", e);
      const message =
        e?.message === "APPLE_CANCELLED"
          ? ""
          : e?.message || "Apple sign-in failed. Please try again.";
      if (message) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleAppleSignIn}
      disabled={isLoading}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        // Apple HIG: minimum 44pt height, full-width, rounded
        "relative w-full h-12 rounded-xl overflow-hidden",
        "bg-black text-white",
        "flex items-center justify-center gap-2",
        // SF font stack — uses SF Pro on iOS automatically
        "font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',sans-serif]",
        "text-[17px] font-medium tracking-[-0.01em]",
        "active:opacity-90",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
        className,
      )}
      aria-label="Sign in with Apple"
    >
      {/* Subtle moving sheen — feels premium, not flashy */}
      {!isLoading && (
        <motion.span
          aria-hidden
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
          animate={{ translateX: ["-100%", "200%"] }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            repeatDelay: 4,
            ease: "easeInOut",
          }}
          style={{ width: "60%" }}
        />
      )}

      {isLoading ? (
        <span className="flex items-center gap-2">
          <span
            className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
            aria-hidden
          />
          <span>Signing in…</span>
        </span>
      ) : (
        <>
          {/* Official Apple logo glyph (filled, white) */}
          <svg
            width="17"
            height="20"
            viewBox="0 0 17 20"
            fill="currentColor"
            aria-hidden
            className="-mt-0.5"
          >
            <path d="M14.94 6.94c-.1.08-1.86 1.05-1.86 3.26 0 2.55 2.24 3.45 2.31 3.47-.01.06-.36 1.24-1.18 2.45-.74 1.06-1.5 2.12-2.66 2.12s-1.46-.68-2.8-.68c-1.31 0-1.77.7-2.83.7s-1.79-.98-2.65-2.18C2.27 14.6 1.5 12.32 1.5 10.16c0-3.46 2.25-5.29 4.47-5.29 1.18 0 2.16.78 2.9.78.71 0 1.81-.82 3.15-.82.51 0 2.27.04 3.42 1.7l-.5.41ZM11.07 3.4c.55-.66.94-1.58.94-2.5 0-.13-.01-.26-.03-.36-.9.03-1.97.6-2.61 1.36-.51.58-.99 1.5-.99 2.43 0 .14.02.28.03.33.06.01.16.02.26.02.81 0 1.83-.55 2.4-1.28Z" />
          </svg>
          <span>Sign in with Apple</span>
        </>
      )}
    </motion.button>
  );
};

export default AppleSignInButton;
