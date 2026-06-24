import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  ChefHat, 
  Box, 
  BookOpen, 
  DollarSign, 
  Settings,
  Store
} from "lucide-react";
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
  SidebarProvider
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pedidos", url: "/orders", icon: ShoppingCart },
  { title: "Clientes", url: "/customers", icon: Users },
  { title: "Produtos", url: "/products", icon: Package },
  { title: "Produção", url: "/production", icon: ChefHat },
  { title: "Estoque", url: "/stock", icon: Box },
  { title: "Fichas Técnicas", url: "/recipes", icon: BookOpen },
  { title: "Financeiro", url: "/financial", icon: DollarSign },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const STORE_LINK = { title: "Ver Loja Pública", url: "/cardapio", icon: Store };

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <Sidebar className="border-r border-sidebar-border bg-sidebar">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <img src="/logo.jpeg" alt="Logo" className="w-9 h-9 rounded-full object-cover shrink-0" />
              <div>
                <h1 className="text-base font-serif font-bold text-primary leading-tight">Rochele Ataide</h1>
                <p className="text-xs text-muted-foreground">Confeitaria</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
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
        <SidebarFooter className="p-3 border-t border-sidebar-border">
          <SidebarMenu>
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
        <main className="flex-1 flex flex-col p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
