import { Router, type IRouter } from "express";
import { and, eq, ilike, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  generalCostsTable,
  ingredientsTable,
  pricingSimulationsTable,
  productExtraCostsTable,
  productsTable,
  technicalSheetItemsTable,
  technicalSheetsTable,
} from "@workspace/db";
import {
  calculateCMV,
  calculateContributionMargin,
  calculateGrossQuantity,
  calculateIngredientCost,
  calculateMarketplacePrice,
  calculateNetProfit,
  calculateProductTotalCost,
  calculateSuggestedPriceByCMV,
  calculateSuggestedPriceByMargin,
  calculateTechnicalSheetCost,
  calculateUnitCost,
  cmvStatus,
} from "../lib/pricing";

const router: IRouter = Router();

const IngredientBody = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["comprado", "fabricado", "produto"]).default("comprado"),
  packageContent: z.coerce.number().positive(),
  unit: z.string().trim().min(1),
  packagePrice: z.coerce.number().min(0),
  yieldPercent: z.coerce.number().min(0.01).max(100).default(100),
  active: z.boolean().default(true),
});

const TechnicalSheetItemBody = z.object({
  ingredientId: z.coerce.number().int().positive(),
  netQuantity: z.coerce.number().min(0),
  unit: z.string().trim().min(1),
  note: z.string().optional().nullable(),
});

const TechnicalSheetBody = z.object({
  productId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1),
  totalYield: z.coerce.number().positive(),
  preparationMode: z.string().optional().nullable(),
  items: z.array(TechnicalSheetItemBody).default([]),
});

const GeneralCostBody = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["monthly_fixed", "variable"]).default("variable"),
  value: z.coerce.number().min(0),
  applyToDirectSale: z.boolean().default(true),
  applyToMarketplace: z.boolean().default(true),
  active: z.boolean().default(true),
});

const ProductExtraCostBody = z.object({
  productId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1),
  type: z.enum(["fixed", "percentage"]),
  value: z.coerce.number().min(0),
  active: z.boolean().default(true),
});

const SimulationBody = z.object({
  productId: z.coerce.number().int().positive(),
  directSalePrice: z.coerce.number().min(0),
  marketplacePrice: z.coerce.number().min(0).optional(),
  targetCMV: z.coerce.number().min(1).max(99).default(35),
  targetMargin: z.coerce.number().min(1).max(99).default(60),
  save: z.boolean().optional().default(false),
});

