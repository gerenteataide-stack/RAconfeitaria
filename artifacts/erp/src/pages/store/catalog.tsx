import { useState } from "react";
import { useLocation } from "wouter";
import { ShoppingCart, Plus, Minus, Cake, Star, Search } from "lucide-react";
import { useListProducts } from "@workspace/api-client-react";
import { useListCategories } from "@workspace/api-client-react";
import { useCart } from "@/contexts/cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function StoreCatalog() {
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const { data: categories = [] } = useListCategories();
  const { data: allProducts = [] } = useListProducts({ available: true });
  const { items, addItem, removeItem, updateQuantity, total, count } = useCart();

  const products = allProducts.filter((p) => {
    const matchesCat = selectedCategory == null || p.categoryId === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  function getQty(productId: number) {
    return quantities[productId] ?? 1;
  }

  function setQty(productId: number, qty: number) {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(1, qty) }));
  }

  function handleAdd(product: (typeof allProducts)[0]) {
    addItem({
      productId: product.id,
      productName: product.name,
      quantity: getQty(product.id),
      unitPrice: Number(product.price),
    });
    setCartOpen(true);
  }

  const cartInCart = (id: number) => items.find((i) => i.productId === id);

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden py-16 px-4 text-center" style={{ background: "linear-gradient(135deg, #7B2E68 0%, #9B3E88 50%, #8A9A75 100%)" }}>
        <div className="absolute inset-0 opacity-10">
          {["🎂","🍰","🧁","🍫","✨"].map((e, i) => (
            <span key={i} className="absolute text-4xl select-none" style={{ top: `${10 + i * 18}%`, left: `${5 + i * 20}%`, transform: `rotate(${i * 15 - 30}deg)` }}>{e}</span>
          ))}
        </div>
        <div className="relative">
          <Badge className="mb-4 text-xs font-medium border-white/30 text-white bg-white/20 backdrop-blur-sm">
            ✨ Encomendas artesanais
          </Badge>
          <div className="flex items-center justify-center mb-4">
            <img src="/logo.jpeg" alt="Rochele Ataide" className="w-20 h-20 rounded-full object-cover border-4 border-white/30 shadow-lg" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-white mb-3">
            Cardapio
          </h1>
          <p className="text-white/80 text-lg max-w-md mx-auto">
            Bolos, tortas e doces feitos com amor. Escolha, encomendar e simples!
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Search + Cart button */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              className="pl-9 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button className="relative gap-2 shrink-0" style={{ backgroundColor: "#7B2E68" }}>
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">Carrinho</span>
                {count > 0 && (
                  <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs rounded-full bg-amber-400 text-amber-900 border-0">
                    {count}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" style={{ color: "#7B2E68" }} />
                  Seu carrinho
                </SheetTitle>
              </SheetHeader>
              {items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <Cake className="w-12 h-12 opacity-30" />
                  <p className="text-sm">Seu carrinho está vazio</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto space-y-3 py-4">
                    {items.map((item) => (
                      <div key={item.productId} className="bg-pink-50 rounded-xl p-3">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-sm leading-tight pr-2">{item.productName}</p>
                          <button onClick={() => removeItem(item.productId)} className="text-muted-foreground hover:text-destructive text-xs shrink-0">✕</button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="w-6 h-6 rounded-full border flex items-center justify-center hover:bg-white transition-colors">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="w-6 h-6 rounded-full border flex items-center justify-center hover:bg-white transition-colors">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: "#7B2E68" }}>{fmt(item.subtotal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <Separator className="mb-4" />
                    <div className="flex justify-between font-bold text-lg mb-4">
                      <span>Total</span>
                      <span style={{ color: "#7B2E68" }}>{fmt(total)}</span>
                    </div>
                    <Button className="w-full text-base py-5" style={{ backgroundColor: "#7B2E68" }}
                      onClick={() => { setCartOpen(false); navigate("/cardapio/checkout"); }}>
                      Finalizar pedido →
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Frete calculado na finalização
                    </p>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap mb-8">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${selectedCategory == null ? "text-white border-transparent shadow-sm" : "bg-white border-pink-100 text-muted-foreground hover:border-pink-200"}`}
            style={selectedCategory == null ? { backgroundColor: "#7B2E68" } : {}}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${selectedCategory === cat.id ? "text-white border-transparent shadow-sm" : "bg-white border-pink-100 text-muted-foreground hover:border-pink-200"}`}
              style={selectedCategory === cat.id ? { backgroundColor: "#7B2E68" } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Cake className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((product) => {
              const inCart = cartInCart(product.id);
              return (
                <div key={product.id}
                  className="bg-white rounded-2xl border border-pink-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  {/* Product image placeholder */}
                  <div className="h-44 flex items-center justify-center relative"
                    style={{ background: "linear-gradient(135deg, #FFF0F8 0%, #F8F0FF 100%)" }}>
                    <Cake className="w-16 h-16 opacity-20" style={{ color: "#7B2E68" }} />
                    <div className="absolute top-3 right-3">
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-amber-700 font-medium">4.9</span>
                      </div>
                    </div>
                    {inCart && (
                      <div className="absolute top-3 left-3">
                        <Badge className="text-xs" style={{ backgroundColor: "#7B2E68" }}>
                          {inCart.quantity} no carrinho
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold text-base mb-1 leading-tight">{product.name}</h3>
                    {product.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-1">{product.description}</p>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-2">
                      <span className="text-xl font-bold" style={{ color: "#7B2E68" }}>
                        {fmt(Number(product.price))}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQty(product.id, getQty(product.id) - 1)}
                          className="w-7 h-7 rounded-full border border-pink-200 flex items-center justify-center hover:bg-pink-50 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-sm font-medium">{getQty(product.id)}</span>
                        <button
                          onClick={() => setQty(product.id, getQty(product.id) + 1)}
                          className="w-7 h-7 rounded-full border border-pink-200 flex items-center justify-center hover:bg-pink-50 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <Button
                      className="w-full mt-3 text-sm gap-2"
                      style={{ backgroundColor: "#7B2E68" }}
                      onClick={() => handleAdd(product)}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Adicionar ao carrinho
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
