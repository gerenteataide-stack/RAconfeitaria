import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, ShieldCheck, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const { data: users = [] } = useQuery({
    queryKey: ["auth-users"],
    queryFn: () => apiRequest<UserRow[]>("/api/auth/users"),
  });

  const create = useMutation({
    mutationFn: () => apiRequest<UserRow>("/api/auth/users", {
      method: "POST",
      body: JSON.stringify(form),
    }),
    onSuccess: () => {
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["auth-users"] });
      toast({ title: "Usuário criado" });
    },
  });

  const updateUser = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Nenhum usuário selecionado");
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        active: form.active,
      };
      if (form.password) payload.password = form.password;
      return apiRequest<UserRow>(`/api/auth/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setEditing(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["auth-users"] });
      toast({ title: "Usuário atualizado" });
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
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
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
              <Input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="Deixe em branco para manter" />
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
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => updateUser.mutate()} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
