import { supabase } from "@/integrations/supabase/client";

const getParamsFromUrl = (url: URL) => {
  const searchParams = new URLSearchParams(url.search);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

  return {
    accessToken: hashParams.get("access_token") ?? searchParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token") ?? searchParams.get("refresh_token"),
  };
};

export const applySessionFromUrl = async (input: string | URL): Promise<boolean> => {
  try {
    const url = input instanceof URL ? input : new URL(input, window.location.origin);
    const { accessToken, refreshToken } = getParamsFromUrl(url);

    if (!accessToken || !refreshToken) {
      return false;
    }

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Failed to apply OAuth session from URL:", error);
    return false;
  }
};
