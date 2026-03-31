import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { applySessionFromUrl } from "@/lib/oauth-session";

const OAuthCallback = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const appliedSession = await applySessionFromUrl(window.location.href);
        if (appliedSession) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const searchParams = new URLSearchParams(window.location.search);
        const error = searchParams.get("error");
        if (error) {
          console.error("OAuth error:", error, searchParams.get("error_description"));
        }
      } catch (e) {
        console.error("OAuth callback error:", e);
      }
      setProcessing(false);
    };

    handleCallback();
  }, []);

  useEffect(() => {
    if (processing || loading) return;
    navigate(user ? "/" : "/auth", { replace: true });
  }, [processing, loading, user, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  );
};

export default OAuthCallback;
