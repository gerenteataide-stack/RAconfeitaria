import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Instagram, LayoutDashboard, MapPin, Phone, ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/cart";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import logo from "/logo.png";

type PublicSettings = {
  businessName: string;
  businessSubtitle: string;
  businessDescription: string;
  whatsappNumber: string;
  instagram: string;
  location: string;
  serviceNote: string;
};

export function StoreLayout({ children }: { children: React.ReactNode }) {
  const { count } = useCart();
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => apiRequest<PublicSettings>("/api/settings/public"),
  });

  const businessName = settings?.businessName ?? "Rochelle Ataide";
  const businessSubtitle = settings?.businessSubtitle ?? "Confeitaria Artesanal";
  const businessDescription = settings?.businessDescription ?? "Confeitaria artesanal feita com amor e dedicação.";
  const whatsappNumber = settings?.whatsappNumber || "(11) 98765-4321";
  const instagram = settings?.instagram ?? "@rochelleataideconfeitaria";
  const location = settings?.location ?? "São Paulo, SP";
  const serviceNote = settings?.serviceNote ?? "Atendimento com hora marcada";

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#FFF9FC" }}>
      <header className="sticky top-0 z-50 border-b border-pink-100 bg-white/90 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/cardapio">
            <div className="group flex cursor-pointer items-center gap-2">
              <img src={logo} alt={`${businessName} ${businessSubtitle}`} className="h-11 w-11 object-contain" />
              <div>
                <h1 className="font-serif text-sm font-bold leading-tight" style={{ color: "#7B2E68" }}>
                  {businessName}
                </h1>
                <p className="text-xs leading-tight text-muted-foreground">{businessSubtitle}</p>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <button className="hidden items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </button>
            </Link>
            <Link href="/cardapio/checkout">
              <button
                className="relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#7B2E68" }}
              >
                <ShoppingCart className="h-4 w-4" />
                <span>Ver carrinho</span>
                {count > 0 && (
                  <Badge className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-0 bg-amber-400 p-0 text-xs text-amber-900">
                    {count}
                  </Badge>
                )}
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t border-pink-100 bg-white py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 text-sm text-muted-foreground sm:grid-cols-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <img src={logo} alt="Logo" className="h-9 w-9 object-contain" />
              <h3 className="font-semibold" style={{ color: "#7B2E68" }}>{businessName}</h3>
            </div>
            <p>{businessDescription}</p>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-foreground">Contato</h3>
            <div className="mb-1 flex items-center gap-2"><Phone className="h-3 w-3" />{whatsappNumber}</div>
            <div className="flex items-center gap-2"><Instagram className="h-3 w-3" />{instagram}</div>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-foreground">Localização</h3>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{location}<br />{serviceNote}</span>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-5xl border-t border-pink-50 px-4 pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {businessName} {businessSubtitle}. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
