import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if already dismissed in this session
    const dismissed = sessionStorage.getItem("install_banner_dismissed_session");
    if (dismissed) {
      return;
    }

    // Detect iOS - more comprehensive check
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice =
      (/iphone|ipad|ipod/.test(userAgent) || /mac os/.test(userAgent)) &&
      !/(android|windows|linux)/.test(userAgent);
    
    setIsIOS(isIOSDevice);

    // Show banner for iOS immediately
    if (isIOSDevice) {
      // Add a small delay to ensure state is set
      setTimeout(() => setShowBanner(true), 100);
      return;
    }

    // Handle the beforeinstallprompt event (Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    // Listen for the event
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
        sessionStorage.setItem("install_banner_dismissed_session", "true");
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    // Temporarily hide banner (will show again on refresh)
    setShowBanner(false);
  };

  const handleClose = () => {
    // Permanently dismiss for this session
    sessionStorage.setItem("install_banner_dismissed_session", "true");
    setShowBanner(false);
  };

  if (!showBanner || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground p-4 shadow-lg animate-in slide-in-from-bottom-2">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Install MUSEMBI PMS</p>
            <p className="text-xs opacity-90">
              {isIOS
                ? "Add to home screen for quick access"
                : "Get the app on your device"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isIOS ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleDismiss}
                className="h-8 px-3 text-xs"
              >
                Later
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClose}
                className="h-8 w-8 p-0 text-primary-foreground hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleInstall}
                className="h-8 px-3 text-xs bg-white text-primary hover:bg-white/90"
              >
                Install
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 w-8 p-0 text-primary-foreground hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {isIOS && (
        <div className="mt-3 text-xs opacity-90 max-w-lg mx-auto">
          <p className="font-medium mb-1">How to install:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Tap the Share button</li>
            <li>Select "Add to Home Screen"</li>
            <li>Tap "Add" to confirm</li>
          </ol>
        </div>
      )}
    </div>
  );
}
