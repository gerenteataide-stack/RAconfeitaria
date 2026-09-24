import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResponseBody = { message?: string; error?: string };

function getResetToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
}

export default function ResetPassword() {
  const token = getResetToken();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/local/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json() as ResponseBody;
      if (!response.ok) throw new Error(result.error || "Não foi possível alterar a senha.");
      window.history.replaceState(null, "", window.location.pathname);
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF9FC] px-4 py-8 text-[#2C2C2C]">
      <Card className="w-full max-w-md rounded-lg border-pink-100 shadow-lg">
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <img src="/logo.png" alt="Rochelle Ataide" className="h-10 w-10 object-contain" />
            <div>
              <p className="font-serif font-bold text-[#7B2E68]">Rochelle Ataide</p>
              <p className="text-sm text-muted-foreground">Confeitaria Artesanal</p>
            </div>
          </div>
          <CardTitle className="font-serif text-2xl text-[#7B2E68]">Criar nova senha</CardTitle>
          <CardDescription>Escolha uma senha com pelo menos 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <p className="rounded-md border border-[#8A9A75]/30 bg-[#8A9A75]/10 p-3 text-sm">
                Senha alterada com sucesso. Entre usando sua nova senha.
              </p>
              <Button asChild className="w-full"><Link href="/login">Ir para o login</Link></Button>
            </div>
          ) : !token ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive" role="alert">Este link é inválido ou expirou. Solicite uma nova redefinição.</p>
              <Button asChild className="w-full"><Link href="/esqueci-senha">Solicitar novo link</Link></Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="pl-9" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
              <Button asChild type="button" variant="ghost" className="w-full">
                <Link href="/login"><ArrowLeft aria-hidden="true" /> Voltar ao login</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
