import { Block } from "@/components/skeletons/PageSkeleton";

/**
 * The runner's silhouette for both phases (lazy chunk and data): the PageBar
 * row, the progress hairline, the beat, the rep player, then three set rows.
 * One shape, so chunk → data → content never shifts under a loaded bar.
 */
const SessionSkeleton = () => (
  <div className="animate-fade-in">
    <div className="h-11 safe-top" />
    <div className="h-1 bg-border/40" />
    <div className="px-4 pt-4">
      <Block height={12} className="w-28 !rounded-md" />
      <Block height={26} delay={40} className="w-2/3 mt-2 !rounded-lg" />
      <Block height={220} delay={80} className="mt-4 !rounded-2xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Block key={i} height={56} delay={140 + i * 40} className="mt-2" />
      ))}
    </div>
  </div>
);

export default SessionSkeleton;
