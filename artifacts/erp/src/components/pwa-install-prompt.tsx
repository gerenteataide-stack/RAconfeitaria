import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaInstallPromptProps = {
  compact?: boolean;
};

export function PwaInstallPrompt({ compact = false }: PwaInstallPromptProps) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    if (standalone) {
      setInstalled(true);
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstallEvent(null);
      setInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (installed || !installEvent) return null;

  async function installApp() {
    const currentInstallEvent = installEvent;
    if (!currentInstallEvent) return;
    await currentInstallEvent.prompt();
    const choice = await currentInstallEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  }

  return (
    <button
      type="button"
      onClick={() => void installApp()}
      className={compact
        ? "inline-flex min-h-9 items-center gap-2 rounded-md border border-sidebar-border bg-white px-3 text-xs font-semibold text-primary transition-colors hover:bg-sidebar-accent"
        : "inline-flex min-h-12 items-center gap-2 rounded-md border border-[#7A8B68]/50 bg-white/80 px-5 text-sm font-semibold text-[#46513C] shadow-sm transition-colors hover:bg-white"}
    >
      <Download className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
      Instalar app
    </button>
  );
}
