import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      const beforeInstallPromptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(beforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    
    // Check if already installed
    window.addEventListener("appinstalled", () => {
      setShowPrompt(false);
      toast.success("MUSEMBI PMS installed successfully!");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        toast.success("Installation started. App will be available on your home screen.");
      } else {
        toast.info("Installation cancelled.");
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (err) {
      toast.error("Installation failed. Try again from your browser menu.");
      console.error("Install error:", err);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">Install MUSEMBI PMS</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Get quick access to your property management system from your home screen.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={handleInstall}
            disabled={isInstalling}
            className="flex-1"
          >
            {isInstalling ? "Installing..." : "Install"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDismiss}
            disabled={isInstalling}
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
