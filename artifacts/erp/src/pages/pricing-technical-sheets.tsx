import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fmtCurrency, type PricingIngredient, type TechnicalSheet } from "./pricing-module-types";
import { type Product, useListProducts } from "@workspace/api-client-react";

type SheetItemForm = { ingredientId: string; netQuantity: string; unit: string; note: string };
const empty = { id: 0, productId: "", name: "", totalYield: "1", preparationMode: "", items: [{ ingredientId: "", netQuantity: "0", unit: "g", note: "" }] as SheetItemForm[] };

export default function PricingTechnicalSheetsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: products = [] } = useListProducts();
  const { data: ingredients = [] } = useQuery({ queryKey: ["pricing-module-ingredients"], queryFn: () => apiRequest<PricingIngredient[]>("/api/pricing-module/ingredients") });
  const { data: sheets = [], isLoading } = useQuery({ queryKey: ["pricing-module-sheets"], queryFn: () => apiRequest<TechnicalSheet[]>("/api/pricing-module/technical-sheets") });
  const [form, setForm] = useState(empty);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        productId: Number(form.productId),
        name: form.name,
        totalYield: Number(form.totalYield || 1),
        preparationMode: form.preparationMode,
        items: form.items.filter((item) => item.ingredientId).map((item) => ({
          ingredientId: Number(item.ingredientId),
          netQuantity: Number(item.netQuantity || 0),
          unit: item.unit,
          note: item.note,
        })),
      };
      return form.id
        ? apiRequest<TechnicalSheet>(`/api/pricing-module/technical-sheets/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : apiRequest<TechnicalSheet>("/api/pricing-module/technical-sheets", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["pricing-module-sheets"] });
      toast({ title: "Ficha técnica salva" });
    },
  });

  function edit(sheet: TechnicalSheet) {
    setForm({
      id: sheet.id,
      productId: String(sheet.productId),
      name: sheet.name,
      totalYield: String(sheet.totalYield),
      preparationMode: sheet.preparationMode,
      items: sheet.items.length ? sheet.items.map((item) => ({ ingredientId: String(item.ingredientId), netQuantity: String(item.netQuantity), unit: item.unit, note: item.note })) : empty.items,
    });
  }

  async function remove(id: number) {
    await apiRequest<void>(`/api/pricing-module/technical-sheets/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["pricing-module-sheets"] });
  }

  function updateItem(index: number, patch: Partial<SheetItemForm>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        if (patch.ingredientId) {
          const ing = ingredients.find((ingredient) => ingredient.id === Number(patch.ingredientId));
          if (ing) next.unit = ing.unit;
        }
        return next;
      }),
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="font-serif text-3xl font-bold text-primary">Fichas Técnicas</h1><p className="text-sm text-muted-foreground">Receitas por produto com quantidade bruta, rendimento e custo por ingrediente.</p></div>

      <Card><CardContent className="grid gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div><Label>Produto</Label><Select value={form.productId} onValueChange={(productId) => { const product = products.find((p: Product) => p.id === Number(productId)); setForm({ ...form, productId, name: product?.name ?? form.name }); }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{products.map((p: Product) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Nome da ficha</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Rendimento total</Label><Input type="number" min="1" step="0.001" value={form.totalYield} onChange={(e) => setForm({ ...form, totalYield: e.target.value })} /></div>
        </div>
        <div><Label>Modo de preparo</Label><Textarea value={form.preparationMode} onChange={(e) => setForm({ ...form, preparationMode: e.target.value })} /></div>
        <div className="grid gap-3">
          <div className="flex items-center justify-between"><Label>Ingredientes da ficha</Label><Button variant="outline" onClick={() => setForm({ ...form, items: [...form.items, { ingredientId: "", netQuantity: "0", unit: "g", note: "" }] })}>Adicionar ingrediente</Button></div>
          {form.items.map((item, index) => {
            const ing = ingredients.find((ingredient) => ingredient.id === Number(item.ingredientId));
            const net = Number(item.netQuantity || 0);
            const gross = ing ? net / (Number(ing.yieldPercent || 100) / 100) : 0;
            const cost = ing ? gross * Number(ing.unitCost || 0) : 0;
            return (
              <div key={index} className="grid gap-2 rounded-lg border border-pink-100 p-3 md:grid-cols-[1.4fr_0.7fr_0.5fr_0.7fr_0.7fr_auto] md:items-end">
                <div><Label>Ingrediente</Label><Select value={item.ingredientId} onValueChange={(ingredientId) => updateItem(index, { ingredientId })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{ingredients.map((ingredient) => <SelectItem key={ingredient.id} value={String(ingredient.id)}>{ingredient.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Qtd. líquida</Label><Input type="number" min="0" step="0.001" value={item.netQuantity} onChange={(e) => updateItem(index, { netQuantity: e.target.value })} /></div>
                <div><Label>Un.</Label><Input value={item.unit} onChange={(e) => updateItem(index, { unit: e.target.value })} /></div>
                <div><Label>Qtd. bruta</Label><Input value={gross.toFixed(3)} disabled /></div>
                <div><Label>Custo</Label><Input value={fmtCurrency(cost)} disabled /></div>
                <Button variant="ghost" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">{form.id > 0 && <Button variant="outline" onClick={() => setForm(empty)}>Cancelar</Button>}<Button disabled={!form.productId || !form.name || save.isPending} onClick={() => save.mutate()} style={{ backgroundColor: "#7B2E68" }}><Plus className="mr-2 h-4 w-4" /> Salvar ficha</Button></div>
      </CardContent></Card>

      <div className="grid gap-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : sheets.map((sheet) => (
          <Card key={sheet.id}><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_140px_140px_auto] md:items-center">
            <div><p className="font-semibold">{sheet.name}</p><p className="text-sm text-muted-foreground">{sheet.items.length} ingrediente(s)</p></div>
            <p>Custo total<br /><strong>{fmtCurrency(sheet.totalCost)}</strong></p>
            <p>Custo un.<br /><strong>{fmtCurrency(sheet.unitCost)}</strong></p>
            <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => edit(sheet)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(sheet.id)}><Trash2 className="h-4 w-4" /></Button></div>
          </CardContent></Card>
        ))}
        {!isLoading && sheets.length === 0 && <div className="rounded-lg border border-dashed bg-white p-8 text-center text-muted-foreground">Nenhuma ficha técnica cadastrada.</div>}
      </div>
    </div>
  );
}
