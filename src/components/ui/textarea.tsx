import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "surface-inset flex min-h-[80px] w-full rounded-md px-3 py-2 text-sm ring-offset-background transition-shadow duration-200 [transition-timing-function:var(--ease-soft)]",
        "placeholder:text-fg-faint",
        "focus-visible:outline-none focus-visible:border-[hsl(var(--gold)/0.45)]",
        "focus-visible:shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.5),0_0_0_1px_hsl(var(--gold)/0.35),0_0_18px_-4px_hsl(var(--gold)/0.4)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
