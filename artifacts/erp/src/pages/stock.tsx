import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type StockItem = { id: number; name: string; unit: string; quantity: number; minStock: number; unitCost: number; supplier: string | null; isLow: boolean };
const empty = { name: "", unit: "un", quantity: "", minStock: "", unitCost: "", supplier: "" };

export default function Stock() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [movement, setMovement] = useState<Record<number, { type: "entry" | "exit"; quantity: string }>>({});
  const { data: items = [] } = useQuery({ queryKey: ["stock"], queryFn: () => apiRequest<StockItem[]>("/api/stock") });
  const create = useMutation({
    mutationFn: () => apiRequest<StockItem>("/api/stock", { method: "POST", body: JSON.stringify({ ...form, quantity: Number(form.quantity || 0), minStock: Number(form.minStock || 0), unitCost: Number(form.unitCost || 0) }) }),
    onSuccess: () => { setForm(empty); qc.invalidateQueries({ queryKey: ["stock"] }); toast({ title: "Item criado" }); },
  });
  const move = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { type: "entry" | "exit"; quantity: string } }) => apiRequest(`/api/stock/${id}/movement`, { method: "POST", body: JSON.stringify({ type: data.type, quantity: Number(data.quantity), reason: data.type === "entry" ? "Entrada manual" : "Saída manual" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }),
  });
  const remove = useMutation({ mutationFn: (id: number) => apiRequest(`/api/stock/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }) });

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-3xl font-serif font-bold" style={{ color: "#7B2E68" }}>Estoque</h1><p className="text-sm text-muted-foreground">Ingredientes, fornecedores e alerta de estoque mínimo.</p></div>
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Novo ingrediente</h2>
        <div className="grid gap-3 md:grid-cols-6">
          <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Unidade" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <Input type="number" placeholder="Qtd." value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <Input type="number" placeholder="Mínimo" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          <Input type="number" placeholder="Custo unit." value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
          <Button disabled={!form.name || create.isPending} onClick={() => create.mutate()} style={{ backgroundColor: "#7B2E68" }}>Criar</Button>
          <div className="md:col-span-6"><Label>Fornecedor</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
        </div>
      </section>
      <section className="grid gap-3">
        {items.length === 0 ? <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-10 text-muted-foreground"><Box className="mb-3 h-8 w-8" /><p>Nenhum item em estoque.</p></div> : items.map((item) => {
          const data = movement[item.id] ?? { type: "entry" as const, quantity: "" };
          return (
            <div key={item.id} className="grid items-center gap-3 rounded-lg border bg-white p-4 shadow-sm md:grid-cols-[1fr_120px_220px_40px]">
              <div><div className="flex gap-2"><h2 className="font-semibold">{item.name}</h2>{item.isLow && <Badge variant="destructive">Baixo</Badge>}</div><p className="text-sm text-muted-foreground">{item.quantity} {item.unit} · mínimo {item.minStock} · fornecedor {item.supplier || "-"}</p></div>
              <p className="font-semibold">R$ {item.unitCost.toFixed(2)}</p>
              <div className="flex gap-2">
                <Select value={data.type} onValueChange={(type: "entry" | "exit") => setMovement({ ...movement, [item.id]: { ...data, type } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entry">Entrada</SelectItem><SelectItem value="exit">Saída</SelectItem></SelectContent></Select>
                <Input type="number" placeholder="Qtd." value={data.quantity} onChange={(e) => setMovement({ ...movement, [item.id]: { ...data, quantity: e.target.value } })} />
                <Button onClick={() => move.mutate({ id: item.id, data })} disabled={!data.quantity}>OK</Button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
