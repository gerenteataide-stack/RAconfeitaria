import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createPrivateKey } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, pushTokensTable, usersTable } from "@workspace/db";

const PROJECT_ID = "raconfeitaria01";

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

export async function sendNewOrderPush(orderId: number): Promise<boolean> {
  const messaging = getAdminMessaging();
  if (!messaging) return false;

  const subscriptions = await db.select({ id: pushTokensTable.id, token: pushTokensTable.token })
    .from(pushTokensTable)
    .innerJoin(usersTable, eq(pushTokensTable.userId, usersTable.id))
    .where(and(eq(usersTable.active, true), inArray(usersTable.roleName, ["owner", "manager"])));
  if (subscriptions.length === 0) return true;

  const result = await messaging.sendEachForMulticast({
    tokens: subscriptions.map((subscription) => subscription.token),
    data: {
      type: "new_order",
      orderId: String(orderId),
      url: "/orders",
      tag: `pedido-${orderId}`,
      title: "Novo pedido recebido",
      body: "Foi recebido um novo pedido na loja.",
    },
  });

  const invalidIds = result.responses.flatMap((response, index) => {
    const code = response.error?.code;
    return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token"
      ? [subscriptions[index].id]
      : [];
  });
  if (invalidIds.length) await db.delete(pushTokensTable).where(inArray(pushTokensTable.id, invalidIds));
  return true;
}
