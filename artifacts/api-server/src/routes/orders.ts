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
import { requireAuth, requirePermission } from "../lib/auth";
import { createRateLimit } from "../lib/security";
import { getFirebaseErrorCode, sendNewOrderPush } from "../lib/firebase-admin";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const createOrderRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

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

  await db.insert(financialEntriesTable).values({
    ...paidOrderEntryValues(order),
  });
}

function paidOrderEntryValues(order: typeof ordersTable.$inferSelect) {
  const today = new Date().toISOString().slice(0, 10);
  const saleAmount = Math.max(0, Number(order.total) - Number(order.deliveryFee ?? 0));
  return {
    type: "receivable",
    description: `Pedido #${order.id}`,
    amount: String(saleAmount),
    dueDate: today,
    paidAt: today,
    paid: true,
    counterpart: order.customerName ?? "Cliente",
    category: "Venda",
    orderId: order.id,
  };
}

router.get("/orders", requireAuth, requirePermission("orders"), async (req, res): Promise<void> => {
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

router.post("/orders", createOrderRateLimit, async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { items, ...orderData } = parsed.data;
  if (orderData.deliveryType === "pickup" && !orderData.deliveryDate) {
    res.status(400).json({ error: "Delivery date is required for pickup orders" });
    return;
  }
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
  try {
    const pushResult = await sendNewOrderPush(order.id);
    logger.info({ orderId: order.id, ...pushResult }, "Firebase order notification attempt completed");
  } catch (error) {
    logger.warn({
      orderId: order.id,
      errorType: error instanceof Error ? error.name : "UnknownError",
      errorCode: getFirebaseErrorCode(error),
    }, "Firebase order notification was not sent");
  }
  res.status(201).json(result);
});

router.get("/orders/:id", requireAuth, requirePermission("orders"), async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const result = await getOrderWithItems(params.data.id);
  if (!result) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(result);
});

router.patch("/orders/:id", requireAuth, requirePermission("orders"), async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select({ deliveryType: ordersTable.deliveryType, deliveryDate: ordersTable.deliveryDate })
    .from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }
  const nextDeliveryType = parsed.data.deliveryType ?? existing.deliveryType;
  const nextDeliveryDate = parsed.data.deliveryDate === undefined ? existing.deliveryDate : parsed.data.deliveryDate;
  if (nextDeliveryType === "pickup" && !nextDeliveryDate) {
    res.status(400).json({ error: "Delivery date is required for pickup orders" });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.deliveryFee !== undefined) updateData.deliveryFee = String(parsed.data.deliveryFee);

  const [o] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, params.data.id)).returning();
  if (!o) { res.status(404).json({ error: "Order not found" }); return; }
  const result = await getOrderWithItems(o.id);
  res.json(result);
});

router.delete("/orders/:id", requireAuth, requirePermission("orders"), async (req, res): Promise<void> => {
  const params = DeleteOrderParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, params.data.id));
  const [o] = await db.delete(ordersTable).where(eq(ordersTable.id, params.data.id)).returning();
  if (!o) { res.status(404).json({ error: "Order not found" }); return; }
  res.sendStatus(204);
});

router.patch("/orders/:id/status", requireAuth, requirePermission("orders"), async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select({ paymentMethod: ordersTable.paymentMethod, deliveryType: ordersTable.deliveryType })
    .from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  const paymentAtDelivery = existing.deliveryType === "delivery"
    && (existing.paymentMethod === "cash" || existing.paymentMethod === "credit_card" || existing.paymentMethod === "debit_card");
  if (parsed.data.status === "paid" && paymentAtDelivery) {
    res.status(409).json({ error: "Pedidos para entrega em dinheiro ou cartão só devem ser marcados como pagos após a confirmação do recebimento." });
    return;
  }

  const [o] = await db.update(ordersTable).set({
    status: parsed.data.status,
    ...(parsed.data.status === "paid" ? { paymentStatus: "paid" } : {}),
  }).where(eq(ordersTable.id, params.data.id)).returning();
  if (!o) { res.status(404).json({ error: "Order not found" }); return; }
  if (parsed.data.status === "paid") {
    await ensureFinancialEntryForPaidOrder(o);
  }
  const result = await getOrderWithItems(o.id);
  res.json(result);
});

router.patch("/orders/:id/payment", requireAuth, requirePermission("orders"), async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const outcome = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(ordersTable)
      .where(eq(ordersTable.id, params.data.id))
      .for("update");
    if (!order) return "not_found" as const;
    if (order.status !== "delivered") return "not_delivered" as const;
    if (order.paymentStatus === "paid") return "already_paid" as const;

    await tx.update(ordersTable).set({ paymentStatus: "paid" }).where(eq(ordersTable.id, order.id));
    const existingEntry = await tx.select({ id: financialEntriesTable.id }).from(financialEntriesTable)
      .where(sql`order_id = ${order.id} AND type = 'receivable'`)
      .limit(1);
    if (existingEntry.length === 0) {
      await tx.insert(financialEntriesTable).values(paidOrderEntryValues(order));
    }
    return "paid" as const;
  });

  if (outcome === "not_found") { res.status(404).json({ error: "Order not found" }); return; }
  if (outcome === "not_delivered") {
    res.status(409).json({ error: "Confirme o pagamento somente depois que o pedido for entregue." });
    return;
  }

  const result = await getOrderWithItems(params.data.id);
  res.json(result);
});

export default router;
