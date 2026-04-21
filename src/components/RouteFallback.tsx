/**
 * Lightweight, brand-consistent fallback used by React.lazy + Suspense
 * on route changes. Uses min-h-[100dvh] (matches AppRoutes container) so
 * the spinner stays vertically centred on iOS without the URL bar wobble
 * that min-h-screen causes.
 */
const RouteFallback = () => (
  <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 animate-reveal">
    <div className="relative h-10 w-10">
      <div className="absolute inset-0 rounded-full border-2 border-gold/15" />
      <div className="absolute inset-0 rounded-full border-2 border-gold border-t-transparent animate-spin" />
    </div>
    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 font-semibold">
      Loading
    </p>
  </div>
);

export default RouteFallback;