function ingredient(row: typeof ingredientsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    packageContent: Number(row.packageContent),
    unit: row.unit,
    packagePrice: Number(row.packagePrice),
    yieldPercent: Number(row.yieldPercent),
    unitCost: Number(row.unitCost),
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

function generalCost(row: typeof generalCostsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    value: Number(row.value),
    applyToDirectSale: row.applyToDirectSale,
    applyToMarketplace: row.applyToMarketplace,
    active: row.active,
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

async function sheetWithItems(sheetId: number) {
  const [sheet] = await db.select().from(technicalSheetsTable).where(eq(technicalSheetsTable.id, sheetId));
  if (!sheet) return null;
  const rows = await db.select().from(technicalSheetItemsTable).where(eq(technicalSheetItemsTable.technicalSheetId, sheetId));
  const ingredientIds = rows.map((item) => item.ingredientId);
  const ingredients = ingredientIds.length ? await db.select().from(ingredientsTable).where(inArray(ingredientsTable.id, ingredientIds)) : [];
  const ingredientById = new Map(ingredients.map((item) => [item.id, item]));
  return {
    id: sheet.id,
    productId: sheet.productId,
    name: sheet.name,
    totalYield: Number(sheet.totalYield),
    totalCost: Number(sheet.totalCost),
    unitCost: Number(sheet.unitCost),
    preparationMode: sheet.preparationMode ?? "",
    items: rows.map((item) => {
      const ing = ingredientById.get(item.ingredientId);
      return {
        id: item.id,
        ingredientId: item.ingredientId,
        ingredientName: ing?.name ?? `Ingrediente #${item.ingredientId}`,
        netQuantity: Number(item.netQuantity),
        grossQuantity: Number(item.grossQuantity),
        unit: item.unit,
        yieldPercent: Number(ing?.yieldPercent ?? 100),
        ingredientCost: Number(item.ingredientCost),
        note: item.note ?? "",
      };
    }),
    createdAt: sheet.createdAt.toISOString(),
  };
}

async function recalculateSheet(sheetId: number) {
  const rows = await db.select().from(technicalSheetItemsTable).where(eq(technicalSheetItemsTable.technicalSheetId, sheetId));
  const [sheet] = await db.select().from(technicalSheetsTable).where(eq(technicalSheetsTable.id, sheetId));
  const totals = calculateTechnicalSheetCost(rows.map((item) => Number(item.ingredientCost)), Number(sheet?.totalYield ?? 1));
  await db.update(technicalSheetsTable)
    .set({ totalCost: String(totals.totalCost), unitCost: String(totals.unitCost) })
    .where(eq(technicalSheetsTable.id, sheetId));
}

async function saveSheetItems(sheetId: number, items: z.infer<typeof TechnicalSheetItemBody>[]) {
  await db.delete(technicalSheetItemsTable).where(eq(technicalSheetItemsTable.technicalSheetId, sheetId));
  if (items.length === 0) return;
  const ingredients = await db.select().from(ingredientsTable).where(inArray(ingredientsTable.id, items.map((item) => item.ingredientId)));
  const ingredientById = new Map(ingredients.map((item) => [item.id, item]));
  await db.insert(technicalSheetItemsTable).values(items.map((item) => {
    const ing = ingredientById.get(item.ingredientId);
    const yieldPercent = Number(ing?.yieldPercent ?? 100);
    const grossQuantity = calculateGrossQuantity(item.netQuantity, yieldPercent);
    const ingredientCost = calculateIngredientCost(item.netQuantity, Number(ing?.unitCost ?? 0), yieldPercent);
    return {
      technicalSheetId: sheetId,
      ingredientId: item.ingredientId,
      netQuantity: String(item.netQuantity),
      grossQuantity: String(grossQuantity),
      unit: item.unit,
      ingredientCost: String(ingredientCost),
      note: item.note ?? null,
    };
  }));
}

async function buildSimulation(input: z.infer<typeof SimulationBody>, channel: "direct" | "marketplace") {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, input.productId));
  if (!product) return null;
  const [sheet] = await db.select().from(technicalSheetsTable).where(eq(technicalSheetsTable.productId, input.productId));
  const extraRows = await db.select().from(productExtraCostsTable).where(and(eq(productExtraCostsTable.productId, input.productId), eq(productExtraCostsTable.active, true)));
  const generalRows = await db.select().from(generalCostsTable).where(eq(generalCostsTable.active, true));
  const salePrice = channel === "direct" ? input.directSalePrice : Number(input.marketplacePrice ?? input.directSalePrice);
  const ingredientCost = Number(sheet?.unitCost ?? 0);
  const extraFixed = extraRows.filter((item) => item.type === "fixed").reduce((sum, item) => sum + Number(item.value), 0);
  const extraPercent = extraRows.filter((item) => item.type === "percentage").reduce((sum, item) => sum + Number(item.value), 0);
  const applicableGeneral = generalRows.filter((item) => channel === "direct" ? item.applyToDirectSale : item.applyToMarketplace);
  const generalPercent = applicableGeneral.filter((item) => item.type === "variable").reduce((sum, item) => sum + Number(item.value), 0);
  const fixedAllocated = 0;
  const percentTotal = extraPercent + generalPercent;
  const costBeforePercent = ingredientCost + extraFixed + fixedAllocated;
  const totalCost = calculateProductTotalCost(ingredientCost, extraFixed, salePrice, percentTotal, fixedAllocated);
  const cmvPercent = calculateCMV(totalCost, salePrice);
  const contribution = calculateContributionMargin(salePrice, totalCost);
  const net = calculateNetProfit(salePrice, totalCost, 0);
  const suggestedByCMV = calculateSuggestedPriceByCMV(costBeforePercent, input.targetCMV, percentTotal);
  const suggestedByMargin = calculateSuggestedPriceByMargin(costBeforePercent, input.targetMargin, percentTotal);
  const suggestedDirectPrice = Math.max(suggestedByCMV, suggestedByMargin);
  const marketplaceTax = generalRows.filter((item) => item.applyToMarketplace && item.type === "variable").reduce((sum, item) => sum + Number(item.value), 0);
  const suggestedMarketplacePrice = calculateMarketplacePrice(suggestedDirectPrice, marketplaceTax);
  const alerts = [
    !sheet ? "Ficha técnica incompleta" : null,
    sheet && Number(sheet.totalYield) <= 0 ? "Produto sem rendimento informado" : null,
    cmvPercent > 50 ? "Produto com CMV alto" : null,
    salePrice < suggestedDirectPrice ? "Preço atual abaixo do recomendado" : null,
    net.value < 0 ? "Margem líquida negativa" : null,
  ].filter(Boolean);
  return {
    product: { id: product.id, name: product.name, currentPrice: Number(product.price) },
    channel,
    hasTechnicalSheet: Boolean(sheet),
    ingredientCost,
    extraCost: extraFixed,
    variableCost: salePrice * (percentTotal / 100),
    fixedCostAllocated: fixedAllocated,
    totalCost,
    cmvPercent,
    cmvStatus: cmvStatus(cmvPercent),
    contributionMargin: contribution.value,
    contributionMarginPercent: contribution.percent,
    grossProfit: contribution.value,
    netProfit: net.value,
    netProfitPercent: net.percent,
    suggestedDirectPrice,
    suggestedMarketplacePrice,
    targetCMV: input.targetCMV,
    targetMargin: input.targetMargin,
    alerts,
  };
}

