import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Pencil, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type StockItem = {
  id: number;
  name: string;
  ingredientType: "comprado" | "fabricado" | "produto";
  unit: string;
  packageContent: number;
  packagePrice: number;
  yieldPercent: number;
  quantity: number;
  minStock: number;
  unitCost: number;
  supplier: string | null;
  active: boolean;
  isLow: boolean;
};

const empty = {
  name: "",
  ingredientType: "comprado",
  unit: "g",
  packageContent: "1",
  packagePrice: "",
  yieldPercent: "100",
  quantity: "",
  minStock: "",
  unitCost: "",
  supplier: "",
  active: true,
};

function fmtCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function itemToForm(item: StockItem) {
  return {
    name: item.name,
    ingredientType: item.ingredientType,
    unit: item.unit,
    packageContent: String(item.packageContent ?? 1),
    packagePrice: String(item.packagePrice ?? 0),
    yieldPercent: String(item.yieldPercent ?? 100),
    quantity: String(item.quantity ?? 0),
    minStock: String(item.minStock ?? 0),
    unitCost: String(item.unitCost ?? 0),
    supplier: item.supplier ?? "",
    active: item.active,
  };
}

export default function Stock() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const [movement, setMovement] = useState<Record<number, { type: "entry" | "exit"; quantity: string }>>({});
  const { data: items = [] } = useQuery({ queryKey: ["stock"], queryFn: () => apiRequest<StockItem[]>("/api/stock") });

  const calculatedUnitCost = useMemo(() => {
    const content = Number(form.packageContent || 0);
    const price = Number(form.packagePrice || 0);
    return content > 0 ? price / content : Number(form.unitCost || 0);
  }, [form.packageContent, form.packagePrice, form.unitCost]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        packageContent: Number(form.packageContent || 0),
        packagePrice: Number(form.packagePrice || 0),
        yieldPercent: Number(form.yieldPercent || 100),
        quantity: Number(form.quantity || 0),
        minStock: Number(form.minStock || 0),
        unitCost: Number(form.unitCost || calculatedUnitCost || 0),
        supplier: form.supplier || null,
      };
      return editing
        ? apiRequest<StockItem>(`/api/stock/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiRequest<StockItem>("/api/stock", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      setForm(empty);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: editing ? "Ingrediente atualizado" : "Ingrediente criado" });
    },
    onError: (error) => {
      toast({ title: "Erro ao salvar ingrediente", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    },
  });

  const move = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { type: "entry" | "exit"; quantity: string } }) => apiRequest(`/api/stock/${id}/movement`, { method: "POST", body: JSON.stringify({ type: data.type, quantity: Number(data.quantity), reason: data.type === "entry" ? "Entrada manual" : "Saída manual" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/stock/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast({ title: "Ingrediente removido" });
    },
  });

  function setField(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openEdit(item: StockItem) {
    setEditing(item);
    setForm(itemToForm(item));
  }

  function resetForm() {
    setEditing(null);
    setForm(empty);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-primary">Ingredientes e Estoque</h1>
        <p className="text-sm text-muted-foreground">Matéria-prima, rendimento, custo unitário real e movimentação de estoque.</p>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> {editing ? "Editar ingrediente" : "Novo ingrediente"}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(event) => setField("name", event.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.ingredientType} onValueChange={(value) => setField("ingredientType", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comprado">Comprado</SelectItem>
                <SelectItem value="fabricado">Fabricado</SelectItem>
                <SelectItem value="produto">Produto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Conteúdo da embalagem</Label>
            <Input type="number" min="0" step="0.001" value={form.packageContent} onChange={(event) => setField("packageContent", event.target.value)} />
          </div>
          <div>
            <Label>Unidade</Label>
            <Input value={form.unit} onChange={(event) => setField("unit", event.target.value)} />
          </div>
          <div>
            <Label>Preço da embalagem</Label>
            <Input type="number" min="0" step="0.01" value={form.packagePrice} onChange={(event) => setField("packagePrice", event.target.value)} />
          </div>
          <div>
            <Label>Rendimento %</Label>
            <Input type="number" min="0" max="100" step="0.01" value={form.yieldPercent} onChange={(event) => setField("yieldPercent", event.target.value)} />
          </div>
          <div>
            <Label>Custo unitário calculado</Label>
            <Input value={fmtCurrency(calculatedUnitCost)} disabled />
          </div>
          <div>
            <Label>Fornecedor</Label>
            <Input value={form.supplier} onChange={(event) => setField("supplier", event.target.value)} />
          </div>
          <div>
            <Label>Quantidade em estoque</Label>
            <Input type="number" min="0" step="0.001" value={form.quantity} onChange={(event) => setField("quantity", event.target.value)} />
          </div>
          <div>
            <Label>Estoque mínimo</Label>
            <Input type="number" min="0" step="0.001" value={form.minStock} onChange={(event) => setField("minStock", event.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={form.active} onCheckedChange={(value) => setField("active", value)} />
            <Label>{form.active ? "Ativo" : "Inativo"}</Label>
          </div>
          <div className="flex items-end gap-2">
            {editing && <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>}
            <Button disabled={!form.name || save.isPending} onClick={() => save.mutate()} style={{ backgroundColor: "#7B2E68" }}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-10 text-muted-foreground"><Box className="mb-3 h-8 w-8" /><p>Nenhum ingrediente em estoque.</p></div>
        ) : items.map((item) => {
          const data = movement[item.id] ?? { type: "entry" as const, quantity: "" };
          return (
            <div key={item.id} className="grid items-center gap-3 rounded-lg border bg-white p-4 shadow-sm xl:grid-cols-[1.4fr_0.9fr_0.9fr_240px_80px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{item.name}</h2>
                  <Badge variant="outline">{item.ingredientType}</Badge>
                  {item.isLow && <Badge variant="destructive">Baixo</Badge>}
                  {!item.active && <Badge variant="secondary">Inativo</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{item.quantity} {item.unit} · mínimo {item.minStock} · fornecedor {item.supplier || "-"}</p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">Embalagem</p>
                <p>{item.packageContent} {item.unit} por {fmtCurrency(item.packagePrice)}</p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">Custo / rendimento</p>
                <p className="font-semibold">{fmtCurrency(item.unitCost)} · {item.yieldPercent}%</p>
              </div>
              <div className="flex gap-2">
                <Select value={data.type} onValueChange={(type: "entry" | "exit") => setMovement({ ...movement, [item.id]: { ...data, type } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entry">Entrada</SelectItem><SelectItem value="exit">Saída</SelectItem></SelectContent></Select>
                <Input type="number" placeholder="Qtd." value={data.quantity} onChange={(event) => setMovement({ ...movement, [item.id]: { ...data, quantity: event.target.value } })} />
                <Button onClick={() => move.mutate({ id: item.id, data })} disabled={!data.quantity}>OK</Button>
              </div>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          );
        })}
      </section>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ingrediente?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação remove o ingrediente do estoque. Fichas técnicas que usam esse item podem ficar incompletas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
