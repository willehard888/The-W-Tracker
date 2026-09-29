import * as React from "react";

import { cn } from "@/lib/utils";
import { FIELD } from "@/components/ui/input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/** The text field, taller. Same shape, same focus; no resize handle on a phone. */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return <textarea className={cn(FIELD, "min-h-24 py-3 leading-relaxed resize-none", className)} ref={ref} {...props} />;
});
Textarea.displayName = "Textarea";

export { Textarea };