router.get("/pricing-module/ingredients", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const type = typeof req.query.type === "string" ? req.query.type : "";
  const rows = await db.select().from(ingredientsTable)
    .where(and(search ? ilike(ingredientsTable.name, `%${search}%`) : undefined, type ? eq(ingredientsTable.type, type) : undefined))
    .orderBy(ingredientsTable.name);
  res.json(rows.map(ingredient));
});

router.post("/pricing-module/ingredients", async (req, res): Promise<void> => {
  const parsed = IngredientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const unitCost = calculateUnitCost(parsed.data.packagePrice, parsed.data.packageContent);
  const [row] = await db.insert(ingredientsTable).values({ ...parsed.data, packageContent: String(parsed.data.packageContent), packagePrice: String(parsed.data.packagePrice), yieldPercent: String(parsed.data.yieldPercent), unitCost: String(unitCost) }).returning();
  res.status(201).json(ingredient(row));
});

router.patch("/pricing-module/ingredients/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = IngredientBody.partial().safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) { res.status(400).json({ error: parsed.success ? "ID inválido" : parsed.error.message }); return; }
  const [current] = await db.select().from(ingredientsTable).where(eq(ingredientsTable.id, id));
  if (!current) { res.status(404).json({ error: "Ingrediente não encontrado" }); return; }
  const packagePrice = parsed.data.packagePrice ?? Number(current.packagePrice);
  const packageContent = parsed.data.packageContent ?? Number(current.packageContent);
  const data: Record<string, unknown> = { ...parsed.data, unitCost: String(calculateUnitCost(packagePrice, packageContent)) };
  if (parsed.data.packageContent !== undefined) data.packageContent = String(parsed.data.packageContent);
  if (parsed.data.packagePrice !== undefined) data.packagePrice = String(parsed.data.packagePrice);
  if (parsed.data.yieldPercent !== undefined) data.yieldPercent = String(parsed.data.yieldPercent);
  const [row] = await db.update(ingredientsTable).set(data).where(eq(ingredientsTable.id, id)).returning();
  res.json(ingredient(row));
});

router.delete("/pricing-module/ingredients/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.update(ingredientsTable).set({ active: false }).where(eq(ingredientsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Ingrediente não encontrado" }); return; }
  res.sendStatus(204);
});

router.get("/pricing-module/technical-sheets", async (_req, res): Promise<void> => {
  const sheets = await db.select().from(technicalSheetsTable).orderBy(technicalSheetsTable.name);
  res.json(await Promise.all(sheets.map((sheet) => sheetWithItems(sheet.id))));
});

router.post("/pricing-module/technical-sheets", async (req, res): Promise<void> => {
  const parsed = TechnicalSheetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [sheet] = await db.insert(technicalSheetsTable).values({ productId: parsed.data.productId, name: parsed.data.name, totalYield: String(parsed.data.totalYield), preparationMode: parsed.data.preparationMode ?? null }).returning();
  await saveSheetItems(sheet.id, parsed.data.items);
  await recalculateSheet(sheet.id);
  res.status(201).json(await sheetWithItems(sheet.id));
});

router.patch("/pricing-module/technical-sheets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = TechnicalSheetBody.safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) { res.status(400).json({ error: parsed.success ? "ID inválido" : parsed.error.message }); return; }
  const [sheet] = await db.update(technicalSheetsTable).set({ productId: parsed.data.productId, name: parsed.data.name, totalYield: String(parsed.data.totalYield), preparationMode: parsed.data.preparationMode ?? null }).where(eq(technicalSheetsTable.id, id)).returning();
  if (!sheet) { res.status(404).json({ error: "Ficha não encontrada" }); return; }
  await saveSheetItems(id, parsed.data.items);
  await recalculateSheet(id);
  res.json(await sheetWithItems(id));
});

router.delete("/pricing-module/technical-sheets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(technicalSheetItemsTable).where(eq(technicalSheetItemsTable.technicalSheetId, id));
  const [sheet] = await db.delete(technicalSheetsTable).where(eq(technicalSheetsTable.id, id)).returning();
  if (!sheet) { res.status(404).json({ error: "Ficha não encontrada" }); return; }
  res.sendStatus(204);
});

