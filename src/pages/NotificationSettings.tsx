import { backOr } from "@/lib/nav";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Flame, Brain, Users, Swords, BarChart3, RotateCcw,
  Minus, Plus,
} from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { AppLauncher } from "@capacitor/app-launcher";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAthleteProfile } from "@/hooks/use-athlete-profile";
import { usePushControls } from "@/hooks/use-push-notifications";
import {
  getNotificationPrefs,
  clampReminderHour,
  REMINDER_HOUR_MIN,
  REMINDER_HOUR_MAX,
  type NotificationPrefs,
} from "@/lib/notification-prefs";
import { STREAK_COPY } from "@/lib/streak-notifications";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { hapticImpact } from "@/lib/haptics";
import { captureException } from "@/lib/observability";
import { cn } from "@/lib/utils";

/**
 * /settings/notifications — full control over what reaches the lock screen.
 * The beat states where you stand, the live lock-screen preview is the one
 * spectacle, and the switches are hairline rows under it.
 *
 * Preferences live in profiles.notification_prefs (absent key = on) and are
 * enforced server-side by every push sender; the streak guard is a LOCAL
 * notification, so its toggle + hour resync the schedule on this device
 * immediately via resyncStreakWarning.
 */

type PermState = "granted" | "denied" | "prompt" | "web";

