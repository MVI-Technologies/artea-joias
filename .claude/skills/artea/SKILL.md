---
name: artea
description: Central operating knowledge for the Artea Joias codebase — product domain, business rules, architecture, critical flows, and rules for how an agent should approach changes in this repo. Load this before making any non-trivial change to Artea Joias. Defers to artea-frontend for React/UI specifics and artea-supabase for schema/RLS/Edge Function specifics.
---

# Artea Joias — Project Knowledge

This is the master skill for the **Artea Joias** codebase. It exists so an agent
does not have to rediscover the domain model and business rules from scratch, and
does not silently break invariants that are enforced by convention rather than by
a compiler.

Read this fully before touching pricing, orders/romaneios, lot (grupo de compra)
lifecycle, client approval, or auth. For deep React/UI work, also load
`artea-frontend`. For any schema, RLS, migration, or Edge Function work, also
load `artea-supabase` — it is intentionally the strictest of the three.

Provenance markers used below:
- **[CODE]** — verified by reading the current source/migrations.
- **[README]** — only documented in `README.md`, not independently verified.
- **[DIVERGENCE]** — README/docs say one thing, code does another. These are the
  highest-value facts in this document — do not "fix" the README to match code,
  and do not trust the README over code.

## 1. What this system is

Artea Joias **[CODE+README]** is a B2C system for selling semi-jewelry
("semijoias") through **group buying links** ("grupos de compra" / "lotes" /
"links"). There is exactly **one selling company** — this is not a marketplace,
there are no third-party sellers, and there is no multi-tenant concept anywhere
in the schema (no `tenant_id`/`seller_id` columns exist). All product, pricing,
and business-rule data is controlled by a single administrator role.

A **lot** (`lots` table, called "grupo de compra" or "link" in the UI) is a
time-boxed catalog: the admin creates it, attaches products to it via
`lot_products`, opens it, clients place items in a cart against that lot, the
admin closes it, and a fulfillment pipeline (romaneio → separação → pagamento →
envio → conclusão) runs per client.

Products come in two flavors **[CODE]** (`products.tipo_venda`):
- `individual` — sold one at a time, no minimum.
- `pacote` — sold in fixed-size packages (`products.quantidade_pacote`, e.g. 12
  or 24 units of the same model); a lot can additionally require that a
  fractional/package product reach its minimum before the lot is allowed to
  close (`lots.requer_pacote_fechado`, enforced by
  `check_all_fractional_products_complete()`).

Per-lot, per-product minimums can also be overridden via
`lot_products.qtd_minima_cliente` (falls back to `products.quantidade_minima`).
See `calcPrecoClienteNoLote` / `disponibilidadeLote` in `artea-frontend` and
`artea-supabase` for how price and availability are actually computed.

## 2. Non-negotiable business rules

These are invariants an agent must not break, even incidentally:

1. **Cost and margin are administrator-only data.** `products.custo` (internal
   cost) and `products.margem_pct` never appear in any client-facing UI, and no
   new client-facing query should select them. `products.preco` is the only
   price a `cliente`-role user should ever see or reason about.
   **[DIVERGENCE — already violated in code today, see `artea-supabase` §Sensitive
   Data]**: `src/pages/client/Catalog.jsx` and `src/pages/client/Cart.jsx`
   currently `select()` `custo` and `margem_pct` alongside `preco` on the
   client-facing product join, and RLS does not restrict which *columns* of
   `products` a `cliente`-role row can read (RLS is row-level, not
   column-level; the `products` SELECT policy is `USING (true)` for any
   authenticated user). This means cost/margin are already inspectable today via
   the browser network tab even though no screen renders them. **Do not extend
   this pattern.** If you touch pricing code, prefer computing price
   server-side and avoid adding new `custo`/`margem_pct` selects reachable by a
   `cliente` session. Flag this to the user rather than "fixing" it unprompted,
   since removing the columns from an existing query it may break the
   `calcPrecoClienteNoLote` fallback described in `artea-frontend`.
