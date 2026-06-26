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
  id: string;
  name: string;
  type: "fixed" | "variable";
  amountType: "currency" | "percent";
  amount: number;
};

type CostsResponse = {
  costs: CostItem[];
};

function newCost(): CostItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "fixed",
    amountType: "currency",
    amount: 0,
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
    queryFn: () => apiRequest<CostsResponse>("/api/settings/costs"),
  });

  useEffect(() => {
    if (data) setCosts(data.costs.length > 0 ? data.costs : [newCost()]);
  }, [data]);

  const totals = useMemo(() => {
    return costs.reduce(
      (acc, cost) => {
        const amount = Number(cost.amount || 0);
        if (cost.type === "fixed") acc.fixed += amount;
        if (cost.type === "variable" && cost.amountType === "currency") acc.variableCurrency += amount;
        if (cost.type === "variable" && cost.amountType === "percent") acc.variablePercent += amount;
        return acc;
      },
      { fixed: 0, variableCurrency: 0, variablePercent: 0 },
    );
  }, [costs]);

  const save = useMutation({
    mutationFn: () => apiRequest<CostsResponse>("/api/settings/costs", {
      method: "PUT",
      body: JSON.stringify({
        costs: costs
          .filter((cost) => cost.name.trim())
          .map((cost) => ({
            ...cost,
            name: cost.name.trim(),
            amount: Number(cost.amount || 0),
            amountType: cost.type === "fixed" ? "currency" : cost.amountType,
          })),
      }),
    }),
    onSuccess: (response) => {
      setCosts(response.costs.length > 0 ? response.costs : [newCost()]);
      qc.invalidateQueries({ queryKey: ["pricing-costs"] });
      qc.invalidateQueries({ queryKey: ["recipe-costs"] });
      qc.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Custos salvos" });
    },
    onError: (error) => {
      toast({ title: "Erro ao salvar custos", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    },
  });

  function updateCost(id: string, patch: Partial<CostItem>) {
    setCosts((current) => current.map((cost) => {
      if (cost.id !== id) return cost;
      const next = { ...cost, ...patch };
      if (patch.type === "fixed") next.amountType = "currency";
      return next;
    }));
  }

  function removeCost(id: string) {
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
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Incidência</Label>
                <Select
                  value={cost.type === "fixed" ? "currency" : cost.amountType}
                  disabled={cost.type === "fixed"}
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
                <Input type="number" min="0" step="0.01" value={String(cost.amount)} onChange={(event) => updateCost(cost.id, { amount: Number(event.target.value) })} />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => removeCost(cost.id)}>
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
