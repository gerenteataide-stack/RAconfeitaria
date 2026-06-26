import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  generalCostsTable,
  pricingSimulationsTable,
  productExtraCostsTable,
  productsTable,
  recipeIngredientsTable,
  recipesTable,
  stockItemsTable,
} from "@workspace/db";
import {
  calculateCMV,
  calculateContributionMargin,
  calculateFixedCostAllocation,
  calculateGrossQuantity,
  calculateIngredientCost,
  calculateMarketplacePrice,
  calculateNetProfit,
  calculateProductTotalCost,
  calculateSuggestedPriceByCMV,
  calculateSuggestedPriceByMargin,
  calculateTechnicalSheetCost,
  cmvStatus,
  filterCostsByChannel,
  splitCosts,
  type PricingCost,
  type SaleChannel,
} from "../lib/pricing";

const router: IRouter = Router();

const GeneralCostBody = z.object({
  name: z.string().min(1),
  type: z.enum(["fixed", "variable", "monthly_fixed"]).default("variable"),
  amountType: z.enum(["currency", "percent"]).default("percent"),
  value: z.coerce.number().min(0),
  applyToDirectSale: z.boolean().optional().default(true),
  applyToMarketplace: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true),
});

const ProductExtraCostBody = z.object({
  productId: z.coerce.number().int().positive(),
  name: z.string().min(1),
  type: z.enum(["fixed", "percentage"]).default("fixed"),
  value: z.coerce.number().min(0),
  active: z.boolean().optional().default(true),
});

const SimulationBody = z.object({
  productId: z.coerce.number().int().positive(),
  directSalePrice: z.coerce.number().min(0).optional(),
  marketplacePrice: z.coerce.number().min(0).optional(),
  targetCMV: z.coerce.number().min(1).max(99).default(35),
  targetMargin: z.coerce.number().min(1).max(99).default(60),
  monthlySalesEstimate: z.coerce.number().int().min(1).default(1),
});

function cost(row: typeof generalCostsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    amountType: row.type === "monthly_fixed" ? "currency" : row.amountType,
    value: Number(row.value),
    applyToDirectSale: row.applyToDirectSale,
    applyToMarketplace: row.applyToMarketplace,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

function extraCost(row: typeof productExtraCostsTable.$inferSelect) {
  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    type: row.type,
    value: Number(row.value),
    active: row.active,
  };
}

async function recipeCost(productId: number) {
  const [recipe] = await db.select().from(recipesTable).where(eq(recipesTable.productId, productId)).limit(1);
  if (!recipe) {
    return { hasRecipe: false, ingredientCost: 0, unitCost: 0, totalCost: 0, items: [] as unknown[] };
  }

  const items = await db.select().from(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, recipe.id));
  const stockIds = Array.from(new Set(items.map((item) => item.stockItemId)));
  const stock = stockIds.length ? await db.select().from(stockItemsTable).where(inArray(stockItemsTable.id, stockIds)) : [];
  const stockById = new Map(stock.map((item) => [item.id, item]));
  const pricedItems = items.map((item) => {
    const stockItem = stockById.get(item.stockItemId);
    const yieldPercent = Number(stockItem?.yieldPercent ?? 100);
    const netQuantity = Number(item.quantity);
    const grossQuantity = calculateGrossQuantity(netQuantity, yieldPercent);
    const ingredientCost = calculateIngredientCost(netQuantity, Number(stockItem?.unitCost ?? 0), yieldPercent);
    return {
      stockItemId: item.stockItemId,
      stockItemName: stockItem?.name ?? item.stockItemName,
      netQuantity,
      grossQuantity,
      unit: item.unit,
      yieldPercent,
      unitCost: Number(stockItem?.unitCost ?? 0),
      ingredientCost,
      alert: !stockItem || Number(stockItem.unitCost ?? 0) <= 0 ? "Ingrediente sem preço cadastrado" : null,
    };
  });
  const totals = calculateTechnicalSheetCost(pricedItems.map((item) => item.ingredientCost), recipe.yield);

  return {
    hasRecipe: true,
    recipeId: recipe.id,
    totalYield: recipe.yield,
    ingredientCost: totals.unitCost,
    unitCost: totals.unitCost,
    totalCost: totals.totalCost,
    items: pricedItems,
  };
}

