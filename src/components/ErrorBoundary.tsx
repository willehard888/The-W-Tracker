import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { captureException } from "@/lib/observability";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

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

  // Most render crashes are one bad response; mounting the subtree again
  // is enough, and cheaper than a reload that drops every cached query.
  private reset = () => this.setState({ hasError: false, error: null, componentStack: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      // Surface the actual error message + the top of the React component
      // stack so debugging doesn't require an Xcode/Web Inspector connection.
      // DEV-only: prod users get the friendly line; the stack still reaches
      // Sentry via captureException above.
      const showDetails = import.meta.env.DEV;
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
        <div className="min-h-full flex flex-col items-center justify-center gap-4 p-6 text-left max-w-md mx-auto">
          <EmptyState
            icon={AlertTriangle}
            title="Something went wrong"
            description="This screen hit a snag. Try again, or reload the app."
            action={
              <div className="flex items-center gap-2">
                <Button variant="gold-outline" size="sm" className="min-h-11" onClick={this.reset}>
                  Try again
                </Button>
                <Button variant="ghost" size="sm" className="min-h-11" onClick={() => window.location.reload()}>
                  Reload
                </Button>
              </div>
            }
          />
          {showDetails && (
          <details
            className="w-full rounded-lg border border-white/15 bg-black/40 p-3 text-meta text-white/75 leading-relaxed"
            open
          >
            <summary className="cursor-pointer text-white/80 font-bold text-xs mb-1">
              {name}: {message}
            </summary>
            {stackHead && (
              <pre className="mt-2 whitespace-pre-wrap break-words text-label opacity-80">
                {stackHead}
              </pre>
            )}
            {componentHead && (
              <pre className="mt-2 whitespace-pre-wrap break-words text-label opacity-60">
                {componentHead}
              </pre>
            )}
          </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
