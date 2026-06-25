import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Truck, Store, CalendarDays, ShoppingBag, Minus, Plus } from "lucide-react";
import { useCreateOrder } from "@workspace/api-client-react";
import { useCart } from "@/contexts/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type DeliveryZone = {
  id: number;
  name: string;
  cepStart: string | null;
  cepEnd: string | null;
  neighborhood: string | null;
  fee: number;
  minOrder: number;
  active: boolean;
};

function normalize(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export default function StoreCheckout() {
  const [, navigate] = useLocation();
  const { items, updateQuantity, removeItem, total, clear } = useCart();
  const { toast } = useToast();
  const createOrder = useCreateOrder();
  const { data: deliveryZones = [] } = useQuery({
    queryKey: ["public-delivery-zones"],
    queryFn: () => apiRequest<DeliveryZone[]>("/api/delivery-zones?active=true"),
  });

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerDocument: "",
    deliveryType: "pickup" as "pickup" | "delivery",
    deliveryAddress: "",
    neighborhood: "",
    cep: "",
    deliveryDate: "",
    notes: "",
  });

  const selectedZone = form.deliveryType === "delivery"
    ? deliveryZones.find((zone) => {
      const neighborhoodMatch = zone.neighborhood && form.neighborhood && normalize(zone.neighborhood) === normalize(form.neighborhood);
      const cep = onlyDigits(form.cep);
      const cepStart = onlyDigits(zone.cepStart ?? "");
      const cepEnd = onlyDigits(zone.cepEnd ?? "");
      const cepMatch = cep && cepStart && cepEnd && cep >= cepStart && cep <= cepEnd;
      return neighborhoodMatch || cepMatch;
    })
    : undefined;
  const deliveryFee = form.deliveryType === "delivery" ? selectedZone?.fee ?? 0 : 0;
  const grandTotal = total + deliveryFee;

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione produtos antes de finalizar.", variant: "destructive" });
      return;
    }
    if (!form.customerName || !form.customerPhone || !form.customerEmail || !form.customerDocument || !form.deliveryDate) {
      toast({ title: "Preencha os campos obrigatÃ³rios", variant: "destructive" });
      return;
    }
    if (form.deliveryType === "delivery" && (!form.deliveryAddress || !form.neighborhood)) {
      toast({ title: "Informe o endereço e o bairro de entrega", variant: "destructive" });
      return;
    }
    if (form.deliveryType === "delivery" && deliveryZones.length > 0 && !selectedZone) {
      toast({ title: "Bairro ou CEP fora da área de entrega", variant: "destructive" });
      return;
    }
    try {
      const order = await createOrder.mutateAsync({
        data: {
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          deliveryType: form.deliveryType,
          deliveryAddress: form.deliveryAddress ? `${form.deliveryAddress} - ${form.neighborhood}${form.cep ? ` - CEP ${form.cep}` : ""}` : undefined,
          deliveryDate: form.deliveryDate,
          deliveryFee: deliveryFee,
          notes: form.notes || undefined,
          items: items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      });
      clear();
      try {
        const payment = await apiRequest<{ configured: boolean; checkoutUrl?: string | null }>(
          "/api/payments/picpay/checkout",
          {
            method: "POST",
            body: JSON.stringify({
              orderId: order.id,
              buyerEmail: form.customerEmail,
              buyerDocument: form.customerDocument,
            }),
          },
        );
        if (payment.configured && payment.checkoutUrl) {
          window.location.href = payment.checkoutUrl;
          return;
        }
      } catch {
        // O pedido ja foi registrado; o pagamento pode ser combinado manualmente.
      }
      navigate(`/cardapio/sucesso?id=${order.id}`);
    } catch {
      toast({ title: "Erro ao enviar pedido", description: "Tente novamente ou entre em contato.", variant: "destructive" });
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Carrinho vazio</h2>
        <p className="text-muted-foreground mb-6">Adicione produtos antes de finalizar.</p>
        <Link href="/cardapio">
          <Button style={{ backgroundColor: "#7B2E68" }}>Ver cardÃ¡pio</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/cardapio">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar ao cardÃ¡pio
        </button>
      </Link>

      <h1 className="text-2xl font-serif font-bold mb-8" style={{ color: "#7B2E68" }}>Finalizar pedido</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Personal info */}
            <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-sm">
              <h2 className="font-semibold mb-4">Seus dados</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input id="name" placeholder="Seu nome" value={form.customerName}
                    onChange={(e) => handleChange("customerName", e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label htmlFor="phone">WhatsApp *</Label>
                  <Input id="phone" placeholder="(11) 99999-9999" value={form.customerPhone}
                    onChange={(e) => handleChange("customerPhone", e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" placeholder="seuemail@exemplo.com" value={form.customerEmail}
                    onChange={(e) => handleChange("customerEmail", e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label htmlFor="document">CPF *</Label>
                  <Input id="document" placeholder="000.000.000-00" value={form.customerDocument}
                    onChange={(e) => handleChange("customerDocument", e.target.value)} className="mt-1" required />
                </div>
              </div>
            </div>

            {/* Delivery type */}
            <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-sm">
              <h2 className="font-semibold mb-4">Como prefere receber?</h2>
              <div className="grid grid-cols-2 gap-3">
                <button type="button"
                  onClick={() => handleChange("deliveryType", "pickup")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${form.deliveryType === "pickup" ? "border-[#7B2E68] bg-pink-50" : "border-pink-100 hover:border-pink-200"}`}>
                  <Store className="w-6 h-6" style={{ color: form.deliveryType === "pickup" ? "#7B2E68" : undefined }} />
                  <span className="font-medium text-sm">Retirada</span>
                  <span className="text-xs text-muted-foreground text-center">GrÃ¡tis Â· Combinar local</span>
                </button>
                <button type="button"
                  onClick={() => handleChange("deliveryType", "delivery")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${form.deliveryType === "delivery" ? "border-[#7B2E68] bg-pink-50" : "border-pink-100 hover:border-pink-200"}`}>
                  <Truck className="w-6 h-6" style={{ color: form.deliveryType === "delivery" ? "#7B2E68" : undefined }} />
                  <span className="font-medium text-sm">Entrega</span>
                  <span className="text-xs text-muted-foreground text-center">Taxa por bairro</span>
                </button>
              </div>

              {form.deliveryType === "delivery" && (
                <div className="mt-4">
                  <Label htmlFor="address">EndereÃ§o de entrega *</Label>
                  <Input id="address" placeholder="Rua, nÃºmero, bairro" value={form.deliveryAddress}
                    onChange={(e) => handleChange("deliveryAddress", e.target.value)} className="mt-1" />
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label htmlFor="neighborhood">Bairro *</Label>
                      <Input id="neighborhood" placeholder="Ex: Centro" value={form.neighborhood}
                        onChange={(e) => handleChange("neighborhood", e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="cep">CEP</Label>
                      <Input id="cep" placeholder="00000-000" value={form.cep}
                        onChange={(e) => handleChange("cep", e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedZone ? `Entrega ${selectedZone.name}: ${fmt(selectedZone.fee)}` : deliveryZones.length > 0 ? "Informe bairro ou CEP para calcular a taxa." : "Nenhuma taxa cadastrada. A entrega serÃ¡ combinada."}
                  </p>
                </div>
              )}
            </div>

            {/* Date */}
            <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-sm">
              <h2 className="font-semibold mb-4">Data desejada</h2>
              <div>
                <Label htmlFor="date" className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" /> Data de {form.deliveryType === "pickup" ? "retirada" : "entrega"} *
                </Label>
                <Input id="date" type="date" value={form.deliveryDate}
                  min={new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]}
                  onChange={(e) => handleChange("deliveryDate", e.target.value)} className="mt-1" required />
                <p className="text-xs text-muted-foreground mt-1">Prazo mÃ­nimo de 2 dias para produÃ§Ã£o artesanal.</p>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-sm">
              <h2 className="font-semibold mb-4">ObservaÃ§Ãµes</h2>
              <Textarea
                placeholder="Ex: Escrita no bolo, alergias, recheio preferido..."
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Right: order summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-sm sticky top-24">
              <h2 className="font-semibold mb-4">Resumo do pedido</h2>
              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={item.productId} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center shrink-0 mt-0.5">
                      <ShoppingBag className="w-4 h-4" style={{ color: "#7B2E68" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{item.productName}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-5 h-5 rounded-full border flex items-center justify-center hover:bg-gray-50">
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-xs w-3 text-center">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-5 h-5 rounded-full border flex items-center justify-center hover:bg-gray-50">
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                        <button type="button" onClick={() => removeItem(item.productId)}
                          className="text-xs text-muted-foreground hover:text-destructive ml-1">âœ•</button>
                      </div>
                    </div>
                    <span className="text-sm font-semibold shrink-0" style={{ color: "#7B2E68" }}>{fmt(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{fmt(total)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Frete</span>
                  <span>{form.deliveryType === "delivery" ? fmt(deliveryFee) : "GrÃ¡tis"}</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between font-bold text-lg mb-5">
                <span>Total</span>
                <span style={{ color: "#7B2E68" }}>{fmt(grandTotal)}</span>
              </div>

              <Button type="submit" className="w-full py-5 text-base gap-2" style={{ backgroundColor: "#7B2E68" }}
                disabled={createOrder.isPending}>
                {createOrder.isPending ? "Enviando..." : "Confirmar pedido â†’"}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                O pagamento sera aberto pelo PicPay apos confirmar o pedido.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}




