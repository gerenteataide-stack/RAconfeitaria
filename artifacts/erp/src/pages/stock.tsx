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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth";
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
  unit: "un",
  packageContent: "1",
  packagePrice: "",
  yieldPercent: "100",
  quantity: "",
  minStock: "",
  unitCost: "",
  supplier: "",
  active: true,
};

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
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("itens");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [movementDate, setMovementDate] = useState(todayInputValue());
  const [movement, setMovement] = useState({ stockItemId: "", type: "entry", quantity: "", reason: "", movementDate: todayInputValue() });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock", search, lowOnly],
    queryFn: () => apiRequest<StockItem[]>(`/api/stock?search=${encodeURIComponent(search)}${lowOnly ? "&lowStock=true" : ""}`),
  });
  const { data: movements = [] } = useQuery({
    queryKey: ["stock-movements", movementDate],
    queryFn: () => apiRequest<StockMovement[]>(`/api/stock-movements?date=${movementDate}`),
  });

  const stats = useMemo(() => {
    const active = items.filter((item) => item.active);
    const low = active.filter((item) => item.isLow);
    return { active: active.length, low: low.length, movements: movements.length };
  }, [items, movements.length]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        ingredientType: "comprado",
        packageContent: 1,
        packagePrice: 0,
        yieldPercent: 100,
        quantity: Number(form.quantity || 0),
        minStock: Number(form.minStock || 0),
        unitCost: 0,
        supplier: null,
        active: true,
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
        reason: movement.reason || (movement.type === "entry" ? "Entrada manual" : "SaÃ­da manual"),
        movementDate: movement.movementDate,
      }),
    }),
    onSuccess: () => {
      setMovement({ stockItemId: "", type: "entry", quantity: "", reason: "", movementDate });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      toast({ title: "MovimentaÃ§Ã£o registrada" });
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
        <p className="text-sm text-muted-foreground">Cadastro simples de produtos, unidade de medida, saldo e movimentaÃ§Ãµes de entrada e saÃ­da.</p>
      </div>

      {stats.low > 0 && (user?.role === "owner" || user?.role === "manager") && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          AtenÃ§Ã£o: {stats.low} item(ns) estÃ£o abaixo do estoque mÃ­nimo.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Itens ativos</p><p className="text-2xl font-semibold">{stats.active}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Estoque crÃ­tico</p><p className="text-2xl font-semibold text-red-600">{stats.low}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Movimentações em {new Date(`${movementDate}T00:00:00`).toLocaleDateString("pt-BR")}</p><p className="text-2xl font-semibold">{stats.movements}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-auto w-full grid-cols-3 md:w-[560px]">
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="movimentos">Entradas e saÃ­das</TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar item no estoque" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((value) => !value)}>Somente crÃ­ticos</Button>
          </div>

          <div className="grid gap-3">
            {isLoading ? <p className="text-sm text-muted-foreground">Carregando estoque...</p> : items.map((item) => (
              <Card key={item.id}>
                <CardContent className="grid gap-3 p-4 xl:grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr_auto] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{item.name}</h2>
                      {item.isLow && <Badge variant="destructive">CrÃ­tico</Badge>}
                      {!item.active && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Unidade: {item.unit}{item.createdAt ? ` Â· Cadastro em ${fmtDate(item.createdAt)}` : ""}
                    </p>
                  </div>
                  <div><p className="text-xs text-muted-foreground">Saldo</p><p className="font-semibold">{item.quantity} {item.unit}</p></div>
                  <div><p className="text-xs text-muted-foreground">MÃ­nimo</p><p>{item.minStock} {item.unit}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ãšltima atualizaÃ§Ã£o</p>
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
            <CardHeader><CardTitle>{editing ? "Editar produto do estoque" : "Cadastrar produto no estoque"}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-5">
              <div className="md:col-span-2"><Label>Produto</Label><Input value={form.name} onChange={(event) => setField("name", event.target.value)} /></div>
              <div><Label>Unidade de medida</Label><Input placeholder="un, kg, g, litro..." value={form.unit} onChange={(event) => setField("unit", event.target.value)} /></div>
              <div><Label>Saldo inicial</Label><Input type="number" min="0" step="0.001" value={form.quantity} onChange={(event) => setField("quantity", event.target.value)} /></div>
              <div><Label>Estoque mÃ­nimo</Label><Input type="number" min="0" step="0.001" value={form.minStock} onChange={(event) => setField("minStock", event.target.value)} /></div>
              <div className="flex items-end gap-2 md:col-span-5">
                {editing && <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>}
                <Button disabled={!form.name || save.isPending} onClick={() => save.mutate()} style={{ backgroundColor: "#7B2E68" }}><Plus className="mr-2 h-4 w-4" />Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimentos" className="grid gap-4">
          <Card>
            <CardHeader><CardTitle>Registrar entrada ou saÃ­da</CardTitle></CardHeader>
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
                  <SelectContent><SelectItem value="entry">Entrada</SelectItem><SelectItem value="exit">SaÃ­da</SelectItem></SelectContent>
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
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Movimentações da data</CardTitle>
                <div className="w-full md:w-48">
                  <Label>Data</Label>
                  <Input type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {movements.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_120px_140px_180px] md:items-center">
                  <div><p className="font-medium">{item.stockItemName || `Item #${item.stockItemId}`}</p><p className="text-sm text-muted-foreground">{item.reason || "-"}</p></div>
                  <Badge variant={item.type === "entry" ? "default" : "destructive"}>{item.type === "entry" ? "Entrada" : "SaÃ­da"}</Badge>
                  <p className="font-semibold">{item.quantity}</p>
                  <p className="text-sm text-muted-foreground">{fmtDate(item.createdAt)}</p>
                </div>
              ))}
              {movements.length === 0 && <div className="rounded-lg border border-dashed bg-white p-8 text-center text-muted-foreground">Nenhuma movimentaÃ§Ã£o registrada.</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item de estoque?</AlertDialogTitle>
            <AlertDialogDescription>Essa aÃ§Ã£o remove o item do estoque. Fichas tÃ©cnicas que usam esse item podem ficar incompletas.</AlertDialogDescription>
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


