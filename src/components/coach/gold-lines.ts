// Verified in-browser: full invert turns the white SVG background pure black
// (partial invert left a muddy brown box), sepia+saturate turns the line art
// warm gold. Tiles use a black background so the SVG's square edge is
// seamless. Lives alone so Home can use it without importing the illustrated
// catalog that ExerciseIllustration pulls in.
/**
 * The same treatment baked into a copy of every bundled thumbnail
 * (public/illustrations/gold, 268 files, 0.8 MB, made once with the filter's
 * own math). A list row shows a plain image; the five-stage CSS filter was a
 * separate non-composited repaint per visible thumbnail in WKWebView. The
 * animated frames still use GOLD_LINES: they are vectors fetched on demand.
 */
export const goldThumb = (idNum: string): string => `/illustrations/gold/${idNum}.webp`;

export const GOLD_LINES = "invert(1) sepia(0.7) saturate(3) hue-rotate(-18deg) brightness(0.9)";
