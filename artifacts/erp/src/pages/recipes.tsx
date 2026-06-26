import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useListRecipes,
  useListProducts,
  useListStockItems,
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
  getListRecipesQueryKey,
  type Recipe,
  type RecipeIngredientInput,
  type Product,
  type StockItem,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { Plus, Pencil, Trash2, BookOpen, Loader2 } from "lucide-react";

interface RecipeFormState {
  productId: string;
  yield: string;
  prepTime: string;
  instructions: string;
  ingredients: Array<{
    stockItemId: string;
    quantity: string;
    unit: string;
  }>;
}

const emptyForm: RecipeFormState = {
  productId: "",
  yield: "1",
  prepTime: "30",
  instructions: "",
  ingredients: [{ stockItemId: "", quantity: "1", unit: "g" }],
};

type BusinessSettings = {
  costs: Array<{
    id: string;
    name: string;
    type: "fixed" | "variable";
    amountType: "currency" | "percent";
    amount: number;
  }>;
};

function fmtCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formToPayload(form: RecipeFormState) {
  return {
    productId: Number(form.productId),
    yield: Number(form.yield || 1),
    prepTime: Number(form.prepTime || 0),
    instructions: form.instructions || undefined,
    ingredients: form.ingredients
      .filter((ingredient) => ingredient.stockItemId && ingredient.quantity)
      .map((ingredient) => ({
        stockItemId: Number(ingredient.stockItemId),
        quantity: Number(ingredient.quantity),
        unit: ingredient.unit || "un",
      })),
  };
}

function recipeToForm(recipe: Recipe): RecipeFormState {
  return {
    productId: String(recipe.productId),
    yield: String(recipe.yield),
    prepTime: String(recipe.prepTime),
    instructions: recipe.instructions ?? "",
    ingredients: (recipe.ingredients ?? []).map((ingredient) => ({
      stockItemId: String(ingredient.stockItemId),
      quantity: String(ingredient.quantity),
      unit: ingredient.unit,
    })),
  };
}

