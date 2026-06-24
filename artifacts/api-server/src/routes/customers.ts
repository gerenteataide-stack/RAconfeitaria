import { Router, type IRouter } from "express";
import { db, customersTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, ilike, desc } from "drizzle-orm";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  ListCustomersQueryParams,
  GetCustomerParams,
  UpdateCustomerParams,
  DeleteCustomerParams,
  GetCustomerHistoryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatCustomer(c: Record<string, unknown>) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    whatsapp: c.whatsapp ?? null,
    email: c.email ?? null,
    birthDate: c.birthDate ?? null,
    address: c.address ?? null,
    neighborhood: c.neighborhood ?? null,
    city: c.city ?? null,
    notes: c.notes ?? null,
    loyaltyPoints: Number(c.loyaltyPoints ?? 0),
    totalSpent: Number(c.totalSpent ?? 0),
    totalOrders: Number(c.totalOrders ?? 0),
    lastOrderAt: c.lastOrderAt ? (c.lastOrderAt instanceof Date ? c.lastOrderAt.toISOString() : c.lastOrderAt) : null,
    createdAt: c.createdAt instanceof Date ? (c.createdAt as Date).toISOString() : c.createdAt,
  };
}

router.get("/customers", async (req, res): Promise<void> => {
  const qp = ListCustomersQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const rows = await db.select().from(customersTable)
    .where(qp.data.search ? ilike(customersTable.name, `%${qp.data.search}%`) : undefined)
    .orderBy(customersTable.name);

  res.json(rows.map((c) => formatCustomer(c as Record<string, unknown>)));
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [c] = await db.insert(customersTable).values(parsed.data).returning();
  res.status(201).json(formatCustomer(c as Record<string, unknown>));
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));
  if (!c) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(formatCustomer(c as Record<string, unknown>));
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [c] = await db.update(customersTable).set(parsed.data).where(eq(customersTable.id, params.data.id)).returning();
  if (!c) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json(formatCustomer(c as Record<string, unknown>));
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [c] = await db.delete(customersTable).where(eq(customersTable.id, params.data.id)).returning();
  if (!c) { res.status(404).json({ error: "Customer not found" }); return; }
  res.sendStatus(204);
});

router.get("/customers/:id/history", async (req, res): Promise<void> => {
  const params = GetCustomerHistoryParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));
  if (!c) { res.status(404).json({ error: "Customer not found" }); return; }

  const orders = await db.select().from(ordersTable)
    .where(eq(ordersTable.customerId, params.data.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(20);

  const ordersWithItems = await Promise.all(
    orders.map(async (o) => {
      const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));
      return {
        ...o,
        total: Number(o.total),
        deliveryFee: Number(o.deliveryFee),
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        items: items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), subtotal: Number(i.subtotal), createdAt: undefined })),
      };
    })
  );

  res.json({
    customerId: params.data.id,
    totalOrders: Number(c.totalOrders),
    totalSpent: Number(c.totalSpent),
    avgTicket: Number(c.totalOrders) > 0 ? Number(c.totalSpent) / Number(c.totalOrders) : 0,
    loyaltyPoints: c.loyaltyPoints,
    lastOrderAt: c.lastOrderAt ? (c.lastOrderAt instanceof Date ? c.lastOrderAt.toISOString() : c.lastOrderAt) : null,
    orders: ordersWithItems,
  });
});

export default router;
