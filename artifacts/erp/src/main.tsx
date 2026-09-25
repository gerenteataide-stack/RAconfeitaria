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
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((registration) => registration.update())
    .catch(() => undefined);
}

registerAppServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
