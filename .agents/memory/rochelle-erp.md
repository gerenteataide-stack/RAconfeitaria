---
name: Rochelle Ataidê Confeitaria ERP
description: Full-stack confectionery ERP — key architecture decisions and sharp edges
---

## Stack
- Frontend: React Vite at `/` (artifacts/erp)
- Backend: Express 5 API server at `/api` (artifacts/api-server)
- DB: Drizzle ORM + PostgreSQL (lib/db)
- API contract: OpenAPI spec → Orval codegen (lib/api-spec)

## Modules built
Dashboard, Pedidos (orders), Clientes (CRM), Produtos, Produção, Estoque, Fichas Técnicas (recipes), Financeiro

## Brand colors (use exactly)
- Primary: #7B2E68 (plum purple)
- Secondary: #8A9A75 (sage green)
- Background: #FFF9FC

## Key schema files
- lib/db/src/schema/ — one file per domain (categories, products, customers, orders, production, stock, recipes, financial)
- All numeric DB columns use `numeric` type; always cast to String() when inserting, Number() when reading

## Sharp edges
- numeric columns from Drizzle come back as strings — always Number(value) in route handlers before JSON response
- Order total is calculated in the POST /orders route, not passed from client
- CMV and costs auto-calculated from recipe ingredients + stock item unit costs
- Financial DRE uses 60/40 split estimate for product cost vs expenses (no dedicated cost categorization yet)

**Why numeric casting:** Drizzle returns numeric/decimal columns as JS strings to preserve precision. Route handlers must cast to Number() before returning JSON or the frontend gets string values for currency fields.
