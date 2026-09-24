import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createPrivateKey } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, pushTokensTable, usersTable } from "@workspace/db";

const PROJECT_ID = "raconfeitaria01";

type PushAttemptResult = {
  status: "not_configured" | "no_recipients" | "sent" | "partial_failure" | "failed";
  recipients: number;
  sent: number;
  failed: number;
  errorCodes: Record<string, number>;
};

export function isFirebaseAdminConfigured(): boolean {
  try {
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "null") as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    } | null;
    if (credentials?.project_id !== PROJECT_ID || !credentials.client_email || !credentials.private_key) return false;
    createPrivateKey(credentials.private_key.replace(/\\n/g, "\n"));
    return true;
  } catch {
    return false;
  }
}

export function getFirebaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[a-z0-9/_-]{1,80}$/i.test(code) ? code : undefined;
}

function getAdminMessaging() {
  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) return null;

  const existingApp = getApps().find((app) => app.name === "ra-order-notifications");
  if (existingApp) return getMessaging(existingApp);

  const credentials = JSON.parse(rawCredentials) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (credentials.project_id !== PROJECT_ID || !credentials.client_email || !credentials.private_key) {
    throw new Error("Invalid Firebase service account configuration");
  }

  const app = initializeApp({
    credential: cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key.replace(/\\n/g, "\n"),
    }),
    projectId: PROJECT_ID,
  }, "ra-order-notifications");
  return getMessaging(app);
}

async function sendPushToSubscriptions(
  subscriptions: Array<{ id: number; token: string }>,
  data: Record<string, string>,
): Promise<PushAttemptResult> {
  if (!isFirebaseAdminConfigured()) {
    return { status: "not_configured", recipients: 0, sent: 0, failed: 0, errorCodes: {} };
  }
  const messaging = getAdminMessaging();
  if (!messaging) return { status: "not_configured", recipients: 0, sent: 0, failed: 0, errorCodes: {} };
  if (subscriptions.length === 0) return { status: "no_recipients", recipients: 0, sent: 0, failed: 0, errorCodes: {} };

  const result = await messaging.sendEachForMulticast({
    tokens: subscriptions.map((subscription) => subscription.token),
    data,
  });

  const invalidIds = result.responses.flatMap((response, index) => {
    const code = response.error?.code;
    return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token"
      ? [subscriptions[index].id]
      : [];
  });
  if (invalidIds.length) await db.delete(pushTokensTable).where(inArray(pushTokensTable.id, invalidIds));

  const errorCodes = result.responses.reduce<Record<string, number>>((counts, response) => {
    const code = response.error?.code;
    if (code) counts[code] = (counts[code] ?? 0) + 1;
    return counts;
  }, {});
  return {
    status: result.failureCount === 0 ? "sent" : result.successCount > 0 ? "partial_failure" : "failed",
    recipients: subscriptions.length,
    sent: result.successCount,
    failed: result.failureCount,
    errorCodes,
  };
}

export async function sendNewOrderPush(orderId: number): Promise<PushAttemptResult> {
  const subscriptions = await db.select({ id: pushTokensTable.id, token: pushTokensTable.token })
    .from(pushTokensTable)
    .innerJoin(usersTable, eq(pushTokensTable.userId, usersTable.id))
    .where(and(eq(usersTable.active, true), inArray(usersTable.roleName, ["owner", "manager"])));
  return sendPushToSubscriptions(subscriptions, {
    type: "new_order",
    orderId: String(orderId),
    url: "/orders",
    tag: `pedido-${orderId}`,
    title: "Novo pedido recebido",
    body: "Foi recebido um novo pedido na loja.",
  });
}

export async function sendTestOrderPush(userId: number): Promise<PushAttemptResult> {
  const subscriptions = await db.select({ id: pushTokensTable.id, token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(eq(pushTokensTable.userId, userId));
  return sendPushToSubscriptions(subscriptions, {
    type: "test_notification",
    url: "/orders",
    tag: `teste-pedido-${Date.now()}`,
    title: "Teste de notificação",
    body: "As notificações de pedidos estão funcionando neste navegador.",
  });
}
