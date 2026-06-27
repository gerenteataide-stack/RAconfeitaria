import { useGetDashboardStats, useGetSalesChart, useGetTopProducts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, ShoppingBag, Package, RefreshCw, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, LineChart, Line } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: salesChart, isLoading: chartLoading } = useGetSalesChart();
  const { data: topProducts, isLoading: topProductsLoading } = useGetTopProducts();

  const isLoading = statsLoading || chartLoading || topProductsLoading;

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-serif font-bold text-primary">Dashboard Executivo</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse bg-muted h-32 border-none shadow-sm" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 animate-pulse bg-muted h-96 border-none shadow-sm" />
          <Card className="animate-pulse bg-muted h-96 border-none shadow-sm" />
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary">Dashboard Executivo</h1>
        <p className="text-muted-foreground mt-1">Bem-vinda, Rochelle. Aqui está o resumo da sua confeitaria hoje.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-card hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Hoje</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(stats.revenueToday)}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-success" />
              <span>Mês: <span className="font-medium text-foreground">{formatCurrency(stats.revenueMonth)}</span></span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-card hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Hoje</CardTitle>
            <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.ordersToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Ticket Médio: <span className="font-medium text-foreground">{formatCurrency(stats.avgTicket)}</span></p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-card hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Baixo</CardTitle>
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Itens precisando de reposição</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-card hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Recorrentes</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <RefreshCw className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.recurringCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">CMV Geral: <span className="font-medium text-foreground">{stats.cmvPercent.toFixed(1)}%</span></p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif">Vendas nos últimos 30 dias</CardTitle>
            <CardDescription>Acompanhamento diário de faturamento e volume de pedidos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {salesChart && salesChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      yAxisId="left"
                      tickFormatter={(val) => `R$ ${val / 1000}k`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <RechartsTooltip 
                      formatter={(value: number, name: string) => [
                        name === 'revenue' ? formatCurrency(value) : value, 
                        name === 'revenue' ? 'Faturamento' : 'Pedidos'
                      ]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR')}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    />
                    <Bar yAxisId="left" dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Sem dados suficientes para o gráfico
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif">Top Produtos</CardTitle>
            <CardDescription>Os queridinhos dos clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {topProducts?.slice(0, 5).map((product, i) => (
                <div key={product.id} className="flex items-center gap-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden relative">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="object-cover w-full h-full" />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                      {i + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{product.quantitySold} unidades vendidas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
              {!topProducts?.length && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  Nenhum produto vendido ainda.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
