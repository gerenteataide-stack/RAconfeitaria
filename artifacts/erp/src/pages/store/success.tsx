import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StoreSuccess() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("id");
  const payment = params.get("payment");

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
          O pagamento não foi concluído. Você pode falar conosco pelo WhatsApp para receber outro link.
        </div>
      )}
      <div className="mb-8 rounded-2xl border border-pink-100 bg-white p-6 text-left shadow-sm">
        <h2 className="mb-3 font-semibold">O que acontece agora?</h2>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#7B2E68" }}>1</span>
            Vamos confirmar o pedido por WhatsApp e enviar as instruções para pagamento pelo PicPay.
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#7B2E68" }}>2</span>
            Sua encomenda entra na produção com carinho artesanal.
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
        <a href="https://wa.me/5511987654321" target="_blank" rel="noopener noreferrer">
          <Button className="w-full gap-2" style={{ backgroundColor: "#25D366", color: "white" }}>
            <ShoppingBag className="h-4 w-4" /> Falar no WhatsApp
          </Button>
        </a>
      </div>
    </div>
  );
}