2. **Clients only ever see the final price**, already inclusive of lot-level
   fees (`escritorio_pct`, `adicional_por_produto`). There is no UI path that
   shows a cliente a pre-fee price alongside the final one.
3. **Unapproved or blocked clients cannot transact.** `clients.approved` (bool)
   gates everything past login: `AuthContext.fetchClientProfile` force-signs-out
   and throws a `PENDING_APPROVAL:` error if a non-admin client's `approved` is
   `false`, and `ProtectedRoute` in `App.jsx` shows a "Cadastro Pendente" screen
   for any authenticated-but-unapproved cliente. New client-facing routes must
   go inside the existing `<ProtectedRoute>` wrapper, not a new ad hoc check.
4. **The catalog a client can shop is entirely a function of the lot**, not of
   a generic product listing. There is no "browse all products" for clients —
   access is always `/app/catalogo/:linkUrl`, resolved through `lots.link_compra`,
   and requires the client to already be authenticated and approved
   (unauthenticated visits to `/catalogo/:linkUrl` redirect to `/login`, they do
   not show a public catalog). **[DIVERGENCE]** README's phrasing ("Acesso via
   Link... através de links únicos") could be read as "no login required" —
   that is not how the routing in `App.jsx` behaves.
5. **A lot's minimum quantity and package rules gate its closing**, not just its
   deadline. `auto_close_lots_by_deadline()` will refuse to close a lot whose
   `requer_pacote_fechado` is true and which has incomplete `pacote` products.
6. **Romaneio generation follows lot closing, not the other way around.**
   Romaneios are actually created earlier, at checkout time (via
   `checkout_romaneio` RPC, one romaneio per client per lot, upserted on repeat
   checkout), and then **recalculated** (fees applied/refreshed) when the lot's
   status transitions `aberto → fechado` (`generate_complete_romaneios_on_lot_close`
   trigger calls `recalculate_romaneio_values` for every romaneio in that lot).
   **[DIVERGENCE]** README's flow (romaneios "generated after group closes")
   undersells that the romaneio row and its line items already exist before
   closing; closing recalculates totals/fees, it doesn't create the order from
   scratch.
7. **"Pedido" (order) is a `romaneios` row, not a row in an `orders` table.**
   The original per-line-item `orders` table was **dropped** in migration 030
   ("Architectural refactor: Orders are Romaneios"). One `romaneios` row = one
   client's full checkout for one lot; `romaneio_items` holds the line items.
   **[DIVERGENCE]** README's "Estrutura do Banco de Dados" section still lists
   `orders` as a current table — it is not. See `artea-supabase` for the full
   current shape and for a stale Edge Function fallback that still queries the
   removed `orders` table.
8. **Payment can be partial.** `romaneio_pagamentos` records individual
   payments against a romaneio; `romaneios.valor_pago` is a trigger-maintained
   cache of their sum, and status values like `pago_50_pct` /
   `pago_50_pct_s_frete` / `parcialmente_pago` exist specifically for
   partial-payment states. Do not assume "pago" is the only "money received"
   state when writing reports or gating shipping.
9. **Never trust the frontend for authorization.** Every admin-only mutation
   must be protected by RLS and/or a `SECURITY DEFINER` RPC that checks role
   server-side — see `artea-supabase` §RLS. Hiding a button is UX, not security.
10. **Reports, romaneios, and integrations read from the same tables you're
    changing.** `lot_products.quantidade_pedidos` / `quantidade_clientes` are
    trigger-maintained off `romaneio_items` + `romaneios.status_pagamento`
    (migration 043) — if you change how items are inserted/cancelled, these
    counters (used for "X peças compradas por Y pessoas" and availability) can
    silently go stale. Financial reports (`get_financial_summary`,
    `report_financial_daily`) and `clients.ultima_compra` (trigger-maintained
    off `romaneios.created_at`) have the same dependency.

## 3. Architecture

