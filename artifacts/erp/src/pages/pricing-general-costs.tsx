import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fmtCurrency, fmtPercent, type GeneralCost } from "./pricing-module-types";

const empty = { name: "", type: "variable", value: "", applyToDirectSale: true, applyToMarketplace: true, active: true };

export default function PricingGeneralCostsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const { data: costs = [] } = useQuery({ queryKey: ["pricing-module-general-costs"], queryFn: () => apiRequest<GeneralCost[]>("/api/pricing-module/general-costs") });
  const save = useMutation({
    mutationFn: () => apiRequest<GeneralCost>("/api/pricing-module/general-costs", { method: "POST", body: JSON.stringify({ ...form, value: Number(form.value || 0) }) }),
    onSuccess: () => { setForm(empty); qc.invalidateQueries({ queryKey: ["pricing-module-general-costs"] }); },
  });
  async function remove(id: number) {
    await apiRequest<void>(`/api/pricing-module/general-costs/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["pricing-module-general-costs"] });
  }
  const monthly = costs.filter((c) => c.type === "monthly_fixed").reduce((s, c) => s + c.value, 0);
  const direct = costs.filter((c) => c.type === "variable" && c.applyToDirectSale && c.active).reduce((s, c) => s + c.value, 0);
  const market = costs.filter((c) => c.type === "variable" && c.applyToMarketplace && c.active).reduce((s, c) => s + c.value, 0);

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="font-serif text-3xl font-bold text-primary">Custos Gerais</h1><p className="text-sm text-muted-foreground">Custos fixos mensais e taxas percentuais que impactam todos os produtos.</p></div>
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Fixos mensais</p><p className="text-xl font-semibold">{fmtCurrency(monthly)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Taxas venda direta</p><p className="text-xl font-semibold">{fmtPercent(direct)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Taxas marketplace</p><p className="text-xl font-semibold">{fmtPercent(market)}</p></CardContent></Card>
      </div>
      <Card><CardContent className="grid gap-3 p-4 md:grid-cols-[1.3fr_0.8fr_0.7fr_0.8fr_0.8fr_0.6fr_auto] md:items-end">
        <div><Label>Nome</Label><Input placeholder="Imposto, cartão, aluguel..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Tipo</Label><Select value={form.type} onValueChange={(type) => setForm({ ...form, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="variable">Variável %</SelectItem><SelectItem value="monthly_fixed">Fixo mensal R$</SelectItem></SelectContent></Select></div>
        <div><Label>Valor</Label><Input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
        <div className="flex items-center gap-2"><Switch checked={form.applyToDirectSale} onCheckedChange={(v) => setForm({ ...form, applyToDirectSale: v })} /><Label>Venda direta</Label></div>
        <div className="flex items-center gap-2"><Switch checked={form.applyToMarketplace} onCheckedChange={(v) => setForm({ ...form, applyToMarketplace: v })} /><Label>Marketplace</Label></div>
        <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
        <Button disabled={!form.name || save.isPending} onClick={() => save.mutate()} style={{ backgroundColor: "#7B2E68" }}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
      </CardContent></Card>
      <div className="grid gap-3">
        {costs.map((cost) => <Card key={cost.id}><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_140px_140px_180px_auto] md:items-center"><div><p className="font-semibold">{cost.name}</p><p className="text-sm text-muted-foreground">{cost.active ? "Ativo" : "Inativo"}</p></div><p>{cost.type === "monthly_fixed" ? "Fixo mensal" : "Variável"}</p><p className="font-semibold">{cost.type === "monthly_fixed" ? fmtCurrency(cost.value) : fmtPercent(cost.value)}</p><p className="text-sm text-muted-foreground">{cost.applyToDirectSale ? "Direta" : ""} {cost.applyToMarketplace ? "Marketplace" : ""}</p><Button variant="ghost" size="icon" onClick={() => remove(cost.id)}><Trash2 className="h-4 w-4" /></Button></CardContent></Card>)}
        {costs.length === 0 && <div className="rounded-lg border border-dashed bg-white p-8 text-center text-muted-foreground">Nenhum custo geral cadastrado.</div>}
      </div>
    </div>
  );
}
