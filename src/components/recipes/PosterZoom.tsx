import { useRef } from "react";
import { X, Minus, Plus } from "lucide-react";
import ZoomableImage, { type ZoomableImageHandle } from "@/components/ui/ZoomableImage";

/**
 * Full-screen poster viewer. The zoom/pan/double-tap/swipe-dismiss gesture
 * engine lives in the shared ZoomableImage; this just adds the recipe-specific
 * chrome (always-reachable close + +/−/Fit buttons for reading small text).
 */
const PosterZoom = ({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) => {
  const z = useRef<ZoomableImageHandle>(null);
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
        <button onClick={() => z.current?.zoomBy(-0.6)} aria-label="Zoom out" className={btn}><Minus size={18} /></button>
        <button onClick={() => z.current?.reset()} className="h-11 px-5 rounded-full bg-white/12 border border-white/20 text-white text-[12px] font-bold active:scale-95 transition-transform">Fit</button>
        <button onClick={() => z.current?.zoomBy(0.6)} aria-label="Zoom in" className={btn}><Plus size={18} /></button>
      </div>

      <ZoomableImage ref={z} url={url} alt={alt} onClose={onClose} imgClassName="w-full max-w-none" />
    </div>
  );
};

export default PosterZoom;