```
React 19 + Vite (SPA, client-side routed)
        │  @supabase/supabase-js (anon key, user JWT after login)
        ▼
Supabase Postgres  ──  Auth  ──  Row Level Security
        │
        ├─ RPCs / SECURITY DEFINER functions (checkout_romaneio, update_romaneio_status, ...)
        ├─ Triggers (counters, ultima_compra, valor_pago cache, romaneio recalculation)
        └─ Views (report_financial_daily, ...)
        │
        ▼
Edge Functions (Deno, service_role key — server-side only)
  create-user · update-user · admin-update-password · reset-password
  generate-romaneio-pdf · mercadopago · send-whatsapp · proxy-image · smart-endpoint
        │
        ▼
External services: Correios (frete), Mercado Pago (pagamento), Evolution API (WhatsApp)
```

- **Frontend**: pure SPA, no server-rendering, no API routes of its own. Every
  data access is either a direct `supabase-js` call from the browser (subject
  to RLS) or a `fetch`/`supabase.functions.invoke` to an Edge Function.
- **RLS is the actual authorization boundary**, not the React route guards.
  `ProtectedRoute`/`isAdmin` in the frontend only controls *navigation UX*.
- **Edge Functions exist specifically for operations the anon/user key cannot
  or should not perform**: creating/updating `auth.users` (requires
  `service_role`), generating PDFs, calling out to Mercado Pago/Evolution API
  with secrets that must not reach the browser.
- **Triggers/RPCs carry real business logic** (pricing recalculation, lot
  auto-close, counters, audit log). Do not reimplement this logic in the
  frontend "for convenience" — see `artea-supabase` §Migrations.

## 4. Areas of the system

| Area | Entry point | Guard |
|---|---|---|
| Public/auth | `/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha` | none |
| Client area | `/app/*` (`ClientLayout`) | `ProtectedRoute` (must be authenticated + `approved`) |
| Admin area | `/admin/*` (`AdminLayout`) | `ProtectedRoute requireAdmin` (must be authenticated + `clients.role === 'admin'`) |
| Backend/Supabase | `supabase/migrations`, RPCs, RLS | enforced server-side, independent of the frontend |
| Edge Functions | `supabase/functions/*` | each function does its own auth check — verify per-function, do not assume |
| External integrations | `src/services/integrations/*`, Edge Functions | Correios, Mercado Pago, Evolution API (WhatsApp) |

Admin and client are **separate route trees with separate layouts**
(`AdminLayout`/`Sidebar`/`Header` vs `ClientLayout`) — there is no shared
"dashboard" component that branches on role. When adding a screen, decide which
tree it belongs to; do not add cliente-reachable logic inside `pages/admin/*`
or vice versa.

## 5. Critical flows (as implemented, not just as documented)

1. **Cadastro/login** — Auth is **phone + password**, not email. A synthetic
   email `{digits}@artea.local` is derived from the phone number for
   `supabase.auth`. `Register.jsx` calls `supabase.auth.signUp()` directly with
   registration data in `options.data` (user_metadata); it does **not** insert
   into `clients` itself — the `handle_new_user` trigger on `auth.users` does
   that, defaulting `approved=false`, `cadastro_status='pendente'`.
   **[DIVERGENCE]** `AuthContext.jsx` also exposes a `signUp()` helper that
   manually inserts into `clients` after `auth.signUp()` — this is not what
   `Register.jsx` actually uses and would likely race/duplicate against the
   trigger's `ON CONFLICT (auth_id) DO UPDATE`. Treat it as legacy/dead code,
   not as the canonical signup path.
2. **Client approval** — purely a `clients.approved` flip by an admin
   (`ClientList`/`ClientForm`). No workflow/state machine beyond the boolean +
   `cadastro_status` (`incompleto` | `pendente` | `completo`).
3. **Catalog access** — client navigates to a lot's link
   (`/app/catalogo/:linkUrl`), which resolves via `lots.link_compra`. Product
   list, price, and availability are all lot-scoped (see §6 in `artea-frontend`
   for the exact query shape).
4. **Cart** — client-side cart state, persisted per-user in `localStorage`
   under `cart_*` keys, deliberately wiped on sign-out and on detecting a
   different `session.user.id` than the last owner (`AuthContext` — anti
   cart-leak-between-accounts logic). If you touch cart storage, preserve this
   isolation.
