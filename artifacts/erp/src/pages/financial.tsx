import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type FinancialEntry = { id: number; type: "receivable" | "payable"; description: string; amount: number; dueDate: string; paid: boolean; counterpart: string | null; category: string | null };
type CashFlow = { totalInflows: number; totalOutflows: number; balance: number };
type Dre = {
  revenue: number;
  productCost: number;
  expenses: number;
  fixedCosts: number;
  variableSalesCost: number;
  contributionMargin: number;
  contributionMarginPercent: number;
  breakEvenRevenue: number;
  netProfit: number;
  cmvPercent: number;
};
const month = new Date().toISOString().slice(0, 7);
const empty = { type: "receivable" as "receivable" | "payable", description: "", amount: "", dueDate: new Date().toISOString().slice(0, 10), counterpart: "", category: "" };

function money(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export default function Financial() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const { data: entries = [] } = useQuery({ queryKey: ["financial-entries"], queryFn: () => apiRequest<FinancialEntry[]>("/api/financial/entries") });
  const { data: cash } = useQuery({ queryKey: ["cashflow"], queryFn: () => apiRequest<CashFlow>(`/api/financial/cashflow?month=${month}`) });
  const { data: dre } = useQuery({ queryKey: ["dre"], queryFn: () => apiRequest<Dre>(`/api/financial/dre?month=${month}`) });
  const create = useMutation({
    mutationFn: () => apiRequest("/api/financial/entries", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount || 0), counterpart: form.counterpart || undefined, category: form.category || undefined }) }),
    onSuccess: () => { setForm(empty); qc.invalidateQueries(); toast({ title: "Lançamento criado" }); },
  });
  const remove = useMutation({ mutationFn: (id: number) => apiRequest(`/api/financial/entries/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries() });

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-3xl font-serif font-bold" style={{ color: "#7B2E68" }}>Financeiro</h1><p className="text-sm text-muted-foreground">Contas a receber, contas a pagar, fluxo de caixa e DRE.</p></div>
      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm text-muted-foreground">Entradas</p><p className="text-xl font-bold text-green-600">{money(cash?.totalInflows ?? 0)}</p></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm text-muted-foreground">Saídas</p><p className="text-xl font-bold text-red-600">{money(cash?.totalOutflows ?? 0)}</p></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm text-muted-foreground">Saldo</p><p className="text-xl font-bold">{money(cash?.balance ?? 0)}</p></div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Ponto de equilíbrio</p>
          <p className="text-xl font-bold" style={{ color: "#7A8B68" }}>{money(dre?.breakEvenRevenue ?? 0)}</p>
          <p className="text-xs text-muted-foreground">Margem {((dre?.contributionMarginPercent ?? 0) * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm text-muted-foreground">Lucro DRE</p><p className="text-xl font-bold" style={{ color: "#7B2E68" }}>{money(dre?.netProfit ?? 0)}</p><p className="text-xs text-muted-foreground">CMV {(dre?.cmvPercent ?? 0).toFixed(1)}%</p></div>
      </div>
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Novo lançamento</h2>
        <div className="grid gap-3 md:grid-cols-6">
          <Select value={form.type} onValueChange={(type: "receivable" | "payable") => setForm({ ...form, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="receivable">Receber</SelectItem><SelectItem value="payable">Pagar</SelectItem></SelectContent></Select>
          <Input className="md:col-span-2" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input type="number" placeholder="Valor" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <Button disabled={!form.description || !form.amount} onClick={() => create.mutate()} style={{ backgroundColor: "#7B2E68" }}>Criar</Button>
          <div><Label>Cliente/Fornecedor</Label><Input value={form.counterpart} onChange={(e) => setForm({ ...form, counterpart: e.target.value })} /></div>
          <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        </div>
      </section>
      <section className="grid gap-3">
        {entries.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm"><div><div className="flex items-center gap-2"><h2 className="font-semibold">{entry.description}</h2><Badge variant={entry.type === "receivable" ? "default" : "secondary"}>{entry.type === "receivable" ? "Receber" : "Pagar"}</Badge></div><p className="text-sm text-muted-foreground">{entry.dueDate} · {entry.counterpart || "-"} · {entry.category || "-"}</p></div><div className="flex items-center gap-3"><p className={entry.type === "receivable" ? "font-semibold text-green-600" : "font-semibold text-red-600"}>{money(entry.amount)}</p><Button variant="ghost" size="icon" onClick={() => remove.mutate(entry.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}
        {entries.length === 0 && <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-10 text-muted-foreground"><DollarSign className="mb-3 h-8 w-8" /><p>Nenhum lançamento financeiro.</p></div>}
      </section>
    </div>
  );
}
