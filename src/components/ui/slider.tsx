import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="surface-inset relative h-2 w-full grow overflow-hidden rounded-full">
      <SliderPrimitive.Range
        className="absolute h-full"
        style={{
          background:
            "linear-gradient(180deg, hsl(42 88% 62%) 0%, hsl(42 78% 54%) 55%, hsl(42 64% 42%) 100%)",
          boxShadow:
            "inset 0 0.5px 0 hsl(0 0% 100% / 0.5), 0 0 12px hsl(var(--gold) / 0.3)",
        }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        "block h-5 w-5 rounded-full transition-[transform,box-shadow] duration-150",
        "[background:radial-gradient(circle_at_30%_28%,hsl(42_95%_82%)_0%,hsl(42_78%_54%)_55%,hsl(42_60%_36%)_100%)]",
        "shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.6),0_2px_4px_hsl(0_0%_0%/0.45),0_0_12px_-2px_hsl(var(--gold)/0.45)]",
        "ring-1 ring-[hsl(0_0%_0%/0.4)] hover:scale-110 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--gold)/0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
