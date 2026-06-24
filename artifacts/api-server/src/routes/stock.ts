import { Router, type IRouter } from "express";
import { db, stockItemsTable, stockMovementsTable } from "@workspace/db";
import { eq, ilike, and, sql } from "drizzle-orm";
import {
  CreateStockItemBody,
  UpdateStockItemBody,
  ListStockItemsQueryParams,
  GetStockItemParams,
  UpdateStockItemParams,
  DeleteStockItemParams,
  AddStockMovementParams,
  AddStockMovementBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatStock(s: Record<string, unknown>) {
  const qty = Number(s.quantity ?? 0);
  const min = Number(s.minStock ?? 0);
  return {
    id: s.id,
    name: s.name,
    unit: s.unit,
    quantity: qty,
    minStock: min,
    unitCost: Number(s.unitCost ?? 0),
    supplier: s.supplier ?? null,
    isLow: qty <= min,
    createdAt: s.createdAt instanceof Date ? (s.createdAt as Date).toISOString() : s.createdAt,
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
  const parsed = CreateStockItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [s] = await db.insert(stockItemsTable).values({
    ...parsed.data,
    quantity: String(parsed.data.quantity),
    minStock: String(parsed.data.minStock),
    unitCost: String(parsed.data.unitCost),
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

router.patch("/stock/:id", async (req, res): Promise<void> => {
  const params = UpdateStockItemParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateStockItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.quantity !== undefined) updateData.quantity = String(parsed.data.quantity);
  if (parsed.data.minStock !== undefined) updateData.minStock = String(parsed.data.minStock);
  if (parsed.data.unitCost !== undefined) updateData.unitCost = String(parsed.data.unitCost);

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
  const parsed = AddStockMovementBody.safeParse(req.body);
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
  });

  const [updated] = await db.update(stockItemsTable)
    .set({ quantity: String(newQty) })
    .where(eq(stockItemsTable.id, params.data.id))
    .returning();

  res.status(201).json(formatStock(updated as Record<string, unknown>));
});

export default router;
