import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

/** The field label's voice — the same string three forms used to declare by hand. */
export const FIELD_LABEL = "text-label font-bold text-muted-foreground";

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(FIELD_LABEL, "block leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

/**
 * The line under a field that failed: one voice (destructive, the label
 * size, bold), announced to screen readers. Nine forms wrote it in ember or
 * destructive, label or meta, bold or not.
 */
export const FieldError = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p role="alert" className={cn("mt-1.5 text-label font-bold text-destructive leading-snug", className)}>
    {children}
  </p>
);

export { Label };
