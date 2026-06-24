import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts,
  useListCategories,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Pencil, Trash2, Package, ImageIcon, Loader2 } from "lucide-react";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface ProductFormState {
  name: string;
  description: string;
  categoryId: string;
  price: string;
  cost: string;
  unit: string;
  available: boolean;
}

const empty: ProductFormState = { name: "", description: "", categoryId: "", price: "", cost: "", unit: "un", available: true };

function productToForm(p: Product): ProductFormState {
  return {
    name: p.name,
    description: p.description ?? "",
    categoryId: p.categoryId ? String(p.categoryId) : "",
    price: String(p.price),
    cost: p.cost != null ? String(p.cost) : "",
    unit: p.unit ?? "un",
    available: p.available,
  };
}

export default function Products() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useListProducts();
  const { data: categories = [] } = useListCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadForId = useRef<number | null>(null);

  function openCreate() {
    setEditProduct(null);
    setForm(empty);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setForm(productToForm(p));
    setDialogOpen(true);
  }

  function setField(k: keyof ProductFormState, v: string | boolean) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    if (!form.name || !form.price) {
      toast({ title: "Nome e preço são obrigatórios", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name,
      description: form.description || undefined,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      price: Number(form.price),
      cost: form.cost ? Number(form.cost) : undefined,
      unit: form.unit || undefined,
      available: form.available,
    };
    try {
      if (editProduct) {
        await updateProduct.mutateAsync({ id: editProduct.id, data: payload });
        toast({ title: "Produto atualizado!" });
      } else {
        await createProduct.mutateAsync({ data: payload });
        toast({ title: "Produto criado!" });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: "Erro ao salvar produto", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProduct.mutateAsync({ id: deleteTarget.id });
      toast({ title: "Produto removido" });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Erro ao remover produto", variant: "destructive" });
    }
  }

  async function handleToggleAvailable(p: Product) {
    await updateProduct.mutateAsync({ id: p.id, data: { available: !p.available } });
  }

  const triggerUpload = useCallback((productId: number) => {
    uploadForId.current = productId;
    fileInputRef.current?.click();
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = uploadForId.current;
    if (!file || !id) return;
    e.target.value = "";

    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/products/${id}/image`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      await qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast({ title: "Foto atualizada!" });
    } catch {
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      setUploadingId(null);
      uploadForId.current = null;
    }
  }

  const isPending = createProduct.isPending || updateProduct.isPending;

  const cmvColor = (v: number | null) =>
    v == null ? "" : v <= 30 ? "text-green-600" : v <= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold" style={{ color: "#7B2E68" }}>Produtos</h1>
          <p className="text-muted-foreground text-sm mt-1">{products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} className="gap-2" style={{ backgroundColor: "#7B2E68" }}>
          <Plus className="w-4 h-4" /> Novo produto
        </Button>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Product grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Package className="w-12 h-12 opacity-30" />
          <p>Nenhum produto cadastrado ainda.</p>
          <Button onClick={openCreate} variant="outline">Criar primeiro produto</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p) => {
            const isUploading = uploadingId === p.id;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-pink-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                {/* Image area */}
                <div className="relative h-40 bg-gradient-to-br from-pink-50 to-purple-50 group">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 opacity-20" style={{ color: "#7B2E68" }} />
                    </div>
                  )}
                  {/* Upload overlay */}
                  <button
                    onClick={() => triggerUpload(p.id)}
                    disabled={isUploading}
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-white">
                        <Upload className="w-5 h-5" />
                        <span className="text-xs font-medium">{p.imageUrl ? "Trocar foto" : "Adicionar foto"}</span>
                      </div>
                    )}
                  </button>
                  {/* Available badge */}
                  <div className="absolute top-2 left-2">
                    <Badge className={`text-xs ${p.available ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      {p.available ? "Disponível" : "Indisponível"}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 flex flex-col flex-1 gap-2">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">{p.name}</h3>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(p)} className="p-1 rounded hover:bg-pink-50 text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {p.categoryName && (
                    <span className="text-xs text-muted-foreground">{p.categoryName}</span>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-1 border-t border-pink-50">
                    <div>
                      <p className="font-bold text-sm" style={{ color: "#7B2E68" }}>{fmt(Number(p.price))}</p>
                      {p.cmvPercent != null && (
                        <p className={`text-xs font-medium ${cmvColor(p.cmvPercent)}`}>CMV {p.cmvPercent.toFixed(0)}%</p>
                      )}
                    </div>
                    <Switch
                      checked={p.available}
                      onCheckedChange={() => handleToggleAvailable(p)}
                      className="scale-90"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif" style={{ color: "#7B2E68" }}>
              {editProduct ? "Editar produto" : "Novo produto"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="prod-name">Nome *</Label>
              <Input id="prod-name" value={form.name} onChange={(e) => setField("name", e.target.value)} className="mt-1" placeholder="Ex: Bolo Red Velvet" />
            </div>
            <div>
              <Label htmlFor="prod-desc">Descrição</Label>
              <Textarea id="prod-desc" value={form.description} onChange={(e) => setField("description", e.target.value)} className="mt-1" rows={2} placeholder="Breve descrição do produto" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prod-price">Preço (R$) *</Label>
                <Input id="prod-price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setField("price", e.target.value)} className="mt-1" placeholder="0,00" />
              </div>
              <div>
                <Label htmlFor="prod-cost">Custo (R$)</Label>
                <Input id="prod-cost" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setField("cost", e.target.value)} className="mt-1" placeholder="0,00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoryId} onValueChange={(v) => setField("categoryId", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="prod-unit">Unidade</Label>
                <Input id="prod-unit" value={form.unit} onChange={(e) => setField("unit", e.target.value)} className="mt-1" placeholder="un, kg, etc." />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="prod-avail" checked={form.available} onCheckedChange={(v) => setField("available", v)} />
              <Label htmlFor="prod-avail">Disponível no cardápio</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isPending} style={{ backgroundColor: "#7B2E68" }}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editProduct ? "Salvar" : "Criar produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" será removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
