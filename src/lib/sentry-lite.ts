// Only what observability.ts uses. Importing @sentry/react directly (even
// destructured) kept the whole SDK in the chunk; a re-export module gives
// rollup a three-export entry to tree-shake from.
export { init, captureException, setUser } from "@sentry/react";
