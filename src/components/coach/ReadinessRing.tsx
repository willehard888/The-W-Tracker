import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  score: number; // 0..100
  size?: number;
  label?: string;
  className?: string;
}

const tone = (s: number) => {
  if (s >= 80) return { ring: "hsl(152 68% 55%)", bg: "hsl(152 68% 50% / 0.15)", text: "text-xp-green" };
  if (s >= 60) return { ring: "hsl(var(--gold))", bg: "hsl(var(--gold) / 0.15)", text: "text-gold" };
  if (s >= 40) return { ring: "hsl(28 90% 60%)", bg: "hsl(28 90% 55% / 0.15)", text: "text-amber" };
  return { ring: "hsl(0 78% 60%)", bg: "hsl(0 78% 55% / 0.15)", text: "text-rose" };
};

const ReadinessRing = ({ score, size = 56, label, className }: Props) => {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const t = tone(clamped);

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--border))"
            strokeOpacity={0.4}
            strokeWidth={stroke}
            fill="none"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={t.ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${t.ring})` }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-display font-black"
          style={{ fontSize: size * 0.34, color: t.ring }}
        >
          {clamped}
        </div>
      </div>
      {label && (
        <div className="leading-tight">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
            Readiness
          </p>
          <p className={cn("text-[11px] font-bold", t.text)}>{label}</p>
        </div>
      )}
    </div>
  );
};

export default ReadinessRing;
