import { Router, type IRouter, type Request } from "express";
import { z } from "zod/v4";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import {
  couponsTable,
  db,
  deliveryZonesTable,
  notificationsTable,
  settingsTable,
} from "@workspace/db";
import { requireAuth, requirePermission } from "../lib/auth";

const router: IRouter = Router();

const DeliveryZoneBody = z.object({
  name: z.string().min(1),
  cepStart: z.string().optional().nullable(),
  cepEnd: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  fee: z.coerce.number().min(0),
  minOrder: z.coerce.number().min(0).optional().default(0),
  active: z.boolean().optional().default(true),
});

const CouponBody = z.object({
  code: z.string().min(2).transform((v) => v.trim().toUpperCase()),
  description: z.string().optional().nullable(),
  type: z.enum(["percent", "fixed"]).default("percent"),
  value: z.coerce.number().min(0),
  minOrder: z.coerce.number().min(0).optional().default(0),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});

const NotificationBody = z.object({
  audience: z.enum(["admin", "customer"]).default("admin"),
  channel: z.enum(["system", "whatsapp", "email", "push"]).default("system"),
  title: z.string().min(1),
  message: z.string().min(1),
  scheduledFor: z.coerce.date().optional().nullable(),
});

const SettingsBody = z.object({
  cashbackPercent: z.coerce.number().min(0).max(100).optional(),
  loyaltyPointsPerCurrency: z.coerce.number().min(0).optional(),
  whatsappNumber: z.string().optional(),
  pixKey: z.string().optional(),
  privacyPolicyUrl: z.string().optional(),
  businessName: z.string().optional(),
  businessSubtitle: z.string().optional(),
  businessDescription: z.string().optional(),
  instagram: z.string().optional(),
  location: z.string().optional(),
  serviceNote: z.string().optional(),
  recipeFixedCost: z.coerce.number().min(0).optional(),
  recipeVariableCost: z.coerce.number().min(0).optional(),
});

const CostItemBody = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["fixed", "variable"]),
  amountType: z.enum(["currency", "percent"]).default("currency"),
  amount: z.coerce.number().min(0),
});

const PricingCostsBody = z.object({
  costs: z.array(CostItemBody),
});

