import { useState } from "react";
import { markUrl, type MarkFamily } from "@/lib/marks";
import { cn } from "@/lib/utils";

/**
 * One drawn mark at a fixed size. Decorative by default (the label beside it
 * carries the meaning); pass `alt` when the mark stands alone.
 *
 * `fallback` renders when the file is missing — a badge added to the DB
 * after this set was drawn still shows its emoji instead of a broken image.
 */
const Mark = ({
  family, id, size, alt = "", fallback = null, className,
}: {
  family: MarkFamily;
  id: string;
  size: number;
  alt?: string;
  fallback?: React.ReactNode;
  className?: string;
}) => {
  const [missing, setMissing] = useState(false);
  if (missing) return <>{fallback}</>;
  return (
    <img
      src={markUrl(family, id)}
      alt={alt}
      aria-hidden={alt === "" || undefined}
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      onError={() => setMissing(true)}
      className={cn("shrink-0 select-none object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
};

export default Mark;
