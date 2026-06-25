import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const emptyForm = { name: "", email: "", password: "", role: "attendant" };

export default function UsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
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
      toast({ title: "Usuario criado" });
    },
  });

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-primary">Usuarios e perfis</h1>
        <p className="text-muted-foreground">Controle quem acessa cada area administrativa.</p>
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
                <Label>Senha provisoria</Label>
                <Input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} minLength={8} required />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select value={form.role} onValueChange={(value) => update("role", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Proprietaria</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="finance">Financeiro</SelectItem>
                    <SelectItem value="production">Producao</SelectItem>
                    <SelectItem value="stock">Estoquista</SelectItem>
                    <SelectItem value="attendant">Atendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? "Criando..." : "Criar usuario"}
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
                <div className="flex items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-primary">
                    <ShieldCheck className="h-4 w-4" /> {user.roleLabel}
                  </span>
                  <span className={user.active ? "text-green-700" : "text-destructive"}>{user.active ? "Ativo" : "Inativo"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
