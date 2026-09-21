// Mount one page the way the app does — real route pattern, so `useParams`
// and `useSearchParams` see what they would see — without the app's shell.
//
// No ErrorBoundary on purpose: a page that throws while mounting must fail
// the test, not be swallowed into a fallback. No Toaster, no onboarding
// provider: every consumer of those is null-safe, and mounting them would
// only add their own effects to what is being measured.
import { Suspense, type ComponentType } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const mountRoute = (pattern: string, path: string, Page: ComponentType) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Suspense fallback={null}>
          <Routes>
            <Route path={pattern} element={<Page />} />
            {/* Somewhere for a redirecting page to land, so the redirect is visible. */}
            <Route path="*" element={<p data-testid="redirected" />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
};

/**
 * Everything React or jsdom would complain about on mount, collected so a
 * test can assert silence. `console.error` is where React puts key warnings,
 * act() warnings and boundary reports; unhandled rejections are the effect
 * that fired after the page thought it was done.
 */
const show = (v: unknown): string => {
  if (typeof v === "string") return v;
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
};

export const watchConsole = () => {
  const errors: string[] = [];
  const onError = (...args: unknown[]) => {
    const line = args.map(show).join(" ");
    // Updates that land after a test's own awaits are React's act() noise,
    // not a page defect; a real warning names the component, not the test.
    if (line.includes("not wrapped in act(")) return;
    errors.push(line);
  };
  const onRejection = (e: PromiseRejectionEvent | { reason?: unknown }) => {
    errors.push(`unhandled rejection: ${String((e as { reason?: unknown }).reason)}`);
  };
  const original = console.error;
  console.error = onError as typeof console.error;
  const handler = (e: Event) => onRejection(e as PromiseRejectionEvent);
  window.addEventListener("unhandledrejection", handler);
  return {
    errors,
    stop: () => {
      console.error = original;
      window.removeEventListener("unhandledrejection", handler);
    },
  };
};
