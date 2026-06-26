import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type CostItem = {
  id: number | string;
  name: string;
  type: "fixed" | "variable" | "monthly_fixed";
  amountType: "currency" | "percent";
  value: number;
  amount?: number;
  applyToDirectSale: boolean;
  applyToMarketplace: boolean;
  active: boolean;
};

function newCost(): CostItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "variable",
    amountType: "percent",
    value: 0,
    applyToDirectSale: true,
    applyToMarketplace: true,
    active: true,
  };
}

function fmtCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CostsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [costs, setCosts] = useState<CostItem[]>([]);
  const { data } = useQuery({
    queryKey: ["pricing-costs"],
    queryFn: () => apiRequest<CostItem[]>("/api/pricing/general-costs"),
  });

  useEffect(() => {
    if (data) setCosts(data.length > 0 ? data : [newCost()]);
  }, [data]);

  const totals = useMemo(() => {
    return costs.reduce(
      (acc, cost) => {
        const amount = Number(cost.value ?? cost.amount ?? 0);
        if (cost.type === "monthly_fixed") acc.monthlyFixed += amount;
        if (cost.type === "fixed") acc.fixed += amount;
        if (cost.type === "variable" && cost.amountType === "currency") acc.variableCurrency += amount;
        if (cost.type === "variable" && cost.amountType === "percent") acc.variablePercent += amount;
        return acc;
      },
      { fixed: 0, variableCurrency: 0, variablePercent: 0, monthlyFixed: 0 },
    );
  }, [costs]);

  const save = useMutation({
    mutationFn: async () => {
      const saved: CostItem[] = [];
      for (const cost of costs.filter((item) => item.name.trim())) {
        const body = {
          name: cost.name.trim(),
          type: cost.type,
          amountType: cost.type === "monthly_fixed" || cost.type === "fixed" ? "currency" : cost.amountType,
          value: Number(cost.value ?? cost.amount ?? 0),
          applyToDirectSale: cost.applyToDirectSale,
          applyToMarketplace: cost.applyToMarketplace,
          active: cost.active,
        };
        if (typeof cost.id === "number") {
          saved.push(await apiRequest<CostItem>(`/api/pricing/general-costs/${cost.id}`, { method: "PATCH", body: JSON.stringify(body) }));
        } else {
          saved.push(await apiRequest<CostItem>("/api/pricing/general-costs", { method: "POST", body: JSON.stringify(body) }));
        }
      }
      return saved;
    },
    onSuccess: (response) => {
      setCosts(response.length > 0 ? response : [newCost()]);
      qc.invalidateQueries({ queryKey: ["pricing-costs"] });
      qc.invalidateQueries({ queryKey: ["recipe-costs"] });
      qc.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Custos salvos" });
    },
    onError: (error) => {
      toast({ title: "Erro ao salvar custos", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    },
  });

  function updateCost(id: number | string, patch: Partial<CostItem>) {
    setCosts((current) => current.map((cost) => {
      if (cost.id !== id) return cost;
      const next = { ...cost, ...patch };
      if (patch.type === "fixed") next.amountType = "currency";
      return next;
    }));
  }

  async function removeCost(id: number | string) {
    if (typeof id === "number") {
      await apiRequest<void>(`/api/pricing/general-costs/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["pricing-costs"] });
      qc.invalidateQueries({ queryKey: ["/api/recipes"] });
    }
    setCosts((current) => {
      const next = current.filter((cost) => cost.id !== id);
      return next.length > 0 ? next : [newCost()];
    });
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Custos</h1>
          <p className="text-sm text-muted-foreground">Cadastre os custos da loja usados na sugestão de preço das fichas técnicas.</p>
        </div>
        <Button className="gap-2" onClick={() => setCosts((current) => [...current, newCost()])} style={{ backgroundColor: "#7B2E68" }}>
          <Plus className="h-4 w-4" /> Adicionar custo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Fixos em R$</p>
            <p className="text-xl font-semibold">{fmtCurrency(totals.fixed)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Variáveis em R$</p>
            <p className="text-xl font-semibold">{fmtCurrency(totals.variableCurrency)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Variáveis em %</p>
            <p className="text-xl font-semibold">{totals.variablePercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Fixos mensais</p>
            <p className="text-xl font-semibold">{fmtCurrency(totals.monthlyFixed)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg">Lista de custos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {costs.map((cost) => (
            <div key={cost.id} className="grid grid-cols-1 gap-3 rounded-lg border border-pink-100 p-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto]">
              <div className="grid gap-2">
                <Label>Nome do custo</Label>
                <Input placeholder="Ex.: aluguel, embalagem, taxa do cartão" value={cost.name} onChange={(event) => updateCost(cost.id, { name: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={cost.type} onValueChange={(value) => updateCost(cost.id, { type: value as CostItem["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixo</SelectItem>
                    <SelectItem value="variable">Variável</SelectItem>
                    <SelectItem value="monthly_fixed">Fixo mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Incidência</Label>
                <Select
                  value={cost.type === "fixed" || cost.type === "monthly_fixed" ? "currency" : cost.amountType}
                  disabled={cost.type === "fixed" || cost.type === "monthly_fixed"}
                  onValueChange={(value) => updateCost(cost.id, { amountType: value as CostItem["amountType"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="currency">R$</SelectItem>
                    <SelectItem value="percent">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Valor</Label>
                <Input type="number" min="0" step="0.01" value={String(cost.value ?? cost.amount ?? 0)} onChange={(event) => updateCost(cost.id, { value: Number(event.target.value) })} />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => void removeCost(cost.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button className="w-fit gap-2" onClick={() => save.mutate()} disabled={save.isPending} style={{ backgroundColor: "#7B2E68" }}>
            <Save className="h-4 w-4" /> {save.isPending ? "Salvando..." : "Salvar custos"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