async function buildPricing(productId: number, input: z.infer<typeof SimulationBody>, channel: SaleChannel) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) return null;
  const sheet = await recipeCost(productId);
  const generalRows = await db.select().from(generalCostsTable).where(eq(generalCostsTable.active, true));
  const extraRows = await db.select().from(productExtraCostsTable).where(and(eq(productExtraCostsTable.productId, productId), eq(productExtraCostsTable.active, true)));
  const price = channel === "marketplace"
    ? Number(input.marketplacePrice ?? product.price)
    : Number(input.directSalePrice ?? product.price);
  const generalCosts: PricingCost[] = generalRows.map((row) => ({
    name: row.name,
    type: row.type as PricingCost["type"],
    amountType: row.type === "monthly_fixed" ? "currency" : row.amountType as PricingCost["amountType"],
    amount: Number(row.value),
    applyToDirectSale: row.applyToDirectSale,
    applyToMarketplace: row.applyToMarketplace,
    active: row.active,
  }));
  const extraCosts: PricingCost[] = extraRows.map((row) => ({
    name: row.name,
    type: "variable",
    amountType: row.type === "percentage" ? "percent" : "currency",
    amount: Number(row.value),
    applyToDirectSale: true,
    applyToMarketplace: true,
    active: row.active,
  }));
  const channelCosts = [...filterCostsByChannel(generalCosts, channel), ...extraCosts];
  const split = splitCosts(channelCosts);
  const fixedAllocated = calculateFixedCostAllocation(split.monthlyFixed, input.monthlySalesEstimate);
  const costBeforeSalePercent = sheet.unitCost + split.fixedCurrency + fixedAllocated;
  const totalCost = calculateProductTotalCost(sheet.unitCost, split.fixedCurrency, price, split.percent, fixedAllocated);
  const cmvPercent = calculateCMV(totalCost, price);
  const contribution = calculateContributionMargin(price, totalCost);
  const net = calculateNetProfit(price, totalCost, 0);
  const suggestedDirectPrice = calculateSuggestedPriceByCMV(costBeforeSalePercent, input.targetCMV, split.percent);
  const suggestedByMargin = calculateSuggestedPriceByMargin(costBeforeSalePercent, input.targetMargin, split.percent);
  const marketplacePercent = splitCosts(filterCostsByChannel(generalCosts, "marketplace")).percent;
  const suggestedMarketplacePrice = calculateMarketplacePrice(Math.max(suggestedDirectPrice, suggestedByMargin), marketplacePercent);
  const alerts = [
    !sheet.hasRecipe ? "Ficha técnica incompleta" : null,
    sheet.totalYield === 0 ? "Produto sem rendimento informado" : null,
    ...sheet.items.map((item) => (item as { alert?: string | null }).alert ?? null),
    cmvPercent > 50 ? "Produto com CMV alto" : null,
    price > 0 && price < suggestedDirectPrice ? "Preço atual abaixo do recomendado" : null,
    net.value < 0 ? "Margem líquida negativa" : null,
  ].filter(Boolean);

  return {
    product: { id: product.id, name: product.name, price: Number(product.price) },
    channel,
    sheet,
    extraCosts: extraRows.map(extraCost),
    generalCosts: generalRows.map(cost),
    monthlySalesEstimate: input.monthlySalesEstimate,
    directSalePrice: Number(input.directSalePrice ?? product.price),
    marketplacePrice: Number(input.marketplacePrice ?? 0),
    targetCMV: input.targetCMV,
    targetMargin: input.targetMargin,
    ingredientCost: sheet.unitCost,
    extraCost: split.fixedCurrency,
    variableCost: price * (split.percent / 100),
    fixedCostAllocated: fixedAllocated,
    totalCost,
    cmvPercent,
    cmvStatus: cmvStatus(cmvPercent),
    contributionMargin: contribution.value,
    contributionMarginPercent: contribution.percent,
    grossProfit: contribution.value,
    netProfit: net.value,
    netProfitPercent: net.percent,
    suggestedDirectPrice: Math.max(suggestedDirectPrice, suggestedByMargin),
    suggestedMarketplacePrice,
    belowSuggested: price < suggestedDirectPrice,
    alerts,
  };
}

router.get("/pricing/general-costs", async (_req, res): Promise<void> => {
  const rows = await db.select().from(generalCostsTable).orderBy(generalCostsTable.name);
  res.json(rows.map(cost));
});

router.post("/pricing/general-costs", async (req, res): Promise<void> => {
  const parsed = GeneralCostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(generalCostsTable).values({
    ...parsed.data,
    amountType: parsed.data.type === "monthly_fixed" ? "currency" : parsed.data.amountType,
    value: String(parsed.data.value),
  }).returning();
  res.status(201).json(cost(row));
});

router.patch("/pricing/general-costs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = GeneralCostBody.partial().safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) { res.status(400).json({ error: parsed.success ? "Invalid id" : parsed.error.message }); return; }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.value !== undefined) data.value = String(parsed.data.value);
  if (parsed.data.type === "monthly_fixed") data.amountType = "currency";
  const [row] = await db.update(generalCostsTable).set(data).where(eq(generalCostsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Cost not found" }); return; }
  res.json(cost(row));
});

router.delete("/pricing/general-costs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.delete(generalCostsTable).where(eq(generalCostsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Cost not found" }); return; }
  res.sendStatus(204);
});

