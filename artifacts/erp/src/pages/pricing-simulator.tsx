import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getListProductsQueryKey, type Product, useListProducts } from "@workspace/api-client-react";
import { fmtCurrency, fmtPercent } from "./pricing-module-types";

type PricingResult = {
  product: { id: number; name: string; currentPrice: number };
  channel: "direct" | "marketplace";
  hasTechnicalSheet: boolean;
  ingredientCost: number;
  extraCost: number;
  variableCost: number;
  fixedCostAllocated: number;
  totalCost: number;
  cmvPercent: number;
  cmvStatus: string;
  contributionMargin: number;
  contributionMarginPercent: number;
  grossProfit: number;
  netProfit: number;
  netProfitPercent: number;
  suggestedDirectPrice: number;
  suggestedMarketplacePrice: number;
  alerts: string[];
};
type Sim = { direct: PricingResult; marketplace: PricingResult };
type Dashboard = { criticalCMV: PricingResult[]; highestProfit: PricingResult[]; lowestMargin: PricingResult[]; withoutTechnicalSheet: PricingResult[]; belowSuggested: PricingResult[] };
type ExtraCost = { id: number; name: string; type: "fixed" | "percentage"; value: number };

function cmvClass(value: number) {
  if (value <= 30) return "text-green-700";
  if (value <= 40) return "text-emerald-700";
  if (value <= 50) return "text-amber-600";
  return "text-red-600";
}

