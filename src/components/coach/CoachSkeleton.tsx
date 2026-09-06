import { Block } from "@/components/skeletons/PageSkeleton";

/**
 * Coach, both phases (lazy chunk and data): the PageBar row, the opening
 * beat and its disclaimer line, the brief hero, the plan, then quiet rows.
 * One silhouette so the chunk → data → content swaps never shift.
 */
const CoachSkeleton = () => (
  <div className="animate-fade-in">
    <div className="h-11 safe-top" />
    <div className="px-4 pt-3 pb-6">
      <Block height={28} className="w-3/4 !rounded-lg" />
      <Block height={12} delay={40} className="w-44 mt-2 !rounded-md" />
      <Block height={236} delay={80} className="mt-4 !rounded-3xl" />
      <Block height={168} delay={140} className="mt-3" />
      <Block height={96} delay={200} className="mt-3" />
      <Block height={64} delay={260} className="mt-3" />
    </div>
  </div>
);

export default CoachSkeleton;
