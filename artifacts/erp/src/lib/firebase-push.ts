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

async function getBrowserMessaging() {
  if (typeof window === "undefined" || !(await isSupported())) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getMessaging(app);
}

export async function registerOrderPush(): Promise<string> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Este navegador não oferece suporte a notificações push.");
  }

  if (Notification.permission === "denied") {
    throw new Error("As notificações estão bloqueadas. No Chrome, abra as configurações do site e permita notificações para tentar novamente.");
  }

  // Start the permission prompt in the click handler before awaiting browser capability checks.
  const supportCheck = isSupported();
  const permissionRequest = Notification.permission === "granted"
    ? Promise.resolve<NotificationPermission>("granted")
    : Notification.requestPermission();
  const [supported, permission] = await Promise.all([supportCheck, permissionRequest]);
  if (permission !== "granted") throw new Error("Permita notificações para receber avisos de pedidos.");
  if (!supported) throw new Error("Este navegador não oferece suporte a notificações push. Abra o app no Chrome atualizado.");

  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  const messaging = await getBrowserMessaging();
  if (!messaging) throw new Error("Não foi possível iniciar as notificações neste navegador.");
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("O Firebase não gerou um token para este navegador.");
  return token;
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