5. **Checkout / romaneio creation** — `checkout_romaneio(p_lot_id, p_items, ...)`
   RPC (`SECURITY DEFINER`): validates the lot is `aberto`, upserts a single
   `romaneios` row per (client, lot), replaces its `romaneio_items`, logs to
   `romaneio_status_log`. Re-checkout on the same lot updates the existing
   romaneio as long as its `status_pagamento` is still an editable/"draft"
   state (`aguardando_pagamento`, `aguardando`, `pendente`, `gerado`, and later
   also the partial-payment drafts `pago_50_pct`/`pago_50_pct_s_frete` —
   evolved across migrations 029→070, always check the **current** function
   body, not an old migration, before relying on which statuses are editable).
6. **Lot closing** — admin (or `auto_close_lots_by_deadline()`) flips
   `lots.status` `aberto → fechado`; a trigger recalculates every romaneio in
   that lot (fees, freight, totals) via `recalculate_romaneio_values`.
7. **Romaneio (packing list) lifecycle** — after closing, admin works through
   `SeparacaoList`/`RomaneioDetail` screens; status progresses through the
   values in `romaneios.status_pagamento` (see `artea-supabase` for the current
   full enum) — this single column carries both "payment status" and, loosely,
   "fulfillment status" (e.g. `em_separacao`, `enviado`, `concluido` are also
   values of `status_pagamento`, not a separate fulfillment column).
8. **Pagamento** — Pix (manual, via `chave_pix` shown to client, or PIX payload
   generated in `generate-romaneio-pdf`) or Mercado Pago (webhook-driven,
   `mercadopago` Edge Function re-verifies the payment against the MP API
   before trusting it, then calls `process_payment_webhook` RPC). Partial
   payments recorded individually in `romaneio_pagamentos`.
9. **Envio** — admin marks the romaneio as shipped (status transition +
   tracking data); no live carrier tracking integration beyond freight
   *calculation* at close time (Correios).
10. **Conclusão** — final status transition; `clients.ultima_compra` is kept in
    sync automatically by trigger, not written by application code.

## 6. Integrations — what to know before touching them

- **Supabase** is not just "the database" — Auth, RLS, RPCs, Storage, and Edge
  Functions are all load-bearing. See `artea-supabase`.
- **Correios**: freight calculation only (`src/services/integrations/correios.js`,
  `023_freight_integration.sql` / `freight_calculations` table), run at lot-close
  time when `lots.calculo_frete_automatico` is set; not a live tracking feed.
- **Mercado Pago**: `@mercadopago/sdk-react` on the frontend for the payment
  brick, `mercadopago` Edge Function as webhook receiver. The webhook always
  re-fetches the payment from MP's API by id before acting — do not change it
  to trust the webhook payload directly, that would reopen a spoofing hole it
  was written to close.
- **WhatsApp**: via Evolution API, `send-whatsapp` Edge Function,
  `whatsapp_messages` table logs sends. Used for group opened/closed, payment
  confirmed, shipped notifications.
- **PDF generation**: there are **two separate PDF code paths** — the
  `generate-romaneio-pdf` Edge Function (Deno, `pdf-lib`, produces the
  romaneio/packing-list PDF with PIX payload) and client-side `jspdf` +
  `jspdf-autotable` (`src/utils/pdfGenerator.js`, used for admin-side exports).
  Don't assume "PDF generation" means the Edge Function — check which one a
  given screen actually calls.

## 7. Development conventions observed in this codebase

- **Portuguese domain vocabulary throughout**, including in code (`lots`,
  `nome`, `preco`, `custo`, `romaneios`, `dados_pagamento`) — keep new
  identifiers consistent with the existing language mix (English for generic
  React/JS scaffolding, Portuguese for domain nouns/fields) rather than
  introducing English equivalents for existing concepts.
- **`src/utils/pricing.js` is the explicitly-declared single source of truth**
  for client-facing price math (its own doc comment says so) — any screen that
  shows a client price should call `calcPrecoClienteNoLote`, not reimplement
  the `preco * (1+adicional/100) * (1+escritorio/100)` formula inline.
