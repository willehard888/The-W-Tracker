import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "surface-inset inline-flex h-10 items-center justify-center rounded-full p-1 text-fg-muted gap-1",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
    className={cn(
      "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-1.5 text-[12px] font-semibold tracking-[-0.003em] cursor-pointer select-none",
      "transition-[background,box-shadow,color] duration-200 [transition-timing-function:var(--ease-soft)]",
      // Active — gold metal pill (matches Button gold recipe)
      "data-[state=active]:text-[hsl(var(--primary-foreground))]",
      "data-[state=active]:[background:linear-gradient(180deg,hsl(42_95%_72%)_0%,hsl(42_85%_56%)_45%,hsl(42_65%_38%)_100%)]",
      "data-[state=active]:shadow-[inset_0_0.5px_0_hsl(0_0%_100%/0.6),inset_0_-6px_14px_-6px_hsl(28_90%_35%/0.5),inset_0_-1px_0_hsl(42_50%_18%/0.5),0_1px_1px_hsl(42_60%_18%/0.4),0_4px_12px_-4px_hsl(42_78%_50%/0.4)]",
      // Inactive hover
      "hover:text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--gold)/0.55)] focus-visible:ring-offset-1 focus-visible:ring-offset-background",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--gold)/0.55)] focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
