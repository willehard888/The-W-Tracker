import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * The load-failed twin of EmptyState: same silhouette, one retry. Before it
 * existed, a failed fetch rendered "nothing here yet" on twenty screens.
 * `onRetry` takes a react-query `refetch` as-is.
 */
export const ErrorState = ({
  title = "Couldn't load this",
  description = "Connection hiccup. Try again.",
  onRetry,
  size,
  className,
}: {
  title?: string;
  description?: string;
  onRetry: () => unknown;
  size?: "default" | "compact";
  className?: string;
}) => (
  <EmptyState
    icon={WifiOff}
    title={title}
    description={description}
    size={size}
    className={className}
    action={
      <Button variant="gold-outline" size="sm" className="min-h-11" onClick={() => void onRetry()}>
        Try again
      </Button>
    }
  />
);

export default ErrorState;
