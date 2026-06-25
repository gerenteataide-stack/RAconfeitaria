import { Link, useLocation } from "wouter";
import {
  Bell,
  BookOpen,
  Box,
  ChefHat,
  DollarSign,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/auth";

const NAV_ITEMS = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { title: "Pedidos", url: "/orders", icon: ShoppingCart, permission: "orders" },
  { title: "Clientes", url: "/customers", icon: Users, permission: "customers" },
  { title: "Produtos", url: "/products", icon: Package, permission: "products" },
  { title: "Producao", url: "/production", icon: ChefHat, permission: "production" },
  { title: "Estoque", url: "/stock", icon: Box, permission: "stock" },
  { title: "Fichas Tecnicas", url: "/recipes", icon: BookOpen, permission: "recipes" },
  { title: "Financeiro", url: "/financial", icon: DollarSign, permission: "financial" },
  { title: "Marketing", url: "/marketing", icon: Megaphone, permission: "marketing" },
  { title: "Delivery", url: "/delivery", icon: Truck, permission: "delivery" },
  { title: "Notificacoes", url: "/notifications", icon: Bell, permission: "notifications" },
  { title: "Configuracoes", url: "/settings", icon: Settings, permission: "*" },
  { title: "Usuarios", url: "/users", icon: Users, permission: "*" },
];

const STORE_LINK = { title: "Ver Loja Publica", url: "/cardapio", icon: Store };

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, can, logout } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar className="border-r border-sidebar-border bg-sidebar">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="h-10 w-10 shrink-0 object-contain" />
              <div>
                <h1 className="font-serif text-base font-bold leading-tight text-primary">Rochelle Ataide</h1>
                <p className="text-xs text-muted-foreground">Confeitaria</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location.startsWith(item.url)}>
                        <Link href={item.url} className="flex items-center gap-3">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-3">
            <SidebarMenu>
              {user && (
                <SidebarMenuItem>
                  <div className="mb-3 rounded-md border border-sidebar-border bg-white/70 p-3">
                    <p className="truncate text-sm font-medium text-primary">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.roleLabel}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={logout}>
                      Sair
                    </Button>
                  </div>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href={STORE_LINK.url} className="flex items-center gap-3 text-xs font-medium" style={{ color: "#8A9A75" }}>
                    <STORE_LINK.icon className="h-4 w-4" />
                    <span>{STORE_LINK.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <main className="flex flex-1 flex-col overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
