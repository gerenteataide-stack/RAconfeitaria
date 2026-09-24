import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { db, pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requirePermission } from "../lib/auth";
import { getFirebaseErrorCode, isFirebaseAdminConfigured, sendTestOrderPush } from "../lib/firebase-admin";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const tokenBody = z.object({ token: z.string().trim().min(20).max(4096) });

router.post("/push-tokens", requireAuth, requirePermission("orders"), async (req, res): Promise<void> => {
  if (req.user?.role !== "owner" && req.user?.role !== "manager") {
    res.status(403).json({ error: "Only owners and managers can manage order notifications" });
    return;
  }
  const parsed = tokenBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid notification token" }); return; }

  const token = parsed.data.token;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db.insert(pushTokensTable).values({ userId: req.user.id, token, tokenHash })
    .onConflictDoUpdate({
      target: pushTokensTable.tokenHash,
      set: { userId: req.user.id, token, updatedAt: new Date() },
    });
  const serverConfigured = isFirebaseAdminConfigured();
  logger.info({ userId: req.user.id, role: req.user.role, serverConfigured }, "Order push subscription registered");
  res.status(200).json({ serverConfigured });
});

router.post("/push-tokens/test", requireAuth, requirePermission("orders"), async (req, res): Promise<void> => {
  if (req.user?.role !== "owner" && req.user?.role !== "manager") {
    res.status(403).json({ error: "Only owners and managers can test order notifications" });
    return;
  }

  try {
    const result = await sendTestOrderPush(req.user.id);
    logger.info({ userId: req.user.id, ...result }, "Order push test completed");
    res.status(200).json(result);
  } catch (error) {
    const errorCode = getFirebaseErrorCode(error);
    logger.warn({ userId: req.user.id, errorType: error instanceof Error ? error.name : "UnknownError", errorCode }, "Order push test failed");
    res.status(200).json({ status: "failed", recipients: 0, sent: 0, failed: 1, errorCodes: errorCode ? { [errorCode]: 1 } : {} });
  }
});

router.delete("/push-tokens", requireAuth, requirePermission("orders"), async (req, res): Promise<void> => {
  if (req.user?.role !== "owner" && req.user?.role !== "manager") {
    res.status(403).json({ error: "Only owners and managers can manage order notifications" });
    return;
  }
  const parsed = tokenBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid notification token" }); return; }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  await db.delete(pushTokensTable).where(eq(pushTokensTable.tokenHash, tokenHash));
  res.sendStatus(204);
});

export default router;
