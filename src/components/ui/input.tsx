import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input/80 bg-background/40 px-3 py-2 text-base ring-offset-background transition-shadow duration-200 [transition-timing-function:var(--ease-soft)]",
          "shadow-[inset_0_1px_0_hsl(0_0%_0%/0.35),inset_0_-1px_0_hsl(0_0%_100%/0.04)]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:border-gold/45",
          "focus-visible:shadow-[inset_0_1px_0_hsl(0_0%_0%/0.4),0_0_0_1px_hsl(var(--gold)/0.35),0_0_18px_-4px_hsl(var(--gold)/0.4)]",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
