import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator, CheckCircle2, Save } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getListProductsQueryKey, type Product, useListProducts } from "@workspace/api-client-react";

type PricingResult = {
  product: { id: number; name: string; price: number };
  channel: "direct" | "marketplace";
  sheet: { hasRecipe: boolean; totalYield?: number; ingredientCost: number; unitCost: number; totalCost: number; items: Array<{ stockItemName: string; netQuantity: number; grossQuantity: number; unit: string; yieldPercent: number; ingredientCost: number; alert?: string | null }> };
  directSalePrice: number;
  marketplacePrice: number;
  targetCMV: number;
  targetMargin: number;
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
  belowSuggested: boolean;
  alerts: string[];
};

type SimResponse = {
  direct: PricingResult;
  marketplace: PricingResult;
};

type DashboardResponse = {
  criticalCMV: PricingResult[];
  highestProfit: PricingResult[];
  lowestMargin: PricingResult[];
  withoutTechnicalSheet: PricingResult[];
  belowSuggested: PricingResult[];
};

type ExtraCost = {
  id: number;
  productId: number;
  name: string;
  type: "fixed" | "percentage";
  value: number;
  active: boolean;
};

const emptyExtra = { name: "", type: "fixed", value: "", active: true };

function fmtCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function cmvClass(value: number) {
  if (value <= 30) return "text-green-700";
  if (value <= 40) return "text-emerald-700";
  if (value <= 50) return "text-amber-600";
  return "text-red-600";
}