export default function PricingSimulatorPage() {
  const qc = useQueryClient();
  const { data: products = [] } = useListProducts();
  const [productId, setProductId] = useState("");
  const product = products.find((p: Product) => p.id === Number(productId));
  const [form, setForm] = useState({ directSalePrice: "", marketplacePrice: "", targetCMV: "35", targetMargin: "60", monthlySalesEstimate: "100" });
  const [extra, setExtra] = useState({ name: "", type: "fixed", value: "" });
  const [result, setResult] = useState<Sim | null>(null);
  const { data: dashboard } = useQuery({ queryKey: ["pricing-module-dashboard"], queryFn: () => apiRequest<Dashboard>("/api/pricing-module/dashboard") });
  const { data: extras = [] } = useQuery({ queryKey: ["pricing-module-extra-costs", productId], enabled: Boolean(productId), queryFn: () => apiRequest<ExtraCost[]>(`/api/pricing-module/product-extra-costs?productId=${productId}`) });
  const simulate = useMutation({
    mutationFn: () => apiRequest<Sim>("/api/pricing-module/simulate", { method: "POST", body: JSON.stringify({ productId: Number(productId), directSalePrice: Number(form.directSalePrice || product?.price || 0), marketplacePrice: Number(form.marketplacePrice || 0), targetCMV: Number(form.targetCMV || 35), targetMargin: Number(form.targetMargin || 60), monthlySalesEstimate: Number(form.monthlySalesEstimate || 1) }) }),
    onSuccess: setResult,
  });
  const addExtra = useMutation({
    mutationFn: () => apiRequest<ExtraCost>("/api/pricing-module/product-extra-costs", { method: "POST", body: JSON.stringify({ productId: Number(productId), name: extra.name, type: extra.type, value: Number(extra.value || 0), active: true }) }),
    onSuccess: () => { setExtra({ name: "", type: "fixed", value: "" }); qc.invalidateQueries({ queryKey: ["pricing-module-extra-costs", productId] }); },
  });
  const apply = useMutation({
    mutationFn: () => apiRequest(`/api/pricing-module/products/${productId}/apply-suggested`, { method: "POST", body: JSON.stringify({ directSalePrice: Number(form.directSalePrice || product?.price || 0), targetCMV: Number(form.targetCMV || 35), targetMargin: Number(form.targetMargin || 60), monthlySalesEstimate: Number(form.monthlySalesEstimate || 1) }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: getListProductsQueryKey() }),
  });
  async function removeExtra(id: number) {
    await apiRequest<void>(`/api/pricing-module/product-extra-costs/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["pricing-module-extra-costs", productId] });
  }
  const direct = result?.direct;

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="font-serif text-3xl font-bold text-primary">Precificação Inteligente / CMV</h1><p className="text-sm text-muted-foreground">Simule preço, CMV, margem, lucro e marketplace com dados reais do banco.</p></div>
      <div className="grid gap-3 md:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">CMV crítico</p><p className="text-2xl font-semibold text-red-600">{dashboard?.criticalCMV.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sem ficha</p><p className="text-2xl font-semibold">{dashboard?.withoutTechnicalSheet.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Abaixo sugerido</p><p className="text-2xl font-semibold text-amber-600">{dashboard?.belowSuggested.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Maior lucro</p><p className="truncate font-semibold">{dashboard?.highestProfit[0]?.product.name ?? "-"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Menor margem</p><p className="truncate font-semibold">{dashboard?.lowestMargin[0]?.product.name ?? "-"}</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Simulação</CardTitle></CardHeader><CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2"><Label>Produto</Label><Select value={productId} onValueChange={(value) => { const p = products.find((item: Product) => item.id === Number(value)); setProductId(value); setForm({ ...form, directSalePrice: String(p?.price ?? "") }); }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{products.map((p: Product) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Preço direto</Label><Input type="number" value={form.directSalePrice} onChange={(e) => setForm({ ...form, directSalePrice: e.target.value })} /></div>
          <div><Label>Preço marketplace</Label><Input type="number" value={form.marketplacePrice} onChange={(e) => setForm({ ...form, marketplacePrice: e.target.value })} /></div>
          <div><Label>Vendas/mês</Label><Input type="number" value={form.monthlySalesEstimate} onChange={(e) => setForm({ ...form, monthlySalesEstimate: e.target.value })} /></div>
          <div><Label>CMV alvo %</Label><Input type="number" value={form.targetCMV} onChange={(e) => setForm({ ...form, targetCMV: e.target.value })} /></div>
          <div><Label>Margem desejada %</Label><Input type="number" value={form.targetMargin} onChange={(e) => setForm({ ...form, targetMargin: e.target.value })} /></div>
        </div>
        <div className="grid gap-3 rounded-lg border border-pink-100 bg-pink-50/40 p-4 md:grid-cols-[1fr_180px_160px_auto]">
          <div><Label>Custo exclusivo</Label><Input placeholder="Embalagem, sacola, topper..." value={extra.name} onChange={(e) => setExtra({ ...extra, name: e.target.value })} /></div>
          <div><Label>Tipo</Label><Select value={extra.type} onValueChange={(type) => setExtra({ ...extra, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">R$ fixo</SelectItem><SelectItem value="percentage">% venda</SelectItem></SelectContent></Select></div>
          <div><Label>Valor</Label><Input type="number" value={extra.value} onChange={(e) => setExtra({ ...extra, value: e.target.value })} /></div>
          <div className="flex items-end"><Button disabled={!productId || !extra.name} onClick={() => addExtra.mutate()}>Adicionar</Button></div>
        </div>
        <div className="flex flex-wrap gap-2">{extras.map((item) => <Badge key={item.id} variant="outline" className="gap-2">{item.name}: {item.type === "fixed" ? fmtCurrency(item.value) : fmtPercent(item.value)} <button onClick={() => removeExtra(item.id)}><Trash2 className="h-3 w-3" /></button></Badge>)}</div>
        <div className="flex gap-2"><Button disabled={!productId || simulate.isPending} onClick={() => simulate.mutate()} style={{ backgroundColor: "#7B2E68" }}>Calcular</Button>{direct && <Button variant="outline" className="gap-2" onClick={() => apply.mutate()}><Save className="h-4 w-4" />Aplicar preço sugerido</Button>}</div>
      </CardContent></Card>
      {result && <div className="grid gap-4 lg:grid-cols-2">{[result.direct, result.marketplace].map((row) => <Card key={row.channel}><CardHeader><CardTitle>{row.channel === "direct" ? "Venda direta" : "Marketplace"}</CardTitle></CardHeader><CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Custo produção</p><p className="font-semibold">{fmtCurrency(row.ingredientCost)}</p></div>
          <div><p className="text-xs text-muted-foreground">Custo total</p><p className="font-semibold">{fmtCurrency(row.totalCost)}</p></div>
          <div><p className="text-xs text-muted-foreground">CMV</p><p className={`font-semibold ${cmvClass(row.cmvPercent)}`}>{fmtPercent(row.cmvPercent)}</p></div>
          <div><p className="text-xs text-muted-foreground">Margem</p><p className={row.contributionMarginPercent >= Number(form.targetMargin) ? "font-semibold text-green-700" : "font-semibold text-red-600"}>{fmtPercent(row.contributionMarginPercent)}</p></div>
          <div><p className="text-xs text-muted-foreground">Lucro líquido</p><p className={row.netProfit >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-600"}>{fmtCurrency(row.netProfit)}</p></div>
          <div><p className="text-xs text-muted-foreground">Preço sugerido</p><p className="font-semibold text-primary">{fmtCurrency(row.channel === "direct" ? row.suggestedDirectPrice : row.suggestedMarketplacePrice)}</p></div>
        </div>
        {row.alerts.length ? <div className="grid gap-2">{row.alerts.map((alert) => <div key={alert} className="flex gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" />{alert}</div>)}</div> : <div className="flex gap-2 rounded-md bg-green-50 p-2 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" />Precificação saudável.</div>}
      </CardContent></Card>)}</div>}
    </div>
  );
}
