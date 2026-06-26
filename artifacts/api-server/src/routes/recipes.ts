import { Router, type IRouter } from "express";
import { db, recipesTable, recipeIngredientsTable, productsTable, settingsTable, stockItemsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  GetRecipeParams,
  UpdateRecipeParams,
  DeleteRecipeParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const RecipeIngredientBody = z.object({
  stockItemId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().min(0),
  unit: z.string().min(1).default("un"),
});

const RecipeBody = z.object({
  productId: z.coerce.number().int().positive(),
  yield: z.coerce.number().int().positive(),
  prepTime: z.coerce.number().int().min(0).default(0),
  instructions: z.string().optional(),
  ingredients: z.array(RecipeIngredientBody).default([]),
});

const UpdateRecipeBody = RecipeBody.partial().extend({
  ingredients: z.array(RecipeIngredientBody).optional(),
});

type RecipeRow = typeof recipesTable.$inferSelect;
type IngredientRow = typeof recipeIngredientsTable.$inferSelect;
type ProductRow = typeof productsTable.$inferSelect;
type StockItemRow = typeof stockItemsTable.$inferSelect;

function serializeRecipe(
  recipe: RecipeRow,
  ingredients: IngredientRow[],
  stockItemsById: Map<number, StockItemRow>,
  productsById: Map<number, ProductRow>,
  globalCosts: {
    fixedTotal: number;
    variableCurrencyTotal: number;
    variablePercentTotal: number;
  },
) {
  const ingredientsWithCost = ingredients.map((ingredient) => {
    const stockItem = stockItemsById.get(ingredient.stockItemId);
    const unitCost = stockItem ? Number(stockItem.unitCost) : 0;
    const quantity = Number(ingredient.quantity);
    return {
      stockItemId: ingredient.stockItemId,
      stockItemName: stockItem?.name ?? ingredient.stockItemName,
      quantity,
      unit: ingredient.unit,
      cost: unitCost * quantity,
    };
  });

  const ingredientsCost = ingredientsWithCost.reduce((acc, ingredient) => acc + ingredient.cost, 0);
  const fixedCost = globalCosts.fixedTotal;
  const variableCost = globalCosts.variableCurrencyTotal;
  const variablePercent = globalCosts.variablePercentTotal;
  const totalCost = ingredientsCost + fixedCost + variableCost;
  const unitCost = recipe.yield > 0 ? totalCost / recipe.yield : totalCost;
  const product = productsById.get(recipe.productId);
  const productPrice = product ? Number(product.price) : 0;
  const cmvPercent = productPrice > 0 ? (unitCost / productPrice) * 100 : null;
  const variablePercentRate = variablePercent / 100;
  const contributionMarginPercent = productPrice > 0 ? ((productPrice - unitCost - (productPrice * variablePercentRate)) / productPrice) * 100 : null;
  const suggestedDenominator = 0.4 - variablePercentRate;
  const suggestedPrice = suggestedDenominator > 0 ? unitCost / suggestedDenominator : 0;

  return {
    id: recipe.id,
    productId: recipe.productId,
    productName: recipe.productName,
    yield: recipe.yield,
    prepTime: recipe.prepTime,
    fixedCost,
    variableCost,
    variablePercent,
    instructions: recipe.instructions ?? null,
    ingredientsCost,
    totalCost,
    unitCost,
    productPrice,
    suggestedPrice,
    cmvPercent,
    contributionMarginPercent,
    ingredients: ingredientsWithCost,
    createdAt: recipe.createdAt.toISOString(),
  };
}

async function readRecipeGlobalCosts() {
  const rows = await db.select().from(settingsTable).where(inArray(settingsTable.key, ["pricingCosts", "recipeFixedCost", "recipeVariableCost"]));
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value ?? "0"]));
  const legacyFixed = Number(settings.recipeFixedCost ?? 0);
  const legacyVariable = Number(settings.recipeVariableCost ?? 0);
  let costs: Array<{ type: string; amountType: string; amount: number }> = [];
  try {
    costs = settings.pricingCosts ? JSON.parse(settings.pricingCosts) : [];
  } catch {
    costs = [];
  }

  return {
    fixedTotal: costs
      .filter((cost) => cost.type === "fixed")
      .reduce((total, cost) => total + Number(cost.amount || 0), legacyFixed),
    variableCurrencyTotal: costs
      .filter((cost) => cost.type === "variable" && cost.amountType !== "percent")
      .reduce((total, cost) => total + Number(cost.amount || 0), legacyVariable),
    variablePercentTotal: costs
      .filter((cost) => cost.type === "variable" && cost.amountType === "percent")
      .reduce((total, cost) => total + Number(cost.amount || 0), 0),
  };
}

