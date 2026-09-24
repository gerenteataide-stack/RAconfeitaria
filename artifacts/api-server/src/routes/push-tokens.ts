import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { db, pushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requirePermission } from "../lib/auth";
import { isFirebaseAdminConfigured } from "../lib/firebase-admin";

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
  res.status(200).json({ serverConfigured: isFirebaseAdminConfigured() });
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
