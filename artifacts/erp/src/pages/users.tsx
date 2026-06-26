import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  active: boolean;
  lastLoginAt: string | null;
};

const emptyForm = { name: "", email: "", password: "", role: "attendant", active: true };

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}

function roleLabel(role: string) {
  return {
    owner: "Proprietária",
    manager: "Gerente",
    finance: "Financeiro",
    production: "Produção",
    stock: "Estoquista",
    attendant: "Atendente",
  }[role] ?? role;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const { data: users = [] } = useQuery({
    queryKey: ["auth-users"],
    queryFn: () => apiRequest<UserRow[]>("/api/auth/users"),
  });

  const create = useMutation({
    mutationFn: () => apiRequest<UserRow>("/api/auth/users", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password.trim(),
      }),
    }),
    onSuccess: (createdUser) => {
      setForm(emptyForm);
      qc.setQueryData<UserRow[]>(["auth-users"], (current = []) => [...current, createdUser].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      qc.invalidateQueries({ queryKey: ["auth-users"] });
      toast({ title: "Usuário criado" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar usuário", description: errorMessage(error), variant: "destructive" });
    },
  });

  const updateUser = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Nenhum usuário selecionado");
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        role: form.role,
        active: form.active,
      };
      const email = form.email.trim().toLowerCase();
      if (email !== editing.email.trim().toLowerCase()) payload.email = email;
      if (form.password.trim()) payload.password = form.password.trim();
      return apiRequest<UserRow>(`/api/auth/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (updatedUser) => {
      qc.setQueryData<UserRow[]>(["auth-users"], (current = []) => current.map((user) => user.id === updatedUser.id ? updatedUser : user));
      setEditing(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["auth-users"] });
      toast({ title: "Usuário atualizado" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar usuário", description: errorMessage(error), variant: "destructive" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: () => {
      if (!deleteTarget) throw new Error("Nenhum usuário selecionado");
      return apiRequest<void>(`/api/auth/users/${deleteTarget.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      if (deleteTarget) {
        qc.setQueryData<UserRow[]>(["auth-users"], (current = []) => current.filter((user) => user.id !== deleteTarget.id));
      }
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["auth-users"] });
      toast({ title: "Usuário excluído" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir usuário", description: errorMessage(error), variant: "destructive" });
    },
  });

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openEdit(user: UserRow) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      active: user.active,
    });
  }

  function closeEdit() {
    setEditing(null);
    setForm(emptyForm);
  }

  function submitCreate() {
    if (!isValidEmail(form.email)) {
      toast({ title: "Email inválido", description: "Informe um email válido antes de criar o usuário.", variant: "destructive" });
      return;
    }
    create.mutate();
  }

  function submitUpdate() {
    if (!editing) return;
    const emailChanged = form.email.trim().toLowerCase() !== editing.email.trim().toLowerCase();
    if (emailChanged && !isValidEmail(form.email)) {
      toast({ title: "Email inválido", description: "Corrija o email ou deixe o email atual sem alteração.", variant: "destructive" });
      return;
    }
    updateUser.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-primary">Usuários e perfis</h1>
        <p className="text-muted-foreground">Controle quem acessa cada área administrativa.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5" /> Novo acesso</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submitCreate(); }}>
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(event) => update("name", event.target.value)} required />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required />
              </div>
              <div>
                <Label>Senha provisória</Label>
                <Input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} minLength={8} required />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select value={form.role} onValueChange={(value) => update("role", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Proprietária</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="finance">Financeiro</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                    <SelectItem value="stock">Estoquista</SelectItem>
                    <SelectItem value="attendant">Atendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? "Criando..." : "Criar usuário"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {users.map((user) => (
            <Card key={user.id} className="rounded-lg">
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-primary">
                    <ShieldCheck className="h-4 w-4" /> {user.roleLabel || roleLabel(user.role)}
                  </span>
                  <span className={user.active ? "text-green-700" : "text-destructive"}>{user.active ? "Ativo" : "Inativo"}</span>
                  <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(user)}>
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(event) => update("name", event.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
            </div>
            <div>
              <Label>Nova senha</Label>
              <Input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} minLength={8} placeholder="Deixe em branco para manter" />
            </div>
            <div>
              <Label>Perfil</Label>
              <Select value={form.role} onValueChange={(value) => update("role", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Proprietária</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="finance">Financeiro</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                  <SelectItem value="stock">Estoquista</SelectItem>
                  <SelectItem value="attendant">Atendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={(value) => update("active", value)} />
              <Label>{form.active ? "Usuário ativo" : "Usuário inativo"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>Cancelar</Button>
            <Button onClick={submitUpdate} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o acesso de {deleteTarget?.name}. Não é possível excluir o próprio usuário logado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteUser.mutate()} disabled={deleteUser.isPending}>
              {deleteUser.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
