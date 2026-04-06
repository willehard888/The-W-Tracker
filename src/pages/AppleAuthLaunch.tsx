import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { startPublishedAppleSignIn } from "@/lib/native-auth";

const AppleAuthLaunch = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const result = await startPublishedAppleSignIn();
      if (cancelled || !result.error) return;

      setError(result.error.message);
      toast.error(result.error.message || "Apple Sign In failed");
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {error ? (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold">Apple Sign In failed</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <a href="/auth" className="text-sm font-semibold text-primary underline underline-offset-4">
            Back to login
          </a>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold">Opening Apple Sign In</h1>
            <p className="text-sm text-muted-foreground">
              Complete Face ID and we’ll bring you straight back into the app.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AppleAuthLaunch;