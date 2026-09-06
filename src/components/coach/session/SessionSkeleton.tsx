import { Block } from "@/components/skeletons/PageSkeleton";

/**
 * The runner's silhouette for both phases (lazy chunk and data): the PageBar
 * row, the progress hairline, the beat (position line, display name,
 * prescription), the rep player, the coaching whisper, then the sets — one
 * open row and two folded ones. One shape, so chunk → data → content never
 * shifts under a loaded bar.
 */
const SessionSkeleton = () => (
  <div className="animate-fade-in">
    {/* Same padding rules as PageBar, so the bar lands where the skeleton was. */}
    <div className="safe-top pt-3 pb-2"><div className="h-10" /></div>
    <div className="h-1 bg-border/40" />
    <div className="px-4 pt-4">
      <Block height={13} className="w-40 !rounded-md" />
      <Block height={28} delay={40} className="w-3/4 mt-2 !rounded-lg" />
      <Block height={13} delay={70} className="w-28 mt-2 !rounded-md" />
      <Block height={226} delay={110} className="mt-4 !rounded-2xl" />
      <Block height={40} delay={150} className="mt-3" />
      <Block height={11} delay={190} className="w-10 mt-5 !rounded-md" />
      <Block height={100} delay={230} className="mt-2 !rounded-2xl" />
      <Block height={48} delay={270} className="mt-1" />
      <Block height={48} delay={310} className="mt-1" />
    </div>
  </div>
);

export default SessionSkeleton;
