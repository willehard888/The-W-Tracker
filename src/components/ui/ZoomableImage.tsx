import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MIN = 1;
const MAX = 4;

export interface ZoomableImageHandle {
  zoomBy: (delta: number) => void;
  reset: () => void;
}

interface ZoomableImageProps {
  url: string;
  alt?: string;
  /** Fired on Escape and when a downward swipe (at fit scale) passes threshold. */
  onClose: () => void;
  /** 0→1 while the user swipes down to dismiss — lets the parent fade chrome/backdrop. */
  onDismissProgress?: (ratio: number) => void;
  className?: string;
  imgClassName?: string;
}

/**
 * Apple-Photos-grade image stage: pinch-zoom, double-tap toggle, pan when
 * zoomed, and swipe-down-to-dismiss when at fit scale. Native viewport pinch is
 * disabled (touch-action:none) so the WebView can't hijack the gesture and
 * strand the user. Extracted from PosterZoom so recipes + the post lightbox
 * share one proven implementation. Exposes zoomBy/reset for +/−/Fit buttons.
 */
const ZoomableImage = forwardRef<ZoomableImageHandle, ZoomableImageProps>(
  ({ url, alt = "", onClose, onDismissProgress, className, imgClassName }, ref) => {
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [dragY, setDragY] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const g = useRef({
      mode: null as null | "pinch" | "pan" | "dismiss",
      startDist: 0, startScale: 1,
      startX: 0, startY: 0, baseX: 0, baseY: 0,
      lastTap: 0,
    });

    const clamp = (s: number) => Math.min(MAX, Math.max(MIN, s));
    const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };
    const zoomBy = (d: number) => setScale((s) => { const n = clamp(s + d); if (n <= 1) setPos({ x: 0, y: 0 }); return n; });

    useImperativeHandle(ref, () => ({ zoomBy, reset }), []);

    useEffect(() => {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", onKey);
      return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
    }, [onClose]);

    const onTouchStart = (e: React.TouchEvent) => {
      const c = g.current;
      if (e.touches.length === 2) {
        c.mode = "pinch";
        c.startDist = dist(e.touches);
        c.startScale = scale;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - c.lastTap < 280) {
          // double-tap → toggle between fit and 2.5×
          if (scale > 1) reset(); else setScale(2.5);
          c.lastTap = 0;
          c.mode = null;
          return;
        }
        c.lastTap = now;
        if (scale > 1) {
          c.mode = "pan";
          c.startX = e.touches[0].clientX;
          c.startY = e.touches[0].clientY;
          c.baseX = pos.x;
          c.baseY = pos.y;
        } else {
          // at fit scale, a single-finger drag is a swipe-to-dismiss
          c.mode = "dismiss";
          c.startY = e.touches[0].clientY;
        }
      }
    };

    const onTouchMove = (e: React.TouchEvent) => {
      const c = g.current;
      if (c.mode === "pinch" && e.touches.length === 2) {
        setScale(clamp(c.startScale * (dist(e.touches) / c.startDist)));
      } else if (c.mode === "pan" && e.touches.length === 1 && scale > 1) {
        setPos({ x: c.baseX + (e.touches[0].clientX - c.startX), y: c.baseY + (e.touches[0].clientY - c.startY) });
      } else if (c.mode === "dismiss" && e.touches.length === 1) {
        const dy = Math.max(0, e.touches[0].clientY - c.startY); // downward only
        setDragY(dy);
        onDismissProgress?.(Math.min(1, dy / 240));
      }
    };

    const onTouchEnd = (e: React.TouchEvent) => {
      const c = g.current;
      if (e.touches.length === 0) {
        if (c.mode === "dismiss") {
          if (dragY > 110) { onClose(); return; }
          setDragY(0);
          onDismissProgress?.(0);
        }
        c.mode = null;
        if (scale <= 1) setPos({ x: 0, y: 0 });
      }
    };

    const dismissRatio = Math.min(1, dragY / 240);

    return (
      <div
        className={cn("absolute inset-0 flex items-center justify-center overflow-hidden", className)}
        style={{ touchAction: "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={url}
          alt={alt}
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={cn("select-none", imgClassName)}
          style={{
            transform: `translate3d(${pos.x}px, ${pos.y + dragY}px, 0) scale(${scale * (1 - dismissRatio * 0.12)})`,
            transformOrigin: "center center",
            transition: g.current.mode ? "none" : "transform 0.2s ease-out, opacity 0.3s ease-out",
            opacity: loaded ? 1 - dismissRatio * 0.35 : 0,
          }}
        />
      </div>
    );
  },
);

ZoomableImage.displayName = "ZoomableImage";
export default ZoomableImage;
