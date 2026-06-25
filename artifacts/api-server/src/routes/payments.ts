import { Router, type IRouter, type Request } from "express";
import { z } from "zod/v4";
import { eq, sql } from "drizzle-orm";
import {
  db,
  financialEntriesTable,
  orderItemsTable,
  ordersTable,
  paymentsTable,
} from "@workspace/db";
import { requireAuth, requirePermission } from "../lib/auth";

const router: IRouter = Router();

const CheckoutBody = z.object({
  orderId: z.coerce.number().int().positive(),
});

const PicPayCheckoutBody = CheckoutBody.extend({
  buyerEmail: z.string().email(),
  buyerDocument: z.string().min(11),
});

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPaymentResponse = {
  id: number | string;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  date_approved?: string;
};

type PicPayPaymentResponse = {
  referenceId?: string;
  paymentUrl?: string;
  qrcode?: {
    content?: string;
    base64?: string;
  };
  status?: string;
  authorizationId?: string;
};

function publicBaseUrl(req: Request) {
  return process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`;
}

function formatPayment(row: typeof paymentsTable.$inferSelect) {
  return {
    ...row,
    amount: Number(row.amount),
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function markOrderPaid(orderId: number, payment: MercadoPagoPaymentResponse | PicPayPaymentResponse, provider: string) {
  const paidAt = "date_approved" in payment && payment.date_approved ? new Date(payment.date_approved) : new Date();
  await db.update(ordersTable).set({ status: "paid" }).where(eq(ordersTable.id, orderId));
  await db.update(paymentsTable)
    .set({
      status: payment.status ?? "paid",
      providerPaymentId: "id" in payment ? String(payment.id) : payment.authorizationId ?? null,
      rawPayload: JSON.stringify(payment),
      paidAt,
    })
    .where(eq(paymentsTable.orderId, orderId));

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) return;

  const today = new Date().toISOString().slice(0, 10);
  const existing = await db.select().from(financialEntriesTable)
    .where(sql`order_id = ${orderId} AND type = 'receivable' AND category = 'Venda online'`)
    .limit(1);
  if (existing.length === 0) {
    await db.insert(financialEntriesTable).values({
      type: "receivable",
      description: `Pedido #${orderId} - ${provider}`,
      amount: String(order.total),
      dueDate: today,
      paidAt: today,
      paid: true,
      counterpart: order.customerName ?? "Cliente loja online",
      category: "Venda online",
      orderId,
    });
  }
}

router.get("/payments/order/:orderId", requireAuth, requirePermission("financial"), async (req, res): Promise<void> => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId)) { res.status(400).json({ error: "Invalid order id" }); return; }
  const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.orderId, orderId));
  res.json(rows.map(formatPayment));
});

