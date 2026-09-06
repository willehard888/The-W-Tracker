// Verified in-browser: full invert turns the white SVG background pure black
// (partial invert left a muddy brown box), sepia+saturate turns the line art
// warm gold. Tiles use a black background so the SVG's square edge is
// seamless. Lives alone so Home can use it without importing the illustrated
// catalog that ExerciseIllustration pulls in.
export const GOLD_LINES = "invert(1) sepia(0.7) saturate(3) hue-rotate(-18deg) brightness(0.9)";
