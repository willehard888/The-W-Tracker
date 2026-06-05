import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      // Inner highlight + outer contact shadow for unified lift
      "ring-1 ring-white/8 shadow-[0_0_0_1px_hsl(0_0%_0%/0.4),0_2px_6px_-2px_hsl(0_0%_0%/0.45)]",
      className,
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, loading = "lazy", decoding = "async", ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn(
      "aspect-square h-full w-full",
      // Fade in on decode so a cached/fast image never hard-cuts in.
      "opacity-0 transition-opacity duration-200 data-[loaded=true]:opacity-100",
      className,
    )}
    loading={loading}
    decoding={decoding}
    onLoad={(e) => { (e.currentTarget as HTMLImageElement).dataset.loaded = "true"; }}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    // Brief delay so a cached image swaps straight in without flashing the
    // initials placeholder first (kills list-scroll avatar flicker).
    delayMs={props.delayMs ?? 120}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full text-xs font-semibold text-fg-muted",
      "[background:linear-gradient(180deg,hsl(258_16%_12%)_0%,hsl(258_16%_7%)_100%)]",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
