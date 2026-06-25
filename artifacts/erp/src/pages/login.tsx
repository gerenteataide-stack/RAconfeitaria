import { useState } from "react";
import { useLocation } from "wouter";
import { LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      toast({ title: "Nao foi possivel entrar", description: "Confira email e senha.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF9FC] text-[#2C2C2C]">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-[1fr_420px]">
        <section className="flex flex-col justify-between px-6 py-8 lg:px-10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Rochelle Ataide" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="font-serif text-xl font-bold text-[#7B2E68]">Rochelle Ataide</h1>
              <p className="text-sm text-muted-foreground">Confeitaria Artesanal</p>
            </div>
          </div>
          <div className="max-w-2xl py-16">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.22em] text-[#8A9A75]">ERP premium</p>
            <h2 className="font-serif text-4xl font-bold leading-tight text-[#7B2E68] md:text-5xl">
              Gestao de pedidos, producao, estoque e financeiro em um so painel.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Acesso protegido por perfil para manter cada area da confeitaria organizada e segura.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Painel administrativo seguro</p>
        </section>

        <section className="flex items-center px-4 pb-10 lg:px-0 lg:pb-0">
          <Card className="w-full rounded-lg border-pink-100 shadow-lg">
            <CardHeader>
              <CardTitle className="font-serif text-2xl text-[#7B2E68]">Entrar no painel</CardTitle>
              <CardDescription>Use seu email e senha de acesso.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-9" required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
