import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const OAuthCallback = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for tokens in URL hash (from OAuth redirect)
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            // Small delay to let auth state propagate
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        // Check for error in URL params
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
