import { useEffect, useState } from "react";

/**
 * Whether the device thinks it has a network. `navigator.onLine` is a weak
 * signal (a captive portal still reads as online) but it is the only one that
 * costs nothing, and the false negative — offline when it really is offline —
 * is the one that matters here.
 */
export const useOnline = () => {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
};
