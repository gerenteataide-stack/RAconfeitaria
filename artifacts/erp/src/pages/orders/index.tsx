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
import { getCurrentOrderPushToken, registerOrderPush, removeOrderPushToken } from "@/lib/firebase-push";

function playOrderAlert(context: AudioContext) {
  const startedAt = context.currentTime;
  [880, 660].forEach((frequency, index) => {
    const startAt = startedAt + index * 0.2;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(0.08, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.17);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.18);
  });
}

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

const KANBAN_COLUMNS = [
  { id: "new", label: "Novos" },
  { id: "paid", label: "Pagos" },
  { id: "production", label: "Produção" },
  { id: "ready", label: "Prontos" },
  { id: "out_for_delivery", label: "Em entrega" },
  { id: "delivered", label: "Entregues" },
  { id: "cancelled", label: "Cancelados" },
];

function nextActions(order: Order): Array<{ label: string; status: OrderStatusUpdateStatus; variant?: "default" | "outline" | "destructive" }> {
  const actions: Array<{ label: string; status: OrderStatusUpdateStatus; variant?: "default" | "outline" | "destructive" }> = [];
  if (order.status === "new" || order.status === "awaiting_payment") actions.push({ label: "Marcar pago", status: "paid" });
  if (order.status === "paid") actions.push({ label: "Produção", status: "production" });
  if (order.status === "production") actions.push({ label: "Pronto", status: "ready" });
  if (order.status === "ready" && order.deliveryType === "delivery") actions.push({ label: "Saiu", status: "out_for_delivery", variant: "outline" });
  if (order.status === "ready" || order.status === "out_for_delivery") actions.push({ label: "Entregue", status: "delivered" });
  if (order.status !== "cancelled" && order.status !== "delivered") actions.push({ label: "Cancelar", status: "cancelled", variant: "destructive" });
  return actions;
}

export default function Orders() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderSoundEnabled, setOrderSoundEnabled] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem("ra-order-push-enabled") === "true");
  const [pushBusy, setPushBusy] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
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
    if (orderSnapshotRef.current.date !== selectedDate) {
      orderSnapshotRef.current = { date: selectedDate, ids: null };
    }
    if (isLoading) return;

    const currentIds = new Set(orders.map((order) => order.id));
    const previousIds = orderSnapshotRef.current.ids;
    const arrivals = previousIds
      ? orders.filter((order) => !previousIds.has(order.id) && (order.status === "new" || order.status === "awaiting_payment"))
      : [];
    const context = audioContextRef.current;

    if (orderSoundEnabled && arrivals.length > 0 && context) {
      void context.resume().then(() => playOrderAlert(context));
      toast({ title: "Novo pedido recebido", description: `${arrivals.length} pedido(s) novo(s).` });
    }
    orderSnapshotRef.current = { date: selectedDate, ids: currentIds };
  }, [orders, isLoading, selectedDate, orderSoundEnabled, toast]);

  async function toggleOrderSound(enabled: boolean) {
    setOrderSoundEnabled(enabled);
    try {
      if (!enabled) return;

      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      await context.resume();
      playOrderAlert(context);
      toast({ title: "Som de pedidos ativado" });
    } catch {
      setOrderSoundEnabled(false);
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
        description: error instanceof Error ? error.message : "Tente novamente neste navegador.",
        variant: "destructive",
      });
    } finally {
      setPushBusy(false);
    }
  }

  function changeStatus(order: Order, status: OrderStatusUpdateStatus) {
    updateStatus.mutate({ id: order.id, data: { status } });
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
            <Switch aria-label="Ativar notificações de pedidos" checked={pushEnabled} onCheckedChange={toggleOrderPush} disabled={pushBusy} />
            <span className="text-sm text-muted-foreground">Notificações</span>
          </div>
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
        <div className="flex h-full min-w-max gap-4">
          {isLoading ? (
            <div className="flex h-40 w-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : (
            KANBAN_COLUMNS.map((column) => {
              const columnOrders = getColumnOrders(column.id);
              return (
                <div key={column.id} className="flex w-80 flex-col overflow-hidden rounded-xl border border-border bg-muted/50">
                  <div className="flex items-center justify-between border-b border-border bg-card p-3">
                    <h3 className="text-sm font-semibold text-foreground">{column.label}</h3>
                    <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-normal">
                      {columnOrders.length}
                    </Badge>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
                    {columnOrders.map((order) => {
                      const config = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                      return (
                        <div key={order.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50">
                          <div className="flex items-start justify-between">
                            <span className="font-mono text-xs text-muted-foreground">#{order.id.toString().padStart(4, "0")}</span>
                            <Badge variant="outline" className={`border px-1.5 py-0 text-[10px] ${config?.color || ""}`}>
                              {config?.label || order.status}
                            </Badge>
                          </div>

                          <div>
                            <h4 className="line-clamp-1 text-sm font-medium text-foreground">{order.customerName || "Cliente não informado"}</h4>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Data: {format(new Date(order.deliveryDate), "dd 'de' MMM", { locale: ptBR })}
                              {order.deliveryTime && ` às ${order.deliveryTime}`}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Pagamento: {order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod : "A combinar"}
                            </p>
                          </div>

                          <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              {order.deliveryType === "delivery" ? <Truck className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                              {order.deliveryType === "delivery" ? "Entrega" : "Retirada"}
                            </span>
                            <span className="text-sm font-semibold text-primary">{formatCurrency(order.total)}</span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {nextActions(order).map((action) => (
                              <Button
                                key={action.status}
                                size="sm"
                                variant={action.variant === "destructive" ? "destructive" : action.variant ?? "outline"}
                                onClick={() => changeStatus(order, action.status)}
                                disabled={updateStatus.isPending}
                                className="h-8 text-xs"
                              >
                                {action.label}
                              </Button>
                            ))}
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