router.post("/payments/picpay/checkout", async (req, res): Promise<void> => {
  const parsed = PicPayCheckoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const amount = Number(order.total);
  const externalReference = `order:${order.id}`;
  const picpayToken = process.env.PICPAY_TOKEN;
  if (!picpayToken) {
    const [payment] = await db.insert(paymentsTable).values({
      orderId: order.id,
      provider: "picpay",
      status: "configuration_required",
      amount: String(amount),
      externalReference,
      rawPayload: JSON.stringify({ reason: "PICPAY_TOKEN missing" }),
    }).returning();
    await db.update(ordersTable).set({ status: "awaiting_payment" }).where(eq(ordersTable.id, order.id));
    res.status(202).json({
      configured: false,
      message: "PicPay ainda nao esta configurado.",
      payment: formatPayment(payment),
    });
    return;
  }

  const baseUrl = publicBaseUrl(req);
  const names = (order.customerName ?? "Cliente").trim().split(/\s+/);
  const firstName = names[0] ?? "Cliente";
  const lastName = names.slice(1).join(" ") || "Confeitaria";
  const phoneDigits = (order.customerPhone ?? "").replace(/\D/g, "");
  const apiBase = process.env.PICPAY_API_BASE || "https://appws.picpay.com/ecommerce/public";
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  const response = await fetch(`${apiBase}/payments`, {
    method: "POST",
    headers: {
      "x-picpay-token": picpayToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      referenceId: externalReference,
      callbackUrl: `${baseUrl}/api/payments/picpay/webhook`,
      returnUrl: `${baseUrl}/cardapio/sucesso?id=${order.id}&payment=pending`,
      value: amount,
      expiresAt,
      buyer: {
        firstName,
        lastName,
        document: parsed.data.buyerDocument.replace(/\D/g, ""),
        email: parsed.data.buyerEmail,
        phone: phoneDigits,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    res.status(502).json({ error: "PicPay payment creation failed", detail: text });
    return;
  }

  const picpay = await response.json() as PicPayPaymentResponse;
  const [payment] = await db.insert(paymentsTable).values({
    orderId: order.id,
    provider: "picpay",
    status: picpay.status ?? "pending",
    amount: String(amount),
    paymentUrl: picpay.paymentUrl ?? null,
    externalReference,
    providerPreferenceId: picpay.referenceId ?? externalReference,
    rawPayload: JSON.stringify(picpay),
  }).returning();
  await db.update(ordersTable).set({ status: "awaiting_payment" }).where(eq(ordersTable.id, order.id));

  res.status(201).json({
    configured: true,
    checkoutUrl: picpay.paymentUrl ?? null,
    qrCode: picpay.qrcode ?? null,
    payment: formatPayment(payment),
  });
});

router.post("/payments/picpay/webhook", async (req, res): Promise<void> => {
  const referenceId = String(req.body?.referenceId ?? req.query.referenceId ?? "");
  const match = /^order:(\d+)$/.exec(referenceId);
  if (!match) { res.json({ ok: true }); return; }

  const status = String(req.body?.status ?? "").toLowerCase();
  const orderId = Number(match[1]);
  const payload = req.body as PicPayPaymentResponse;

  if (["paid", "completed", "approved"].includes(status)) {
    await markOrderPaid(orderId, { ...payload, status: status || "paid" }, "PicPay");
  } else if (status) {
    await db.update(paymentsTable)
      .set({ status, rawPayload: JSON.stringify(req.body) })
      .where(eq(paymentsTable.orderId, orderId));
  }

  res.json({ ok: true });
});

router.post("/payments/checkout", async (req, res): Promise<void> => {
  const parsed = CheckoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const externalReference = `order:${order.id}`;
  const amount = Number(order.total);

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) {
    const [payment] = await db.insert(paymentsTable).values({
      orderId: order.id,
      status: "configuration_required",
      amount: String(amount),
      externalReference,
      rawPayload: JSON.stringify({ reason: "MERCADO_PAGO_ACCESS_TOKEN missing" }),
    }).returning();
    await db.update(ordersTable).set({ status: "awaiting_payment" }).where(eq(ordersTable.id, order.id));
    res.status(202).json({
      configured: false,
      message: "Mercado Pago ainda nao esta configurado.",
      payment: formatPayment(payment),
    });
    return;
  }

  const baseUrl = publicBaseUrl(req);
  const preferenceBody = {
    external_reference: externalReference,
    notification_url: `${baseUrl}/api/payments/webhook`,
    back_urls: {
      success: `${baseUrl}/cardapio/sucesso?id=${order.id}&payment=approved`,
      pending: `${baseUrl}/cardapio/sucesso?id=${order.id}&payment=pending`,
      failure: `${baseUrl}/cardapio/sucesso?id=${order.id}&payment=failed`,
    },
    auto_return: "approved",
    payer: {
      name: order.customerName ?? undefined,
    },
    items: items.map((item) => ({
      id: String(item.productId),
      title: item.productName,
      quantity: item.quantity,
      unit_price: Number(item.unitPrice),
      currency_id: "BRL",
    })),
    shipments: Number(order.deliveryFee) > 0 ? { cost: Number(order.deliveryFee), mode: "not_specified" } : undefined,
  };

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(preferenceBody),
  });

  if (!response.ok) {
    const text = await response.text();
    res.status(502).json({ error: "Mercado Pago preference failed", detail: text });
    return;
  }

  const preference = await response.json() as MercadoPagoPreferenceResponse;
  const paymentUrl = preference.init_point ?? preference.sandbox_init_point ?? null;
  const [payment] = await db.insert(paymentsTable).values({
    orderId: order.id,
    status: "pending",
    amount: String(amount),
    paymentUrl,
    externalReference,
    providerPreferenceId: preference.id,
    rawPayload: JSON.stringify(preference),
  }).returning();
  await db.update(ordersTable).set({ status: "awaiting_payment" }).where(eq(ordersTable.id, order.id));

  res.status(201).json({
    configured: true,
    checkoutUrl: paymentUrl,
    payment: formatPayment(payment),
  });
});

router.post("/payments/webhook", async (req, res): Promise<void> => {
  const paymentId = req.query["data.id"] ?? req.query.id ?? req.body?.data?.id ?? req.body?.id;
  if (!paymentId) { res.json({ ok: true }); return; }
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) { res.json({ ok: true }); return; }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) { res.json({ ok: true }); return; }
  const payment = await response.json() as MercadoPagoPaymentResponse;
  const match = /^order:(\d+)$/.exec(payment.external_reference ?? "");
  if (match && payment.status === "approved") {
    await markOrderPaid(Number(match[1]), payment, "Mercado Pago");
  } else if (match) {
    await db.update(paymentsTable)
      .set({
        status: payment.status,
        providerPaymentId: String(payment.id),
        rawPayload: JSON.stringify(payment),
      })
      .where(eq(paymentsTable.orderId, Number(match[1])));
  }
  res.json({ ok: true });
});

export default router;
