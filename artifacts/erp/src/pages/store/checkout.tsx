import { useEffect, useState } from "react";
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

type AppliedCoupon = {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: number;
  discount: number;
};

type PublicSettings = {
  cashbackPercent: number;
  loyaltyPointsPerCurrency: number;
  loyaltyEnabled: boolean;
  loyaltyProgramName: string;
  loyaltyProgramType: "points" | "cashback" | "points_cashback" | "custom";
  loyaltyRewardDescription: string;
};

type StoreCustomer = {
  id: number;
  name: string;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  neighborhood: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  totalOrders: number;
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
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [knownCustomer, setKnownCustomer] = useState<StoreCustomer | null>(null);
  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => apiRequest<PublicSettings>("/api/settings/public"),
  });
  const { data: deliveryZones = [] } = useQuery({
    queryKey: ["public-delivery-zones"],
    queryFn: () => apiRequest<DeliveryZone[]>("/api/delivery-zones?active=true"),
  });

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
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
  const discount = Math.min(total, appliedCoupon?.discount ?? 0);
  const grandTotal = total - discount + deliveryFee;
  const cashbackPercent = Number(publicSettings?.cashbackPercent ?? 0);
  const loyaltyEnabled = publicSettings?.loyaltyEnabled ?? true;
  const loyaltyProgramType = publicSettings?.loyaltyProgramType ?? "points_cashback";
  const showLoyaltyPoints = loyaltyEnabled && (loyaltyProgramType === "points" || loyaltyProgramType === "points_cashback" || loyaltyProgramType === "custom");
  const showLoyaltyCashback = loyaltyEnabled && (loyaltyProgramType === "cashback" || loyaltyProgramType === "points_cashback" || loyaltyProgramType === "custom");
  const expectedCashback = showLoyaltyCashback && cashbackPercent > 0 ? (total - discount) * (cashbackPercent / 100) : 0;

  useEffect(() => {
    const saved = localStorage.getItem("ra-store-customer");
    if (!saved) return;
    try {
      const customer = JSON.parse(saved) as StoreCustomer;
      setKnownCustomer(customer);
      setForm((prev) => ({
        ...prev,
        customerName: prev.customerName || customer.name,
        customerPhone: prev.customerPhone || (customer.whatsapp || customer.phone),
        deliveryAddress: prev.deliveryAddress || customer.address || "",
        neighborhood: prev.neighborhood || customer.neighborhood || "",
      }));
      void lookupCustomer(customer.whatsapp || customer.phone);
    } catch {
      localStorage.removeItem("ra-store-customer");
    }
  }, []);

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function lookupCustomer(phoneValue = form.customerPhone) {
    const phone = onlyDigits(phoneValue);
    if (phone.length < 8) return;
    try {
      const customer = await apiRequest<StoreCustomer>(`/api/customers/lookup?whatsapp=${phone}`);
      setKnownCustomer(customer);
      localStorage.setItem("ra-store-customer", JSON.stringify(customer));
      setForm((prev) => ({
        ...prev,
        customerName: prev.customerName || customer.name,
        deliveryAddress: prev.deliveryAddress || customer.address || "",
        neighborhood: prev.neighborhood || customer.neighborhood || "",
      }));
    } catch {
      setKnownCustomer(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione produtos antes de finalizar.", variant: "destructive" });
      return;
    }
    if (!form.customerName || !form.customerPhone || !form.deliveryDate) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
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
      const discountedItems = items.map((i) => {
        const proportionalDiscount = total > 0 ? discount * (i.subtotal / total) : 0;
        const discountedSubtotal = Math.max(0, i.subtotal - proportionalDiscount);
        return {
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: Number((discountedSubtotal / i.quantity).toFixed(2)),
        };
      });
      const order = await createOrder.mutateAsync({
        data: {
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          deliveryType: form.deliveryType,
          deliveryAddress: form.deliveryAddress ? `${form.deliveryAddress} - ${form.neighborhood}${form.cep ? ` - CEP ${form.cep}` : ""}` : undefined,
          deliveryDate: form.deliveryDate,
          deliveryFee: deliveryFee,
          notes: [form.notes, appliedCoupon ? `Cupom aplicado: ${appliedCoupon.code}` : ""].filter(Boolean).join("\n") || undefined,
          items: discountedItems,
        },
      });
      localStorage.setItem("ra-store-customer", JSON.stringify({
        id: knownCustomer?.id ?? 0,
        name: form.customerName,
        phone: form.customerPhone,
        whatsapp: form.customerPhone,
        address: form.deliveryAddress,
        neighborhood: form.neighborhood,
        loyaltyPoints: knownCustomer?.loyaltyPoints ?? 0,
        totalSpent: knownCustomer?.totalSpent ?? 0,
        totalOrders: knownCustomer?.totalOrders ?? 0,
      }));
      clear();
      navigate(`/cardapio/sucesso?id=${order.id}`);
    } catch {
      toast({ title: "Erro ao enviar pedido", description: "Tente novamente ou entre em contato.", variant: "destructive" });
    }
  }

  async function applyCoupon() {
    try {
      const coupon = await apiRequest<AppliedCoupon>(`/api/coupons/validate?code=${encodeURIComponent(couponCode)}&subtotal=${total}`);
      setAppliedCoupon(coupon);
      toast({ title: "Cupom aplicado", description: `${coupon.code} descontou ${fmt(coupon.discount)}.` });
    } catch (error) {
      setAppliedCoupon(null);
      toast({ title: "Cupom inválido", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Carrinho vazio</h2>
        <p className="text-muted-foreground mb-6">Adicione produtos antes de finalizar.</p>
        <Link href="/cardapio">
          <Button style={{ backgroundColor: "#7B2E68" }}>Ver cardápio</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/cardapio">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar ao cardápio
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
                    onChange={(e) => handleChange("customerPhone", e.target.value)}
                    onBlur={() => lookupCustomer()}
                    className="mt-1" required />
                </div>
                {knownCustomer && loyaltyEnabled && (
                  <div className="rounded-xl border border-pink-100 bg-pink-50 p-3 text-sm">
                    <p className="font-medium" style={{ color: "#7B2E68" }}>Olá, {knownCustomer.name}</p>
                    <p className="font-medium">{publicSettings?.loyaltyProgramName ?? "Cartão fidelidade"}</p>
                    {publicSettings?.loyaltyRewardDescription && <p className="text-muted-foreground">{publicSettings.loyaltyRewardDescription}</p>}
                    {showLoyaltyPoints && <p className="text-muted-foreground">{knownCustomer.loyaltyPoints} ponto(s) acumulado(s).</p>}
                    {showLoyaltyCashback && cashbackPercent > 0 && <p className="text-green-700">Cashback ativo: você pode ganhar {fmt(expectedCashback)} nesta compra.</p>}
                  </div>
                )}
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
                  <span className="text-xs text-muted-foreground text-center">Grátis · Combinar local</span>
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
                  <Label htmlFor="address">Endereço de entrega *</Label>
                  <Input id="address" placeholder="Rua, número, bairro" value={form.deliveryAddress}
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
                    {selectedZone ? `Entrega ${selectedZone.name}: ${fmt(selectedZone.fee)}` : deliveryZones.length > 0 ? "Informe bairro ou CEP para calcular a taxa." : "Nenhuma taxa cadastrada. A entrega será combinada."}
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
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => handleChange("deliveryDate", e.target.value)} className="mt-1" required />
                <p className="text-xs text-muted-foreground mt-1">Escolha a data desejada. Pedidos para o mesmo dia serão confirmados pelo WhatsApp.</p>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-pink-100 p-5 shadow-sm">
              <h2 className="font-semibold mb-4">Observações</h2>
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
                          className="text-xs text-muted-foreground hover:text-destructive ml-1">×</button>
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
                <div className="grid gap-2 rounded-lg bg-pink-50 p-3">
                  <Label htmlFor="coupon">Cupom</Label>
                  <div className="flex gap-2">
                    <Input id="coupon" placeholder="PRIMEIRACOMPRA" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} />
                    <Button type="button" variant="outline" onClick={applyCoupon} disabled={!couponCode}>Aplicar</Button>
                  </div>
                  {appliedCoupon && <p className="text-xs text-green-700">Cupom {appliedCoupon.code} aplicado: -{fmt(discount)}</p>}
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Desconto</span><span>-{fmt(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Frete</span>
                  <span>{form.deliveryType === "delivery" ? fmt(deliveryFee) : "Grátis"}</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between font-bold text-lg mb-5">
                <span>Total</span>
                <span style={{ color: "#7B2E68" }}>{fmt(grandTotal)}</span>
              </div>

              <Button type="submit" className="w-full py-5 text-base gap-2" style={{ backgroundColor: "#7B2E68" }}
                disabled={createOrder.isPending}>
                {createOrder.isPending ? "Enviando..." : "Confirmar pedido →"}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                O pagamento será combinado pelo WhatsApp. Você pode pagar pelo PicPay.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}






