import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { StoreLayout } from "@/components/store-layout";
import { CartProvider } from "@/contexts/cart";
import { AuthProvider, useAuth } from "@/contexts/auth";

import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders/index";
import NewOrder from "@/pages/orders/new";
import Customers from "@/pages/customers";
import Products from "@/pages/products";
import Production from "@/pages/production";
import Stock from "@/pages/stock";
import Recipes from "@/pages/recipes";
import Financial from "@/pages/financial";
import Marketing from "@/pages/marketing";
import Delivery from "@/pages/delivery";
import Notifications from "@/pages/notifications";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import UsersPage from "@/pages/users";
import NotFound from "@/pages/not-found";

import StoreCatalog from "@/pages/store/catalog";
import StoreCheckout from "@/pages/store/checkout";
import StoreSuccess from "@/pages/store/success";

const queryClient = new QueryClient();

function StoreRouter() {
  return (
    <CartProvider>
      <StoreLayout>
        <Switch>
          <Route path="/cardapio" component={StoreCatalog} />
          <Route path="/cardapio/checkout" component={StoreCheckout} />
          <Route path="/cardapio/sucesso" component={StoreSuccess} />
        </Switch>
      </StoreLayout>
    </CartProvider>
  );
}

function AdminRouter() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando acesso...</div>;
  }
  if (!user) return <Redirect to="/login" />;

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/orders" component={Orders} />
        <Route path="/orders/new" component={NewOrder} />
        <Route path="/customers" component={Customers} />
        <Route path="/products" component={Products} />
        <Route path="/production" component={Production} />
        <Route path="/stock" component={Stock} />
        <Route path="/recipes" component={Recipes} />
        <Route path="/financial" component={Financial} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/delivery" component={Delivery} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/settings" component={Settings} />
        <Route path="/users" component={UsersPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/cardapio" component={StoreRouter} />
      <Route path="/cardapio/:rest*" component={StoreRouter} />
      <Route component={AdminRouter} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
