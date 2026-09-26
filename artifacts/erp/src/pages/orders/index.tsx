import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  Clock,
  BellRing,
  Filter,
  Megaphone,
  MapPin,
  Package,
  Plus,
  Search,
  Truck,
  Volume2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  getListOrdersQueryKey,
  useListOrders,
  useUpdateOrderStatus,
} from "@workspace/api-client-react";
import type { Order, OrderStatusUpdateStatus } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/auth";
import { apiRequest } from "@/lib/api";
import { getCurrentOrderPushToken, getPushEnvironment, getPushRegistrationError, registerOrderPush, removeOrderPushToken } from "@/lib/firebase-push";
import { playOrderSound, unlockOrderSound } from "@/lib/order-sound";

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
};

const STATUS_CONFIG = {
  new: { label: "Novo", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Package },
  awaiting_payment: { label: "Aguardando pagamento", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  paid: { label: "Pago", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: Check },
  production: { label: "Em produção", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Clock },
  ready: { label: "Pronto", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: Package },
  out_for_delivery: { label: "Saiu para entrega", color: "bg-orange-100 text-orange-800 border-orange-200", icon: Truck },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-800 border-green-200", icon: Check },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800 border-red-200", icon: X },
};

type PushTestResult = {
  status: "not_configured" | "no_recipients" | "sent" | "partial_failure" | "failed";
  recipients: number;
  sent: number;
  failed: number;
  errorCodes: Record<string, number>;
};

const KANBAN_COLUMNS = [
  { id: "new", label: "Novos" },
  { id: "paid", label: "Pagos" },
  { id: "production", label: "Produção" },
  { id: "ready", label: "Prontos" },
  { id: "out_for_delivery", label: "Em entrega" },
  { id: "delivered", label: "Entregues" },
  { id: "cancelled", label: "Cancelados" },
];

type OrderCardAction = {
  label: string;
  status: OrderStatusUpdateStatus;
  icon: LucideIcon;
  variant?: "default" | "outline" | "destructive";
};

function nextActions(order: Order): OrderCardAction[] {
  const actions: OrderCardAction[] = [];
  const paymentAtDelivery = order.deliveryType === "delivery"
    && (order.paymentMethod === "cash" || order.paymentMethod === "credit_card" || order.paymentMethod === "debit_card")
    && order.paymentStatus !== "paid";
  if (order.status === "new" || order.status === "awaiting_payment") {
    actions.push(paymentAtDelivery
      ? { label: "Iniciar produção", status: "production", icon: Clock }
      : { label: "Marcar pago", status: "paid", icon: Check });
  }
  if (order.status === "paid") actions.push({ label: "Produção", status: "production", icon: Clock });
  if (order.status === "production") actions.push({ label: "Pronto", status: "ready", icon: Package });
  if (order.status === "ready" && order.deliveryType === "delivery") actions.push({ label: "Saiu para entrega", status: "out_for_delivery", icon: Truck, variant: "outline" });
  if (order.status === "ready" || order.status === "out_for_delivery") actions.push({ label: "Entregue", status: "delivered", icon: Check });
  if (order.status !== "cancelled" && order.status !== "delivered") actions.push({ label: "Cancelar", status: "cancelled", icon: X, variant: "destructive" });
  return actions;
}

