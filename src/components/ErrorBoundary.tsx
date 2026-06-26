import { Component, ErrorInfo, ReactNode } from "react";
import { captureException } from "@/lib/observability";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { componentStack: info.componentStack });
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      // Surface the actual error message + the top of the React component
      // stack so debugging doesn't require an Xcode/Web Inspector connection.
      // The user can screenshot this and we can act on it.
      const message = this.state.error?.message ?? "(no error message)";
      const name = this.state.error?.name ?? "Error";
      const stackHead = (this.state.error?.stack ?? "")
        .split("\n")
        .slice(0, 6)
        .join("\n");
      const componentHead = (this.state.componentStack ?? "")
        .split("\n")
        .slice(0, 6)
        .join("\n");

      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-left max-w-md mx-auto">
          <p className="text-white/90 text-sm font-bold text-center">
            Something went wrong. Please reload the app.
          </p>
          <details
            className="w-full rounded-lg border border-white/15 bg-black/40 p-3 text-[11px] text-white/70 leading-relaxed"
            open
          >
            <summary className="cursor-pointer text-white/80 font-bold text-xs mb-1">
              {name}: {message}
            </summary>
            {stackHead && (
              <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] opacity-80">
                {stackHead}
              </pre>
            )}
            {componentHead && (
              <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] opacity-60">
                {componentHead}
              </pre>
            )}
          </details>
          <button
            className="px-4 py-2 rounded-lg bg-gold text-black text-sm font-semibold"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
