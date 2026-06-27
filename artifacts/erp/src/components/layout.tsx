import { Link, useLocation } from "wouter";
import {
  BookOpen,
  Box,
  Calculator,
  ChefHat,
  DollarSign,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  ShoppingCart,
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/auth";

const NAV_ITEMS = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { title: "Pedidos", url: "/orders", icon: ShoppingCart, permission: "orders" },
  { title: "Clientes", url: "/customers", icon: Users, permission: "customers" },
  { title: "Produtos", url: "/products", icon: Package, permission: "products" },
  { title: "Produção", url: "/production", icon: ChefHat, permission: "production" },
  { title: "Estoque", url: "/stock", icon: Box, permission: "stock" },
  { title: "Ingredientes", url: "/admin/ingredientes", icon: Box, permission: "pricing" },
  { title: "Fichas Técnicas", url: "/admin/fichas-tecnicas", icon: BookOpen, permission: "pricing" },
  { title: "Custos Gerais", url: "/admin/custos-gerais", icon: Calculator, permission: "pricing" },
  { title: "Precificação", url: "/admin/precificacao", icon: Calculator, permission: "pricing" },
  { title: "Financeiro", url: "/financial", icon: DollarSign, permission: "financial" },
  { title: "Marketing", url: "/marketing", icon: Megaphone, permission: "marketing" },
  { title: "Delivery", url: "/delivery", icon: Truck, permission: "delivery" },
  { title: "Usuários", url: "/users", icon: Users, permission: "users" },
  { title: "Configurações", url: "/settings", icon: Settings, permission: "settings" },
];

function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, can, logout } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const visibleItems = NAV_ITEMS.filter((item) => can(item.permission));

  function closeMobileMenu() {
    if (isMobile) setOpenMobile(false);
  }

  return (
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
                      <Link href={item.url} className="flex items-center gap-3" onClick={closeMobileMenu}>
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
                <div className="rounded-md border border-sidebar-border bg-white/70 p-3">
                  <p className="truncate text-sm font-medium text-primary">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.roleLabel}</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={logout}>
                    Sair
                  </Button>
                </div>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4 md:p-6">
        <div className="mb-4 flex items-center gap-3 md:hidden">
          <SidebarTrigger />
          <div>
            <p className="text-sm font-semibold text-primary">Rochelle Ataide</p>
            <p className="text-xs text-muted-foreground">Menu da gestão</p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutShell>{children}</LayoutShell>
    </SidebarProvider>
  );
}
