import { Router, type IRouter } from "express";
import { db, financialEntriesTable, generalCostsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  CreateFinancialEntryBody,
  UpdateFinancialEntryBody,
  ListFinancialEntriesQueryParams,
  UpdateFinancialEntryParams,
  DeleteFinancialEntryParams,
  GetCashFlowQueryParams,
  GetDreQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatEntry(e: Record<string, unknown>) {
  return {
    id: e.id,
    type: e.type,
    description: e.description,
    amount: Number(e.amount),
    dueDate: e.dueDate,
    paidAt: e.paidAt ?? null,
    paid: e.paid,
    counterpart: e.counterpart ?? null,
    category: e.category ?? null,
    orderId: e.orderId ?? null,
    createdAt: e.createdAt instanceof Date ? (e.createdAt as Date).toISOString() : e.createdAt,
  };
}

router.get("/financial/entries", async (req, res): Promise<void> => {
  const qp = ListFinancialEntriesQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const conditions = [];
  if (qp.data.type) conditions.push(eq(financialEntriesTable.type, qp.data.type));
  if (qp.data.month) conditions.push(sql`to_char(due_date::date, 'YYYY-MM') = ${qp.data.month}`);

  const rows = await db.select().from(financialEntriesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(financialEntriesTable.dueDate);

  res.json(rows.map((e) => formatEntry(e as Record<string, unknown>)));
});

router.post("/financial/entries", async (req, res): Promise<void> => {
  const parsed = CreateFinancialEntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [e] = await db.insert(financialEntriesTable).values({
    ...parsed.data,
    amount: String(parsed.data.amount),
  }).returning();
  res.status(201).json(formatEntry(e as Record<string, unknown>));
});

router.patch("/financial/entries/:id", async (req, res): Promise<void> => {
  const params = UpdateFinancialEntryParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateFinancialEntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);

  const [e] = await db.update(financialEntriesTable).set(updateData).where(eq(financialEntriesTable.id, params.data.id)).returning();
  if (!e) { res.status(404).json({ error: "Financial entry not found" }); return; }
  res.json(formatEntry(e as Record<string, unknown>));
});

router.delete("/financial/entries/:id", async (req, res): Promise<void> => {
  const params = DeleteFinancialEntryParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [e] = await db.delete(financialEntriesTable).where(eq(financialEntriesTable.id, params.data.id)).returning();
  if (!e) { res.status(404).json({ error: "Financial entry not found" }); return; }
  res.sendStatus(204);
});

router.get("/financial/cashflow", async (req, res): Promise<void> => {
  const qp = GetCashFlowQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const month = qp.data.month ?? new Date().toISOString().slice(0, 7);
  const entries = await db.select().from(financialEntriesTable)
    .where(sql`to_char(due_date::date, 'YYYY-MM') = ${month}`)
    .orderBy(financialEntriesTable.dueDate);

  const inflows = entries.filter((e) => e.type === "receivable").reduce((acc, e) => acc + Number(e.amount), 0);
  const outflows = entries.filter((e) => e.type === "payable").reduce((acc, e) => acc + Number(e.amount), 0);

  res.json({
    month,
    totalInflows: inflows,
    totalOutflows: outflows,
    balance: inflows - outflows,
    entries: entries.map((e) => formatEntry(e as Record<string, unknown>)),
  });
});

router.get("/financial/dre", async (req, res): Promise<void> => {
  const qp = GetDreQueryParams.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: qp.error.message }); return; }

  const month = qp.data.month ?? new Date().toISOString().slice(0, 7);
  const entries = await db.select().from(financialEntriesTable)
    .where(sql`to_char(due_date::date, 'YYYY-MM') = ${month}`);
  const generalCosts = await db.select().from(generalCostsTable)
    .where(eq(generalCostsTable.active, true));

  const revenue = entries.filter((e) => e.type === "receivable").reduce((acc, e) => acc + Number(e.amount), 0);
  const allCosts = entries.filter((e) => e.type === "payable").reduce((acc, e) => acc + Number(e.amount), 0);
  const productCost = allCosts * 0.6; // estimate 60% are product costs
  const expenses = allCosts * 0.4;
  const grossProfit = revenue - productCost;
  const variablePercent = generalCosts
    .filter((cost) => cost.type === "variable" && cost.applyToDirectSale)
    .reduce((acc, cost) => acc + Number(cost.value), 0);
  const variableSalesCost = revenue * (variablePercent / 100);
  const contributionMargin = grossProfit - variableSalesCost;
  const contributionMarginPercent = revenue > 0 ? contributionMargin / revenue : 0;
  const registeredFixedCosts = generalCosts
    .filter((cost) => cost.type === "monthly_fixed")
    .reduce((acc, cost) => acc + Number(cost.value), 0);
  const fixedCosts = registeredFixedCosts;
  const breakEvenContributionPercent = Math.max(0, 1 - (variablePercent / 100));
  const breakEvenRevenue = breakEvenContributionPercent > 0 ? fixedCosts / breakEvenContributionPercent : 0;
  const netProfit = contributionMargin - fixedCosts;
  const cmvPercent = revenue > 0 ? (productCost / revenue) * 100 : 0;

  res.json({
    month,
    revenue,
    productCost,
    grossProfit,
    expenses,
    fixedCosts,
    variableSalesCost,
    contributionMargin,
    contributionMarginPercent: breakEvenContributionPercent,
    breakEvenRevenue,
    netProfit,
    cmvPercent,
  });
});

export default router;
