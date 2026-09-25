import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BellRing, CheckCircle, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getPushRegistrationError, registerOrderPush } from "@/lib/firebase-push";

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
  const numericOrderId = orderId ? Number(orderId) : NaN;
  const notificationKeyStorage = Number.isSafeInteger(numericOrderId) && numericOrderId > 0
    ? `ra-order-notification-key:${numericOrderId}`
    : null;
  const notificationPreferenceKey = Number.isSafeInteger(numericOrderId) && numericOrderId > 0
    ? `ra-order-notifications-enabled:${numericOrderId}`
    : null;
  const [notificationsEnabled, setNotificationsEnabled] = useState(() =>
    Boolean(notificationPreferenceKey && localStorage.getItem(notificationPreferenceKey) === "true")
  );
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const payment = params.get("payment");
  const method = params.get("method");
  const paymentMethod = method === "pix" || method === "cash" || method === "debit_card" || method === "credit_card" ? method : null;
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => apiRequest<PublicSettings>("/api/settings/public"),
  });

  const pixKey = settings?.pixKey?.trim() ?? "";
  const whatsapp = settings?.whatsappNumber?.trim() ?? "";
  const whatsappDigits = onlyDigits(whatsapp);
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : undefined;
  const paymentMethodLabel = paymentMethod === "pix" ? "Pix" : paymentMethod === "cash" ? "Dinheiro" : paymentMethod === "debit_card" ? "Cartão de débito" : paymentMethod === "credit_card" ? "Cartão de crédito" : "a combinar";

  async function copyPix() {
    if (!pixKey) return;
    await navigator.clipboard.writeText(pixKey);
    toast({ title: "Chave Pix copiada" });
  }

  async function toggleOrderNotifications() {
    if (!notificationKeyStorage || !notificationPreferenceKey) return;
    const customerNotificationKey = sessionStorage.getItem(notificationKeyStorage);
    if (!customerNotificationKey) {
      toast({ title: "Não foi possível validar este pedido", description: "Abra a confirmação no mesmo aparelho usado para fazer o pedido.", variant: "destructive" });
      return;
    }

    setNotificationsLoading(true);
    try {
      if (notificationsEnabled) {
        await apiRequest<void>("/api/customer-order-notifications", {
          method: "DELETE",
          body: JSON.stringify({ orderId: numericOrderId, customerNotificationKey }),
        });
        localStorage.removeItem(notificationPreferenceKey);
        setNotificationsEnabled(false);
        toast({ title: "Avisos desativados para este pedido" });
        return;
      }

      const token = await registerOrderPush();
      await apiRequest<void>("/api/customer-order-notifications", {
        method: "POST",
        body: JSON.stringify({ orderId: numericOrderId, customerNotificationKey, token }),
      });
      localStorage.setItem(notificationPreferenceKey, "true");
      setNotificationsEnabled(true);
      toast({ title: "Avisos do pedido ativados", description: "Você receberá atualizações quando o pedido mudar de etapa." });
    } catch (error) {
      toast({
        title: notificationsEnabled ? "Não foi possível desativar os avisos" : "Não foi possível ativar os avisos",
        description: getPushRegistrationError(error).message,
        variant: "destructive",
      });
    } finally {
      setNotificationsLoading(false);
    }
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

      {notificationKeyStorage && sessionStorage.getItem(notificationKeyStorage) && (
        <div className="mb-6 rounded-lg border border-[#7B2E68]/15 bg-white p-4 text-left">
          <p className="text-sm text-muted-foreground">Receba avisos sobre pagamento, preparo e entrega deste pedido.</p>
          <Button
            type="button"
            variant={notificationsEnabled ? "outline" : "default"}
            className="mt-3 w-full gap-2"
            onClick={() => void toggleOrderNotifications()}
            disabled={notificationsLoading}
          >
            <BellRing className="h-4 w-4" aria-hidden="true" />
            {notificationsLoading ? "Atualizando..." : notificationsEnabled ? "Desativar avisos deste pedido" : "Ativar avisos deste pedido"}
          </Button>
        </div>
      )}

      {paymentMethod === "pix" && pixKey && (
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

      {paymentMethod === "pix" && !pixKey && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          A chave Pix ainda não foi cadastrada. Fale conosco pelo WhatsApp para combinar o pagamento.
        </div>
      )}
      {paymentMethod && paymentMethod !== "pix" && (
        <div className="mb-6 rounded-lg border border-pink-100 bg-white p-4 text-sm text-muted-foreground">
          Forma escolhida: <strong className="text-foreground">{paymentMethodLabel}</strong>. Vamos confirmar os detalhes do pagamento pelo WhatsApp.
        </div>
      )}
      {!paymentMethod && (
        <div className="mb-6 rounded-lg border border-pink-100 bg-white p-4 text-sm text-muted-foreground">
          A forma de pagamento será combinada com a confeitaria pelo WhatsApp.
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
            {paymentMethod === "pix" ? "Faça o pagamento pelo Pix e envie o comprovante pelo WhatsApp." : `A forma escolhida foi ${paymentMethodLabel}. Aguarde a confirmação dos detalhes pelo WhatsApp.`}
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
              <MessageCircle className="h-4 w-4" /> {paymentMethod === "pix" ? "Enviar comprovante" : "Falar pelo WhatsApp"}
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
