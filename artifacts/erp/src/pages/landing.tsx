import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Cake, Instagram, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { type Product, useListProducts } from "@workspace/api-client-react";
import { apiRequest } from "@/lib/api";

type PublicSettings = {
  businessName: string;
  businessSubtitle: string;
  businessDescription: string;
  whatsappNumber: string;
  instagram: string;
  location: string;
  serviceNote: string;
};

function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getWhatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}?text=${encodeURIComponent("Olá! Quero fazer um pedido.")}`;
}

function getInstagramUrl(value: string) {
  const handle = value.trim();
  if (!handle) return "";
  if (/^https?:\/\//i.test(handle)) return handle;
  return `https://www.instagram.com/${handle.replace(/^@/, "")}/`;
}

function productHasPhoto(product: Product) {
  return Boolean(product.imageUrl?.trim());
}

export default function LandingPage() {
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => apiRequest<PublicSettings>("/api/settings/public"),
  });
  const { data: products = [], isLoading } = useListProducts();

  const businessName = settings?.businessName?.trim() || "Rochelle Ataide";
  const subtitle = settings?.businessSubtitle?.trim() || "Confeitaria artesanal";
  const description = settings?.businessDescription?.trim() || "Bolos, doces e momentos especiais feitos com carinho.";
  const whatsappUrl = getWhatsappUrl(settings?.whatsappNumber ?? "");
  const instagramUrl = getInstagramUrl(settings?.instagram ?? "");
  const featuredProducts = products
    .filter((product) => product.available)
    .sort((first, second) => Number(productHasPhoto(second)) - Number(productHasPhoto(first)))
    .slice(0, 6);

  return (
    <main className="min-h-screen overflow-hidden bg-[#FFF9FC] text-[#2C2C2C]">
      <section className="relative isolate flex min-h-[82svh] items-center overflow-hidden px-5 pb-20 pt-6 sm:px-8 lg:px-16">
        <div className="absolute inset-0 -z-20 bg-[#FFF9FC]" />
        <img
          src="/confeiteira-rochelle.png"
          alt={`Confeiteira ${businessName}`}
          className="pointer-events-none absolute -right-28 bottom-0 -z-10 h-[72%] max-w-none object-contain opacity-40 sm:right-0 sm:h-[82%] sm:opacity-60 lg:right-[4%] lg:h-[94%] lg:opacity-100"
        />

        <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-16">
          <a href="/" className="flex min-w-0 items-center gap-3" aria-label={`${businessName}, página inicial`}>
            <img src="/logo.png" alt="" className="h-11 w-11 object-contain" />
            <span className="min-w-0">
              <span className="block truncate font-serif text-sm font-bold text-[#7B2E68] sm:text-base">{businessName}</span>
              <span className="block text-xs text-[#66735B]">{subtitle}</span>
            </span>
          </a>
          <a
            href="/cardapio"
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#7B2E68] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#642455]"
          >
            <span>Fazer pedido</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </header>

        <div className="relative z-10 mx-auto w-full max-w-7xl pt-24 lg:pt-16">
          <div className="w-[70%] max-w-2xl sm:w-[60%] lg:w-full">
            <div className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#7A8B68]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Feito à mão, para celebrar</span>
            </div>
            <h1 className="max-w-xl font-serif text-4xl font-bold leading-tight text-[#43243D] sm:text-5xl lg:text-6xl">
              {businessName}
            </h1>
            <p className="mt-3 text-lg font-medium text-[#7B2E68] sm:text-xl">{subtitle}</p>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#51464E] sm:text-lg">{description}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/cardapio"
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-[#7B2E68] px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#642455]"
              >
                Ver cardápio e pedir
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#produtos"
                className="inline-flex min-h-12 items-center rounded-md border border-[#7A8B68]/50 bg-white/70 px-5 text-sm font-semibold text-[#46513C] transition-colors hover:bg-white"
              >
                Conhecer os produtos
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[#544A51]">
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-[#7B2E68]">
                  <MessageCircle className="h-4 w-4 text-[#7A8B68]" aria-hidden="true" /> WhatsApp
                </a>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-[#7B2E68]">
                  <Instagram className="h-4 w-4 text-[#7A8B68]" aria-hidden="true" /> Instagram
                </a>
              )}
              {settings?.location && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#7A8B68]" aria-hidden="true" /> {settings.location}
                </span>
              )}
            </div>
          </div>
        </div>
        <a href="#produtos" className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-xs font-medium text-[#66735B] hover:text-[#7B2E68]">
          Descubra os sabores
        </a>
      </section>

      <section id="produtos" className="scroll-mt-6 border-t border-[#7B2E68]/10 bg-white px-5 py-16 sm:px-8 lg:px-16 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#7A8B68]">Um pouco do nosso trabalho</p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-[#43243D] sm:text-4xl">Escolha seu próximo favorito</h2>
            </div>
            <a href="/cardapio" className="inline-flex items-center gap-2 text-sm font-semibold text-[#7B2E68] hover:underline">
              Ver todos os produtos <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Carregando produtos">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="aspect-[4/5] animate-pulse bg-[#F3EDF1]" />
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {featuredProducts.map((product) => (
                <a
                  key={product.id}
                  href={`/cardapio#produto-${product.id}`}
                  aria-label={`Ver ${product.name} no cardápio`}
                  className="group min-w-0"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#F6F0F3]">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#7B2E68]/40">
                        <Cake className="h-12 w-12" aria-hidden="true" />
                      </div>
                    )}
                    <span className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between bg-[#43243D]/90 px-3 py-3 text-xs font-semibold text-white transition-transform group-hover:translate-y-0 group-focus-visible:translate-y-0">
                      Abrir no cardápio <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2 py-3">
                    <span className="line-clamp-2 text-sm font-semibold text-[#3F353D]">{product.name}</span>
                    <span className="shrink-0 text-sm font-bold text-[#7B2E68]">{formatPrice(Number(product.price))}</span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="border-y border-[#7B2E68]/10 py-12 text-center">
              <Cake className="mx-auto h-9 w-9 text-[#7A8B68]" aria-hidden="true" />
              <p className="mt-3 font-medium text-[#51464E]">Os produtos da loja aparecerão aqui.</p>
              <a href="/cardapio" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#7B2E68] hover:underline">
                Acessar o cardápio <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </section>

      <section className="bg-[#43243D] px-5 py-12 text-white sm:px-8 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[#D9C4D3]">Seu momento merece um doce especial</p>
            <h2 className="mt-2 font-serif text-2xl font-bold sm:text-3xl">Vamos preparar seu pedido?</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/cardapio" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-[#43243D] hover:bg-[#FFF0F8]">
              Fazer pedido <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Conversar pelo WhatsApp" className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/40 text-white hover:bg-white/10">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </a>
            )}
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Abrir Instagram" className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/40 text-white hover:bg-white/10">
                <Instagram className="h-5 w-5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="bg-[#FFF9FC] px-5 py-6 text-center text-xs text-[#655B62] sm:px-8">
        <p>{businessName} · {subtitle}{settings?.serviceNote ? ` · ${settings.serviceNote}` : ""}</p>
      </footer>
    </main>
  );
}
