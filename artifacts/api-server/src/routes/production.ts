import { Router, type IRouter } from "express";
import { db, productionOrdersTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateProductionOrderBody,
  ListProductionOrdersQueryParams,
  UpdateProductionStatusParams,
  UpdateProductionStatusBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatProd(p: Record<string, unknown>) {
  return {
    id: p.id,
    productId: p.productId,
    productName: p.productName,
    quantity: p.quantity,
    scheduledDate: p.scheduledDate,
    scheduledTime: p.scheduledTime ?? null,
    status: p.status,
    orderId: p.orderId ?? null,
    notes: p.notes ?? null,
    createdAt: p.createdAt instanceof Date ? (p.createdAt as Date).toISOString() : p.createdAt,
  };
}

router.get("/production", async (req, res): Promise<void> => {
  const qp = ListProductionOrdersQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const conditions = [];
  if (qp.data.date) conditions.push(eq(productionOrdersTable.scheduledDate, qp.data.date));
  if (qp.data.status) conditions.push(eq(productionOrdersTable.status, qp.data.status));

  const rows = await db.select().from(productionOrdersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(productionOrdersTable.scheduledDate);

  res.json(rows.map((p) => formatProd(p as Record<string, unknown>)));
});

router.post("/production", async (req, res): Promise<void> => {
  const parsed = CreateProductionOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // look up product name
  const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  const productName = prod?.name ?? `Produto #${parsed.data.productId}`;

  const [po] = await db.insert(productionOrdersTable).values({
    ...parsed.data,
    productName,
  }).returning();

  res.status(201).json(formatProd(po as Record<string, unknown>));
});

router.patch("/production/:id/status", async (req, res): Promise<void> => {
  const params = UpdateProductionStatusParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProductionStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [po] = await db.update(productionOrdersTable)
    .set({ status: parsed.data.status })
    .where(eq(productionOrdersTable.id, params.data.id))
    .returning();
  if (!po) { res.status(404).json({ error: "Production order not found" }); return; }
  res.json(formatProd(po as Record<string, unknown>));
});

export default router;
