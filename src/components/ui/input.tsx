import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "surface-inset flex h-10 w-full rounded-md px-3 py-2 text-base ring-offset-background transition-shadow duration-200 [transition-timing-function:var(--ease-soft)]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-fg-faint",
          "focus-visible:outline-none focus-visible:border-[hsl(var(--gold)/0.45)]",
          "focus-visible:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.5),0_0_0_1px_hsl(var(--gold)/0.35),0_0_18px_-4px_hsl(var(--gold)/0.4)]",
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
