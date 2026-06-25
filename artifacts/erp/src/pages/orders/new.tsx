import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Product = { id: number; name: string; price: number; available: boolean };
type Customer = { id: number; name: string; phone: string; address: string | null };
type Line = { productId: string; quantity: string; unitPrice: string; notes: string };

const today = new Date().toISOString().slice(0, 10);

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function NewOrder() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => apiRequest<Product[]>("/api/products") });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => apiRequest<Customer[]>("/api/customers") });
  const [form, setForm] = useState({ customerId: "", customerName: "", customerPhone: "", deliveryType: "pickup", deliveryAddress: "", deliveryDate: today, deliveryTime: "", deliveryFee: "0", notes: "" });
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: "1", unitPrice: "", notes: "" }]);

  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0) + Number(form.deliveryFee || 0), [lines, form.deliveryFee]);
  const create = useMutation({
    mutationFn: () => apiRequest<{ id: number }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId: form.customerId ? Number(form.customerId) : undefined,
        customerName: form.customerName || undefined,
        customerPhone: form.customerPhone || undefined,
        deliveryType: form.deliveryType,
        deliveryAddress: form.deliveryAddress || undefined,
        deliveryDate: form.deliveryDate,
        deliveryTime: form.deliveryTime || undefined,
        deliveryFee: Number(form.deliveryFee || 0),
        notes: form.notes || undefined,
        items: lines.filter((line) => line.productId).map((line) => ({ productId: Number(line.productId), quantity: Number(line.quantity || 1), unitPrice: Number(line.unitPrice || 0), notes: line.notes || undefined })),
      }),
    }),
    onSuccess: () => {
      toast({ title: "Pedido criado" });
      navigate("/orders");
    },
  });

  function chooseCustomer(id: string) {
    const customer = customers.find((item) => String(item.id) === id);
    setForm({ ...form, customerId: id, customerName: customer?.name ?? "", customerPhone: customer?.phone ?? "", deliveryAddress: customer?.address ?? "" });
  }

  function updateLine(index: number, data: Partial<Line>) {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...data } : line));
  }

  function chooseProduct(index: number, productId: string) {
    const product = products.find((item) => String(item.id) === productId);
    updateLine(index, { productId, unitPrice: product ? String(product.price) : "" });
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-serif font-bold" style={{ color: "#7B2E68" }}>Novo Pedido</h1><p className="text-sm text-muted-foreground">Pedido manual com cliente, entrega, itens e observações.</p></div>
        <Link href="/orders"><Button variant="outline">Voltar</Button></Link>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-semibold">Cliente e entrega</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>Cliente cadastrado</Label><Select value={form.customerId} onValueChange={chooseCustomer}><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Nome</Label><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} /></div>
          <div><Label>Tipo</Label><Select value={form.deliveryType} onValueChange={(deliveryType) => setForm({ ...form, deliveryType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pickup">Retirada</SelectItem><SelectItem value="delivery">Delivery</SelectItem></SelectContent></Select></div>
          <div className="md:col-span-2"><Label>Endereço</Label><Input value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} /></div>
          <div><Label>Data</Label><Input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} /></div>
          <div><Label>Horário</Label><Input value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} placeholder="14:00" /></div>
          <div><Label>Frete</Label><Input type="number" value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })} /></div>
          <div className="md:col-span-3"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Itens</h2><Button variant="outline" onClick={() => setLines([...lines, { productId: "", quantity: "1", unitPrice: "", notes: "" }])}><Plus className="mr-2 h-4 w-4" /> Item</Button></div>
        <div className="grid gap-3">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_100px_130px_1fr_40px]">
              <Select value={line.productId} onValueChange={(id) => chooseProduct(index, id)}><SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger><SelectContent>{products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select>
              <Input type="number" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
              <Input type="number" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} />
              <Input placeholder="Obs. do item" value={line.notes} onChange={(e) => updateLine(index, { notes: e.target.value })} />
              <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
        <div><p className="text-sm text-muted-foreground">Total do pedido</p><p className="text-2xl font-bold" style={{ color: "#7B2E68" }}>{money(total)}</p></div>
        <Button disabled={create.isPending || lines.every((line) => !line.productId)} onClick={() => create.mutate()} style={{ backgroundColor: "#7B2E68" }}>Criar pedido</Button>
      </div>
    </div>
  );
}
