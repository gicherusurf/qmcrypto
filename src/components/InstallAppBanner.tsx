import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Smartphone, Share, PlusSquare } from "lucide-react";

// Chrome/Android fires `beforeinstallprompt`; we stash it and trigger it on tap.
// iOS Safari has no install API, so we show Add-to-Home-Screen instructions.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "qm-install-banner-dismissed";

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    if (isIos()) {
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) {
      setShowIosHelp(true);
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="glass-card rounded-xl border border-primary/30 bg-background/95 backdrop-blur p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10 shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Install QMProfits</p>
            {!showIosHelp ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Get the app on your phone — faster access, full screen, works like a native app.
              </p>
            ) : (
              <div className="text-xs text-muted-foreground mt-1 space-y-1">
                <p className="flex items-center gap-1.5">
                  1. Tap the <Share className="h-3.5 w-3.5 inline text-primary" /> Share button below
                </p>
                <p className="flex items-center gap-1.5">
                  2. Choose <PlusSquare className="h-3.5 w-3.5 inline text-primary" /> "Add to Home Screen"
                </p>
              </div>
            )}
            {!showIosHelp && (
              <div className="flex gap-2 mt-2.5">
                <Button size="sm" className="h-8 text-xs" onClick={install}>
                  Install App
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={dismiss}>
                  Not now
                </Button>
              </div>
            )}
          </div>
          <button onClick={dismiss} className="p-1 rounded hover:bg-secondary shrink-0" aria-label="Dismiss">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
