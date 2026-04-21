import { Component, ReactNode } from "react";
import BrandLogo from "@/components/BrandLogo";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level safety net so a single component crash never produces a
 * blank white screen on a published TestFlight or production build.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Surface the crash in the browser console — Lovable's read-console-logs
    // tool will pick it up so we can debug after the fact.
    console.error("[ErrorBoundary] Unhandled render error:", error, info);
  }

  handleReload = () => {
    // Clear any half-broken state by reloading the SPA.
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <BrandLogo size={64} className="rounded-xl glow-gold mb-2" />
        <h1 className="font-display text-xl font-bold tracking-tight">
          Something broke
        </h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          We hit an unexpected error. Reloading usually fixes it.
        </p>
        <button
          onClick={this.handleReload}
          className="mt-2 h-11 px-6 rounded-xl bg-gold text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
        >
          Reload app
        </button>
        {import.meta.env.DEV && this.state.error && (
          <pre className="mt-4 max-w-full overflow-x-auto text-[10px] text-destructive/80 bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-left">
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
