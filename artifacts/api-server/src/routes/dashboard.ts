import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, productsTable, customersTable, stockItemsTable } from "@workspace/db";
import { sql, eq, gte, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";

  const [todayOrders] = await db
    .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(total::numeric), 0)` })
    .from(ordersTable)
    .where(and(sql`date(created_at) = ${today}`, sql`status != 'cancelled'`));

  const [monthOrders] = await db
    .select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(total::numeric), 0)` })
    .from(ordersTable)
    .where(and(sql`date(created_at) >= ${firstOfMonth}`, sql`status != 'cancelled'`));

  // estimate net profit as 40% of revenue
  const netProfit = Number(monthOrders.total) * 0.4;
  const avgTicket = Number(monthOrders.count) > 0 ? Number(monthOrders.total) / Number(monthOrders.count) : 0;

  // CMV = average cost/price ratio across products
  const products = await db.select({ price: productsTable.price, cost: productsTable.cost }).from(productsTable);
  const cmvProducts = products.filter((p) => p.cost && Number(p.price) > 0);
  const cmvPercent =
    cmvProducts.length > 0
      ? cmvProducts.reduce((acc, p) => acc + (Number(p.cost) / Number(p.price)) * 100, 0) / cmvProducts.length
      : 0;

  const [lowStock] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockItemsTable)
    .where(sql`quantity::numeric <= min_stock::numeric`);

  const [recurring] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customersTable)
    .where(sql`total_orders > 1`);

  res.json({
    revenueToday: Number(todayOrders.total),
    revenueMonth: Number(monthOrders.total),
    netProfit,
    avgTicket,
    ordersToday: Number(todayOrders.count),
    ordersMonth: Number(monthOrders.count),
    cmvPercent,
    lowStockCount: Number(lowStock.count),
    recurringCustomers: Number(recurring.count),
  });
});

router.get("/dashboard/sales-chart", async (req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT 
      date(created_at) as date,
      coalesce(sum(total::numeric), 0) as revenue,
      count(*) as orders
    FROM orders
    WHERE status != 'cancelled'
      AND created_at >= now() - interval '30 days'
    GROUP BY date(created_at)
    ORDER BY date(created_at)
  `);

  const points = (rows.rows as Array<{ date: string; revenue: string; orders: string }>).map((r) => ({
    date: r.date,
    revenue: Number(r.revenue),
    orders: Number(r.orders),
  }));

  res.json(points);
});

router.get("/dashboard/top-products", async (req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT 
      p.id,
      p.name,
      coalesce(sum(oi.quantity), 0) as quantity_sold,
      coalesce(sum(oi.subtotal::numeric), 0) as revenue,
      p.image_url,
      p.cost,
      p.price
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    GROUP BY p.id, p.name, p.image_url, p.cost, p.price
    ORDER BY revenue DESC
    LIMIT 10
  `);

  const topProducts = (rows.rows as Array<{
    id: number; name: string; quantity_sold: string; revenue: string; image_url: string | null; cost: string | null; price: string;
  }>).map((r) => {
    const revenue = Number(r.revenue);
    const cost = r.cost ? Number(r.cost) : Number(r.price) * 0.35;
    const profit = revenue - cost * Number(r.quantity_sold);
    return {
      id: r.id,
      name: r.name,
      quantitySold: Number(r.quantity_sold),
      revenue,
      profit,
      imageUrl: r.image_url ?? null,
    };
  });

  res.json(topProducts);
});

export default router;