async function listRecipesSerialized(recipeId?: number) {
  const recipes = recipeId
    ? await db.select().from(recipesTable).where(eq(recipesTable.id, recipeId))
    : await db.select().from(recipesTable).orderBy(recipesTable.productName);

  if (recipes.length === 0) return [];

  const recipeIds = recipes.map((recipe) => recipe.id);
  const productIds = Array.from(new Set(recipes.map((recipe) => recipe.productId)));
  const ingredients = await db.select().from(recipeIngredientsTable).where(inArray(recipeIngredientsTable.recipeId, recipeIds));
  const stockItemIds = Array.from(new Set(ingredients.map((ingredient) => ingredient.stockItemId)));
  const stockItems = stockItemIds.length > 0
    ? await db.select().from(stockItemsTable).where(inArray(stockItemsTable.id, stockItemIds))
    : [];
  const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
  const stockItemsById = new Map(stockItems.map((item) => [item.id, item]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const globalCosts = await readRecipeGlobalCosts();
  const ingredientsByRecipeId = new Map<number, IngredientRow[]>();

  for (const ingredient of ingredients) {
    const current = ingredientsByRecipeId.get(ingredient.recipeId) ?? [];
    current.push(ingredient);
    ingredientsByRecipeId.set(ingredient.recipeId, current);
  }

  return recipes.map((recipe) => serializeRecipe(
    recipe,
    ingredientsByRecipeId.get(recipe.id) ?? [],
    stockItemsById,
    productsById,
    globalCosts,
  ));
}

async function getRecipeWithIngredients(recipeId: number) {
  const [recipe] = await listRecipesSerialized(recipeId);
  return recipe ?? null;
}

router.get("/recipes", async (_req, res): Promise<void> => {
  res.json(await listRecipesSerialized());
});

router.post("/recipes", async (req, res): Promise<void> => {
  const parsed = RecipeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  const productName = product?.name ?? `Produto #${parsed.data.productId}`;

  const { ingredients, ...recipeData } = parsed.data;
  const [recipe] = await db.insert(recipesTable).values({
    ...recipeData,
    productName,
  }).returning();

  if (ingredients.length > 0) {
    const ingredientRows = await Promise.all(
      ingredients.map(async (ing) => {
        const [si] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, ing.stockItemId));
        return {
          recipeId: recipe.id,
          stockItemId: ing.stockItemId,
          stockItemName: si?.name ?? `Item #${ing.stockItemId}`,
          quantity: String(ing.quantity),
          unit: ing.unit,
        };
      })
    );
    await db.insert(recipeIngredientsTable).values(ingredientRows);
  }

  const result = await getRecipeWithIngredients(recipe.id);
  res.status(201).json(result);
});

router.get("/recipes/:id", async (req, res): Promise<void> => {
  const params = GetRecipeParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const result = await getRecipeWithIngredients(params.data.id);
  if (!result) { res.status(404).json({ error: "Recipe not found" }); return; }
  res.json(result);
});

router.patch("/recipes/:id", async (req, res): Promise<void> => {
  const params = UpdateRecipeParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateRecipeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { ingredients, ...recipeData } = parsed.data;
  const updateData: Record<string, unknown> = { ...recipeData };
  if (recipeData.productId !== undefined) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, recipeData.productId));
    updateData.productName = product?.name ?? `Produto #${recipeData.productId}`;
  }

  const [recipe] = await db.update(recipesTable).set(updateData).where(eq(recipesTable.id, params.data.id)).returning();
  if (!recipe) { res.status(404).json({ error: "Recipe not found" }); return; }

  if (ingredients !== undefined) {
    await db.delete(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, params.data.id));
    if (ingredients.length > 0) {
      const ingredientRows = await Promise.all(
        ingredients.map(async (ing) => {
          const [si] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, ing.stockItemId));
          return {
            recipeId: recipe.id,
            stockItemId: ing.stockItemId,
            stockItemName: si?.name ?? `Item #${ing.stockItemId}`,
            quantity: String(ing.quantity),
            unit: ing.unit,
          };
        })
      );
      await db.insert(recipeIngredientsTable).values(ingredientRows);
    }
  }

  const result = await getRecipeWithIngredients(recipe.id);
  res.json(result);
});

router.delete("/recipes/:id", async (req, res): Promise<void> => {
  const params = DeleteRecipeParams.safeParse({ id: Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, params.data.id));
  const [r] = await db.delete(recipesTable).where(eq(recipesTable.id, params.data.id)).returning();
  if (!r) { res.status(404).json({ error: "Recipe not found" }); return; }
  res.sendStatus(204);
});

export default router;
