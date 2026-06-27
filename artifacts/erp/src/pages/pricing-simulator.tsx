import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type Simulation = { direct: PricingResult; marketplace: PricingResult };
type Dashboard = {
  criticalCMV: PricingResult[];
  highestProfit: PricingResult[];
  lowestMargin: PricingResult[];
  withoutTechnicalSheet: PricingResult[];
  belowSuggested: PricingResult[];
};
type ExtraCost = { id: number; name: string; type: "fixed" | "percentage"; value: number };

function cmvClass(value: number) {
  if (value <= 30) return "text-green-700";
  if (value <= 40) return "text-emerald-700";
  if (value <= 50) return "text-amber-600";
  return "text-red-600";
}

function marginClass(value: number, target: number) {
  return value >= target ? "text-green-700" : "text-red-600";
}

export default function PricingSimulatorPage() {
  const qc = useQueryClient();
  const { data: products = [] } = useListProducts();
  const [productId, setProductId] = useState("");
  const product = products.find((p: Product) => p.id === Number(productId));
  const [form, setForm] = useState({ directSalePrice: "", marketplacePrice: "", targetCMV: "35", targetMargin: "60" });
  const [extra, setExtra] = useState({ name: "", type: "fixed", value: "" });

  const directSalePrice = Number(form.directSalePrice || product?.price || 0);
  const marketplacePrice = Number(form.marketplacePrice || 0);
  const targetCMV = Number(form.targetCMV || 35);
  const targetMargin = Number(form.targetMargin || 60);

  const simulationPayload = useMemo(() => ({
    productId: Number(productId),
    directSalePrice,
    marketplacePrice,
    targetCMV,
    targetMargin,
  }), [productId, directSalePrice, marketplacePrice, targetCMV, targetMargin]);

  const { data: dashboard } = useQuery({
    queryKey: ["pricing-module-dashboard"],
    queryFn: () => apiRequest<Dashboard>("/api/pricing-module/dashboard"),
  });

  const { data: extras = [] } = useQuery({
    queryKey: ["pricing-module-extra-costs", productId],
    enabled: Boolean(productId),
    queryFn: () => apiRequest<ExtraCost[]>(`/api/pricing-module/product-extra-costs?productId=${productId}`),
  });

  const { data: result, isFetching } = useQuery({
    queryKey: ["pricing-module-simulation", simulationPayload, extras.length],
    enabled: Boolean(productId) && directSalePrice > 0,
    queryFn: () => apiRequest<Simulation>("/api/pricing-module/simulate", { method: "POST", body: JSON.stringify(simulationPayload) }),
  });

  const addExtra = useMutation({
    mutationFn: () => apiRequest<ExtraCost>("/api/pricing-module/product-extra-costs", {
      method: "POST",
      body: JSON.stringify({ productId: Number(productId), name: extra.name, type: extra.type, value: Number(extra.value || 0), active: true }),
    }),
    onSuccess: () => {
      setExtra({ name: "", type: "fixed", value: "" });
      qc.invalidateQueries({ queryKey: ["pricing-module-extra-costs", productId] });
      qc.invalidateQueries({ queryKey: ["pricing-module-simulation"] });
      qc.invalidateQueries({ queryKey: ["pricing-module-dashboard"] });
    },
  });

  const apply = useMutation({
    mutationFn: () => apiRequest(`/api/pricing-module/products/${productId}/apply-suggested`, { method: "POST", body: JSON.stringify(simulationPayload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      qc.invalidateQueries({ queryKey: ["pricing-module-dashboard"] });
    },
  });

  async function removeExtra(id: number) {
    await apiRequest<void>(`/api/pricing-module/product-extra-costs/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["pricing-module-extra-costs", productId] });
    qc.invalidateQueries({ queryKey: ["pricing-module-simulation"] });
    qc.invalidateQueries({ queryKey: ["pricing-module-dashboard"] });
  }

  function selectProduct(value: string) {
    const selected = products.find((item: Product) => item.id === Number(value));
    setProductId(value);
    setForm((prev) => ({ ...prev, directSalePrice: String(selected?.price ?? ""), marketplacePrice: "" }));
  }

  const direct = result?.direct;
  const marketplace = result?.marketplace;
  const soldPaidCost = (row: PricingResult) => row.extraCost + row.variableCost;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-bold text-primary">Precificação Inteligente / Margem</h1>
          {isFetching && <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Recalculando</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">Cálculo unitário por produto, sem previsão de vendas mensais. Qualquer alteração recalcula os resultados finais.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">CMV crítico</p><p className="text-2xl font-semibold text-red-600">{dashboard?.criticalCMV.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sem ficha</p><p className="text-2xl font-semibold">{dashboard?.withoutTechnicalSheet.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Abaixo sugerido</p><p className="text-2xl font-semibold text-amber-600">{dashboard?.belowSuggested.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Maior lucro</p><p className="truncate font-semibold">{dashboard?.highestProfit[0]?.product.name ?? "-"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Menor margem</p><p className="truncate font-semibold">{dashboard?.lowestMargin[0]?.product.name ?? "-"}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Produto e parâmetros</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <Label>Produto</Label>
              <Select value={productId} onValueChange={selectProduct}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{products.map((p: Product) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Preço venda direta</Label><Input type="number" min="0" step="0.01" value={form.directSalePrice} onChange={(event) => setForm({ ...form, directSalePrice: event.target.value })} /></div>
            <div><Label>Preço marketplace</Label><Input type="number" min="0" step="0.01" placeholder="Opcional" value={form.marketplacePrice} onChange={(event) => setForm({ ...form, marketplacePrice: event.target.value })} /></div>
            <div><Label>CMV alvo %</Label><Input type="number" min="1" max="99" step="0.01" value={form.targetCMV} onChange={(event) => setForm({ ...form, targetCMV: event.target.value })} /></div>
            <div><Label>Margem desejada %</Label><Input type="number" min="1" max="99" step="0.01" value={form.targetMargin} onChange={(event) => setForm({ ...form, targetMargin: event.target.value })} /></div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground">Preço analisado</p>
              <p className="font-semibold text-primary">{fmtCurrency(directSalePrice)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground">CMV alvo</p>
              <p className="font-semibold text-green-700">{fmtPercent(targetCMV)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground">Margem desejada</p>
              <p className="font-semibold text-green-700">{fmtPercent(targetMargin)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground">Preço sugerido</p>
              <p className="font-semibold text-primary">{direct ? fmtCurrency(direct.suggestedDirectPrice) : "-"}</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-pink-100 bg-pink-50/40 p-4 md:grid-cols-[1fr_180px_160px_auto]">
            <div><Label>Custo exclusivo do produto</Label><Input placeholder="Embalagem, etiqueta, topper..." value={extra.name} onChange={(event) => setExtra({ ...extra, name: event.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={extra.type} onValueChange={(type) => setExtra({ ...extra, type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="fixed">R$ fixo</SelectItem><SelectItem value="percentage">% venda</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Valor</Label><Input type="number" min="0" step="0.01" value={extra.value} onChange={(event) => setExtra({ ...extra, value: event.target.value })} /></div>
            <div className="flex items-end"><Button disabled={!productId || !extra.name || addExtra.isPending} onClick={() => addExtra.mutate()}>Adicionar</Button></div>
          </div>

          <div className="flex flex-wrap gap-2">
            {extras.map((item) => (
              <Badge key={item.id} variant="outline" className="gap-2">
                {item.name}: {item.type === "fixed" ? fmtCurrency(item.value) : fmtPercent(item.value)}
                <button type="button" onClick={() => removeExtra(item.id)}><Trash2 className="h-3 w-3" /></button>
              </Badge>
            ))}
            {extras.length === 0 && <p className="text-sm text-muted-foreground">Nenhum custo exclusivo cadastrado para este produto.</p>}
          </div>
        </CardContent>
      </Card>

      {!productId && <div className="rounded-lg border border-dashed bg-white p-8 text-center text-muted-foreground">Selecione um produto para calcular preço, CMV, margem e lucro.</div>}

      {result && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[direct, marketplace].filter(Boolean).map((row) => (
            <Card key={row!.channel}>
              <CardHeader><CardTitle>{row!.channel === "direct" ? "Venda direta" : "Marketplace"}</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Custo do produto</p><p className="font-semibold">{fmtCurrency(row!.ingredientCost)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Lucro bruto</p><p className={row!.grossProfit >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-600"}>{fmtCurrency(row!.grossProfit)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Custo vendeu pagou</p><p className="font-semibold">{fmtCurrency(soldPaidCost(row!))}</p></div>
                  <div><p className="text-xs text-muted-foreground">Custo total</p><p className="font-semibold">{fmtCurrency(row!.totalCost)}</p></div>
                  <div><p className="text-xs text-muted-foreground">CMV</p><p className={`font-semibold ${cmvClass(row!.cmvPercent)}`}>{fmtPercent(row!.cmvPercent)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Margem contribuição</p><p className={`font-semibold ${marginClass(row!.contributionMarginPercent, targetMargin)}`}>{fmtPercent(row!.contributionMarginPercent)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Margem em R$</p><p className={row!.contributionMargin >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-600"}>{fmtCurrency(row!.contributionMargin)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Preço sugerido</p><p className="font-semibold text-primary">{fmtCurrency(row!.channel === "direct" ? row!.suggestedDirectPrice : row!.suggestedMarketplacePrice)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Preço atual</p><p className="font-semibold">{fmtCurrency(row!.channel === "direct" ? directSalePrice : (marketplacePrice || row!.suggestedMarketplacePrice))}</p></div>
                </div>

                {row!.alerts.length ? (
                  <div className="grid gap-2">{row!.alerts.map((alert) => <div key={alert} className="flex gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" />{alert}</div>)}</div>
                ) : (
                  <div className="flex gap-2 rounded-md bg-green-50 p-2 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" />Precificação saudável.</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {direct && (
        <div className="flex justify-end">
          <Button variant="outline" className="gap-2" onClick={() => apply.mutate()} disabled={apply.isPending}>
            <Save className="h-4 w-4" /> Aplicar preço sugerido ao produto
          </Button>
        </div>
      )}
    </div>
  );
}

