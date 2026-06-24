import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";

import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders/index";
import NewOrder from "@/pages/orders/new";
import Customers from "@/pages/customers";
import Products from "@/pages/products";
import Production from "@/pages/production";
import Stock from "@/pages/stock";
import Recipes from "@/pages/recipes";
import Financial from "@/pages/financial";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
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
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
