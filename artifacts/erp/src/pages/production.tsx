import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChefHat, Plus } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Product = { id: number; name: string; available: boolean };
type ProductionOrder = { id: number; productId: number; productName: string; quantity: number; scheduledDate: string; scheduledTime: string | null; status: "pending" | "producing" | "finished"; notes: string | null };

const statusLabel = { pending: "Pendente", producing: "Produzindo", finished: "Finalizado" };
const today = new Date().toISOString().slice(0, 10);

export default function Production() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ productId: "", quantity: "1", scheduledDate: today, scheduledTime: "", notes: "" });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => apiRequest<Product[]>("/api/products") });
  const { data: orders = [] } = useQuery({ queryKey: ["production"], queryFn: () => apiRequest<ProductionOrder[]>("/api/production") });
  const create = useMutation({
    mutationFn: () => apiRequest<ProductionOrder>("/api/production", { method: "POST", body: JSON.stringify({ productId: Number(form.productId), quantity: Number(form.quantity || 1), scheduledDate: form.scheduledDate, scheduledTime: form.scheduledTime || undefined, notes: form.notes || undefined }) }),
    onSuccess: () => { setForm({ productId: "", quantity: "1", scheduledDate: today, scheduledTime: "", notes: "" }); qc.invalidateQueries({ queryKey: ["production"] }); toast({ title: "Produção criada" }); },
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ProductionOrder["status"] }) => apiRequest(`/api/production/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-3xl font-serif font-bold" style={{ color: "#7B2E68" }}>Produção</h1><p className="text-sm text-muted-foreground">Painel diário com produto, quantidade, horário e status.</p></div>
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Criar produção</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2"><Label>Produto</Label><Select value={form.productId} onValueChange={(productId) => setForm({ ...form, productId })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Quantidade</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div><Label>Data</Label><Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} /></div>
          <div><Label>Horário</Label><Input value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} placeholder="09:00" /></div>
          <div className="md:col-span-4"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex items-end"><Button disabled={!form.productId || create.isPending} onClick={() => create.mutate()} style={{ backgroundColor: "#7B2E68" }}>Criar</Button></div>
        </div>
      </section>
      <section className="grid gap-3">
        {orders.length === 0 ? <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-10 text-muted-foreground"><ChefHat className="mb-3 h-8 w-8" /><p>Nenhuma produção cadastrada.</p></div> : orders.map((order) => (
          <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm">
            <div><div className="flex items-center gap-2"><h2 className="font-semibold">{order.productName}</h2><Badge>{statusLabel[order.status]}</Badge></div><p className="text-sm text-muted-foreground">{order.quantity} un · {order.scheduledDate} {order.scheduledTime || ""} · {order.notes || "sem observações"}</p></div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => updateStatus.mutate({ id: order.id, status: "producing" })}>Produzindo</Button><Button onClick={() => updateStatus.mutate({ id: order.id, status: "finished" })} style={{ backgroundColor: "#7B2E68" }}>Finalizar</Button></div>
          </div>
        ))}
      </section>
    </div>
  );
}
