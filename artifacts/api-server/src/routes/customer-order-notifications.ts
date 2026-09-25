import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { customerOrderPushTokensTable, db, ordersTable } from "@workspace/db";
import { z } from "zod";
import { createRateLimit } from "../lib/security";
import {
  getFirebaseErrorCode,
  isFirebaseAdminConfigured,
  sendCustomerOrderStatusPush,
} from "../lib/firebase-admin";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const customerNotificationRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 12 });
const subscribeBody = z.object({
  orderId: z.number().int().positive(),
  customerNotificationKey: z.string().trim().min(32).max(128),
  token: z.string().trim().min(20).max(4096),
});
const unsubscribeBody = subscribeBody.omit({ token: true });

async function findOrderForKey(orderId: number, key: string) {
  const [order] = await db.select({ id: ordersTable.id, status: ordersTable.status, keyHash: ordersTable.customerNotificationKeyHash })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));
  if (!order?.keyHash) return null;
  const providedHash = createHash("sha256").update(key).digest();
  const storedHash = Buffer.from(order.keyHash, "hex");
  if (providedHash.length !== storedHash.length || !timingSafeEqual(providedHash, storedHash)) return null;
  return order;
}

router.post("/customer-order-notifications", customerNotificationRateLimit, async (req, res): Promise<void> => {
  const parsed = subscribeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos para ativar avisos do pedido." }); return; }
  if (!isFirebaseAdminConfigured()) {
    res.status(503).json({ error: "As notificações estão temporariamente indisponíveis." });
    return;
  }

  const { orderId, customerNotificationKey, token } = parsed.data;
  const order = await findOrderForKey(orderId, customerNotificationKey);
  if (!order) { res.status(404).json({ error: "Não foi possível validar a inscrição deste pedido." }); return; }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db.insert(customerOrderPushTokensTable).values({ orderId, token, tokenHash })
    .onConflictDoUpdate({
      target: [customerOrderPushTokensTable.orderId, customerOrderPushTokensTable.tokenHash],
      set: { token, updatedAt: new Date() },
    });

  try {
    const result = await sendCustomerOrderStatusPush(orderId, order.status);
    logger.info({ orderId, ...result }, "Customer order push subscription registered");
  } catch (error) {
    logger.warn({ orderId, errorCode: getFirebaseErrorCode(error) }, "Initial customer order push was not sent");
  }

  res.status(201).json({ subscribed: true });
});

router.delete("/customer-order-notifications", customerNotificationRateLimit, async (req, res): Promise<void> => {
  const parsed = unsubscribeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos para desativar avisos do pedido." }); return; }

  const { orderId, customerNotificationKey } = parsed.data;
  const order = await findOrderForKey(orderId, customerNotificationKey);
  if (!order) { res.status(404).json({ error: "Não foi possível validar a inscrição deste pedido." }); return; }

  await db.delete(customerOrderPushTokensTable)
    .where(eq(customerOrderPushTokensTable.orderId, orderId));
  res.sendStatus(204);
});

export default router;
