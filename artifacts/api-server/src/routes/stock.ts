import { Router, type IRouter } from "express";
import { db, stockItemsTable, stockMovementsTable } from "@workspace/db";
import { desc, eq, ilike, and, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  ListStockItemsQueryParams,
  GetStockItemParams,
  UpdateStockItemParams,
  DeleteStockItemParams,
  AddStockMovementParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const StockItemBody = z.object({
  name: z.string().min(1),
  ingredientType: z.enum(["comprado", "fabricado", "produto"]).default("comprado"),
  unit: z.string().min(1).default("un"),
  packageContent: z.coerce.number().min(0).default(1),
  packagePrice: z.coerce.number().min(0).default(0),
  yieldPercent: z.coerce.number().min(0).max(100).default(100),
  quantity: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  unitCost: z.coerce.number().min(0).optional(),
  supplier: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});

const StockMovementBody = z.object({
  type: z.enum(["entry", "exit"]),
  quantity: z.coerce.number().positive(),
  reason: z.string().optional(),
  movementDate: z.coerce.date().optional(),
});

function calculatedUnitCost(data: { packageContent?: number; packagePrice?: number; unitCost?: number }) {
  if (data.unitCost !== undefined && data.unitCost > 0) return data.unitCost;
  const content = Number(data.packageContent ?? 0);
  if (content <= 0) return 0;
  return Number(data.packagePrice ?? 0) / content;
}

function formatStock(s: Record<string, unknown>) {
  const qty = Number(s.quantity ?? 0);
  const min = Number(s.minStock ?? 0);
  return {
    id: s.id,
    name: s.name,
    ingredientType: s.ingredientType ?? "comprado",
    unit: s.unit,
    packageContent: Number(s.packageContent ?? 1),
    packagePrice: Number(s.packagePrice ?? 0),
    yieldPercent: Number(s.yieldPercent ?? 100),
    quantity: qty,
    minStock: min,
    unitCost: Number(s.unitCost ?? 0),
    supplier: s.supplier ?? null,
    active: s.active ?? true,
    isLow: qty <= min,
    createdAt: s.createdAt instanceof Date ? (s.createdAt as Date).toISOString() : s.createdAt,
    updatedAt: s.updatedAt instanceof Date ? (s.updatedAt as Date).toISOString() : s.updatedAt,
  };
}

function formatMovement(row: Record<string, unknown>) {
  return {
    id: row.id,
    stockItemId: row.stockItemId,
    stockItemName: row.stockItemName,
    type: row.type,
    quantity: Number(row.quantity ?? 0),
    reason: row.reason ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

router.get("/stock", async (req, res): Promise<void> => {
  const qp = ListStockItemsQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const rows = await db.select().from(stockItemsTable)
    .where(
      and(
        qp.data.search ? ilike(stockItemsTable.name, `%${qp.data.search}%`) : undefined,
        qp.data.lowStock ? sql`quantity::numeric <= min_stock::numeric` : undefined,
      )
    )
    .orderBy(stockItemsTable.name);

  res.json(rows.map((s) => formatStock(s as Record<string, unknown>)));
});

router.post("/stock", async (req, res): Promise<void> => {
  const parsed = StockItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const unitCost = calculatedUnitCost(parsed.data);
  const [s] = await db.insert(stockItemsTable).values({
    ...parsed.data,
    packageContent: String(parsed.data.packageContent),
    packagePrice: String(parsed.data.packagePrice),
    yieldPercent: String(parsed.data.yieldPercent),
    quantity: String(parsed.data.quantity),
    minStock: String(parsed.data.minStock),
    unitCost: String(unitCost),
  }).returning();
  res.status(201).json(formatStock(s as Record<string, unknown>));
});

router.get("/stock/:id", async (req, res): Promise<void> => {
  const params = GetStockItemParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [s] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, params.data.id));
  if (!s) { res.status(404).json({ error: "Stock item not found" }); return; }
  res.json(formatStock(s as Record<string, unknown>));
});

router.get("/stock-movements", async (req, res): Promise<void> => {
  const date = typeof req.query.date === "string" ? req.query.date : "";
  const rows = await db.select({
    id: stockMovementsTable.id,
    stockItemId: stockMovementsTable.stockItemId,
    stockItemName: stockItemsTable.name,
    type: stockMovementsTable.type,
    quantity: stockMovementsTable.quantity,
    reason: stockMovementsTable.reason,
    createdAt: stockMovementsTable.createdAt,
  })
    .from(stockMovementsTable)
    .leftJoin(stockItemsTable, eq(stockItemsTable.id, stockMovementsTable.stockItemId))
    .where(date ? sql`date(${stockMovementsTable.createdAt}) = ${date}` : undefined)
    .orderBy(desc(stockMovementsTable.createdAt))
    .limit(80);

  res.json(rows.map((row) => formatMovement(row as Record<string, unknown>)));
});

router.patch("/stock/:id", async (req, res): Promise<void> => {
  const params = UpdateStockItemParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = StockItemBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.packageContent !== undefined) updateData.packageContent = String(parsed.data.packageContent);
  if (parsed.data.packagePrice !== undefined) updateData.packagePrice = String(parsed.data.packagePrice);
  if (parsed.data.yieldPercent !== undefined) updateData.yieldPercent = String(parsed.data.yieldPercent);
  if (parsed.data.quantity !== undefined) updateData.quantity = String(parsed.data.quantity);
  if (parsed.data.minStock !== undefined) updateData.minStock = String(parsed.data.minStock);
  if (parsed.data.unitCost !== undefined || parsed.data.packageContent !== undefined || parsed.data.packagePrice !== undefined) {
    const [current] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, params.data.id));
    updateData.unitCost = String(calculatedUnitCost({
      packageContent: parsed.data.packageContent ?? Number(current?.packageContent ?? 0),
      packagePrice: parsed.data.packagePrice ?? Number(current?.packagePrice ?? 0),
      unitCost: parsed.data.unitCost,
    }));
  }

  const [s] = await db.update(stockItemsTable).set(updateData).where(eq(stockItemsTable.id, params.data.id)).returning();
  if (!s) { res.status(404).json({ error: "Stock item not found" }); return; }
  res.json(formatStock(s as Record<string, unknown>));
});

router.delete("/stock/:id", async (req, res): Promise<void> => {
  const params = DeleteStockItemParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [s] = await db.delete(stockItemsTable).where(eq(stockItemsTable.id, params.data.id)).returning();
  if (!s) { res.status(404).json({ error: "Stock item not found" }); return; }
  res.sendStatus(204);
});

router.post("/stock/:id/movement", async (req, res): Promise<void> => {
  const params = AddStockMovementParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = StockMovementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [current] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, params.data.id));
  if (!current) { res.status(404).json({ error: "Stock item not found" }); return; }

  const delta = parsed.data.type === "entry" ? parsed.data.quantity : -parsed.data.quantity;
  const newQty = Math.max(0, Number(current.quantity) + delta);

  await db.insert(stockMovementsTable).values({
    stockItemId: params.data.id,
    type: parsed.data.type,
    quantity: String(parsed.data.quantity),
    reason: parsed.data.reason,
    createdAt: parsed.data.movementDate ?? new Date(),
  });

  const [updated] = await db.update(stockItemsTable)
    .set({ quantity: String(newQty) })
    .where(eq(stockItemsTable.id, params.data.id))
    .returning();

  res.status(201).json(formatStock(updated as Record<string, unknown>));
});

export default router;
