import { cn } from "@/lib/utils";

interface Props {
  pullDistance: number;
  isRefreshing: boolean;
  threshold: number;
}

const PullRefreshIndicator = ({ pullDistance, isRefreshing, threshold }: Props) => {
  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-all duration-300"
      style={{ height: pullDistance > 0 ? pullDistance : 0 }}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full border-2 border-gold border-t-transparent",
          isRefreshing && "animate-spin"
        )}
        style={{
          opacity: Math.min(pullDistance / threshold, 1),
          transform: `rotate(${pullDistance * 3}deg) scale(${Math.min(pullDistance / threshold, 1)})`,
        }}
      />
    </div>
  );
};

export default PullRefreshIndicator;
