import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Persistent install banner.
 * - Shows on every visit until the app is actually installed (standalone mode).
 * - "Later" (X) hides for the current session only; returns on next page load.
 * - Android/Chromium: triggers the native install prompt via beforeinstallprompt.
 * - iOS Safari: shows Add-to-Home-Screen instructions (no native prompt exists).
 */
export function InstallBanner() {
  const [deferred, setDeferred] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const ua = navigator.userAgent || "";
    const iOSDevice = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const androidDevice = /Android/i.test(ua);
    setIsIOS(iOSDevice);
    setIsAndroid(androidDevice);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      try { sessionStorage.removeItem("install_banner_hidden"); } catch {}
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    // Session-only hide (not persistent) so banner keeps insisting on next visit
    try {
      if (sessionStorage.getItem("install_banner_hidden") === "1") setDismissed(true);
    } catch {}

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
      }
      setDeferred(null);
    } catch {
      /* ignore */
    }
  };

  const hideForSession = () => {
    try { sessionStorage.setItem("install_banner_hidden", "1"); } catch {}
    setDismissed(true);
  };

  if (installed || dismissed) return null;

  // Show on mobile and on desktop Chromium (when a native prompt is available).
  // On other desktop browsers we hide it — they don't support install anyway.
  const showable = isIOS || isAndroid || !!deferred;
  if (!showable) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-50 px-3 pb-2 md:bottom-4">
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-white/20 bg-gradient-to-r from-primary to-primary/90 p-3 text-primary-foreground shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install MUSEMBI PMS</p>
          {isIOS && !deferred ? (
            <p className="text-xs opacity-90">
              Tap <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>.
            </p>
          ) : isAndroid && !deferred ? (
            <p className="text-xs opacity-90">
              Open browser menu (⋮) → <b>Install app</b> / <b>Add to Home screen</b>.
            </p>
          ) : (
            <p className="text-xs opacity-90">Add the app to your home screen for quick access.</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {deferred && (
            <Button
              size="sm"
              onClick={install}
              className="h-8 bg-white px-3 text-xs font-semibold text-primary hover:bg-white/90"
            >
              Install
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={hideForSession}
            className="h-8 w-8 p-0 text-primary-foreground hover:bg-white/20"
            aria-label="Hide for this session"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
