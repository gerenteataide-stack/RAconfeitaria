import { useLocation } from "wouter";
import { CheckCircle, ShoppingBag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StoreSuccess() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("id");

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
        Obrigada pela sua encomenda 🎂
      </p>
      {orderId && (
        <p className="text-sm text-muted-foreground mb-8">
          Seu número de pedido é <strong className="text-foreground">#{orderId}</strong>
        </p>
      )}
      <div className="bg-white rounded-2xl border border-pink-100 p-6 text-left mb-8 shadow-sm">
        <h2 className="font-semibold mb-3">O que acontece agora?</h2>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold"
              style={{ backgroundColor: "#7B2E68" }}>1</span>
            Vamos confirmar o pedido por WhatsApp e combinar os detalhes de pagamento.
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold"
              style={{ backgroundColor: "#7B2E68" }}>2</span>
            Sua encomenda entra na produção com carinho artesanal.
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold"
              style={{ backgroundColor: "#7B2E68" }}>3</span>
            Na data escolhida, seu pedido estará pronto para retirada ou será entregue.
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
