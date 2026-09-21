import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom has none of these; pages construct them at mount. Kept minimal —
// nothing here changes what a component renders, only whether it can.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
if (typeof window.IntersectionObserver === "undefined") {
  Object.defineProperty(window, "IntersectionObserver", { writable: true, configurable: true, value: NoopObserver });
}
if (typeof window.ResizeObserver === "undefined") {
  Object.defineProperty(window, "ResizeObserver", { writable: true, configurable: true, value: NoopObserver });
}
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}
// jsdom logs "not implemented" through console.error for these, which the
// route smoke tests treat as a failure.
Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: () => Promise.resolve() });
Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: () => {} });
Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: () => {} });
// Same for canvas: no 2D context in jsdom. Components that draw (the tribe
// fire) already return early on a null context.
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: () => null });