function zone(row: typeof deliveryZonesTable.$inferSelect) {
  return {
    ...row,
    fee: Number(row.fee),
    minOrder: Number(row.minOrder),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function coupon(row: typeof couponsTable.$inferSelect) {
  return {
    ...row,
    value: Number(row.value),
    minOrder: Number(row.minOrder),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function notification(row: typeof notificationsTable.$inferSelect) {
  return {
    ...row,
    scheduledFor: row.scheduledFor ? row.scheduledFor.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function writeAudit(req: Request, action: string, entity: string, entityId?: number | string) {
  await db.execute(sql`
    INSERT INTO audit_logs (actor, action, entity, entity_id, ip)
    VALUES (${req.user?.email ?? "system"}, ${action}, ${entity}, ${entityId ? String(entityId) : null}, ${req.ip ?? null})
  `);
}

router.get("/delivery-zones", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const active = req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;
  const rows = await db
    .select()
    .from(deliveryZonesTable)
    .where(
      and(
        search ? or(ilike(deliveryZonesTable.name, `%${search}%`), ilike(deliveryZonesTable.neighborhood, `%${search}%`), ilike(deliveryZonesTable.cepStart, `%${search}%`)) : undefined,
        active !== undefined ? eq(deliveryZonesTable.active, active) : undefined,
      ),
    )
    .orderBy(deliveryZonesTable.name);

  res.json(rows.map(zone));
});

router.post("/delivery-zones", requireAuth, requirePermission("delivery"), async (req, res): Promise<void> => {
  const parsed = DeliveryZoneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(deliveryZonesTable).values({
    ...parsed.data,
    fee: String(parsed.data.fee),
    minOrder: String(parsed.data.minOrder),
  }).returning();
  await writeAudit(req, "create", "delivery_zone", row.id);
  res.status(201).json(zone(row));
});

router.patch("/delivery-zones/:id", requireAuth, requirePermission("delivery"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = DeliveryZoneBody.partial().safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) { res.status(400).json({ error: parsed.success ? "Invalid id" : parsed.error.message }); return; }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.fee !== undefined) data.fee = String(parsed.data.fee);
  if (parsed.data.minOrder !== undefined) data.minOrder = String(parsed.data.minOrder);
  const [row] = await db.update(deliveryZonesTable).set(data).where(eq(deliveryZonesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Delivery zone not found" }); return; }
  await writeAudit(req, "update", "delivery_zone", id);
  res.json(zone(row));
});

router.delete("/delivery-zones/:id", requireAuth, requirePermission("delivery"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.delete(deliveryZonesTable).where(eq(deliveryZonesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Delivery zone not found" }); return; }
  await writeAudit(req, "delete", "delivery_zone", id);
  res.sendStatus(204);
});

router.get("/marketing/coupons", requireAuth, requirePermission("marketing"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(couponsTable).orderBy(couponsTable.code);
  res.json(rows.map(coupon));
});

router.post("/marketing/coupons", requireAuth, requirePermission("marketing"), async (req, res): Promise<void> => {
  const parsed = CouponBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(couponsTable).values({
    ...parsed.data,
    value: String(parsed.data.value),
    minOrder: String(parsed.data.minOrder),
  }).returning();
  await writeAudit(req, "create", "coupon", row.id);
  res.status(201).json(coupon(row));
});

router.get("/coupons/validate", async (req, res): Promise<void> => {
  const code = typeof req.query.code === "string" ? req.query.code.trim().toUpperCase() : "";
  const subtotal = Number(req.query.subtotal ?? 0);
  if (!code) { res.status(400).json({ error: "Informe o cupom" }); return; }

  const [row] = await db.select().from(couponsTable).where(eq(couponsTable.code, code)).limit(1);
  const today = new Date().toISOString().slice(0, 10);
  if (!row || !row.active) { res.status(404).json({ error: "Cupom inativo ou não encontrado" }); return; }
  if (row.startsAt && row.startsAt > today) { res.status(400).json({ error: "Cupom ainda não está válido" }); return; }
  if (row.endsAt && row.endsAt < today) { res.status(400).json({ error: "Cupom expirado" }); return; }
  if (subtotal < Number(row.minOrder)) { res.status(400).json({ error: `Pedido mínimo de R$ ${Number(row.minOrder).toFixed(2)}` }); return; }

  const value = Number(row.value);
  const discount = row.type === "percent" ? subtotal * (value / 100) : value;
  res.json({
    ...coupon(row),
    discount: Math.min(subtotal, Math.max(0, discount)),
  });
});

router.patch("/marketing/coupons/:id", requireAuth, requirePermission("marketing"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = CouponBody.partial().safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) { res.status(400).json({ error: parsed.success ? "Invalid id" : parsed.error.message }); return; }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.value !== undefined) data.value = String(parsed.data.value);
  if (parsed.data.minOrder !== undefined) data.minOrder = String(parsed.data.minOrder);
  const [row] = await db.update(couponsTable).set(data).where(eq(couponsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Coupon not found" }); return; }
  await writeAudit(req, "update", "coupon", id);
  res.json(coupon(row));
});

router.delete("/marketing/coupons/:id", requireAuth, requirePermission("marketing"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.delete(couponsTable).where(eq(couponsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Coupon not found" }); return; }
  await writeAudit(req, "delete", "coupon", id);
  res.sendStatus(204);
});

router.get("/notifications", requireAuth, requirePermission("notifications"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(notificationsTable).orderBy(sql`created_at DESC`);
  res.json(rows.map(notification));
});

router.post("/notifications", requireAuth, requirePermission("notifications"), async (req, res): Promise<void> => {
  const parsed = NotificationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(notificationsTable).values(parsed.data).returning();
  await writeAudit(req, "create", "notification", row.id);
  res.status(201).json(notification(row));
});

router.patch("/notifications/:id/read", requireAuth, requirePermission("notifications"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Notification not found" }); return; }
  await writeAudit(req, "read", "notification", id);
  res.json(notification(row));
});

async function readBusinessSettings() {
  const rows = await db.select().from(settingsTable);
  const data = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    cashbackPercent: Number(data.cashbackPercent ?? 0),
    loyaltyPointsPerCurrency: Number(data.loyaltyPointsPerCurrency ?? 1),
    whatsappNumber: data.whatsappNumber ?? "",
    pixKey: data.pixKey ?? "",
    privacyPolicyUrl: data.privacyPolicyUrl ?? "",
    businessName: data.businessName ?? "Rochelle Ataide",
    businessSubtitle: data.businessSubtitle ?? "Confeitaria Artesanal",
    businessDescription: data.businessDescription ?? "Confeitaria artesanal feita com amor e dedicação.",
    instagram: data.instagram ?? "@rochelleataideconfeitaria",
    location: data.location ?? "São Paulo, SP",
    serviceNote: data.serviceNote ?? "Atendimento com hora marcada",
    recipeFixedCost: Number(data.recipeFixedCost ?? 0),
    recipeVariableCost: Number(data.recipeVariableCost ?? 0),
  };
}

router.get("/settings/public", async (_req, res): Promise<void> => {
  const { recipeFixedCost: _recipeFixedCost, recipeVariableCost: _recipeVariableCost, ...publicSettings } = await readBusinessSettings();
  res.json(publicSettings);
});

router.get("/settings/business", requireAuth, requirePermission("settings"), async (_req, res): Promise<void> => {
  res.json(await readBusinessSettings());
});

router.get("/settings/recipe-costs", requireAuth, async (_req, res): Promise<void> => {
  const settings = await readBusinessSettings();
  res.json({
    recipeFixedCost: settings.recipeFixedCost,
    recipeVariableCost: settings.recipeVariableCost,
  });
});

router.put("/settings/business", requireAuth, requirePermission("settings"), async (req, res): Promise<void> => {
  const parsed = SettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const entries = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  for (const [key, value] of entries) {
    await db.insert(settingsTable).values({ key, value: String(value) }).onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: String(value) },
    });
  }
  await writeAudit(req, "update", "settings", "business");
  res.json({ ok: true });
});

router.get("/settings/costs", requireAuth, requirePermission("settings"), async (_req, res): Promise<void> => {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "pricingCosts")).limit(1);
  let costs: z.infer<typeof CostItemBody>[] = [];
  try {
    costs = row?.value ? JSON.parse(row.value) : [];
  } catch {
    costs = [];
  }

  res.json({
    costs: costs.map((cost) => ({
      ...cost,
      amountType: cost.type === "fixed" ? "currency" : cost.amountType,
      amount: Number(cost.amount || 0),
    })),
  });
});

router.put("/settings/costs", requireAuth, requirePermission("settings"), async (req, res): Promise<void> => {
  const parsed = PricingCostsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const costs = parsed.data.costs.map((cost) => ({
    ...cost,
    amountType: cost.type === "fixed" ? "currency" : cost.amountType,
  }));

  await db.insert(settingsTable).values({ key: "pricingCosts", value: JSON.stringify(costs) }).onConflictDoUpdate({
    target: settingsTable.key,
    set: { value: JSON.stringify(costs) },
  });
  await writeAudit(req, "update", "settings", "costs");
  res.json({ costs });
});

export default router;
