import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Flame, Brain, Users, Swords, BarChart3, RotateCcw,
  Minus, Plus, BellOff, BellRing,
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

/**
 * /settings/notifications — full control over what reaches the lock screen.
 *
 * Preferences live in profiles.notification_prefs (absent key = on) and are
 * enforced server-side by every push sender; the streak guard is a LOCAL
 * notification, so its toggle + hour resync the schedule on this device
 * immediately via resyncStreakWarning.
 */

type PermState = "granted" | "denied" | "prompt" | "web";

/** One preference row: icon · label/sub · switch. */
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
}) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <Icon aria-hidden size={14} className="text-muted-foreground shrink-0" />
    <span className="flex-1 min-w-0">
      <span className="block text-[13px] font-semibold">{label}</span>
      <span className="block text-[11px] text-muted-foreground mt-0.5">{sub}</span>
    </span>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
  </div>
);

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

  return (
    <div className="min-h-full">
      <PageBar title="Notification settings" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6 space-y-5">

        {/* ── Delivery status ── */}
        {perm === "granted" && (
          <div className="home-rise surface-card surface-card-quiet px-4 py-3 flex items-center gap-3">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-xp-green opacity-60 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-xp-green" />
            </span>
            <p className="eyebrow text-xp-green/90">
              Delivering to this device
            </p>
          </div>
        )}
        {perm === "prompt" && (
          <div className="home-rise surface-card p-4 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl gradient-gold glow-gold-sm flex items-center justify-center mb-3">
              <BellRing aria-hidden size={22} strokeWidth={2.2} className="text-primary-foreground" />
            </div>
            <p className="font-display text-base font-black tracking-tight">Nothing reaches you yet</p>
            <p className="mx-auto mt-1 max-w-[280px] text-[12px] text-muted-foreground leading-relaxed">
              Turn on notifications so your streak guard and coach can actually reach you. Everything below stays in your control.
            </p>
            <Button
              variant="ember"
              className="mt-3 w-full"
              onClick={() => { void pushControls?.enablePush().then(checkPerm); }}
            >
              Turn on notifications
            </Button>
          </div>
        )}
        {perm === "denied" && (
          <div className="home-rise surface-card p-4 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-center mb-3">
              <BellOff aria-hidden size={22} strokeWidth={2.2} className="text-muted-foreground" />
            </div>
            <p className="font-display text-base font-black tracking-tight">Switched off in iOS Settings</p>
            <p className="mx-auto mt-1 max-w-[280px] text-[12px] text-muted-foreground leading-relaxed">
              iOS is blocking everything from The W Tracker. Allow notifications there and this screen takes over from that point.
            </p>
            <Button
              variant="gold-outline"
              className="mt-3 w-full"
              onClick={() => { void AppLauncher.openUrl({ url: "app-settings:" }).catch(() => undefined); }}
            >
              Open iOS Settings
            </Button>
          </div>
        )}

        {/* ── The one spectacle: live lock-screen preview ── */}
        <div className="home-rise home-rise-1">
          <p className="eyebrow px-1 mb-1.5">Preview</p>
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
              <span className="eyebrow-sm flex-1 text-foreground/55">
                The W Tracker
              </span>
              <span className="text-[11px] tabular-nums text-foreground/45">
                {prefs.streak_guard ? previewTime : "muted"}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] font-bold leading-snug">{copy.title(previewStreak)}</p>
            <p className="mt-0.5 text-[12px] text-foreground/75 leading-snug">{copy.body}</p>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/70">
            Your streak guard, in your coach's voice — exactly as it lands.
          </p>
        </div>

        {/* ── Streak guard ── */}
        <div className="home-rise home-rise-2">
          <p className="eyebrow px-1 mb-1.5">Streak guard</p>
          <div className="surface-card overflow-hidden divide-y divide-border/30">
            <ToggleRow
              icon={Flame}
              label="Streak warning"
              sub="One warning before the day ends — never spam"
              checked={prefs.streak_guard}
              onChange={setCategory("streak_guard")}
            />
            <div className={`flex items-center gap-3 px-4 py-3 transition-opacity ${prefs.streak_guard ? "" : "opacity-40 pointer-events-none"}`}>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold">Warning time</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  Late enough to matter, early enough to act
                </span>
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label="Earlier"
                  disabled={prefs.reminder_hour <= REMINDER_HOUR_MIN}
                  onClick={() => bumpHour(-1)}
                  className="press relative h-9 w-9 rounded-xl border border-border/60 bg-background/60 flex items-center justify-center transition-transform disabled:opacity-30 before:absolute before:-inset-1.5 before:content-['']"
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
                  className="press relative h-9 w-9 rounded-xl border border-border/60 bg-background/60 flex items-center justify-center transition-transform disabled:opacity-30 before:absolute before:-inset-1.5 before:content-['']"
                >
                  <Plus aria-hidden size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Everything else ── */}
        <div className="home-rise home-rise-3">
          <p className="eyebrow px-1 mb-1.5">From the app</p>
          <div className="surface-card overflow-hidden divide-y divide-border/30">
            <ToggleRow icon={Brain} label="Coach" sub="Morning cue & timely course-corrections" checked={prefs.coach} onChange={setCategory("coach")} />
            <ToggleRow icon={Users} label="Social" sub="Friends, messages & recruits" checked={prefs.social} onChange={setCategory("social")} />
            <ToggleRow icon={Swords} label="Tribe" sub="Events, battles & the tribe fire" checked={prefs.tribe} onChange={setCategory("tribe")} />
            <ToggleRow icon={BarChart3} label="Weekly briefing" sub="Your week, analyzed — Sundays" checked={prefs.briefing} onChange={setCategory("briefing")} />
            <ToggleRow icon={RotateCcw} label="Comeback nudges" sub="A hand back up if you drift away" checked={prefs.winback} onChange={setCategory("winback")} />
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground/80 leading-relaxed">
            Switching a category off silences its banners — everything still waits for you inside the app.
          </p>
        </div>

      </div>
    </div>
  );
};

export default NotificationSettings;
