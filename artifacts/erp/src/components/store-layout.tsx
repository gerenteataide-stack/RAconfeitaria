import { Link } from "wouter";
import { ShoppingCart, MapPin, Phone, Instagram } from "lucide-react";
import { useCart } from "@/contexts/cart";
import { Badge } from "@/components/ui/badge";
import logo from "/logo.jpeg";

export function StoreLayout({ children }: { children: React.ReactNode }) {
  const { count } = useCart();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FFF9FC" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-pink-100 bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/cardapio">
            <div className="flex items-center gap-2 cursor-pointer group">
              <img src={logo} alt="Rochele Ataide Confeitaria Artesanal" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <h1 className="font-serif font-bold text-sm leading-tight" style={{ color: "#7B2E68" }}>
                  Rochele Ataide
                </h1>
                <p className="text-xs text-muted-foreground leading-tight">Confeitaria Artesanal</p>
              </div>
            </div>
          </Link>

          <Link href="/cardapio/checkout">
            <button className="relative flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#7B2E68" }}>
              <ShoppingCart className="w-4 h-4" />
              <span>Ver carrinho</span>
              {count > 0 && (
                <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs rounded-full bg-amber-400 text-amber-900 border-0">
                  {count}
                </Badge>
              )}
            </button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-pink-100 bg-white mt-16 py-10">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm text-muted-foreground">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src={logo} alt="Logo" className="w-8 h-8 rounded-full object-cover" />
              <h3 className="font-semibold" style={{ color: "#7B2E68" }}>Rochele Ataide</h3>
            </div>
            <p>Confeitaria artesanal feita com amor e dedicação.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-foreground">Contato</h3>
            <div className="flex items-center gap-2 mb-1"><Phone className="w-3 h-3" />(11) 98765-4321</div>
            <div className="flex items-center gap-2"><Instagram className="w-3 h-3" />@rochelleataideconfeitaria</div>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-foreground">Localização</h3>
            <div className="flex items-start gap-2"><MapPin className="w-3 h-3 mt-0.5 shrink-0" />São Paulo, SP<br />Atendimento com hora marcada</div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 mt-8 pt-4 border-t border-pink-50 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} Rochele Ataide Confeitaria Artesanal. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