/** One preference row: icon · label/sub · switch. The switch pops when a choice lands. */
const ToggleRow = ({
  icon: Icon,
  label,
  sub,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => {
  const [pop, setPop] = useState(false);
  return (
    <div className="flex items-center gap-3 py-3 min-h-11">
      <Icon aria-hidden size={14} className="text-muted-foreground shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold leading-tight">{label}</span>
        <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">{sub}</span>
      </span>
      <span className={cn("inline-flex", pop && "commit-pop")} onAnimationEnd={() => setPop(false)}>
        <Switch checked={checked} onCheckedChange={(v) => { setPop(true); onChange(v); }} aria-label={label} />
      </span>
    </div>
  );
};

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { profile: athlete } = useAthleteProfile();
  const pushControls = usePushControls();

  const [prefs, setPrefs] = useState<NotificationPrefs>(() =>
    getNotificationPrefs((profile as { notification_prefs?: unknown } | null)?.notification_prefs),
  );
  // Re-sync once the profile row hydrates after a cold load on this route.
  const profilePrefs = (profile as { notification_prefs?: unknown } | null)?.notification_prefs;
  useEffect(() => {
    if (profilePrefs !== undefined) setPrefs(getNotificationPrefs(profilePrefs));
  }, [profilePrefs]);

  // ── OS permission state (re-checked when returning from iOS Settings) ──
  const [perm, setPerm] = useState<PermState>(Capacitor.isNativePlatform() ? "prompt" : "web");
  const checkPerm = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    const p = await PushNotifications.checkPermissions().catch(() => null);
    if (!p) return;
    setPerm(p.receive === "granted" ? "granted" : p.receive === "denied" ? "denied" : "prompt");
  }, []);
  useEffect(() => {
    void checkPerm();
    const onVis = () => { if (document.visibilityState === "visible") void checkPerm(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [checkPerm]);

  // ── Persistence: optimistic local state, revert on failure ──
  const save = useCallback(async (next: NotificationPrefs) => {
    const prev = prefs;
    setPrefs(next);
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: { ...next } })
      .eq("user_id", user.id);
    if (error) {
      setPrefs(prev);
      toast.error("Couldn't save — check your connection and try again.");
      captureException(error, { where: "notificationPrefs.save" });
      return;
    }
    void refreshProfile();
    // The streak guard is a local notification — apply the change on-device now.
    void pushControls?.resyncStreakWarning().catch(() => undefined);
  }, [prefs, user, refreshProfile, pushControls]);

  const setCategory = (key: keyof NotificationPrefs) => (v: boolean) =>
    void save({ ...prefs, [key]: v });

  const bumpHour = (delta: number) => {
    const next = clampReminderHour(prefs.reminder_hour + delta);
    if (next === prefs.reminder_hour) return;
    void hapticImpact("light");
    void save({ ...prefs, reminder_hour: next });
  };

  // ── Live preview data ──
  const tone = athlete?.tone_pref ?? "calm_mentor";
  const previewStreak = Math.max(Number(profile?.streak) || 0, 1);
  const copy = STREAK_COPY[tone] ?? STREAK_COPY.calm_mentor;
  const previewTime = `${String(prefs.reminder_hour).padStart(2, "0")}:00`;
  // Key on the VOICE only: a re-entrance says "this changed identity". The
  // hour steppers used to remount the card per tap, restarting the 300ms
  // zoom from zero on a rapid-fire control — the time text updating is the
  // right signal for that change.
  const previewKey = tone;

  // ── The beat: where you stand, in one line ──
  const allOff = !prefs.streak_guard && !prefs.coach && !prefs.social && !prefs.tribe && !prefs.briefing && !prefs.winback;
  const beat =
    perm === "denied" ? "Notifications are off."
    : perm === "prompt" ? "Nothing reaches you yet."
    : allOff ? "Everything is silenced."
    : prefs.streak_guard ? "Reminders on."
    : "Streak guard is off.";
  const standing =
    perm === "denied" ? "iOS is blocking everything from The W Tracker. Allow it in Settings and this screen takes over from there."
    : perm === "prompt" ? "Turn them on so your streak guard and coach can actually reach you. Everything below stays in your control."
    : prefs.streak_guard ? `Your streak guard fires at ${previewTime}${perm === "granted" ? " on this device" : ""}.`
    : "Switch the streak guard on and one warning lands before midnight.";

  return (
    <div className="min-h-full">
      <PageBar title="Notification settings" onBack={() => backOr(navigate, "/profile")} />

      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <h2 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">{beat}</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">{standing}</p>
        </header>

        {/* ── The one spectacle: live lock-screen preview ── */}
        <div className="home-rise home-rise-1 mt-5">
          <div
            key={previewKey}
            // No backdrop-blur: the exact WKWebView perf risk surface-glass was
            // rewritten to avoid — an opaque tint reads the same on this bg.
            className={`mx-auto w-full max-w-[340px] rounded-[22px] border px-3.5 py-3 animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none transition-opacity ${
              prefs.streak_guard
                ? "border-white/10 bg-white/10 shadow-[0_10px_44px_-12px_hsl(var(--gold)/0.28)]"
                : "border-white/5 bg-white/5 opacity-45 grayscale"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="h-[22px] w-[22px] rounded-[6px] gradient-gold flex items-center justify-center shrink-0">
                <span className="font-display text-[12px] font-black text-primary-foreground leading-none">W</span>
              </div>
              <span className="flex-1 text-[11px] font-semibold text-foreground/55">
                The W Tracker
              </span>
              <span className="text-[11px] tabular-nums text-foreground/45">
                {prefs.streak_guard ? previewTime : "muted"}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] font-bold leading-snug">{copy.title(previewStreak)}</p>
            <p className="mt-0.5 text-[12px] text-foreground/75 leading-snug">{copy.body}</p>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground/70">
            Your streak guard, in your coach's voice — exactly as it lands.
          </p>
        </div>

        {perm === "prompt" && (
          <div className="home-rise home-rise-2 mt-4">
            <Button
              variant="ember"
              size="xl"
              className="w-full"
              onClick={() => { void pushControls?.enablePush().then(checkPerm); }}
            >
              Turn on notifications
            </Button>
          </div>
        )}
        {perm === "denied" && (
          <div className="home-rise home-rise-2 mt-4">
            <Button
              variant="ember"
              size="xl"
              className="w-full"
              onClick={() => { void AppLauncher.openUrl({ url: "app-settings:" }).catch(() => undefined); }}
            >
              Open iOS Settings
            </Button>
          </div>
        )}

        {/* ── Streak guard ── */}
        <div className="home-rise home-rise-3 mt-6">
          <p className="text-[11px] font-bold text-muted-foreground mb-1">Streak guard</p>
          <div className="divide-y divide-border/35 border-t border-border/35">
            <ToggleRow
              icon={Flame}
              label="Streak warning"
              sub="One warning before the day ends — never spam"
              checked={prefs.streak_guard}
              onChange={setCategory("streak_guard")}
            />
            <div className={cn("flex items-center gap-3 py-3 min-h-11 transition-opacity", !prefs.streak_guard && "opacity-40 pointer-events-none")}>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold leading-tight">Warning time</span>
                <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">
                  Late enough to matter, early enough to act
                </span>
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label="Earlier"
                  disabled={prefs.reminder_hour <= REMINDER_HOUR_MIN}
                  onClick={() => bumpHour(-1)}
                  className="relative h-9 w-9 rounded-xl border border-border/60 bg-background/60 flex items-center justify-center disabled:opacity-30 before:absolute before:-inset-1.5 before:content-['']"
                >
                  <Minus aria-hidden size={14} />
                </button>
                <span className="font-display text-lg font-black tabular-nums w-[52px] text-center">
                  {previewTime}
                </span>
                <button
                  type="button"
                  aria-label="Later"
                  disabled={prefs.reminder_hour >= REMINDER_HOUR_MAX}
                  onClick={() => bumpHour(1)}
                  className="relative h-9 w-9 rounded-xl border border-border/60 bg-background/60 flex items-center justify-center disabled:opacity-30 before:absolute before:-inset-1.5 before:content-['']"
                >
                  <Plus aria-hidden size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Everything else ── */}
        <div className="home-rise home-rise-4 mt-6">
          <p className="text-[11px] font-bold text-muted-foreground mb-1">From the app</p>
          <div className="divide-y divide-border/35 border-t border-border/35">
            <ToggleRow icon={Brain} label="Coach" sub="Morning cue & timely course-corrections" checked={prefs.coach} onChange={setCategory("coach")} />
            <ToggleRow icon={Users} label="Social" sub="Friends, messages & recruits" checked={prefs.social} onChange={setCategory("social")} />
            <ToggleRow icon={Swords} label="Tribe" sub="Events, battles & the tribe fire" checked={prefs.tribe} onChange={setCategory("tribe")} />
            <ToggleRow icon={BarChart3} label="Weekly briefing" sub="Your week, analyzed — Sundays" checked={prefs.briefing} onChange={setCategory("briefing")} />
            <ToggleRow icon={RotateCcw} label="Comeback nudges" sub="A hand back up if you drift away" checked={prefs.winback} onChange={setCategory("winback")} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground/80 leading-relaxed">
            Switching a category off silences its banners — everything still waits for you inside the app.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
