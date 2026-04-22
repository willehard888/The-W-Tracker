import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-[18px] w-[18px] shrink-0 rounded-[5px] border border-[hsl(var(--border-strong))] transition-[background,box-shadow,border-color] duration-150",
      "[background:linear-gradient(180deg,hsl(258_18%_4%)_0%,hsl(258_16%_6%)_100%)]",
      "shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.45)]",
      "data-[state=checked]:border-[hsl(var(--gold-soft)/0.7)]",
      "data-[state=checked]:[background:linear-gradient(180deg,hsl(42_85%_56%)_0%,hsl(42_65%_38%)_100%)]",
      "data-[state=checked]:text-[hsl(var(--primary-foreground))]",
      "data-[state=checked]:shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.55),inset_0_-1px_0_hsl(42_50%_18%/0.55),0_0_10px_-2px_hsl(var(--gold)/0.4)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--gold)/0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
