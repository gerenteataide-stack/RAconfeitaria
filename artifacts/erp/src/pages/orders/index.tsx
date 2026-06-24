import { useListOrders, useUpdateOrderStatus } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, Clock, MapPin, Package, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG = {
  new: { label: "Novo", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Package },
  awaiting_payment: { label: "Aguardando Pagto", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  paid: { label: "Pago", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: Check },
  production: { label: "Em Produção", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Clock },
  ready: { label: "Pronto", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: Package },
  out_for_delivery: { label: "Saiu Entrega", color: "bg-orange-100 text-orange-800 border-orange-200", icon: MapPin },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-800 border-green-200", icon: Check },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800 border-red-200", icon: X },
};

const KANBAN_COLUMNS = [
  { id: "new", label: "Novos" },
  { id: "paid", label: "Pagos" },
  { id: "production", label: "Produção" },
  { id: "ready", label: "Prontos" },
  { id: "out_for_delivery", label: "Em Entrega" },
];

export default function Orders() {
  const { data: orders, isLoading } = useListOrders();

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getColumnOrders = (statusId: string) => {
    if (!orders) return [];
    if (statusId === "new") return orders.filter(o => o.status === "new" || o.status === "awaiting_payment");
    return orders.filter(o => o.status === statusId);
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-3rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">Pedidos</h1>
          <p className="text-muted-foreground mt-1">Gerencie o fluxo de encomendas do seu ateliê.</p>
        </div>
        <Link href="/orders/new">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6">
            <Plus className="mr-2 h-4 w-4" />
            Novo Pedido
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 bg-card p-2 rounded-xl shadow-sm border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente ou ID..." 
            className="pl-9 border-none bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="w-px h-6 bg-border mx-2"></div>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Filter className="h-4 w-4 mr-2" />
          Filtros
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 h-full min-w-max">
          {isLoading ? (
            <div className="w-full flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            KANBAN_COLUMNS.map(col => {
              const colOrders = getColumnOrders(col.id);
              return (
                <div key={col.id} className="w-80 flex flex-col bg-muted/50 rounded-xl border border-border overflow-hidden">
                  <div className="p-3 border-b border-border bg-card flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-foreground">{col.label}</h3>
                    <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-normal">
                      {colOrders.length}
                    </Badge>
                  </div>
                  <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-3">
                    {colOrders.map(order => {
                      const config = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                      return (
                        <div key={order.id} className="bg-card p-4 rounded-xl shadow-sm border border-border flex flex-col gap-3 cursor-pointer hover:border-primary/50 transition-colors">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-mono text-muted-foreground">#{order.id.toString().padStart(4, '0')}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${config?.color || ''}`}>
                              {config?.label || order.status}
                            </Badge>
                          </div>
                          
                          <div>
                            <h4 className="font-medium text-sm text-foreground line-clamp-1">{order.customerName || "Cliente não informado"}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Entrega: {format(new Date(order.deliveryDate), "dd 'de' MMM", { locale: ptBR })}
                              {order.deliveryTime && ` às ${order.deliveryTime}`}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1 pt-3 border-t border-border">
                            <span className="text-xs text-muted-foreground">{order.deliveryType === 'delivery' ? 'Delivery' : 'Retirada'}</span>
                            <span className="text-sm font-semibold text-primary">{formatCurrency(order.total)}</span>
                          </div>
                        </div>
                      )
                    })}
                    {colOrders.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-center p-4">
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
