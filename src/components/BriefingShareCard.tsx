import { forwardRef } from "react";
import { Flame, Trophy, Sparkles } from "lucide-react";

interface BriefingShareCardProps {
  username: string;
  weekRange: string; // e.g. "Apr 13 – Apr 19"
  headline: string;
  totalXp: number;
  perfectDays: number;
  workouts: number;
  daysCheckedIn: number;
}

/**
 * 3:4 share card (1080 × 1440 logical px) for IG stories.
 * Rendered offscreen, then captured to PNG by the parent.
 */
const BriefingShareCard = forwardRef<HTMLDivElement, BriefingShareCardProps>(
  ({ username, weekRange, headline, totalXp, perfectDays, workouts, daysCheckedIn }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1440,
          background:
            "linear-gradient(180deg, hsl(0 0% 4%) 0%, hsl(42 30% 8%) 50%, hsl(0 0% 4%) 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 80,
          color: "white",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gold ambient glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: "50%",
            transform: "translateX(-50%)",
            width: 1200,
            height: 800,
            background:
              "radial-gradient(ellipse at center, hsl(42 78% 54% / 0.35) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        {/* Header */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontSize: 28,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "hsl(42 78% 54%)",
              fontWeight: 800,
              marginBottom: 16,
            }}
          >
            Weekly Briefing
          </div>
          <div style={{ fontSize: 36, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
            @{username} · {weekRange}
          </div>
        </div>

        {/* Headline */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              background:
                "linear-gradient(180deg, hsl(42 90% 70%) 0%, hsl(42 78% 54%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            "{headline}"
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          <Stat icon="xp" label="Week XP" value={totalXp.toLocaleString()} />
          <Stat icon="perfect" label="Perfect Days" value={`${perfectDays}/7`} />
          <Stat icon="workout" label="Workouts" value={`${workouts}/7`} />
          <Stat icon="checkin" label="Check-ins" value={`${daysCheckedIn}/7`} />
        </div>

        {/* Footer */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              background:
                "linear-gradient(180deg, hsl(42 90% 70%) 0%, hsl(42 78% 54%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            W
          </div>
          <div
            style={{
              fontSize: 26,
              color: "rgba(255,255,255,0.55)",
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            thewtracker.com
          </div>
        </div>
      </div>
    );
  },
);

BriefingShareCard.displayName = "BriefingShareCard";

const Stat = ({
  icon,
  label,
  value,
}: {
  icon: "xp" | "perfect" | "workout" | "checkin";
  label: string;
  value: string;
}) => (
  <div
    style={{
      background: "rgba(255,255,255,0.05)",
      border: "2px solid hsl(42 78% 54% / 0.25)",
      borderRadius: 24,
      padding: 32,
    }}
  >
    <div
      style={{
        fontSize: 22,
        textTransform: "uppercase",
        letterSpacing: 3,
        color: "rgba(255,255,255,0.55)",
        fontWeight: 700,
        marginBottom: 12,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 72,
        fontWeight: 900,
        color: "hsl(42 90% 70%)",
        lineHeight: 1,
      }}
    >
      {value}
    </div>
  </div>
);

export default BriefingShareCard;
