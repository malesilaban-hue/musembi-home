import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "musembi_install_dismissed_at";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  const webkit = /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  return iOS && webkit;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    // Re-show 3 days after dismissal
    const recentlyDismissed = dismissedAt && Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setShowIOS(false);
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    if (!recentlyDismissed && isIOSSafari()) {
      setShowIOS(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || isStandalone()) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "dismissed") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDeferred(null);
  };

  const dismissIOS = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowIOS(false);
  };

  if (deferred) {
    return (
      <Button
        size="sm"
        onClick={install}
        className="fixed bottom-20 right-4 z-40 shadow-lg md:bottom-6"
      >
        <Download className="mr-1.5 h-4 w-4" /> Install app
      </Button>
    );
  }

  if (showIOS) {
    return (
      <div className="fixed bottom-20 right-4 z-40 max-w-xs rounded-lg border bg-card p-3 text-xs shadow-lg md:bottom-6">
        <div className="mb-1 font-semibold">Install MUSEMBI PMS</div>
        <p className="text-muted-foreground">
          Tap <b>Share</b> then <b>Add to Home Screen</b>.
        </p>
        <button
          onClick={dismissIOS}
          className="mt-2 text-[11px] text-muted-foreground underline"
        >
          Not now
        </button>
      </div>
    );
  }

  return null;
}
