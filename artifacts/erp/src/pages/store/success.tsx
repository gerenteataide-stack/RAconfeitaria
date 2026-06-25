import { useLocation } from "wouter";
import { CheckCircle, ShoppingBag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StoreSuccess() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("id");
  const payment = params.get("payment");

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{ backgroundColor: "#f0fdf4" }}>
        <CheckCircle className="w-10 h-10" style={{ color: "#16a34a" }} />
      </div>
      <h1 className="text-3xl font-serif font-bold mb-3" style={{ color: "#7B2E68" }}>
        Pedido confirmado!
      </h1>
      <p className="text-muted-foreground mb-2 text-lg">
        Obrigada pela sua encomenda ðŸŽ‚
      </p>
      {orderId && (
        <p className="text-sm text-muted-foreground mb-8">
          Seu nÃºmero de pedido Ã© <strong className="text-foreground">#{orderId}</strong>
        </p>
      )}
      {payment === "approved" && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Pagamento aprovado. Seu pedido ja entrou na fila de producao.
        </div>
      )}
      {payment === "pending" && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Pagamento recebido como pendente. Vamos confirmar e avisar pelo WhatsApp.
        </div>
      )}
      {payment === "failed" && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          O pagamento nao foi concluido. Voce pode falar conosco pelo WhatsApp para receber outro link.
        </div>
      )}
      <div className="bg-white rounded-2xl border border-pink-100 p-6 text-left mb-8 shadow-sm">
        <h2 className="font-semibold mb-3">O que acontece agora?</h2>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold"
              style={{ backgroundColor: "#7B2E68" }}>1</span>
            Vamos confirmar o pedido por WhatsApp e enviar as instrucoes para pagamento pelo PicPay.
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold"
              style={{ backgroundColor: "#7B2E68" }}>2</span>
            Sua encomenda entra na produÃ§Ã£o com carinho artesanal.
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold"
              style={{ backgroundColor: "#7B2E68" }}>3</span>
            Na data escolhida, seu pedido estarÃ¡ pronto para retirada ou serÃ¡ entregue.
          </li>
        </ol>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="outline" onClick={() => navigate("/cardapio")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Ver mais produtos
        </Button>
        <a
          href="https://wa.me/5511987654321"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button className="gap-2 w-full" style={{ backgroundColor: "#25D366", color: "white" }}>
            <ShoppingBag className="w-4 h-4" /> Falar no WhatsApp
          </Button>
        </a>
      </div>
    </div>
  );
}


