# Rochelle Ataidê Confeitaria — ERP

Plataforma ERP completa para a Rochelle Ataidê Confeitaria Artesanal: gestão de pedidos, clientes, produção, estoque, fichas técnicas e financeiro em um único sistema.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/erp run dev` — run the frontend (port 18996, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui (artifacts/erp)
- API: Express 5 (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in lib/api-spec/openapi.yaml)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (one file per domain)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/erp/src/` — React frontend
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks (DO NOT edit)
- `lib/api-zod/src/generated/` — auto-generated Zod schemas (DO NOT edit)

## Architecture decisions

- Contract-first: OpenAPI spec → Orval codegen → typed hooks + Zod schemas. Never hand-write types that codegen produces.
- All numeric DB columns (price, cost, quantity, amount) use Drizzle `numeric` type. Always cast to `String()` on insert and `Number()` on read in route handlers.
- Order total calculated server-side in POST /orders route (sum of items × qty + delivery fee).
- CMV auto-calculated from recipe ingredients cost ÷ product price × 100.
- Brand colors: Primary #7B2E68 (plum), Secondary #8A9A75 (sage), Background #FFF9FC.

## Product

- **Dashboard Executivo** — KPIs em tempo real, gráfico de vendas 30 dias, top produtos
- **Pedidos** — pipeline visual com 8 status (Novo → Entregue), criar/editar pedidos
- **Clientes (CRM)** — cadastro completo, histórico de compras, pontos de fidelidade
- **Produtos** — catálogo com categorias, preço, custo, CMV, toggle disponibilidade
- **Produção** — painel diário com status Pendente/Produzindo/Finalizado
- **Estoque** — ingredientes com alertas de estoque baixo e movimentações (entrada/saída)
- **Fichas Técnicas** — receitas com cálculo automático de CMV e custo unitário
- **Financeiro** — contas a receber/pagar, fluxo de caixa, DRE simplificada

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change: run `pnpm --filter @workspace/api-spec run codegen` before touching route handlers or frontend hooks.
- `numeric` columns come back as strings from Drizzle — always `Number(value)` in route handlers before JSON response.
- Express 5 wildcard routes need names: `/{*splat}` not `/*` or `*`.
- `req.params.id` is `string | string[]` in Express 5 — always parse: `Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id)`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