export default function Orders() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderSoundEnabled, setOrderSoundEnabled] = useState(() => localStorage.getItem("ra-order-sound-enabled") !== "false");
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem("ra-order-push-enabled") === "true");
  const [pushBusy, setPushBusy] = useState(false);
  const pushSyncingRef = useRef(false);
  const pushEnvironment = getPushEnvironment();
  const pushBlockedUntilHomeScreen = pushEnvironment.requiresHomeScreenApp;
  const [paymentBusyId, setPaymentBusyId] = useState<number | null>(null);
  const orderSnapshotRef = useRef<{ date: string; ids: Set<number> | null }>({ date: selectedDate, ids: null });
  const orderParams = selectedDate ? { date: selectedDate } : undefined;
  const { data: orders = [], isLoading } = useListOrders(orderParams, {
    query: { queryKey: getListOrdersQueryKey(orderParams), refetchInterval: 15000 },
  });
  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListOrdersQueryKey(orderParams) });
        toast({ title: "Pedido atualizado" });
      },
      onError: () => toast({ title: "Erro ao atualizar pedido", variant: "destructive" }),
    },
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const getColumnOrders = (statusId: string) => {
    if (statusId === "new") return orders.filter((order) => order.status === "new" || order.status === "awaiting_payment");
    return orders.filter((order) => order.status === statusId);
  };
  const newOrders = getColumnOrders("new");

  useEffect(() => {
    if (!orderSoundEnabled) return;

    const unlockAudio = () => {
      void unlockOrderSound().then((unlocked) => {
        if (unlocked) {
          window.removeEventListener("pointerdown", unlockAudio);
          window.removeEventListener("keydown", unlockAudio);
        }
      });
    };

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [orderSoundEnabled]);

  useEffect(() => {
    if (!pushEnabled || pushBlockedUntilHomeScreen || (user?.role !== "owner" && user?.role !== "manager")) return;

    let cancelled = false;
    const syncPushToken = async () => {
      if (cancelled || pushSyncingRef.current) return;
      pushSyncingRef.current = true;
      try {
        const token = await getCurrentOrderPushToken();
        if (!token || cancelled) return;
        await apiRequest<{ serverConfigured: boolean }>("/api/push-tokens", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
      } catch {
        // A background refresh must not interrupt order management.
      } finally {
        pushSyncingRef.current = false;
      }
    };

    void syncPushToken();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncPushToken();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pushBlockedUntilHomeScreen, pushEnabled, user?.role]);

  useEffect(() => {
    if (orderSnapshotRef.current.date !== selectedDate) {
      orderSnapshotRef.current = { date: selectedDate, ids: null };
    }
    if (isLoading) return;

    const currentIds = new Set(orders.map((order) => order.id));
    const previousIds = orderSnapshotRef.current.ids;
    const arrivals = previousIds
      ? orders.filter((order) => !previousIds.has(order.id) && (order.status === "new" || order.status === "awaiting_payment"))
      : [];
    if (orderSoundEnabled && arrivals.length > 0) {
      playOrderSound();
      toast({ title: "Novo pedido recebido", description: `${arrivals.length} pedido(s) novo(s).` });
    }
    orderSnapshotRef.current = { date: selectedDate, ids: currentIds };
  }, [orders, isLoading, selectedDate, orderSoundEnabled, toast]);

  async function toggleOrderSound(enabled: boolean) {
    setOrderSoundEnabled(enabled);
    localStorage.setItem("ra-order-sound-enabled", String(enabled));
    window.dispatchEvent(new Event("ra-order-sound-preference"));
    try {
      if (!enabled) return;

      if (!await unlockOrderSound()) throw new Error("Audio is not available");
      playOrderSound();
      toast({ title: "Som de pedidos ativado" });
    } catch {
      toast({ title: "Não foi possível ativar o som", description: "Verifique se o navegador permite áudio.", variant: "destructive" });
    }
  }

  async function toggleOrderPush(enabled: boolean) {
    setPushBusy(true);
    try {
      if (enabled) {
        const token = await registerOrderPush();
        const result = await apiRequest<{ serverConfigured: boolean }>("/api/push-tokens", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        localStorage.setItem("ra-order-push-enabled", "true");
        setPushEnabled(true);
        toast(result.serverConfigured
          ? { title: "Notificações ativadas", description: "Este navegador receberá avisos de novos pedidos." }
          : { title: "Navegador autorizado", description: "Para enviar os avisos pelo Firebase, falta configurar a credencial segura do servidor na Vercel." });
      } else {
        const token = await getCurrentOrderPushToken();
        if (token) {
          await apiRequest<void>("/api/push-tokens", {
            method: "DELETE",
            body: JSON.stringify({ token }),
          });
        }
        await removeOrderPushToken();
        localStorage.removeItem("ra-order-push-enabled");
        setPushEnabled(false);
        toast({ title: "Notificações desativadas" });
      }
    } catch (error) {
      setPushEnabled(!enabled);
      toast({
        title: enabled ? "Não foi possível ativar as notificações" : "Não foi possível desativar as notificações",
        description: getPushRegistrationError(error).message,
        variant: "destructive",
      });
    } finally {
      setPushBusy(false);
    }
  }

  async function testOrderPush() {
    setPushBusy(true);
    try {
      const result = await apiRequest<PushTestResult>("/api/push-tokens/test", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const messages: Record<PushTestResult["status"], { title: string; description: string }> = {
        sent: { title: "Teste enviado", description: "Confira se a notificação apareceu neste navegador." },
        no_recipients: { title: "Este navegador não está inscrito", description: "Ative as notificações neste dispositivo e tente novamente." },
        not_configured: { title: "Firebase não configurado", description: "A credencial segura do servidor não está válida na Vercel." },
        partial_failure: { title: "Envio parcial", description: `${result.sent} enviado(s), ${result.failed} com erro.` },
        failed: { title: "O Firebase recusou o teste", description: Object.keys(result.errorCodes).join(", ") || "Confira os logs do servidor para ver o motivo." },
      };
      const message = messages[result.status];
      toast({ title: message.title, description: message.description, variant: result.status === "sent" ? "default" : "destructive" });
    } catch (error) {
      toast({ title: "Não foi possível testar a notificação", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setPushBusy(false);
    }
  }

  function changeStatus(order: Order, status: OrderStatusUpdateStatus) {
    updateStatus.mutate({ id: order.id, data: { status } });
  }

  async function confirmOrderPayment(order: Order) {
    setPaymentBusyId(order.id);
    try {
      await apiRequest<Order>(`/api/orders/${order.id}/payment`, { method: "PATCH" });
      await qc.invalidateQueries({ queryKey: getListOrdersQueryKey(orderParams) });
      toast({ title: "Pagamento confirmado", description: "A entrada do pedido foi registrada no financeiro." });
    } catch (error) {
      toast({
        title: "Não foi possível confirmar o pagamento",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setPaymentBusyId(null);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Pedidos</h1>
          <p className="mt-1 text-muted-foreground">Gerencie o fluxo de encomendas da confeitaria.</p>
        </div>
        <Link href="/orders/new">
          <Button className="rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            Novo pedido
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou ID..."
            className="border-none bg-transparent pl-9 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="mx-2 h-6 w-px bg-border" />
        <Input
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="w-full sm:w-44"
        />
        <div className="flex items-center gap-2 px-1">
          <Volume2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Switch aria-label="Ativar som para novos pedidos" checked={orderSoundEnabled} onCheckedChange={toggleOrderSound} />
          <span className="text-sm text-muted-foreground">Som</span>
        </div>
        {(user?.role === "owner" || user?.role === "manager") && (
          <div className="flex items-center gap-2 px-1" title="Receber avisos de pedidos neste navegador">
            <BellRing className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Switch aria-label="Ativar notificações de pedidos" checked={pushBlockedUntilHomeScreen ? false : pushEnabled} onCheckedChange={toggleOrderPush} disabled={pushBusy || pushBlockedUntilHomeScreen} />
            <span className="text-sm text-muted-foreground">Notificações</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void testOrderPush()} disabled={pushBusy || !pushEnabled || pushBlockedUntilHomeScreen}>
              Testar
            </Button>
          </div>
        )}
        {pushBlockedUntilHomeScreen && (
          <p className="max-w-sm rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-4 text-amber-800">
            No iPhone, instale o site na Tela de Início pelo Safari e abra o ícone do app. Só então o botão de notificações ficará disponível.
          </p>
        )}
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Filter className="mr-2 h-4 w-4" />
          Filtros
        </Button>
      </div>

      {newOrders.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Megaphone className="h-5 w-5" />
          <span>{newOrders.length} pedido(s) novo(s) aguardando atendimento. Confira a coluna Novos.</span>
        </div>
      )}

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex h-full min-w-max gap-3">
          {isLoading ? (
            <div className="flex h-40 w-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : (
            KANBAN_COLUMNS.map((column) => {
              const columnOrders = getColumnOrders(column.id);
              return (
                <div key={column.id} className="flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/50 lg:w-[17rem] xl:w-[18rem]">
                  <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
                    <h3 className="text-sm font-semibold text-foreground">{column.label}</h3>
                    <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-normal">
                      {columnOrders.length}
                    </Badge>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
                    {columnOrders.map((order) => {
                      const config = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                      return (
                        <div key={order.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/50 lg:gap-1.5 lg:p-2.5">
                          <div className="flex items-start justify-between">
                            <span className="font-mono text-xs text-muted-foreground">#{order.id.toString().padStart(4, "0")}</span>
                            <Badge variant="outline" className={`border px-1.5 py-0 text-[10px] ${config?.color || ""}`}>
                              {config?.label || order.status}
                            </Badge>
                          </div>

                          <div>
                            <h4 className="line-clamp-1 text-sm font-medium text-foreground">{order.customerName || "Cliente não informado"}</h4>
                            {order.deliveryDate && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {order.deliveryType === "delivery" ? "Entrega" : "Retirada"}: {format(new Date(order.deliveryDate), "dd 'de' MMM", { locale: ptBR })}{order.deliveryTime && ` às ${order.deliveryTime}`}
                              </p>
                            )}
                            <div className="mt-1.5 space-y-0.5 border-l-2 border-primary/40 pl-2">
                              {order.items?.length ? order.items.map((item) => (
                                <div key={item.id}>
                                  <p className="break-words text-[11px] leading-snug font-medium text-foreground">{item.quantity}x {item.productName}</p>
                                  {item.notes && <p className="text-[10px] leading-snug text-muted-foreground">{item.notes}</p>}
                                </div>
                              )) : (
                                <p className="text-[11px] text-muted-foreground">Nenhum produto informado</p>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod : "A combinar"}
                              <span aria-hidden="true"> · </span>
                              <span className={order.paymentStatus === "paid" ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
                                {order.paymentStatus === "paid" ? "Recebido" : "Pendente"}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between border-t border-border pt-2">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              {order.deliveryType === "delivery" ? <Truck className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                              {order.deliveryType === "delivery" ? "Entrega" : "Retirada"}
                            </span>
                            <span className="text-sm font-semibold text-primary">{formatCurrency(order.total)}</span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {nextActions(order).map((action) => (
                              <Button
                                key={action.status}
                                size="sm"
                                variant={action.variant === "destructive" ? "destructive" : action.variant ?? "outline"}
                                onClick={() => changeStatus(order, action.status)}
                                disabled={updateStatus.isPending}
                                title={action.label}
                                aria-label={action.label}
                                className="h-8 gap-1.5 px-2 text-[11px] lg:h-7 lg:w-7 lg:gap-0 lg:px-0"
                              >
                                <action.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="lg:sr-only">{action.label}</span>
                              </Button>
                            ))}
                            {order.status === "delivered" && order.paymentStatus !== "paid" && (
                              <Button
                                size="sm"
                                onClick={() => void confirmOrderPayment(order)}
                                disabled={paymentBusyId === order.id}
                                title="Confirmar pagamento recebido"
                                aria-label="Confirmar pagamento recebido"
                                className="h-8 gap-1.5 px-2 text-[11px] lg:h-7 lg:w-7 lg:px-0"
                              >
                                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="lg:sr-only">{paymentBusyId === order.id ? "Confirmando..." : "Confirmar pagamento"}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {columnOrders.length === 0 && (
                      <div className="flex flex-1 items-center justify-center p-4 text-center">
                        <p className="text-xs text-muted-foreground">Nenhum pedido</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

