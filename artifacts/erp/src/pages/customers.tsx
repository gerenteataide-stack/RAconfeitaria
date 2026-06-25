import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Customer = {
  id: number;
  name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  birthDate: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  notes: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  totalOrders: number;
};

const empty = { name: "", phone: "", whatsapp: "", email: "", birthDate: "", address: "", neighborhood: "", city: "", notes: "" };

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Customers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => apiRequest<Customer[]>("/api/customers") });
  const create = useMutation({
    mutationFn: () => apiRequest<Customer>("/api/customers", { method: "POST", body: JSON.stringify({ ...form, whatsapp: form.whatsapp || form.phone }) }),
    onSuccess: () => {
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Cliente cadastrado" });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-serif font-bold" style={{ color: "#7B2E68" }}>Clientes</h1>
        <p className="text-sm text-muted-foreground">CRM com cadastro, histórico financeiro e pontos.</p>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Novo cliente</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Telefone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Nascimento</Label><Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></div>
          <div><Label>Bairro</Label><Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></div>
          <div><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="md:col-span-3"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex items-end"><Button disabled={!form.name || !form.phone || create.isPending} onClick={() => create.mutate()} style={{ backgroundColor: "#7B2E68" }}>Cadastrar</Button></div>
        </div>
      </section>

      <section className="grid gap-3">
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-10 text-muted-foreground">
            <Users className="mb-3 h-8 w-8" />
            <p>Nenhum cliente cadastrado.</p>
          </div>
        ) : customers.map((customer) => (
          <div key={customer.id} className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
            <div>
              <h2 className="font-semibold">{customer.name}</h2>
              <p className="text-sm text-muted-foreground">{customer.phone} · {customer.email || "sem email"} · {customer.neighborhood || "sem bairro"}</p>
              <p className="text-xs text-muted-foreground">{customer.totalOrders} pedido(s) · {money(customer.totalSpent)} · {customer.loyaltyPoints} pontos</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove.mutate(customer.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </section>
    </div>
  );
}