export default function Recipes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: recipes = [], isLoading } = useListRecipes();
  const { data: products = [] } = useListProducts();
  const { data: stockItems = [] } = useListStockItems();
  const { data: settings } = useQuery({
    queryKey: ["pricing-costs"],
    queryFn: () => apiRequest<BusinessSettings>("/api/settings/costs"),
  });
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [form, setForm] = useState<RecipeFormState>(emptyForm);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const stockItemsById = useMemo(() => new Map(stockItems.map((item) => [item.id, item])), [stockItems]);
  const pricingPreview = useMemo(() => {
    const ingredientsCost = form.ingredients.reduce((total, ingredient) => {
      const stockItem = stockItemsById.get(Number(ingredient.stockItemId));
      return total + (Number(stockItem?.unitCost ?? 0) * Number(ingredient.quantity || 0));
    }, 0);
    const configuredCosts = settings?.costs ?? [];
    const fixedCost = configuredCosts
      .filter((cost) => cost.type === "fixed")
      .reduce((total, cost) => total + Number(cost.amount || 0), 0);
    const variableCost = configuredCosts
      .filter((cost) => cost.type === "variable" && cost.amountType === "currency")
      .reduce((total, cost) => total + Number(cost.amount || 0), 0);
    const variablePercent = configuredCosts
      .filter((cost) => cost.type === "variable" && cost.amountType === "percent")
      .reduce((total, cost) => total + Number(cost.amount || 0), 0);
    const totalCost = ingredientsCost + fixedCost + variableCost;
    const yieldAmount = Math.max(Number(form.yield || 1), 1);
    const unitCost = totalCost / yieldAmount;
    const suggestedDenominator = 0.4 - (variablePercent / 100);
    const suggestedPrice = suggestedDenominator > 0 ? unitCost / suggestedDenominator : 0;
    const product = productsById.get(Number(form.productId));
    const productPrice = Number(product?.price ?? 0);
    const contributionMarginPercent = productPrice > 0 ? ((productPrice - unitCost - (productPrice * (variablePercent / 100))) / productPrice) * 100 : null;

    return { ingredientsCost, fixedCost, variableCost, variablePercent, totalCost, unitCost, suggestedPrice, productPrice, contributionMarginPercent };
  }, [form.ingredients, form.productId, form.yield, productsById, settings?.costs, stockItemsById]);

  function resetForm() {
    setForm(emptyForm);
    setEditingRecipe(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(recipe: Recipe) {
    setEditingRecipe(recipe);
    setForm(recipeToForm(recipe));
    setDialogOpen(true);
  }

  function updateField<K extends keyof RecipeFormState>(key: K, value: RecipeFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateIngredient(index: number, patch: Partial<RecipeFormState["ingredients"][number]>) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ingredient, ingredientIndex) => {
        if (ingredientIndex !== index) return ingredient;

        const next = { ...ingredient, ...patch };
        if (patch.stockItemId !== undefined) {
          const selectedItem = stockItemsById.get(Number(patch.stockItemId));
          if (selectedItem?.unit) {
            next.unit = selectedItem.unit;
          }
        }
        return next;
      }),
    }));
  }

  function addIngredient() {
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { stockItemId: "", quantity: "1", unit: "g" }],
    }));
  }

  function removeIngredient(index: number) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index),
    }));
  }

  async function handleSave() {
    if (!form.productId) {
      toast({ title: "Selecione um produto", variant: "destructive" });
      return;
    }

    if (!form.ingredients.some((ingredient) => ingredient.stockItemId && ingredient.quantity)) {
      toast({ title: "Adicione pelo menos um ingrediente", variant: "destructive" });
      return;
    }

    const payload = formToPayload(form);

    try {
      if (editingRecipe) {
        await updateRecipe.mutateAsync({ id: editingRecipe.id, data: payload });
        toast({ title: "Ficha técnica atualizada!" });
      } else {
        await createRecipe.mutateAsync({ data: payload });
        toast({ title: "Ficha técnica criada!" });
      }
      await queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
      setDialogOpen(false);
      resetForm();
    } catch {
      toast({ title: "Erro ao salvar ficha técnica", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      await deleteRecipe.mutateAsync({ id: deleteTarget.id });
      await queryClient.invalidateQueries({ queryKey: getListRecipesQueryKey() });
      toast({ title: "Ficha técnica removida" });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Erro ao remover ficha técnica", variant: "destructive" });
    }
  }

  const isSaving = createRecipe.isPending || updateRecipe.isPending || deleteRecipe.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold" style={{ color: "#7B2E68" }}>Fichas técnicas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie receitas, custos e insumos das suas produções.</p>
        </div>
        <Button onClick={openCreate} className="gap-2" style={{ backgroundColor: "#7B2E68" }}>
          <Plus className="w-4 h-4" /> Nova ficha
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 rounded-xl border border-dashed border-pink-200 bg-pink-50/40">
          <BookOpen className="w-12 h-12 opacity-30" />
          <p>Nenhuma ficha técnica cadastrada ainda.</p>
          <Button onClick={openCreate} variant="outline">Criar primeira ficha</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recipes.map((recipe) => {
            const product = productsById.get(recipe.productId);
            return (
              <div key={recipe.id} className="rounded-xl border border-pink-100 bg-white p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-lg">{recipe.productName}</h3>
                    <p className="text-sm text-muted-foreground">{product?.name ?? "Produto"}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(recipe)} className="rounded p-1.5 hover:bg-pink-50 text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(recipe)} className="rounded p-1.5 hover:bg-red-50 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-pink-50/70 p-3">
                    <p className="text-muted-foreground">Rendimento</p>
                    <p className="font-semibold">{recipe.yield} un</p>
                  </div>
                  <div className="rounded-lg bg-pink-50/70 p-3">
                    <p className="text-muted-foreground">Tempo</p>
                    <p className="font-semibold">{recipe.prepTime} min</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{recipe.ingredients?.length ?? 0} ingrediente{(recipe.ingredients?.length ?? 0) !== 1 ? "s" : ""}</span>
                  <span className="font-semibold" style={{ color: "#7B2E68" }}>
                    {fmtCurrency(recipe.unitCost)} / un
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Custo total</span>
                  <span className="font-semibold">{fmtCurrency(recipe.totalCost)}</span>
                </div>

                <div className="grid grid-cols-1 gap-2 rounded-lg border border-pink-100 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Preço escolhido</span>
                    <span className="font-semibold">{fmtCurrency(recipe.productPrice ?? Number(product?.price ?? 0))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Preço sugerido (60%)</span>
                    <span className="font-semibold" style={{ color: "#7B2E68" }}>{fmtCurrency(recipe.suggestedPrice ?? 0)}</span>
                  </div>
                  {recipe.contributionMarginPercent != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Margem de contribuição</span>
                      <span className={recipe.contributionMarginPercent >= 60 ? "font-semibold text-green-700" : "font-semibold text-red-600"}>
                        {recipe.contributionMarginPercent.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                {recipe.cmvPercent != null && (
                  <div className="text-sm text-muted-foreground">
                    CMV estimado: <span className={recipe.cmvPercent <= 30 ? "text-green-600" : recipe.cmvPercent <= 50 ? "text-amber-600" : "text-red-600"}>{recipe.cmvPercent.toFixed(0)}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingRecipe ? "Editar ficha técnica" : "Nova ficha técnica"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Produto</Label>
              <Select value={form.productId} onValueChange={(value) => updateField("productId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Rendimento</Label>
                <Input type="number" min="1" value={form.yield} onChange={(event) => updateField("yield", event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Tempo de preparo (min)</Label>
                <Input type="number" min="0" value={form.prepTime} onChange={(event) => updateField("prepTime", event.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Instruções</Label>
              <Textarea rows={4} value={form.instructions} onChange={(event) => updateField("instructions", event.target.value)} placeholder="Descreva o preparo" />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Insumos cadastrados no estoque</Label>
                <Button type="button" variant="outline" size="sm" onClick={addIngredient}>Adicionar</Button>
              </div>

              <div className="space-y-3">
                {form.ingredients.map((ingredient, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[1.4fr_0.8fr_0.6fr_auto] gap-2 items-end rounded-lg border border-pink-100 p-3">
                    <div className="grid gap-2">
                      <Label>Item</Label>
                      <Select value={ingredient.stockItemId} onValueChange={(value) => updateIngredient(index, { stockItemId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um insumo" />
                        </SelectTrigger>
                        <SelectContent>
                          {stockItems.map((item) => (
                            <SelectItem key={item.id} value={String(item.id)}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Quantidade</Label>
                      <Input type="number" min="0" step="0.01" value={ingredient.quantity} onChange={(event) => updateIngredient(index, { quantity: event.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Unidade</Label>
                      <Input value={ingredient.unit} onChange={(event) => updateIngredient(index, { unit: event.target.value })} placeholder="g" />
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeIngredient(index)} disabled={form.ingredients.length === 1}>
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-lg border border-pink-100 bg-pink-50/40 p-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Custo total</p>
                <p className="font-semibold">{fmtCurrency(pricingPreview.totalCost)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Fixo {fmtCurrency(pricingPreview.fixedCost)} + variável {fmtCurrency(pricingPreview.variableCost)} + {pricingPreview.variablePercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo por unidade</p>
                <p className="font-semibold">{fmtCurrency(pricingPreview.unitCost)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Preço sugerido 60%</p>
                <p className="font-semibold" style={{ color: "#7B2E68" }}>{fmtCurrency(pricingPreview.suggestedPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem atual</p>
                <p className={pricingPreview.contributionMarginPercent != null && pricingPreview.contributionMarginPercent >= 60 ? "font-semibold text-green-700" : "font-semibold text-red-600"}>
                  {pricingPreview.contributionMarginPercent != null ? `${pricingPreview.contributionMarginPercent.toFixed(0)}%` : "Sem preço"}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} style={{ backgroundColor: "#7B2E68" }}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingRecipe ? "Salvar alterações" : "Criar ficha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover ficha técnica?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não poderá ser desfeita e removerá também os insumos associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