export default function PricingPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: products = [] } = useListProducts();
  const [productId, setProductId] = useState("");
  const selectedProduct = useMemo(() => products.find((product) => product.id === Number(productId)), [productId, products]);
  const [form, setForm] = useState({ directSalePrice: "", marketplacePrice: "", targetCMV: "35", targetMargin: "60", monthlySalesEstimate: "100" });
  const [extraForm, setExtraForm] = useState(emptyExtra);
  const [result, setResult] = useState<SimResponse | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ["pricing-dashboard"],
    queryFn: () => apiRequest<DashboardResponse>("/api/pricing/dashboard"),
  });

  const { data: extraCosts = [] } = useQuery({
    queryKey: ["product-extra-costs", productId],
    enabled: Boolean(productId),
    queryFn: () => apiRequest<ExtraCost[]>(`/api/pricing/product-extra-costs?productId=${productId}`),
  });

  const simulate = useMutation({
    mutationFn: () => apiRequest<SimResponse>("/api/pricing/simulate", {
      method: "POST",
      body: JSON.stringify({
        productId: Number(productId),
        directSalePrice: Number(form.directSalePrice || selectedProduct?.price || 0),
        marketplacePrice: Number(form.marketplacePrice || 0),
        targetCMV: Number(form.targetCMV || 35),
        targetMargin: Number(form.targetMargin || 60),
        monthlySalesEstimate: Number(form.monthlySalesEstimate || 1),
      }),
    }),
    onSuccess: setResult,
    onError: (error) => toast({ title: "Erro ao simular preço", description: error instanceof Error ? error.message : undefined, variant: "destructive" }),
  });

  const saveExtra = useMutation({
    mutationFn: () => apiRequest<ExtraCost>("/api/pricing/product-extra-costs", {
      method: "POST",
      body: JSON.stringify({
        productId: Number(productId),
        name: extraForm.name,
        type: extraForm.type,
        value: Number(extraForm.value || 0),
        active: extraForm.active,
      }),
    }),
    onSuccess: () => {
      setExtraForm(emptyExtra);
      qc.invalidateQueries({ queryKey: ["product-extra-costs", productId] });
      toast({ title: "Custo exclusivo salvo" });
    },
  });

  const removeExtra = useMutation({
    mutationFn: (id: number) => apiRequest<void>(`/api/pricing/product-extra-costs/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-extra-costs", productId] }),
  });

  const applySuggested = useMutation({
    mutationFn: () => apiRequest(`/api/pricing/products/${productId}/apply-suggested`, {
      method: "POST",
      body: JSON.stringify({
        directSalePrice: Number(form.directSalePrice || selectedProduct?.price || 0),
        targetCMV: Number(form.targetCMV || 35),
        targetMargin: Number(form.targetMargin || 60),
        monthlySalesEstimate: Number(form.monthlySalesEstimate || 1),
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast({ title: "Preço do produto atualizado" });
    },
  });

  function setField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const direct = result?.direct;
  const marketplace = result?.marketplace;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-primary">Precificação Inteligente</h1>
        <p className="text-sm text-muted-foreground">CMV, margem, lucro e preço ideal para venda direta e marketplace.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">CMV crítico</p><p className="text-2xl font-semibold text-red-600">{dashboard?.criticalCMV.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sem ficha</p><p className="text-2xl font-semibold">{dashboard?.withoutTechnicalSheet.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Abaixo do sugerido</p><p className="text-2xl font-semibold text-amber-600">{dashboard?.belowSuggested.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Maior lucro</p><p className="text-lg font-semibold truncate">{dashboard?.highestProfit[0]?.product.name ?? "-"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Menor margem</p><p className="text-lg font-semibold truncate">{dashboard?.lowestMargin[0]?.product.name ?? "-"}</p></CardContent></Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Simulação</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <Label>Produto</Label>
              <Select value={productId} onValueChange={(value) => { setProductId(value); const product = products.find((item) => item.id === Number(value)); setForm((prev) => ({ ...prev, directSalePrice: String(product?.price ?? "") })); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{products.map((product: Product) => <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Preço venda direta</Label><Input type="number" min="0" step="0.01" value={form.directSalePrice} onChange={(event) => setField("directSalePrice", event.target.value)} /></div>
            <div><Label>Preço marketplace</Label><Input type="number" min="0" step="0.01" value={form.marketplacePrice} onChange={(event) => setField("marketplacePrice", event.target.value)} /></div>
            <div><Label>Vendas/mês</Label><Input type="number" min="1" value={form.monthlySalesEstimate} onChange={(event) => setField("monthlySalesEstimate", event.target.value)} /></div>
            <div><Label>CMV alvo %</Label><Input type="number" min="1" max="99" value={form.targetCMV} onChange={(event) => setField("targetCMV", event.target.value)} /></div>
            <div><Label>Margem desejada %</Label><Input type="number" min="1" max="99" value={form.targetMargin} onChange={(event) => setField("targetMargin", event.target.value)} /></div>
          </div>

          <div className="grid gap-3 rounded-lg border border-pink-100 bg-pink-50/30 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
            <div><Label>Custo exclusivo</Label><Input placeholder="Embalagem, topper..." value={extraForm.name} onChange={(event) => setExtraForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div><Label>Tipo</Label><Select value={extraForm.type} onValueChange={(value) => setExtraForm((prev) => ({ ...prev, type: value as "fixed" | "percentage" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">R$ fixo</SelectItem><SelectItem value="percentage">% venda</SelectItem></SelectContent></Select></div>
            <div><Label>Valor</Label><Input type="number" min="0" step="0.01" value={extraForm.value} onChange={(event) => setExtraForm((prev) => ({ ...prev, value: event.target.value }))} /></div>
            <div className="flex items-end"><Button disabled={!productId || !extraForm.name} onClick={() => saveExtra.mutate()}>Adicionar</Button></div>
          </div>

          {extraCosts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extraCosts.map((cost) => (
                <Badge key={cost.id} variant="outline" className="gap-2">
                  {cost.name}: {cost.type === "fixed" ? fmtCurrency(cost.value) : fmtPercent(cost.value)}
                  <button onClick={() => removeExtra.mutate(cost.id)}>x</button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button disabled={!productId || simulate.isPending} onClick={() => simulate.mutate()} style={{ backgroundColor: "#7B2E68" }}>{simulate.isPending ? "Calculando..." : "Calcular"}</Button>
            {direct && <Button variant="outline" className="gap-2" onClick={() => applySuggested.mutate()} disabled={applySuggested.isPending}><Save className="h-4 w-4" /> Aplicar preço sugerido</Button>}
          </div>
        </CardContent>
      </Card>

      {direct && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[direct, marketplace].filter(Boolean).map((row) => row && (
            <Card key={row.channel} className="rounded-lg">
              <CardHeader><CardTitle>{row.channel === "direct" ? "Venda direta" : "Marketplace"}</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Custo produto</p><p className="font-semibold">{fmtCurrency(row.ingredientCost)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Custo total</p><p className="font-semibold">{fmtCurrency(row.totalCost)}</p></div>
                  <div><p className="text-xs text-muted-foreground">CMV</p><p className={`font-semibold ${cmvClass(row.cmvPercent)}`}>{fmtPercent(row.cmvPercent)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Margem</p><p className={row.contributionMarginPercent >= 60 ? "font-semibold text-green-700" : "font-semibold text-red-600"}>{fmtPercent(row.contributionMarginPercent)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Lucro líquido</p><p className={row.netProfit >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-600"}>{fmtCurrency(row.netProfit)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Sugerido</p><p className="font-semibold text-primary">{fmtCurrency(row.channel === "direct" ? row.suggestedDirectPrice : row.suggestedMarketplacePrice)}</p></div>
                </div>
                {row.alerts.length > 0 ? (
                  <div className="grid gap-2">
                    {row.alerts.map((alert) => <div key={alert} className="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> {alert}</div>)}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-green-50 p-2 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /> Precificação saudável.</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
