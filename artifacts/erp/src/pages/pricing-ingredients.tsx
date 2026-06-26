import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { fmtCurrency, type PricingIngredient } from "./pricing-module-types";

const empty = { name: "", type: "comprado", packageContent: "1", unit: "g", packagePrice: "", yieldPercent: "100", active: true };

export default function PricingIngredientsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<PricingIngredient | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ["pricing-module-ingredients", search, type],
    queryFn: () => apiRequest<PricingIngredient[]>(`/api/pricing-module/ingredients?search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}`),
  });
  const calculatedUnitCost = Number(form.packageContent || 0) > 0 ? Number(form.packagePrice || 0) / Number(form.packageContent || 1) : 0;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        type: form.type,
        packageContent: Number(form.packageContent || 0),
        unit: form.unit,
        packagePrice: Number(form.packagePrice || 0),
        yieldPercent: Number(form.yieldPercent || 100),
        active: form.active,
      };
      return editing
        ? apiRequest<PricingIngredient>(`/api/pricing-module/ingredients/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : apiRequest<PricingIngredient>("/api/pricing-module/ingredients", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      setForm(empty);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["pricing-module-ingredients"] });
      toast({ title: "Ingrediente salvo" });
    },
  });

  function edit(item: PricingIngredient) {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      packageContent: String(item.packageContent),
      unit: item.unit,
      packagePrice: String(item.packagePrice),
      yieldPercent: String(item.yieldPercent),
      active: item.active,
    });
  }

  async function remove(id: number) {
    await apiRequest<void>(`/api/pricing-module/ingredients/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["pricing-module-ingredients"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-primary">Ingredientes</h1>
        <p className="text-sm text-muted-foreground">Matéria-prima com rendimento e custo unitário real.</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Tipo</Label><Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comprado">Comprado</SelectItem><SelectItem value="fabricado">Fabricado</SelectItem><SelectItem value="produto">Produto</SelectItem></SelectContent></Select></div>
          <div><Label>Conteúdo embalagem</Label><Input type="number" min="0" step="0.001" value={form.packageContent} onChange={(e) => setForm({ ...form, packageContent: e.target.value })} /></div>
          <div><Label>Unidade</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
          <div><Label>Preço embalagem</Label><Input type="number" min="0" step="0.01" value={form.packagePrice} onChange={(e) => setForm({ ...form, packagePrice: e.target.value })} /></div>
          <div><Label>Rendimento %</Label><Input type="number" min="0.01" max="100" step="0.01" value={form.yieldPercent} onChange={(e) => setForm({ ...form, yieldPercent: e.target.value })} /></div>
          <div><Label>Custo unitário</Label><Input value={fmtCurrency(calculatedUnitCost)} disabled /></div>
          <div className="flex items-end gap-2"><Switch checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} /><Label>{form.active ? "Ativo" : "Inativo"}</Label></div>
          <div className="flex gap-2 md:col-span-4">
            {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</Button>}
            <Button disabled={!form.name || save.isPending} onClick={() => save.mutate()} style={{ backgroundColor: "#7B2E68" }}><Plus className="mr-2 h-4 w-4" /> Salvar ingrediente</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <Input placeholder="Buscar ingrediente" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={type || "all"} onValueChange={(value) => setType(value === "all" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos</SelectItem><SelectItem value="comprado">Comprado</SelectItem><SelectItem value="fabricado">Fabricado</SelectItem><SelectItem value="produto">Produto</SelectItem></SelectContent></Select>
      </div>

      <div className="grid gap-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : ingredients.map((item) => (
          <Card key={item.id}>
            <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_140px_140px_120px_auto] md:items-center">
              <div><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.type} · {item.packageContent} {item.unit} · rendimento {item.yieldPercent}%</p></div>
              <p>{fmtCurrency(item.packagePrice)}</p>
              <p className="font-semibold">{fmtCurrency(item.unitCost)} / {item.unit}</p>
              <p className={item.active ? "text-green-700" : "text-red-600"}>{item.active ? "Ativo" : "Inativo"}</p>
              <div className="flex gap-1 justify-end"><Button variant="ghost" size="icon" onClick={() => edit(item)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4" /></Button></div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && ingredients.length === 0 && <div className="rounded-lg border border-dashed bg-white p-8 text-center text-muted-foreground">Nenhum ingrediente cadastrado.</div>}
      </div>
    </div>
  );
}
