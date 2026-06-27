import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, customersTable, productsTable, financialEntriesTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  CreateOrderBody,
  UpdateOrderBody,
  ListOrdersQueryParams,
  GetOrderParams,
  UpdateOrderParams,
  DeleteOrderParams,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrderWithItems(orderId: number) {
  const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!o) return null;
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  return {
    ...o,
    total: Number(o.total),
    deliveryFee: Number(o.deliveryFee),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: items.map((i) => ({
      ...i,
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal),
    })),
  };
}

async function ensureCustomerForOrder(orderData: {
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
}) {
  if (orderData.customerId || !orderData.customerName || !orderData.customerPhone) return orderData.customerId;

  const phoneDigits = orderData.customerPhone.replace(/\D/g, "");
  const [existing] = await db.select().from(customersTable)
    .where(sql`regexp_replace(coalesce(${customersTable.phone}, ''), '\\D', '', 'g') = ${phoneDigits} OR regexp_replace(coalesce(${customersTable.whatsapp}, ''), '\\D', '', 'g') = ${phoneDigits}`)
    .limit(1);
  if (existing) return existing.id;

  const [customer] = await db.insert(customersTable).values({
    name: orderData.customerName,
    phone: phoneDigits || orderData.customerPhone,
    whatsapp: orderData.customerPhone,
    address: orderData.deliveryAddress,
  }).returning();
  return customer.id;
}

async function ensureFinancialEntryForPaidOrder(order: typeof ordersTable.$inferSelect) {
  const existing = await db.select().from(financialEntriesTable)
    .where(sql`order_id = ${order.id} AND type = 'receivable'`)
    .limit(1);
  if (existing.length > 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const saleAmount = Math.max(0, Number(order.total) - Number(order.deliveryFee ?? 0));
  await db.insert(financialEntriesTable).values({
    type: "receivable",
    description: `Pedido #${order.id}`,
    amount: String(saleAmount),
    dueDate: today,
    paidAt: today,
    paid: true,
    counterpart: order.customerName ?? "Cliente",
    category: "Venda",
    orderId: order.id,
  });
}

router.get("/orders", async (req, res): Promise<void> => {
  const qp = ListOrdersQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const conditions = [];
  if (qp.data.status) conditions.push(eq(ordersTable.status, qp.data.status));
  if (qp.data.customerId) conditions.push(eq(ordersTable.customerId, qp.data.customerId));
  if (qp.data.date) conditions.push(sql`date(created_at) = ${qp.data.date}`);

  const orders = await db.select().from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`created_at DESC`);

  const result = await Promise.all(
    orders.map(async (o) => {
      const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, o.id));
      return {
        ...o,
        total: Number(o.total),
        deliveryFee: Number(o.deliveryFee),
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        items: items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), subtotal: Number(i.subtotal) })),
      };
    })
  );

  res.json(result);
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { items, ...orderData } = parsed.data;
  const total = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0) + (orderData.deliveryFee ?? 0);
  const customerId = await ensureCustomerForOrder(orderData);

  const [order] = await db.insert(ordersTable).values({
    ...orderData,
    customerId,
    total: String(total),
    deliveryFee: orderData.deliveryFee !== undefined ? String(orderData.deliveryFee) : "0",
  }).returning();

  if (items.length > 0) {
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
    const productNames = new Map(products.map((p) => [p.id, p.name]));

    await db.insert(orderItemsTable).values(
      items.map((i) => ({
        orderId: order.id,
        productId: i.productId,
        productName: productNames.get(i.productId) ?? `Produto #${i.productId}`,
        quantity: i.quantity,
        unitPrice: String(i.unitPrice),
        subtotal: String(i.unitPrice * i.quantity),
        notes: i.notes,
      }))
    );
  }

  // update customer stats if customerId provided
  if (customerId) {
    await db.execute(sql`
      UPDATE customers SET 
        total_orders = total_orders + 1,
        total_spent = total_spent + ${total},
        loyalty_points = loyalty_points + ${Math.floor(total)},
        last_order_at = now()
      WHERE id = ${customerId}
    `);
  }

  const result = await getOrderWithItems(order.id);
  res.status(201).json(result);
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const result = await getOrderWithItems(params.data.id);
  if (!result) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(result);
});

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.deliveryFee !== undefined) updateData.deliveryFee = String(parsed.data.deliveryFee);

  const [o] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, params.data.id)).returning();
  if (!o) { res.status(404).json({ error: "Order not found" }); return; }
  const result = await getOrderWithItems(o.id);
  res.json(result);
});

router.delete("/orders/:id", async (req, res): Promise<void> => {
  const params = DeleteOrderParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, params.data.id));
  const [o] = await db.delete(ordersTable).where(eq(ordersTable.id, params.data.id)).returning();
  if (!o) { res.status(404).json({ error: "Order not found" }); return; }
  res.sendStatus(204);
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [o] = await db.update(ordersTable).set({ status: parsed.data.status }).where(eq(ordersTable.id, params.data.id)).returning();
  if (!o) { res.status(404).json({ error: "Order not found" }); return; }
  if (parsed.data.status === "paid") {
    await ensureFinancialEntryForPaidOrder(o);
  }
  const result = await getOrderWithItems(o.id);
  res.json(result);
});

export default router;
