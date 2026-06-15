import { useEffect, useRef, useState } from "react";
import { X, Minus, Plus } from "lucide-react";

const MIN = 1;
const MAX = 4;

/**
 * Full-screen poster viewer with reliable controls.
 * - Pinch, double-tap, and +/− buttons to zoom (read small poster text).
 * - Drag to pan when zoomed.
 * - Close button is `fixed` + always on top, so you can ALWAYS exit even when
 *   zoomed/panned. Native viewport pinch is disabled (touch-action: none) so
 *   the webview can't hijack the gesture and strand you.
 */
const PosterZoom = ({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const g = useRef({
    mode: null as null | "pinch" | "pan",
    startDist: 0, startScale: 1,
    startX: 0, startY: 0, baseX: 0, baseY: 0,
    lastTap: 0,
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const clamp = (s: number) => Math.min(MAX, Math.max(MIN, s));
  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };
  const zoomBy = (d: number) => setScale((s) => { const n = clamp(s + d); if (n <= 1) setPos({ x: 0, y: 0 }); return n; });

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
      c.mode = "pan";
      c.startX = e.touches[0].clientX;
      c.startY = e.touches[0].clientY;
      c.baseX = pos.x;
      c.baseY = pos.y;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const c = g.current;
    if (c.mode === "pinch" && e.touches.length === 2) {
      setScale(clamp(c.startScale * (dist(e.touches) / c.startDist)));
    } else if (c.mode === "pan" && e.touches.length === 1 && scale > 1) {
      setPos({ x: c.baseX + (e.touches[0].clientX - c.startX), y: c.baseY + (e.touches[0].clientY - c.startY) });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      g.current.mode = null;
      if (scale <= 1) setPos({ x: 0, y: 0 });
    }
  };

  const btn = "h-11 w-11 rounded-full bg-white/12 border border-white/20 flex items-center justify-center text-white active:scale-95 transition-transform";

  return (
    <div className="fixed inset-0 z-[140] bg-black">
      {/* Close — fixed, top layer, ALWAYS reachable */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="fixed top-[calc(env(safe-area-inset-top)+12px)] right-4 z-20 h-11 w-11 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white active:scale-95"
      >
        <X size={22} />
      </button>

      {/* Zoom controls — fixed bottom */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
        <button onClick={() => zoomBy(-0.6)} aria-label="Zoom out" className={btn}><Minus size={18} /></button>
        <button onClick={reset} className="h-11 px-5 rounded-full bg-white/12 border border-white/20 text-white text-[12px] font-bold active:scale-95 transition-transform">Fit</button>
        <button onClick={() => zoomBy(0.6)} aria-label="Zoom in" className={btn}><Plus size={18} /></button>
      </div>

      {/* Stage */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ touchAction: "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={url}
          alt={alt}
          draggable={false}
          className="w-full max-w-none select-none"
          style={{
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale})`,
            transformOrigin: "center center",
            transition: g.current.mode ? "none" : "transform 0.18s ease-out",
          }}
        />
      </div>
    </div>
  );
};

export default PosterZoom;
