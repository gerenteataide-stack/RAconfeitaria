import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
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

const empty = { name: "", whatsapp: "", email: "", birthDate: "", address: "", neighborhood: "", notes: "" };

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Customers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Customer | null>(null);
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => apiRequest<Customer[]>("/api/customers") });

  const save = useMutation({
    mutationFn: () => apiRequest<Customer>(editing ? `/api/customers/${editing.id}` : "/api/customers", {
      method: editing ? "PATCH" : "POST",
      body: JSON.stringify({ ...form, phone: form.whatsapp, whatsapp: form.whatsapp }),
    }),
    onSuccess: () => {
      setForm(empty);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: editing ? "Cliente atualizado" : "Cliente cadastrado" });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });

  function edit(customer: Customer) {
    setEditing(customer);
    setForm({
      name: customer.name,
      whatsapp: customer.whatsapp || customer.phone,
      email: customer.email || "",
      birthDate: customer.birthDate || "",
      address: customer.address || "",
      neighborhood: customer.neighborhood || "",
      notes: customer.notes || "",
    });
  }

  function reset() {
    setEditing(null);
    setForm(empty);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-bold" style={{ color: "#7B2E68" }}>Clientes</h1>
        <p className="text-sm text-muted-foreground">CRM com cadastro, histórico financeiro e pontos do cartão fidelidade.</p>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Plus className="h-4 w-4" /> {editing ? "Editar cliente" : "Novo cliente"}
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>Nome *</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
          <div><Label>WhatsApp *</Label><Input value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          <div><Label>Nascimento</Label><Input type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></div>
          <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
          <div><Label>Bairro</Label><Input value={form.neighborhood} onChange={(event) => setForm({ ...form, neighborhood: event.target.value })} /></div>
          <div className="md:col-span-3"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
          <div className="flex items-end gap-2">
            {editing && <Button variant="outline" onClick={reset}>Cancelar</Button>}
            <Button disabled={!form.name || !form.whatsapp || save.isPending} onClick={() => save.mutate()} style={{ backgroundColor: "#7B2E68" }}>
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-10 text-muted-foreground">
            <Users className="mb-3 h-8 w-8" />
            <p>Nenhum cliente cadastrado.</p>
          </div>
        ) : customers.map((customer) => (
          <div key={customer.id} className="flex flex-col justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm md:flex-row md:items-center">
            <div>
              <h2 className="font-semibold">{customer.name}</h2>
              <p className="text-sm text-muted-foreground">{customer.whatsapp || customer.phone} - {customer.email || "sem email"} - {customer.address || "sem endereço"} - {customer.neighborhood || "sem bairro"}</p>
              <p className="text-xs text-muted-foreground">{customer.totalOrders} pedido(s) - {money(customer.totalSpent)} - Cartão fidelidade: {customer.loyaltyPoints} ponto(s)</p>
            </div>
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={() => edit(customer)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(customer.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
