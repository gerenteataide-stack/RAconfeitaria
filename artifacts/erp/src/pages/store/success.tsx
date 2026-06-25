import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type PublicSettings = {
  whatsappNumber: string;
  pixKey: string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export default function StoreSuccess() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("id");
  const payment = params.get("payment");
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => apiRequest<PublicSettings>("/api/settings/public"),
  });

  const pixKey = settings?.pixKey?.trim() ?? "";
  const whatsapp = settings?.whatsappNumber?.trim() ?? "";
  const whatsappDigits = onlyDigits(whatsapp);
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : undefined;

  async function copyPix() {
    if (!pixKey) return;
    await navigator.clipboard.writeText(pixKey);
    toast({ title: "Chave Pix copiada" });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: "#f0fdf4" }}>
        <CheckCircle className="h-10 w-10" style={{ color: "#16a34a" }} />
      </div>
      <h1 className="mb-3 font-serif text-3xl font-bold" style={{ color: "#7B2E68" }}>
        Pedido confirmado!
      </h1>
      <p className="mb-2 text-lg text-muted-foreground">
        Obrigada pela sua encomenda.
      </p>
      {orderId && (
        <p className="mb-8 text-sm text-muted-foreground">
          Seu número de pedido é <strong className="text-foreground">#{orderId}</strong>
        </p>
      )}

      {pixKey && (
        <div className="mb-6 rounded-2xl border border-pink-100 bg-white p-5 text-left shadow-sm">
          <h2 className="mb-2 font-semibold text-foreground">Pagamento via Pix</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Faça o pagamento pela chave Pix abaixo e envie o comprovante pelo WhatsApp.
          </p>
          <div className="rounded-lg border bg-pink-50/60 p-3 text-sm font-medium text-foreground break-all">
            {pixKey}
          </div>
          <Button type="button" variant="outline" className="mt-3 w-full gap-2" onClick={copyPix}>
            <Copy className="h-4 w-4" /> Copiar chave Pix
          </Button>
        </div>
      )}

      {!pixKey && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          A chave Pix ainda não foi cadastrada. Vamos enviar as instruções de pagamento pelo WhatsApp.
        </div>
      )}

      {payment === "approved" && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Pagamento aprovado. Seu pedido já entrou na fila de produção.
        </div>
      )}
      {payment === "pending" && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Pagamento recebido como pendente. Vamos confirmar e avisar pelo WhatsApp.
        </div>
      )}
      {payment === "failed" && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          O pagamento não foi concluído. Você pode falar conosco pelo WhatsApp.
        </div>
      )}

      <div className="mb-8 rounded-2xl border border-pink-100 bg-white p-6 text-left shadow-sm">
        <h2 className="mb-3 font-semibold">O que acontece agora?</h2>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#7B2E68" }}>1</span>
            Faça o pagamento pelo Pix e envie o comprovante pelo WhatsApp.
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#7B2E68" }}>2</span>
            Vamos confirmar o pagamento e iniciar a produção.
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#7B2E68" }}>3</span>
            Na data escolhida, seu pedido estará pronto para retirada ou será entregue.
          </li>
        </ol>
      </div>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Button variant="outline" onClick={() => navigate("/cardapio")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Ver mais produtos
        </Button>
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button className="w-full gap-2" style={{ backgroundColor: "#25D366", color: "white" }}>
              <MessageCircle className="h-4 w-4" /> Enviar comprovante
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
