import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type DeliveryZone = {
  id: number;
  name: string;
  cepStart: string | null;
  cepEnd: string | null;
  neighborhood: string | null;
  fee: number;
  minOrder: number;
  active: boolean;
};

const empty = { name: "", neighborhood: "", cepStart: "", cepEnd: "", fee: "", minOrder: "", active: true };

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Delivery() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: zones = [] } = useQuery({
    queryKey: ["delivery-zones"],
    queryFn: () => apiRequest<DeliveryZone[]>("/api/delivery-zones"),
  });

  const save = useMutation({
    mutationFn: ({ id, data }: { id?: number; data: typeof empty }) =>
      apiRequest<DeliveryZone>(id ? `/api/delivery-zones/${id}` : "/api/delivery-zones", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({
          name: data.name,
          neighborhood: data.neighborhood || null,
          cepStart: data.cepStart || null,
          cepEnd: data.cepEnd || null,
          fee: Number(data.fee || 0),
          minOrder: Number(data.minOrder || 0),
          active: data.active,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-zones"] });
      setOpen(false);
      toast({ title: "Zona de entrega salva" });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/delivery-zones/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery-zones"] }),
  });

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | undefined>();
  const [form, setForm] = useState(empty);

  function openCreate() {
    setEditId(undefined);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(zone: DeliveryZone) {
    setEditId(zone.id);
    setForm({
      name: zone.name,
      neighborhood: zone.neighborhood ?? "",
      cepStart: zone.cepStart ?? "",
      cepEnd: zone.cepEnd ?? "",
      fee: String(zone.fee),
      minOrder: String(zone.minOrder),
      active: zone.active,
    });
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold" style={{ color: "#7B2E68" }}>Delivery</h1>
          <p className="text-sm text-muted-foreground">Taxas por bairro, faixa de CEP e pedido mínimo.</p>
        </div>
        <Button onClick={openCreate} className="gap-2" style={{ backgroundColor: "#7B2E68" }}>
          <Plus className="h-4 w-4" /> Nova zona
        </Button>
      </div>

      <div className="grid gap-3">
        {zones.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-muted-foreground">
            <Truck className="mb-3 h-8 w-8" />
            <p>Nenhuma zona de entrega cadastrada.</p>
          </div>
        ) : zones.map((zone) => (
          <div key={zone.id} className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{zone.name}</h2>
                <Badge variant={zone.active ? "default" : "secondary"}>{zone.active ? "Ativa" : "Inativa"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {zone.neighborhood || "Bairro livre"} {zone.cepStart || zone.cepEnd ? `· CEP ${zone.cepStart || "..."} a ${zone.cepEnd || "..."}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold" style={{ color: "#7B2E68" }}>{money(zone.fee)}</p>
                <p className="text-xs text-muted-foreground">mín. {money(zone.minOrder)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(zone)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(zone.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar zona" : "Nova zona de entrega"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Bairro</Label><Input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CEP inicial</Label><Input value={form.cepStart} onChange={(e) => setForm({ ...form, cepStart: e.target.value })} /></div>
              <div><Label>CEP final</Label><Input value={form.cepEnd} onChange={(e) => setForm({ ...form, cepEnd: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Taxa</Label><Input type="number" step="0.01" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} /></div>
              <div><Label>Pedido mínimo</Label><Input type="number" step="0.01" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-3"><Switch checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} /><Label>Ativa</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate({ id: editId, data: form })} disabled={save.isPending || !form.name} style={{ backgroundColor: "#7B2E68" }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
