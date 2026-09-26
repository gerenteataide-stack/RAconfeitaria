import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { getIOSHomeScreenMessage, getPushEnvironment } from "@/lib/firebase-push";

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
  const [iosNeedsHomeScreen, setIosNeedsHomeScreen] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    if (standalone) {
      setInstalled(true);
    }
    setIosNeedsHomeScreen(getPushEnvironment().requiresHomeScreenApp);

    const isDesktop = window.matchMedia("(pointer: fine)").matches &&
      !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setShowInstallHelp(false);
    }

    function handleAppInstalled() {
      setInstallEvent(null);
      setInstalled(true);
      setShowInstallHelp(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    const helpTimer = window.setTimeout(() => {
      if (isDesktop && !standalone) setShowInstallHelp(true);
    }, 1500);
    return () => {
      window.clearTimeout(helpTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (iosNeedsHomeScreen) {
    return (
      <div className={compact
        ? "mt-3 rounded-md border border-[#7A8B68]/30 bg-white p-2 text-[11px] leading-4 text-muted-foreground"
        : "rounded-lg border border-[#7A8B68]/30 bg-white p-3 text-sm text-muted-foreground"}
        role="note"
      >
        <p className="font-semibold text-[#46513C]">Ative os avisos no iPhone</p>
        <p className="mt-1">{getIOSHomeScreenMessage()}</p>
      </div>
    );
  }

  if (installed) return null;

  if (!installEvent) {
    if (!showInstallHelp) return null;
    return (
      <div
        className={compact
          ? "mt-3 rounded-md border border-[#7A8B68]/30 bg-white p-2 text-[11px] leading-4 text-muted-foreground"
          : "rounded-lg border border-[#7A8B68]/30 bg-white p-3 text-sm leading-5 text-muted-foreground"}
        role="note"
      >
        <p className="font-semibold text-[#46513C]">Instale o app no computador</p>
        <p className="mt-1">No Chrome ou Edge, abra o menu do navegador e escolha “Instalar app” ou use o ícone de instalação ao lado do endereço.</p>
      </div>
    );
  }

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
