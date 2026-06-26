import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Box, History, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  createdAt?: string;
  updatedAt?: string;
};

type StockMovement = {
  id: number;
  stockItemId: number;
  stockItemName: string | null;
  type: "entry" | "exit";
  quantity: number;
  reason: string | null;
  createdAt: string;
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

function fmtDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
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
  const [tab, setTab] = useState("itens");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [movement, setMovement] = useState({ stockItemId: "", type: "entry", quantity: "", reason: "", movementDate: todayInputValue() });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock", search, lowOnly],
    queryFn: () => apiRequest<StockItem[]>(`/api/stock?search=${encodeURIComponent(search)}${lowOnly ? "&lowStock=true" : ""}`),
  });
  const { data: movements = [] } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: () => apiRequest<StockMovement[]>("/api/stock-movements"),
  });

  const calculatedUnitCost = useMemo(() => {
    const content = Number(form.packageContent || 0);
    const price = Number(form.packagePrice || 0);
    return content > 0 ? price / content : Number(form.unitCost || 0);
  }, [form.packageContent, form.packagePrice, form.unitCost]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.active);
    const low = active.filter((item) => item.isLow);
    const totalValue = active.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    return { active: active.length, low: low.length, totalValue };
  }, [items]);

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
      resetForm();
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast({ title: editing ? "Item atualizado" : "Item cadastrado" });
    },
    onError: (error) => {
      toast({ title: "Erro ao salvar item", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    },
  });

  const move = useMutation({
    mutationFn: () => apiRequest(`/api/stock/${movement.stockItemId}/movement`, {
      method: "POST",
      body: JSON.stringify({
        type: movement.type,
        quantity: Number(movement.quantity),
        reason: movement.reason || (movement.type === "entry" ? "Entrada manual" : "Saída manual"),
        movementDate: movement.movementDate,
      }),
    }),
    onSuccess: () => {
      setMovement({ stockItemId: "", type: "entry", quantity: "", reason: "", movementDate: todayInputValue() });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      toast({ title: "Movimentação registrada" });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/stock/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast({ title: "Item removido" });
    },
  });

  function setField(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openEdit(item: StockItem) {
    setEditing(item);
    setForm(itemToForm(item));
    setTab("cadastro");
  }

  function resetForm() {
    setEditing(null);
    setForm(empty);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-primary">Estoque</h1>
        <p className="text-sm text-muted-foreground">Cadastro de itens, controle de entrada e saída, custo unitário e estoque mínimo.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Itens ativos</p><p className="text-2xl font-semibold">{stats.active}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Estoque crítico</p><p className="text-2xl font-semibold text-red-600">{stats.low}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Valor estimado</p><p className="text-2xl font-semibold">{fmtCurrency(stats.totalValue)}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-auto w-full grid-cols-3 md:w-[560px]">
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="movimentos">Entradas e saídas</TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar item no estoque" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((value) => !value)}>Somente críticos</Button>
          </div>

          <div className="grid gap-3">
            {isLoading ? <p className="text-sm text-muted-foreground">Carregando estoque...</p> : items.map((item) => (
              <Card key={item.id}>
                <CardContent className="grid gap-3 p-4 xl:grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr_auto] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{item.name}</h2>
                      <Badge variant="outline">{item.ingredientType}</Badge>
                      {item.isLow && <Badge variant="destructive">Crítico</Badge>}
                      {!item.active && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fornecedor: {item.supplier || "-"}{item.createdAt ? ` · Cadastro em ${fmtDate(item.createdAt)}` : ""}
                    </p>
                  </div>
                  <div><p className="text-xs text-muted-foreground">Saldo</p><p className="font-semibold">{item.quantity} {item.unit}</p></div>
                  <div><p className="text-xs text-muted-foreground">Mínimo</p><p>{item.minStock} {item.unit}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Custo unitário</p>
                    <p className="font-semibold">{fmtCurrency(item.unitCost)}</p>
                    {item.updatedAt && <p className="text-xs text-muted-foreground">Atualizado em {fmtDate(item.updatedAt)}</p>}
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!isLoading && items.length === 0 && <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white p-10 text-muted-foreground"><Box className="mb-3 h-8 w-8" /><p>Nenhum item encontrado.</p></div>}
          </div>
        </TabsContent>

        <TabsContent value="cadastro">
          <Card>
            <CardHeader><CardTitle>{editing ? "Editar item de estoque" : "Cadastrar item de estoque"}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div><Label>Nome</Label><Input value={form.name} onChange={(event) => setField("name", event.target.value)} /></div>
              <div><Label>Tipo</Label><Select value={form.ingredientType} onValueChange={(value) => setField("ingredientType", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comprado">Comprado</SelectItem><SelectItem value="fabricado">Fabricado</SelectItem><SelectItem value="produto">Produto</SelectItem></SelectContent></Select></div>
              <div><Label>Conteúdo da embalagem</Label><Input type="number" min="0" step="0.001" value={form.packageContent} onChange={(event) => setField("packageContent", event.target.value)} /></div>
              <div><Label>Unidade</Label><Input value={form.unit} onChange={(event) => setField("unit", event.target.value)} /></div>
              <div><Label>Preço da embalagem</Label><Input type="number" min="0" step="0.01" value={form.packagePrice} onChange={(event) => setField("packagePrice", event.target.value)} /></div>
              <div><Label>Rendimento %</Label><Input type="number" min="0.01" max="100" step="0.01" value={form.yieldPercent} onChange={(event) => setField("yieldPercent", event.target.value)} /></div>
              <div><Label>Custo unitário calculado</Label><Input value={fmtCurrency(calculatedUnitCost)} disabled /></div>
              <div><Label>Fornecedor</Label><Input value={form.supplier} onChange={(event) => setField("supplier", event.target.value)} /></div>
              <div><Label>Saldo inicial</Label><Input type="number" min="0" step="0.001" value={form.quantity} onChange={(event) => setField("quantity", event.target.value)} /></div>
              <div><Label>Estoque mínimo</Label><Input type="number" min="0" step="0.001" value={form.minStock} onChange={(event) => setField("minStock", event.target.value)} /></div>
              <div className="flex items-end gap-2"><Switch checked={form.active} onCheckedChange={(value) => setField("active", value)} /><Label>{form.active ? "Ativo" : "Inativo"}</Label></div>
              <div className="flex items-end gap-2">
                {editing && <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>}
                <Button disabled={!form.name || save.isPending} onClick={() => save.mutate()} style={{ backgroundColor: "#7B2E68" }}><Plus className="mr-2 h-4 w-4" />Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimentos" className="grid gap-4">
          <Card>
            <CardHeader><CardTitle>Registrar entrada ou saída</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1.3fr_150px_130px_150px_1fr_auto] md:items-end">
              <div>
                <Label>Item</Label>
                <Select value={movement.stockItemId} onValueChange={(stockItemId) => setMovement({ ...movement, stockItemId })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{items.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name} ({item.quantity} {item.unit})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Movimento</Label>
                <Select value={movement.type} onValueChange={(type) => setMovement({ ...movement, type })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="entry">Entrada</SelectItem><SelectItem value="exit">Saída</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Quantidade</Label><Input type="number" min="0.001" step="0.001" value={movement.quantity} onChange={(event) => setMovement({ ...movement, quantity: event.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={movement.movementDate} onChange={(event) => setMovement({ ...movement, movementDate: event.target.value })} /></div>
              <div><Label>Motivo</Label><Input placeholder="Compra, uso, perda..." value={movement.reason} onChange={(event) => setMovement({ ...movement, reason: event.target.value })} /></div>
              <Button disabled={!movement.stockItemId || !movement.quantity || move.isPending} onClick={() => move.mutate()} style={{ backgroundColor: movement.type === "entry" ? "#28A745" : "#DC3545" }}>
                {movement.type === "entry" ? <ArrowUpCircle className="mr-2 h-4 w-4" /> : <ArrowDownCircle className="mr-2 h-4 w-4" />}
                Registrar
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Histórico recente</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {movements.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_120px_140px_180px] md:items-center">
                  <div><p className="font-medium">{item.stockItemName || `Item #${item.stockItemId}`}</p><p className="text-sm text-muted-foreground">{item.reason || "-"}</p></div>
                  <Badge variant={item.type === "entry" ? "default" : "destructive"}>{item.type === "entry" ? "Entrada" : "Saída"}</Badge>
                  <p className="font-semibold">{item.quantity}</p>
                  <p className="text-sm text-muted-foreground">{fmtDate(item.createdAt)}</p>
                </div>
              ))}
              {movements.length === 0 && <div className="rounded-lg border border-dashed bg-white p-8 text-center text-muted-foreground">Nenhuma movimentação registrada.</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item de estoque?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação remove o item do estoque. Fichas técnicas que usam esse item podem ficar incompletas.</AlertDialogDescription>
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
