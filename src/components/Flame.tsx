import StylizedStreakFlame from "@/components/home/StylizedStreakFlame";
import { cn } from "@/lib/utils";
import type { StatusTier } from "@/lib/status-tiers";

type StatusInput = number | StatusTier | string;

interface FlameProps {
  /**
   * Either a 0..1 number (overall "status health") or a tier string.
   * Higher = bigger, more stable. Lower = smaller, more flickering.
   */
  status: StatusInput;
  /** Pixel size of the flame container. */
  size?: number;
  /** Optional override label for screen readers. */
  label?: string;
  className?: string;
}

// Map tier strings to a "streak-equivalent" so the new stylized flame
// shows the appropriate stage (1..200+ days).
const TIER_TO_STREAK: Record<string, number> = {
  recruit: 2,
  normal: 2,
  operator: 7,
  performer: 14,
  high_performer: 30,
  elite: 60,
  apex: 120,
  legend: 220,
};

const resolveStreak = (input: StatusInput): number => {
  if (typeof input === "number") {
    if (Number.isNaN(input)) return 2;
    // 0..1 → ~0..220 days, with a soft curve so weak status still shows fire
    const clamped = Math.max(0, Math.min(1, input));
    return Math.round(Math.pow(clamped, 0.85) * 220);
  }
  return TIER_TO_STREAK[input] ?? 2;
};

/**
 * <Flame /> — now powered by the new StylizedStreakFlame engine for a
 * unified app-wide flame look. Status / tier is mapped to an effective
 * streak so the appropriate stage and ferocity is rendered.
 */
const Flame = ({ status, size = 28, label, className }: FlameProps) => {
  const streak = resolveStreak(status);
  return (
    <span
      className={cn("relative inline-block align-middle pointer-events-none select-none", className)}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <StylizedStreakFlame streak={streak} size={size} />
    </span>
  );
};

export default Flame;