router.get("/pricing/product-extra-costs", async (req, res): Promise<void> => {
  const productId = Number(req.query.productId);
  const rows = await db.select().from(productExtraCostsTable)
    .where(Number.isFinite(productId) ? eq(productExtraCostsTable.productId, productId) : undefined)
    .orderBy(productExtraCostsTable.name);
  res.json(rows.map(extraCost));
});

router.post("/pricing/product-extra-costs", async (req, res): Promise<void> => {
  const parsed = ProductExtraCostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(productExtraCostsTable).values({
    ...parsed.data,
    value: String(parsed.data.value),
  }).returning();
  res.status(201).json(extraCost(row));
});

router.patch("/pricing/product-extra-costs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = ProductExtraCostBody.partial().safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) { res.status(400).json({ error: parsed.success ? "Invalid id" : parsed.error.message }); return; }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.value !== undefined) data.value = String(parsed.data.value);
  const [row] = await db.update(productExtraCostsTable).set(data).where(eq(productExtraCostsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Cost not found" }); return; }
  res.json(extraCost(row));
});

router.delete("/pricing/product-extra-costs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.delete(productExtraCostsTable).where(eq(productExtraCostsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Cost not found" }); return; }
  res.sendStatus(204);
});

router.post("/pricing/simulate", async (req, res): Promise<void> => {
  const parsed = SimulationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const direct = await buildPricing(parsed.data.productId, parsed.data, "direct");
  const marketplace = await buildPricing(parsed.data.productId, parsed.data, "marketplace");
  if (!direct || !marketplace) { res.status(404).json({ error: "Product not found" }); return; }
  await db.insert(pricingSimulationsTable).values({
    productId: parsed.data.productId,
    directSalePrice: String(direct.directSalePrice),
    marketplacePrice: String(parsed.data.marketplacePrice ?? marketplace.suggestedMarketplacePrice),
    targetCMV: String(parsed.data.targetCMV),
    targetMargin: String(parsed.data.targetMargin),
    monthlySalesEstimate: parsed.data.monthlySalesEstimate,
    ingredientCost: String(direct.ingredientCost),
    extraCost: String(direct.extraCost),
    variableCost: String(direct.variableCost),
    fixedCostAllocated: String(direct.fixedCostAllocated),
    totalCost: String(direct.totalCost),
    cmvPercent: String(direct.cmvPercent),
    contributionMargin: String(direct.contributionMargin),
    contributionMarginPercent: String(direct.contributionMarginPercent),
    netProfit: String(direct.netProfit),
    netProfitPercent: String(direct.netProfitPercent),
    suggestedDirectPrice: String(direct.suggestedDirectPrice),
    suggestedMarketplacePrice: String(marketplace.suggestedMarketplacePrice),
  });
  res.json({ direct, marketplace });
});

router.get("/pricing/dashboard", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(productsTable.name);
  const rows = await Promise.all(products.map(async (product) => {
    const direct = await buildPricing(product.id, {
      productId: product.id,
      directSalePrice: Number(product.price),
      targetCMV: 35,
      targetMargin: 60,
      monthlySalesEstimate: 1,
    }, "direct");
    return direct;
  }));
  const valid = rows.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof buildPricing>>>[];
  res.json({
    criticalCMV: valid.filter((row) => row.cmvPercent > 50),
    highestProfit: [...valid].sort((a, b) => b.netProfit - a.netProfit).slice(0, 5),
    lowestMargin: [...valid].sort((a, b) => a.contributionMarginPercent - b.contributionMarginPercent).slice(0, 5),
    withoutTechnicalSheet: valid.filter((row) => !row.sheet.hasRecipe),
    belowSuggested: valid.filter((row) => row.belowSuggested),
  });
});

router.post("/pricing/products/:id/apply-suggested", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = SimulationBody.partial().safeParse({ ...req.body, productId: id });
  if (!Number.isFinite(id) || !parsed.success) { res.status(400).json({ error: parsed.success ? "Invalid id" : parsed.error.message }); return; }
  const direct = await buildPricing(id, {
    productId: id,
    directSalePrice: parsed.data.directSalePrice ?? 0,
    marketplacePrice: parsed.data.marketplacePrice,
    targetCMV: parsed.data.targetCMV ?? 35,
    targetMargin: parsed.data.targetMargin ?? 60,
    monthlySalesEstimate: parsed.data.monthlySalesEstimate ?? 1,
  }, "direct");
  if (!direct) { res.status(404).json({ error: "Product not found" }); return; }
  const [product] = await db.update(productsTable).set({ price: String(direct.suggestedDirectPrice), cost: String(direct.ingredientCost) }).where(eq(productsTable.id, id)).returning();
  res.json({ id: product.id, price: Number(product.price), cost: Number(product.cost ?? 0), suggestedDirectPrice: direct.suggestedDirectPrice });
});

export default router;
