/**
 * Per-route skeleton primitives. Mirrors layout of real screens at fixed
 * pixel heights so the swap-to-real-content has zero layout shift.
 *
 * All skeletons use a single shared shimmer keyframe (`skeleton-sweep`)
 * already defined in index.css and used by RouteFallback.
 */

const Block = ({
  className = "",
  delay = 0,
  height,
}: {
  className?: string;
  delay?: number;
  height?: string | number;
}) => (
  <div
    className={`relative overflow-hidden rounded-xl bg-card/40 border border-border/30 ${className}`}
    style={{
      height: typeof height === "number" ? `${height}px` : height,
      animationDelay: `${delay}ms`,
    }}
  >
    <div
      className="absolute inset-0 -translate-x-full animate-[skeleton-sweep_1.6s_ease-in-out_infinite]"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, hsl(var(--gold) / 0.08) 45%, hsl(var(--gold) / 0.14) 50%, hsl(var(--gold) / 0.08) 55%, transparent 100%)",
        animationDelay: `${delay}ms`,
      }}
    />
  </div>
);

export const HomeSkeleton = () => (
  <div className="px-4 pt-4 pb-8 space-y-3 animate-fade-in">
    <Block height={172} />
    <div className="grid grid-cols-3 gap-2">
      <Block height={84} delay={60} />
      <Block height={84} delay={100} />
      <Block height={84} delay={140} />
    </div>
    <Block height={120} delay={180} />
    <Block height={96} delay={220} />
    <Block height={96} delay={260} />
  </div>
);

export const LeaderboardSkeleton = () => (
  <div className="px-4 pt-4 pb-8 space-y-2 animate-fade-in">
    <Block height={48} />
    <Block height={132} delay={60} />
    {Array.from({ length: 8 }).map((_, i) => (
      <Block key={i} height={64} delay={120 + i * 30} />
    ))}
  </div>
);

export const ProfileSkeleton = () => (
  <div className="px-4 pt-4 pb-8 space-y-3 animate-fade-in">
    <Block height={144} />
    <div className="grid grid-cols-2 gap-2">
      <Block height={88} delay={60} />
      <Block height={88} delay={100} />
    </div>
    <Block height={120} delay={160} />
    <Block height={200} delay={220} />
  </div>
);

export const FeedSkeleton = () => (
  <div className="px-4 pt-4 pb-8 space-y-3 animate-fade-in">
    <Block height={56} />
    <Block height={320} delay={80} />
    <Block height={320} delay={160} />
  </div>
);

export const CheckinSkeleton = () => (
  <div className="px-4 pt-4 pb-8 space-y-3 animate-fade-in">
    <Block height={120} />
    <Block height={220} delay={80} />
    <Block height={140} delay={160} />
  </div>
);

/** Data-phase skeleton for board-style lists (podium + rows) — no page
 *  padding, drops inline where the data will render. */
export const BoardRowsSkeleton = () => (
  <div className="space-y-2 animate-fade-in">
    <Block height={132} />
    {Array.from({ length: 6 }).map((_, i) => (
      <Block key={i} height={64} delay={60 + i * 30} />
    ))}
  </div>
);

/** Coach page skeleton — hero strip + plan card + chat CTA (the previous
 *  Profile-shaped fallback caused a visible layout jump on every open). */
export const CoachSkeleton = () => (
  <div className="px-4 pt-4 pb-8 space-y-3 animate-fade-in">
    <Block height={96} />
    <Block height={200} delay={80} />
    <Block height={72} delay={160} />
    <Block height={120} delay={220} />
  </div>
);

export const ListSkeleton = () => (
  <div className="px-4 pt-4 pb-8 space-y-2 animate-fade-in">
    {Array.from({ length: 7 }).map((_, i) => (
      <Block key={i} height={72} delay={i * 40} />
    ))}
  </div>
);
