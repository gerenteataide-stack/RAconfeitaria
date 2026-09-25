import { getApp, getApps, initializeApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCg7dC0dr68hWERsItQu_-FDFz7YRK8jcM",
  authDomain: "raconfeitaria01.firebaseapp.com",
  projectId: "raconfeitaria01",
  storageBucket: "raconfeitaria01.firebasestorage.app",
  messagingSenderId: "709096841923",
  appId: "1:709096841923:web:7566faabf6d98cf9f53876",
  measurementId: "G-8ZWPZ3YRTX",
};

const vapidKey = "BJSAnSH_owVpR38r1jK9Y3zg5ZFqfCKXFnv39VHFyr2msDWv8QuTMosD5S6wSge2By9Rcuv0wzQ8AnCoOF3xr6A";

export type PushEnvironment = {
  isIOS: boolean;
  isStandalone: boolean;
  requiresHomeScreenApp: boolean;
};

export function getPushEnvironment(): PushEnvironment {
  if (typeof window === "undefined") {
    return { isIOS: false, isStandalone: false, requiresHomeScreenApp: false };
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || Boolean(navigatorWithStandalone.standalone);

  return { isIOS, isStandalone, requiresHomeScreenApp: isIOS && !isStandalone };
}

export function getIOSHomeScreenMessage(): string {
  return "No iPhone, abra este site no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início. Depois abra o ícone do app e ative os avisos novamente.";
}

function isRecoverableTokenError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  return code === "messaging/token-subscribe-failed"
    || (message.includes("registration failed") && message.includes("push service error"));
}

async function clearPushSubscription(registration: ServiceWorkerRegistration, messaging: ReturnType<typeof getMessaging>) {
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe().catch(() => undefined);
  await deleteToken(messaging).catch(() => undefined);
}

async function getBrowserMessaging() {
  if (typeof window === "undefined" || !(await isSupported())) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getMessaging(app);
}

export async function registerOrderPush(): Promise<string> {
  const environment = getPushEnvironment();
  if (environment.requiresHomeScreenApp) {
    throw new Error(getIOSHomeScreenMessage());
  }

  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Este navegador não oferece suporte a notificações push.");
  }

  if (!window.isSecureContext) {
    throw new Error("As notificações só funcionam em uma conexão HTTPS segura.");
  }

  if (Notification.permission === "denied") {
    throw new Error(environment.isIOS
      ? "As notificações estão bloqueadas. No iPhone, abra Ajustes > Notificações, selecione RA Confeitaria e permita os avisos."
      : "As notificações estão bloqueadas. Abra as configurações do site e permita notificações para tentar novamente.");
  }

  // Start the permission prompt in the click handler before awaiting browser capability checks.
  const supportCheck = isSupported();
  const permissionRequest = Notification.permission === "granted"
    ? Promise.resolve<NotificationPermission>("granted")
    : Notification.requestPermission();
  const [supported, permission] = await Promise.all([supportCheck, permissionRequest]);
  if (permission !== "granted") throw new Error("Permita notificações para receber avisos de pedidos.");
  if (!supported) throw new Error("Este navegador não oferece suporte a notificações push. Abra o app no Chrome atualizado.");

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  await registration.update();
  const activeRegistration = await navigator.serviceWorker.ready;
  const messaging = await getBrowserMessaging();
  if (!messaging) throw new Error("Não foi possível iniciar as notificações neste navegador.");
  let token: string;
  try {
    token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: activeRegistration });
  } catch (error) {
    if (!isRecoverableTokenError(error)) throw error;
    await clearPushSubscription(activeRegistration, messaging);
    await activeRegistration.update();
    token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: activeRegistration });
  }
  if (!token) throw new Error("O Firebase não gerou um token para este navegador.");
  return token;
}

export function getPushRegistrationError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";

  if (
    code === "messaging/token-subscribe-failed" ||
    (normalizedMessage.includes("registration failed") && normalizedMessage.includes("push service error"))
  ) {
    return new Error(
      "O serviço de notificações do aparelho não respondeu. Abra o site no Chrome atualizado (fora do WhatsApp ou Instagram), confira a conexão e tente novamente. Se continuar, reinicie o navegador e o aparelho.",
    );
  }

  return error instanceof Error ? error : new Error("Não foi possível ativar as notificações. Tente novamente.");
}

export async function getCurrentOrderPushToken(): Promise<string | null> {
  if (!(await isSupported()) || typeof Notification === "undefined" || Notification.permission !== "granted") return null;
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const messaging = await getBrowserMessaging();
  if (!messaging) return null;
  return (await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })) || null;
}

export async function removeOrderPushToken(): Promise<void> {
  const messaging = await getBrowserMessaging();
  if (messaging) await deleteToken(messaging);
}

export async function listenForOrderPushMessages(callback: (payload: MessagePayload) => void): Promise<() => void> {
  const messaging = await getBrowserMessaging();
  return messaging ? onMessage(messaging, callback) : () => undefined;
}
