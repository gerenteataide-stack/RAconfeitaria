import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Link2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResponseBody = { token?: string; error?: string };

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetHref, setResetHref] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/local/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as ResponseBody;
      if (!response.ok) throw new Error(result.error || "Não foi possível solicitar a redefinição.");
      if (!result.token) throw new Error("Não foi possível gerar o link local.");
      setResetHref(`/redefinir-senha#token=${encodeURIComponent(result.token)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível solicitar a redefinição.");
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
          <CardTitle className="font-serif text-2xl text-[#7B2E68]">Recuperação local</CardTitle>
          <CardDescription>Disponível somente neste computador. Nenhum e-mail será enviado.</CardDescription>
        </CardHeader>
        <CardContent>
          {resetHref ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <p className="rounded-md border border-[#8A9A75]/30 bg-[#8A9A75]/10 p-3 text-sm">Link local gerado. Ele expira em 30 minutos e pode ser usado uma única vez.</p>
              <Button asChild variant="outline" className="w-full">
                <Link href={resetHref}><Link2 aria-hidden="true" /> Criar nova senha</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full"><Link href="/login"><ArrowLeft aria-hidden="true" /> Voltar ao login</Link></Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="recovery-email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Gerando link..." : "Gerar link local"}
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
