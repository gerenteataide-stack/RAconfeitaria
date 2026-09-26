import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { getAuthToken } from "@/lib/auth-token";

setAuthTokenGetter(getAuthToken);

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

function registerAppServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  let reloading = false;
  let registration: ServiceWorkerRegistration | null = null;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  const askWaitingWorkerToActivate = () => {
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  };

  const checkForUpdate = () => {
    void registration?.update().catch(() => undefined);
  };

  void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((nextRegistration) => {
      registration = nextRegistration;
      askWaitingWorkerToActivate();
      registration.addEventListener("updatefound", () => {
        const installingWorker = registration?.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed") askWaitingWorkerToActivate();
        });
      });
      checkForUpdate();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("focus", checkForUpdate);
      window.setInterval(checkForUpdate, 5 * 60 * 1000);
    })
    .catch(() => undefined);
}

registerAppServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
