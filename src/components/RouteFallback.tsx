/**
 * Premium brand-aligned route fallback.
 *
 * Replaces the generic spinner with a layered skeleton that mirrors the app
 * shell (header strip + content blocks) so the user sees suggested structure
 * instead of a blank screen. Tinted with the gold shimmer sweep used across
 * the rest of the app for a cohesive premium feel.
 *
 * min-h-[100dvh] matches AppRoutes container so vertical centering survives
 * the iOS URL-bar wobble that min-h-screen causes.
 */
const SkeletonBlock = ({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) => (
  <div
    className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-card/60 via-card/40 to-card/30 border border-border/30 ${className ?? ""}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div
      className="absolute inset-0 -translate-x-full animate-[skeleton-sweep_1.6s_ease-in-out_infinite]"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, hsl(var(--gold) / 0.10) 45%, hsl(var(--gold) / 0.18) 50%, hsl(var(--gold) / 0.10) 55%, transparent 100%)",
        animationDelay: `${delay}ms`,
      }}
    />
  </div>
);

const RouteFallback = () => (
  <div className="min-h-[100dvh] w-full px-4 pt-6 pb-24 animate-fade-in">
    {/* Top accent — matches premium frame */}
    <div className="mx-auto mb-6 h-px w-32 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

    {/* Hero skeleton */}
    <SkeletonBlock className="h-32 w-full mb-4" />

    {/* Stat cards row */}
    <div className="grid grid-cols-3 gap-2 mb-4">
      <SkeletonBlock className="h-20" delay={80} />
      <SkeletonBlock className="h-20" delay={140} />
      <SkeletonBlock className="h-20" delay={200} />
    </div>

    {/* Content blocks */}
    <SkeletonBlock className="h-24 w-full mb-3" delay={260} />
    <SkeletonBlock className="h-24 w-full mb-3" delay={320} />
    <SkeletonBlock className="h-24 w-full" delay={380} />
  </div>
);

export default RouteFallback;
