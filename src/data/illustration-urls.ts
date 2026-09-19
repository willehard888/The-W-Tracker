// Where a drawing's files live. Split out of the generated catalog so the
// player can be imported (Recovery, Library) without pulling 170 kB of
// strength movements along with three one-line URL builders.

const CDN = "https://cdn.jsdelivr.net/gh/everkinetic/data@main/dist/svg";
/** Raw SVG (14–28KB each — used only as the onError fallback). */
export const illustrationUrl = (idNum: string, state: "tension" | "relaxation"): string =>
  `${CDN}/${idNum}-${state}.svg`;

/** Rasterized WebP via the image proxy — ~4KB at thumb size with CDN edge
 *  caching, so lists paint fast instead of downloading + rasterizing a
 *  20KB vector per row. */
export const illustrationImg = (idNum: string, state: "tension" | "relaxation", width: number): string =>
  `https://images.weserv.nl/?url=${encodeURIComponent(`cdn.jsdelivr.net/gh/everkinetic/data@main/dist/svg/${idNum}-${state}.svg`)}&w=${width}&output=webp&q=80`;

/** BUNDLED 112px thumb (public/illustrations/, committed by the generator) —
 *  zero network requests, instant lists, works offline. */
export const illustrationThumb = (idNum: string): string =>
  `/illustrations/${idNum}.webp`;