- **`src/utils/lotAvailability.js` is the single source of truth for
  availability/sold-out logic** — computed live from `lot_products` counters,
  never persisted as a stock column (this was a deliberate migration,
  `055_lot_availability_no_stock_persistence.sql`). Do not add a persisted
  "estoque" column as a shortcut.
- **Toast (`src/components/common/Toast.jsx`) and `ConfirmationModal`** are the
  established feedback/confirmation primitives — see `artea-frontend`.
- **Services vs utils**: `src/services/` wraps external integrations
  (Correios, Mercado Pago, WhatsApp) and cross-cutting config
  (`PaymentConfigService.js`); `src/utils/` holds pure calculation/formatting
  helpers (pricing, availability, dynamic fees, Excel import, PDF). New code
  should follow this split rather than putting integration calls in `utils/`.
- There is a **legacy duplication**: `src/services/correios.js` /
  `src/services/mercadopago.js` alongside `src/services/integrations/correios.js`
  / `src/services/integrations/mercadopago.js`. **[DIVERGENCE]** Before adding
  to either, check which one is actually imported by current pages/components —
  don't assume the `integrations/` subfolder is the only live copy.

## 8. Directives for agents working in this repo

1. **Before changing any feature, locate all four layers**: the frontend
   page/component, the table(s) involved, the RLS policies on those tables,
   and any RPC/trigger/Edge Function touching them. A "simple" UI change to
   pricing or order status almost always has a DB-side counterpart.
2. **Never modify the schema by hand or via a one-off script as the permanent
   fix** — write a new numbered migration in `supabase/migrations/`. See
   `artea-supabase` for the numbering caveats in this repo (there are
   duplicate numbers and one out-of-band `999_emergency_fix_rls.sql` — read
   that section before assuming migration order).
3. **Don't create a parallel abstraction where one already exists.** Before
   adding a new pricing helper, availability check, or Toast/modal pattern,
   check `pricing.js`, `lotAvailability.js`, `dynamicFee.js`,
   `Toast.jsx`/`ConfirmationModal.jsx` first.
4. **Don't duplicate a business rule across frontend and backend "for
   safety"** unless there's a real reason (e.g. UX pre-validation +
   authoritative RLS/RPC check) — and if you do, say so explicitly in a
   comment, since divergence between the two copies is exactly how bugs like
   the ones documented in this file happen.
5. **Preserve compatibility with existing data.** This schema has visible scar
   tissue from iterative fixes (see the migration history in `artea-supabase`)
   — assume production data exists in "legacy" shapes (e.g. clients without
   `auth_id`, phone numbers with/without country code, romaneios predating a
   new column) and handle `NULL`/old formats rather than assuming a clean slate.
6. **Treat admin and cliente as separate concerns**, including when writing
   queries: a query written for the admin screen is not safe to reuse verbatim
   in a cliente screen just because it's convenient — check what columns it
   selects (§2 rule 1).
7. **Any change to a query, table, or the auth flow must explicitly consider
   RLS impact** — see `artea-supabase` §RLS before shipping.
8. **Never let `service_role` (or any Edge-Function-only secret) reach frontend
   code, env vars prefixed for Vite (`VITE_*`), or a git-tracked file.** Only
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong in the frontend.
9. **Never expose `products.custo` or `products.margem_pct` to a `cliente`
   session** in new code, even though (per §2 rule 1) this is already
   imperfectly true today. Don't make it worse.
10. **When you touch orders/romaneios, check downstream effects**: financial
    reports, `lot_products` counters, romaneio PDF generation, and WhatsApp
    notifications all read from the same rows — see §2 rule 10.

## 9. Where to go deeper

- React components, pages, CSS/design system, Supabase-from-the-browser
  patterns → **`artea-frontend`**.
- Schema, RLS policies, migrations, Edge Functions, service_role usage,
  webhooks → **`artea-supabase`** (load this before any backend change; it is
  the strictest of the three skills and documents a confirmed
  privilege-escalation risk in one Edge Function).
