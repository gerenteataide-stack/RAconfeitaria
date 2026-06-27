import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  Clock,
  Filter,
  MapPin,
  Package,
  Plus,
  Search,
  Truck,
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const { data: orders = [], isLoading } = useListOrders(selectedDate ? { date: selectedDate } : undefined);
  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListOrdersQueryKey(selectedDate ? { date: selectedDate } : undefined) });
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

      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="relative flex-1">
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
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Filter className="mr-2 h-4 w-4" />
          Filtros
        </Button>
      </div>

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
