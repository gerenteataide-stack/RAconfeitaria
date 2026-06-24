import { Router, type IRouter } from "express";
import { db, recipesTable, recipeIngredientsTable, productsTable, stockItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateRecipeBody,
  UpdateRecipeBody,
  GetRecipeParams,
  UpdateRecipeParams,
  DeleteRecipeParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getRecipeWithIngredients(recipeId: number) {
  const [recipe] = await db.select().from(recipesTable).where(eq(recipesTable.id, recipeId));
  if (!recipe) return null;

  const ingredients = await db.select().from(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, recipeId));

  // calculate cost per ingredient
  const ingredientsWithCost = await Promise.all(
    ingredients.map(async (ing) => {
      const [si] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, ing.stockItemId));
      const unitCost = si ? Number(si.unitCost) : 0;
      const cost = unitCost * Number(ing.quantity);
      return {
        stockItemId: ing.stockItemId,
        stockItemName: ing.stockItemName,
        quantity: Number(ing.quantity),
        unit: ing.unit,
        cost,
      };
    })
  );

  const totalCost = ingredientsWithCost.reduce((acc, i) => acc + i.cost, 0);
  const unitCost = recipe.yield > 0 ? totalCost / recipe.yield : totalCost;

  // get product price for CMV
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, recipe.productId));
  const productPrice = product ? Number(product.price) : 0;
  const cmvPercent = productPrice > 0 ? (unitCost / productPrice) * 100 : null;

  return {
    id: recipe.id,
    productId: recipe.productId,
    productName: recipe.productName,
    yield: recipe.yield,
    prepTime: recipe.prepTime,
    instructions: recipe.instructions ?? null,
    totalCost,
    unitCost,
    cmvPercent,
    ingredients: ingredientsWithCost,
    createdAt: recipe.createdAt.toISOString(),
  };
}

router.get("/recipes", async (_req, res): Promise<void> => {
  const recipes = await db.select().from(recipesTable).orderBy(recipesTable.productName);

  const result = await Promise.all(recipes.map((r) => getRecipeWithIngredients(r.id)));
  res.json(result.filter(Boolean));
});

router.post("/recipes", async (req, res): Promise<void> => {
  const parsed = CreateRecipeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  const productName = product?.name ?? `Produto #${parsed.data.productId}`;

  const { ingredients, ...recipeData } = parsed.data;
  const [recipe] = await db.insert(recipesTable).values({ ...recipeData, productName }).returning();

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

  const [recipe] = await db.update(recipesTable).set(recipeData).where(eq(recipesTable.id, params.data.id)).returning();
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
