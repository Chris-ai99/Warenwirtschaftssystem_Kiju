"use client";

import { useEffect, useState } from "react";

export function PwaRegistrar() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // The app still works without the service worker.
      });
    }

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      Offline - Buchungen sind erst wieder mit Serververbindung möglich.
    </div>
  );
}
