import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "musembi_install_dismissed_until";

/**
 * Install banner with a dismiss (X) button.
 * - Dismissal is remembered for 7 days (per browser) so the banner doesn't nag.
 * - Reappears automatically after 7 days or when the app is uninstalled.
 * - Native prompt on Android/Chromium; manual steps on iOS Safari.
 */
export function InstallBanner() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || "0");
      if (until && Date.now() < until) setDismissed(true);
    } catch {
      /* ignore */
    }

    const ua = navigator.userAgent || "";
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window));
    setIsAndroid(/Android/i.test(ua));

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) {
      setShowSteps(true);
      return;
    }
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } catch {
      /* ignore */
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (installed || dismissed) return null;

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
          {showSteps && isIOS ? (
            <p className="text-xs opacity-90">
              Tap <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>.
            </p>
          ) : showSteps && isAndroid ? (
            <p className="text-xs opacity-90">
              Open browser menu (⋮) → <b>Install app</b> / <b>Add to Home screen</b>.
            </p>
          ) : isAndroid && !deferred ? (
            <p className="text-xs opacity-90">Tap Install for steps. Requires HTTPS and Chrome / Edge / Samsung Internet.</p>
          ) : isIOS && !deferred ? (
            <p className="text-xs opacity-90">Tap Install to see Add-to-Home-Screen steps.</p>
          ) : (
            <p className="text-xs opacity-90">Add the app to your home screen for quick access.</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            onClick={install}
            className="h-8 bg-white px-3 text-xs font-semibold text-primary hover:bg-white/90"
          >
            Install
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-md p-1.5 text-primary-foreground/90 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