router.get("/pricing-module/general-costs", async (_req, res): Promise<void> => {
  const rows = await db.select().from(generalCostsTable).orderBy(generalCostsTable.name);
  res.json(rows.map(generalCost));
});

router.post("/pricing-module/general-costs", async (req, res): Promise<void> => {
  const parsed = GeneralCostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(generalCostsTable).values({ ...parsed.data, amountType: "percent", value: String(parsed.data.value) }).returning();
  res.status(201).json(generalCost(row));
});

router.patch("/pricing-module/general-costs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = GeneralCostBody.safeParse(req.body);
  if (!Number.isFinite(id) || !parsed.success) { res.status(400).json({ error: parsed.success ? "ID inválido" : parsed.error.message }); return; }
  const [row] = await db.update(generalCostsTable).set({ ...parsed.data, value: String(parsed.data.value) }).where(eq(generalCostsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Custo não encontrado" }); return; }
  res.json(generalCost(row));
});

router.delete("/pricing-module/general-costs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.delete(generalCostsTable).where(eq(generalCostsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Custo não encontrado" }); return; }
  res.sendStatus(204);
});

router.get("/pricing-module/product-extra-costs", async (req, res): Promise<void> => {
  const productId = Number(req.query.productId);
  const rows = await db.select().from(productExtraCostsTable).where(Number.isFinite(productId) ? eq(productExtraCostsTable.productId, productId) : undefined).orderBy(productExtraCostsTable.name);
  res.json(rows.map(extraCost));
});

router.post("/pricing-module/product-extra-costs", async (req, res): Promise<void> => {
  const parsed = ProductExtraCostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(productExtraCostsTable).values({ ...parsed.data, value: String(parsed.data.value) }).returning();
  res.status(201).json(extraCost(row));
});

router.delete("/pricing-module/product-extra-costs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.delete(productExtraCostsTable).where(eq(productExtraCostsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Custo não encontrado" }); return; }
  res.sendStatus(204);
});

router.post("/pricing-module/simulate", async (req, res): Promise<void> => {
  const parsed = SimulationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const direct = await buildSimulation(parsed.data, "direct");
  const marketplace = await buildSimulation(parsed.data, "marketplace");
  if (!direct || !marketplace) { res.status(404).json({ error: "Produto não encontrado" }); return; }
  if (parsed.data.save) {
    await db.insert(pricingSimulationsTable).values({
      productId: parsed.data.productId,
      directSalePrice: String(parsed.data.directSalePrice),
      marketplacePrice: String(parsed.data.marketplacePrice ?? marketplace.suggestedMarketplacePrice),
      targetCMV: String(parsed.data.targetCMV),
      targetMargin: String(parsed.data.targetMargin),
      monthlySalesEstimate: 1,
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
  }
  res.json({ direct, marketplace });
});

router.get("/pricing-module/dashboard", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(productsTable.name);
  const rows = (await Promise.all(products.map((product) => buildSimulation({ productId: product.id, directSalePrice: Number(product.price), targetCMV: 35, targetMargin: 60, save: false }, "direct")))).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof buildSimulation>>>[];
  res.json({
    criticalCMV: rows.filter((row) => row.cmvPercent > 50),
    highestProfit: [...rows].sort((a, b) => b.netProfit - a.netProfit).slice(0, 5),
    lowestMargin: [...rows].sort((a, b) => a.contributionMarginPercent - b.contributionMarginPercent).slice(0, 5),
    withoutTechnicalSheet: rows.filter((row) => !row.hasTechnicalSheet),
    belowSuggested: rows.filter((row) => row.product.currentPrice < row.suggestedDirectPrice),
  });
});

router.post("/pricing-module/products/:id/apply-suggested", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = SimulationBody.partial().safeParse({ ...req.body, productId: id });
  if (!Number.isFinite(id) || !parsed.success) { res.status(400).json({ error: parsed.success ? "ID inválido" : parsed.error.message }); return; }
  const result = await buildSimulation({ productId: id, directSalePrice: Number(parsed.data.directSalePrice ?? 0), targetCMV: parsed.data.targetCMV ?? 35, targetMargin: parsed.data.targetMargin ?? 60, save: false }, "direct");
  if (!result) { res.status(404).json({ error: "Produto não encontrado" }); return; }
  const [product] = await db.update(productsTable).set({ price: String(result.suggestedDirectPrice), cost: String(result.ingredientCost) }).where(eq(productsTable.id, id)).returning();
  res.json({ id: product.id, price: Number(product.price), cost: Number(product.cost ?? 0) });
});

export default router;
