import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton-block rounded-lg bg-secondary/60", className)} {...props} />;
}

export { Skeleton };
