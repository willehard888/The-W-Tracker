import { Block } from "@/components/skeletons/PageSkeleton";

/**
 * Check-in, data phase: the PageBar row, the opening beat, the two core
 * blocks (sleep, workout), then four habit rows. The built screen's own
 * silhouette, so the swap to real content is still.
 */
const CheckinSkeleton = () => (
  <div className="animate-fade-in">
    <div className="h-11 safe-top" />
    <div className="px-4 pt-3 pb-8">
      <Block height={28} className="w-3/4 !rounded-lg" />
      <Block height={116} delay={60} className="mt-5" />
      <Block height={116} delay={100} className="mt-3" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Block key={i} height={66} delay={160 + i * 40} className="mt-3" />
      ))}
    </div>
  </div>
);

export default CheckinSkeleton;
