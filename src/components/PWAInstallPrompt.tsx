import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 3 seconds on first visit
      const hasSeenPrompt = localStorage.getItem("pwa-prompt-seen");
      if (!hasSeenPrompt) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }

    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-seen", "true");
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-seen", "true");
  };

  // Don't show if already installed
  if (isStandalone) return null;

  // Don't show the floating prompt if dismissed
  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-fade-in sm:left-auto sm:right-4 sm:w-80">
      <div className="glass-card p-4 border border-primary/30 shadow-lg">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-primary-foreground text-lg">C</span>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">Install CryptoVest</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {isIOS
                ? "Tap Share then 'Add to Home Screen'"
                : "Install for quick access and offline use"}
            </p>
            
            {isIOS ? (
              <div className="flex items-center gap-2 text-xs text-primary">
                <Share className="h-4 w-4" />
                <span>Use Safari's Share button</span>
              </div>
            ) : deferredPrompt ? (
              <Button size="sm" variant="hero" onClick={handleInstall} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Install App
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
