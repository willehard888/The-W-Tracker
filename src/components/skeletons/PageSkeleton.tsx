/**
 * Per-route skeleton primitives. Mirrors layout of real screens at fixed
 * pixel heights so the swap-to-real-content has zero layout shift.
 *
 * All skeletons use a single shared shimmer keyframe (`skeleton-sweep`)
 * already defined in index.css and used by RouteFallback.
 */

export const Block = ({
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

// Mirrors Home: opening beat (eyebrow + display line), the act, then the day's
// two facts, the standing line and the library.
//
// It had drifted badly — it still reserved 82px for a "coach whisper" removed
// long ago and put Fuel above the library where Home put it below, so the
// skeleton and the screen it stood in for had not matched for months. Blocks
// are square-cornered now because the screen is: only the check-in keeps a
// frame, and a rounded grey rectangle promises a card that never arrives.
export const HomeSkeleton = () => (
  <div className="px-4 pt-3 pb-8 animate-fade-in">
    {/* Opening beat */}
    <Block height={12} className="w-24 !rounded-md" />
    <Block height={28} delay={40} className="w-3/4 mt-2 !rounded-lg" />
    {/* The act — the one block that is still a card, because it is the button */}
    <Block height={168} delay={80} className="mt-5 !rounded-3xl" />
    {/* Fuel: the remaining number, the rail, the macro line */}
    <Block height={96} delay={140} className="mt-8 !rounded-md" />
    {/* Training: the drawing band, then the session line */}
    <Block height={104} delay={180} className="mt-8 !rounded-none -mx-4 w-auto" />
    <Block height={44} delay={210} className="mt-2 !rounded-md" />
    {/* Standing line */}
    <Block height={44} delay={240} className="mt-8 !rounded-md" />
    {/* Library: the day's thought, then three rows */}
    <Block height={64} delay={280} className="mt-10 w-11/12 !rounded-md" />
    <Block height={148} delay={320} className="mt-5 !rounded-md" />
  </div>
);

// Mirrors the nutrition diary: sub-page header, the opening line, the macro
// block, then the four meal-slot sections.
export const NutritionSkeleton = () => (
  <div className="px-4 pt-3 pb-8 animate-fade-in">
    <Block height={44} className="!rounded-xl" />
    <Block height={28} delay={40} className="w-3/4 mt-4 !rounded-lg" />
    <Block height={96} delay={80} className="mt-4" />
    {Array.from({ length: 4 }).map((_, i) => (
      <Block key={i} height={72} delay={140 + i * 40} className="mt-4" />
    ))}
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

/** Pushed screen: the 44 pt PageBar row, then a detail-shaped body. */
export const SubPageSkeleton = () => (
  <div className="animate-fade-in">
    <div className="h-11 safe-top" />
    <div className="px-4 pt-4 pb-8">
      <DetailSkeleton />
    </div>
  </div>
);

/** Settings / memory / notifications: the PageBar row, then grouped rows. */
export const SettingsSkeleton = () => (
  <div className="animate-fade-in">
    <div className="h-11 safe-top" />
    <div className="px-4 pt-4 pb-8 space-y-2">
      <Block height={12} className="w-24 !rounded-md" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Block key={i} height={56} delay={i * 40} />
      ))}
    </div>
  </div>
);

export const ListSkeleton = () => (
  <div className="px-4 pt-4 pb-8 space-y-2 animate-fade-in">
    {Array.from({ length: 7 }).map((_, i) => (
      <Block key={i} height={72} delay={i * 40} />
    ))}
  </div>
);

/** Generic detail-page data phase (hero card + rows) — drops inline where the
 *  data will render, replacing the bare centered spinner that 13 pages used. */
export const DetailSkeleton = () => (
  <div className="space-y-3 animate-fade-in pt-2">
    <Block height={180} />
    <Block height={96} delay={80} />
    <Block height={72} delay={140} />
    <Block height={72} delay={200} />
  </div>
);
