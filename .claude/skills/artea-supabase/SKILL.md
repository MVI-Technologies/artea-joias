---
name: artea-supabase
description: Supabase backend knowledge for Artea Joias — actual current schema (reconstructed across 70+ migrations), RLS model, Edge Functions, and confirmed security issues (privilege-escalation via user_metadata, an Edge Function with no auth check). Load before any change touching the database, RLS, a migration, or an Edge Function.
---

# Artea Joias — Supabase / Backend

This is the strictest of the three Artea Joias skills. It documents the
**current, reconstructed** state of the Supabase backend — not any single
migration in isolation — because this repo's migration history has duplicate
numbers, an out-of-band emergency script, and functions that were rewritten
multiple times. Read `artea` first for domain context; this skill is the
authority on schema, RLS, and Edge Functions.

Provenance markers: **[CODE]** verified in migrations/functions as currently
committed, **[README]** only in README, **[DIVERGENCE]** the two disagree.
Numbers in parentheses like `(030)` refer to
`supabase/migrations/030_remove_orders_table.sql`.

## 0. Migration numbering — read this before trusting file order

`supabase/migrations/` is **not** cleanly ordered: there are duplicate numeric
prefixes (`018_fix_admin_clients_access.sql` and `018_integrations_table.sql`;
also duplicated 019, 034 ×4, 035, 050, 051, 056), and a
`999_emergency_fix_rls.sql` that git history shows was actually added on the
**same day as migration 001-008** (2026-01-20), i.e. it is an early ad-hoc
"disable RLS on `clients` to unblock dev" script that predates the proper
fix in migrations 017/018 (2026-01-22) — its `999` prefix means "run last if
you go by filename," which does **not** reflect when it was actually applied.
**Do not assume file numbering equals chronological or logical order.** When
reconstructing "what does this function/table look like today," find the
**highest-numbered migration that touches it** and read that one; don't stop
at the first match. This document already did that work for the tables and
functions listed below — re-verify with `grep -rn <name> supabase/migrations/`
before relying on it for anything security-relevant, since a later migration
may exist by the time you read this.

## 1. Architecture

- **Postgres** (Supabase-hosted) is the system of record. No other datastore.
- **Supabase Auth** (`auth.users`) holds credentials; the app's own `clients`
  table holds the actual profile/role/business fields, linked 1:1 via
  `clients.auth_id → auth.users.id`.
- **RLS is enabled and is the real authorization boundary** on every
  application table that matters (see §4). The frontend only ever holds the
  anon key + a user's JWT — it has no elevated privilege.
- **Storage**: at least one bucket (`company`, for logo/icon — `015_setup_storage.sql`,
  `019_company_logo_icon.sql`, `035_fix_storage_rls.sql`) plus product images
  handled by `ImageUpload.jsx`. Storage RLS policies exist and are gated on
  admin role — see §3's warning about how "admin" is checked.
- **RPCs / `SECURITY DEFINER` functions** carry logic that must run with
  elevated, controlled privilege regardless of caller role:
  `checkout_romaneio`, `update_romaneio_status`, `recalculate_romaneio_values`,
  `process_payment_webhook`, `handle_new_user` (auth trigger),
  `update_client_financials`, `get_financial_summary`, `get_romaneio_payment_info`.
  When you add a new one, default to checking caller identity/role **inside**
  the function via `clients` (see §3), not by trusting a parameter.
- **Triggers** maintain denormalized state that other features depend on:
  `lot_products.quantidade_pedidos/quantidade_clientes` (043),
  `clients.ultima_compra` (033), `romaneios.valor_pago` (069),
  `products.preco` (generated column, not a trigger, but same idea — never
  write to `preco` directly, it's `GENERATED ALWAYS AS (custo * (1 + margem_pct/100)) STORED`).
- **Edge Functions** (Deno, `supabase/functions/*`) are the only place
  `SUPABASE_SERVICE_ROLE_KEY` is legitimately used. See §6 — two of these
  currently have **no caller authorization check at all**.
- **Webhooks**: `mercadopago` Edge Function receives Mercado Pago's webhook
  and — correctly — re-fetches the payment from MP's own API by id before
  trusting the status, rather than trusting the webhook body.

## 2. Schema — current shape (reconstructed, not from any single migration)

Core tables, purpose, and the migration that most recently reshaped them:

| Table | Purpose | Key fields worth knowing | Last major change |
|---|---|---|---|
| `clients` | Every user (both `cliente` and `admin` roles live in this one table) | `auth_id`, `telefone` (login identity), `role` (`cliente`\|`admin`), `approved`, `cadastro_status`, `cpf`, `enderecos` (JSONB array), `saldo_devedor`, `credito_disponivel`, `ultima_compra` (trigger-maintained), `grupo` | (073) address extraction on signup |
| `products` | Catalog items | `custo` (admin-only), `margem_pct`, `preco` (**GENERATED**, `custo * (1+margem_pct/100)`), `tipo_venda` (`individual`\|`pacote`, (011) — an earlier (006) version used `unitario`\|`pacote`, superseded), `quantidade_pacote`, `quantidade_minima`, `codigo_sku`, `categoria_id` | (016) sku/peso |
| `categories` | Product categories | simple lookup table | (001) |
| `lots` | A "grupo de compra" / catalog link | `link_compra` (unique, resolves the client-facing URL), `status` (large enum, see §2.1), `escritorio_pct`, `adicional_por_produto`, `taxa_dinamica_valor_rules` (JSONB tiers), `custo_separacao`/`custo_operacional`/`custo_motoboy`/`custo_digitacao` (fees baked into romaneio totals at close), `requer_pacote_fechado`, `margem_fixa_pct` (if set, overwrites every attached product's margin — see `apply_lot_margin_to_products()` trigger, (022)), `chave_pix`/`nome_beneficiario` (payment display), `payment_option_id` | (052) adicional_por_produto |
| `lot_products` | N:N lot↔product, plus lot-scoped overrides | `qtd_minima_cliente` (per-lot min override, (014)), `quantidade_pedidos`/`quantidade_clientes` (trigger-maintained counters, (043), **never write these by hand**), `manual_esgotado` (admin can force sold-out, (064)) | (064) |
| `romaneios` | **The order.** One row per (client, lot) checkout | `status_pagamento` (see §2.2), `valor_total`/`valor_produtos`/`valor_frete`/`taxa_separacao`, `valor_pago` (trigger cache of `romaneio_pagamentos` sum), `dados_pagamento` (JSONB), `dados` (JSONB — some code paths read a snapshot of items from `dados.items`/`dados.itens` here, see `generate-romaneio-pdf`), `tipo_romaneio` (`cliente`\|`admin_purchase`) | (069) partial payments |
| `romaneio_items` | Line items of a romaneio | `product_id`, `quantidade`, `preco_unitario`, `valor_total` (generated) | (030) — replaces `orders` |
| `romaneio_status_log` | Audit trail of status changes | `status_anterior`/`status_novo`, `alterado_por`, `observacao` | (025) |
| `romaneio_pagamentos` | Individual partial payments | `valor`, `meio_pagamento`, `registrado_por` | (069) |
| `whatsapp_messages` | Log of WhatsApp sends | `recipients` added (056) | (056) |
| `catalog_clicks` | Click tracking on catalog links | — | (034) |
| `gift_cards` | Marketing gift cards (Marketing screen) | table is `gift_cards` (010) — **not** `gift_certificates`, which is a *separate*, older, apparently-unused table from (001) | (010) |
| `password_reset_codes` | SMS-style reset codes consumed by the `reset-password` Edge Function | `code`, `telefone`, `used`, `expires_at` | (035) |
| `integrations` | Config for Mercado Pago / Correios / PIX, keyed by `type` | `config` JSONB — **contains live API secrets** (MP `access_token`, Correios credentials) | (018) — **see §3 critical finding** |
| `payment_options` | Selectable payment methods shown on catalogs | `dados_config` JSONB | (036) — **shares the same RLS flaw, see §3** |
| `financial_transactions` | Ledger-ish table for financeiro screen | — | (012) |
| `freight_calculations` | Cached Correios freight results | — | (023) |
| `company_settings` | Single-row company profile (name, logo, etc) | — | (001), logo/icon (019) |

**[DIVERGENCE]** README's schema list matches most of this, but:
- lists `orders` as current — it was **dropped** (030); `romaneios` +
  `romaneio_items` replaced it.
- doesn't mention `romaneio_items`, `romaneio_status_log`,
  `romaneio_pagamentos`, `payment_options`, `integrations`,
  `freight_calculations`, `password_reset_codes`, `financial_transactions` —
  all real, current tables.
- lists `gift_cards` correctly by name, but be aware `gift_certificates`
  (older, `001`) also still exists in the schema as dead/legacy structure.

### 2.1 `lots.status` — current valid values

Per the latest constraint (071, which superseded 039):
`aberto, fechado, preparacao, em_preparacao, pronto_e_aberto, em_producao,
em_fabricacao (kept for backward-compat, prefer em_producao),
fornecedor_separando, verificando_estoque, organizando_valores,
aguardando_pagamentos, em_transito, em_transito_internacional, em_separacao,
envio_liberado, envio_parcial_liberado, fechado_e_bloqueado, pago, enviado,
concluido, finalizado, cancelado`.
This is a large, admin-facing operational pipeline, not just "open/closed" —
treat it as free-form-ish operational status, and note that `aberto → fechado`
specifically (not any other transition) is what triggers romaneio
recalculation (§ below, `generate_complete_romaneios_on_lot_close`, 057).

### 2.2 `romaneios.status_pagamento` — current valid values

Per the latest constraint (069): `aguardando_pagamento, aguardando,
parcialmente_pago, pago, pago_frete_incluso, pago_50_pct, pago_50_pct_s_frete,
em_separacao, enviado, concluido, cancelado, fechado_insuficiente,
admin_purchase, pendente`. This single column encodes both payment state and
loose fulfillment state — there is no separate fulfillment-status column.
`docs/client-order-tracking.md` in this repo sketches a different, simpler
status set (`reservado`, etc.) for a client-facing timeline — **treat that doc
as a design sketch, not as documentation of an implemented/current enum**; it
doesn't match the actual constraint.

### 2.3 `checkout_romaneio` RPC — evolved across many migrations

This function was rewritten in (029), (030), (053), (054), (055), (059),
(062), (065), (070), (072). Always read the **current** definition (search for
`CREATE OR REPLACE FUNCTION checkout_romaneio` across migrations and take the
highest-numbered hit) before assuming which `status_pagamento` values are
still "editable" (i.e. safe to overwrite on re-checkout) — that set has grown
over time (most recently including `pago_50_pct`/`pago_50_pct_s_frete` as of
070). Several of the intermediate migrations exist purely to fix a recurring
`temp_checkout_items`-table lifecycle bug (created/dropped inside the function
across sequential invocations) — if you touch this function, be careful with
any `CREATE TEMP TABLE` pattern inside it for the same reason.

## 3. Authentication & the confirmed privilege-escalation pattern

**Login** is phone-based: the frontend derives a synthetic email
`{digits}@artea.local` from the phone number and calls
`supabase.auth.signInWithPassword`. There is no real email/magic-link flow.
`clients.telefone` is the actual identity clients recognize; `auth.users.email`
is a synthetic key that exists only because Supabase Auth requires one.

**Signup**: `supabase.auth.signUp()` from `Register.jsx` with form data in
`options.data` (→ `auth.users.raw_user_meta_data`). The `handle_new_user`
trigger on `auth.users` (rewritten across (040), (049), (050), (067), (073) —
the version in (073) is current and additionally extracts a structured
address into `clients.enderecos`) reads that metadata and inserts the
`clients` row with `approved=false`, `cadastro_status='pendente'`.

**Role source of truth**: `clients.role` is the authoritative role column.
Migration (004) added a trigger (`sync_role_to_metadata`, `SECURITY DEFINER`)
that copies `clients.role` → `auth.users.raw_user_meta_data.role` **whenever
`clients.role` changes**, purely so the frontend can read role instantly from
the JWT without a DB round-trip (`AuthContext.jsx` does exactly this, then
re-confirms against `clients.role` and treats the DB as authoritative if they
disagree — that part of `AuthContext` is correct and cautious).

### ⚠️ Critical, confirmed finding: several RLS policies and one Edge Function trust `raw_user_meta_data`/`user_metadata` for admin checks — and that field is client-writable

The `004` trigger only pushes `clients.role → auth.users.raw_user_meta_data`
in one direction, on writes to `clients`. It does **not** stop a client from
independently calling `supabase.auth.updateUser({ data: { role: 'admin' } })`
from their own already-authenticated session — this is a normal, supported
Supabase Auth client call that directly rewrites the caller's own
`raw_user_meta_data`/`user_metadata`, bypassing the `clients` table entirely,
and it takes effect in that user's own refreshed JWT/session.

Several places check exactly that spoofable field instead of querying
`clients.role` (the pattern every *other* correct policy in this schema uses,
e.g. `EXISTS (SELECT 1 FROM clients WHERE auth_id = auth.uid() AND role =
'admin')`):

- **`integrations` table RLS** (018) — `SELECT`/`INSERT`/`UPDATE`/`DELETE`
  policies all check `auth.users.raw_user_meta_data->>'role' = 'admin'`. This
  table's `config` JSONB holds the **Mercado Pago `access_token`** and
  Correios credentials. Any authenticated `cliente` can self-escalate their
  own metadata and then read live payment-gateway secrets straight from the
  REST API.
- **`payment_options` table RLS** (036) — same pattern, same fix needed;
  impact here is integrity (a self-escalated client could alter payment
  options shown to every other customer), not just confidentiality.
- **`storage.objects` policies for the `company` bucket** (019) — same
  pattern; impact is a self-escalated client could overwrite the company
  logo/icon.
- **`admin-update-password` Edge Function** — checks
  `user.user_metadata.role === 'admin'` from the caller's own JWT. A
  self-escalated client can call this function to **set the password of any
  `userId` they pass in**, i.e. full account takeover of any client (or
  another admin).

This is a real, currently-exploitable gap, not a theoretical one — do not
treat `raw_user_meta_data`/`user_metadata` as a trustworthy authorization
source anywhere in this codebase, and do not copy this pattern into new code.
The correct pattern (used correctly by `clients`, `products`, `lots`,
`romaneios`, etc.) is: `EXISTS (SELECT 1 FROM clients WHERE auth_id =
auth.uid() AND role = 'admin')`. This is documented here as a known-risk
finding per the task that produced this skill (no functional fix was made,
per scope) — if the user asks you to hardn this, point them at exactly these
four locations.

### ⚠️ Critical, confirmed finding: `create-user` and `update-user` Edge Functions have no caller-authorization check at all

`supabase/functions/create-user/index.ts` and
`supabase/functions/update-user/index.ts` both build a `service_role` Supabase
client immediately from the request body and perform privileged operations
(`auth.admin.createUser`, `auth.admin.updateUserById`, arbitrary writes to
`clients` including `role`) **without ever reading the `Authorization` header
or checking who is calling**. There is no `supabase/config.toml` in this repo
overriding Supabase's default Edge Function JWT verification, and that
default only verifies that *some* valid Supabase-signed JWT was presented —
the public `VITE_SUPABASE_ANON_KEY` itself satisfies that check. In practice
this means these two functions are reachable by anyone who has the anon key
(i.e. anyone who has loaded the frontend once), with no login required, and
the request body's `role` field is trusted as-is — a caller can request
`role: "admin"` and get one created. Contrast this with `admin-update-password`,
which at least attempts a check (a spoofable one, see above) — these two
functions attempt none. Document, don't silently "fix," if you encounter this;
flag it to the user as a priority finding.

### RLS recursion pattern (why `clients` policies look self-referential)

Almost every "is this user an admin" check in this schema is
`EXISTS (SELECT 1 FROM clients c WHERE c.auth_id = auth.uid() AND c.role =
'admin')` — including the policy that governs `SELECT` on `clients` itself.
This works because Postgres RLS policy subqueries are allowed to reference the
same table they're attached to, and there's always a separate, non-recursive
"read your own row" policy (`auth_id = auth.uid()`) that lets the check
resolve. Migrations 017/018 exist specifically because an earlier, stricter
policy briefly broke this (admins couldn't see the client list) — if you touch
`clients` RLS, keep both the "own row" and "admin sees all" policies, in that
dependency order, or you can lock out admins from their own dashboard.

### The `999_emergency_fix_rls.sql` script

This file **disables RLS entirely on `clients`**
(`ALTER TABLE clients DISABLE ROW LEVEL SECURITY`) and drops a long list of
named policies. Per §0, it predates the proper RLS fix in (017)/(018) and the
system's current authorization model assumes `clients` RLS is **enabled** —
every RPC and every other table's policy depends on being able to safely
query `clients` under RLS to resolve `auth.uid()` → role. **Never re-run this
file.** If you ever see clients-table RLS behaving oddly (e.g. a client
reading other clients' data), check whether RLS on `clients` is actually
enabled before assuming the policy logic is wrong.

## 4. RLS model summary

- **Enabled on every table listed in §2** (verify with `\d+ <table>` /
  `pg_tables.rowsecurity` if in doubt — don't assume from migration text
  alone, given the disable/re-enable history above).
- **Admin**: full access to almost everything, via the
  `EXISTS (... clients ... role = 'admin')` pattern — **except** the four
  locations in §3 that incorrectly gate on metadata instead.
- **Cliente**: can `SELECT` their own `clients` row; can `SELECT` products/
  categories/lots/lot_products (row-level open to any authenticated user —
  RLS does **not** hide `products.custo`/`margem_pct` columns, see `artea`
  §2 rule 1 and `artea-frontend`); can `SELECT`/`INSERT`/`UPDATE` (while in an
  editable status) only their **own** `romaneios` (`client_id IN (SELECT id
  FROM clients WHERE auth_id = auth.uid())`) and can `SELECT` their own
  `romaneio_items`/`romaneio_pagamentos`/`romaneio_status_log` through that
  join.
- **Any RLS or query change must be checked against**: does an admin still
  see everything they did before, does a cliente still see only their own
  rows, and — specifically for `products` — are you adding a new column that
  a cliente-reachable query could select (custo/margem again).

## 5. Sensitive data — explicit list

Never let these reach a `cliente`-role session or an unauthenticated request,
by any path (direct query, RPC return value, view, Edge Function response):

- `products.custo`, `products.margem_pct` — **already leaking today**, see
  `artea` §2 rule 1. Don't add more exposure; don't assume existing exposure
  is fine to build on top of.
- `integrations.config`, specifically the `mercadopago` and `correios` rows —
  live payment/shipping API credentials. See §3 finding.
- `SUPABASE_SERVICE_ROLE_KEY` — Edge-Function-only, must never be read from
  frontend code, a `VITE_*` env var, or committed to git. `scripts/*.js` in
  the repo root are one-off Node maintenance scripts that **do** use the
  service role key from a local `.env` — that's an accepted pattern for
  operator-run local scripts, it is not acceptable inside anything shipped to
  the browser.
- `password_reset_codes.code` — should only ever be validated server-side
  (the `reset-password` function does this correctly via direct
  `service_role` REST calls).

## 6. Edge Functions — one by one

| Function | Responsibility | Auth model | Notes |
|---|---|---|---|
| `create-user` | Admin creates/backfills a client + auth user | **None — see §3 critical finding** | Also does dedup-by-phone/email and can backfill an existing clientless-of-auth row |
| `update-user` | Admin updates a client's profile/phone/role | **None — see §3 critical finding** | Updates `auth.users` email if phone changed |
| `admin-update-password` | Admin resets a user's password | Checks `user.user_metadata.role === 'admin'` — **spoofable, see §3** | |
| `reset-password/index-simplified.ts` | SMS-code-based self-service password reset | Validates a `password_reset_codes` row (code+phone+not used+not expired) before allowing the change; uses raw `fetch` to the Auth Admin REST API instead of the JS SDK, but the security-relevant logic (code validation) is sound | Deployed file is literally named `index-simplified.ts` — check whether the actual deployed function name/entry matches before assuming this is live |
| `generate-romaneio-pdf` | Builds the romaneio PDF (pdf-lib) + PIX payload | Optional bearer token; if present, verifies the caller's `clients.id` matches `romaneio.client_id` before returning; if absent, generates anonymously (acceptable since it's usually invoked right after checkout) | **Has a stale fallback**: if not given `items` and the romaneio has no `dados.items`/`dados.itens` snapshot, it queries `.from('orders')` — a table **dropped in migration 030**. This fallback path is broken and would error in production; don't assume it works, and don't copy this pattern |
| `mercadopago` | MP webhook receiver | None on the inbound webhook itself (can't be — MP calls it), but **re-verifies the payment by id against MP's own API** before calling `process_payment_webhook` | Good practice already in place — preserve it if you touch this file |
| `send-whatsapp` | Sends WhatsApp messages via Evolution API | Reads `EVOLUTION_API_URL`/`EVOLUTION_API_TOKEN`/`EVOLUTION_INSTANCE` from env; logs to `whatsapp_messages` | 596 lines — includes randomized delay/variation helpers, presumably to avoid WhatsApp anti-spam detection; treat as existing behavior, don't strip it without asking |
| `proxy-image` | Generic image proxy/cache | None — fetches any `url` query param and streams it back | Open proxy: no allowlist on the target host. Low severity (no secrets involved) but worth knowing if asked about SSRF-style concerns |
| `smart-endpoint` | Public catalog preview by lot id/link (used for share previews) | Uses `service_role` to look up a lot by id, `SELECT`ing only display fields (`nome`, `descricao`, `cover_image_url`, `link_compra`) | Deliberately public/unauthenticated by design — verify any change keeps the selected column list minimal |

## 7. Migrations — conventions to follow

- Never hand-edit the schema in the Supabase dashboard as a "permanent" fix —
  write a new numbered migration file, following the existing
  `NNN_description.sql` pattern (check the highest existing number **and**
  the highest git-add-date first, per §0, to avoid re-colliding with an
  existing duplicate number).
- Don't rewrite an already-applied migration file's contents — if a past
  migration needs correcting, ship a new migration that fixes it forward
  (this repo already does this repeatedly — e.g. (057) exists specifically to
  fix functions left over from before (030) removed `orders`).
- Preserve existing data: this schema has many `ALTER TABLE ... ADD COLUMN IF
  NOT EXISTS` + backfill `UPDATE` pairs (e.g. 033's `ultima_compra` backfill,
  069's `valor_pago` backfill) — follow that shape (additive column, backfill,
  then constrain) rather than a destructive rewrite.
- When you touch a table, grep for every trigger, function, view, and RLS
  policy referencing it before changing its shape — this schema has enough
  cross-table triggers (§1) that a column rename or drop can silently break
  something three migrations removed from where you're looking.
- `supabase/scripts/*.sql` are ad hoc debug/diagnostic queries (not
  migrations) — don't treat them as schema documentation, and don't run them
  against data you care about without reading them fully first (some, like
  `force_fix_clients.sql`, are one-off remediation scripts written for a
  specific past incident).

## 8. Checklist — before shipping any backend change

1. Schema: does this need a new column/table, and does it need `NOT NULL`/
   defaults that won't break existing rows?
2. Migration: new numbered file, additive, with backfill if needed.
3. Constraints: any `CHECK` constraint (status enums especially) that needs
   `DROP CONSTRAINT` + `ADD CONSTRAINT` to extend, following the pattern in
   (039)/(060)/(068)/(069)/(071).
4. Indexes: added for new filter/sort columns used by admin list screens
   (this schema adds them liberally, e.g. (019) performance indexes).
5. RLS: updated for the new/changed table, using the `clients.role`-based
   pattern — **never** the `raw_user_meta_data`/`user_metadata` pattern (§3).
6. Grants: confirm `authenticated` role has the access RLS is meant to allow
   (RLS policies are scoped `TO authenticated` in most of this schema).
7. Triggers: does an existing trigger need to fire on the new column/table
   (e.g. counters, `ultima_compra`, `valor_pago`)? Does a new trigger risk
   double-counting or racing an existing one?
8. Functions/RPCs: does `checkout_romaneio`, `update_romaneio_status`, or
   `recalculate_romaneio_values` need to know about this change?
9. Views: `report_financial_daily` and `get_financial_summary` — do they need
   to reflect the new field?
10. Edge Functions: does `generate-romaneio-pdf`, `mercadopago`, or
    `send-whatsapp` read a table/column you're changing?
11. Frontend consumer: which page(s) query this — check `artea-frontend` for
    the query-pattern conventions before assuming a shape.
12. Existing data: write a backfill, don't assume `NULL`/empty is fine
    everywhere downstream.
13. Integrations: Correios/Mercado Pago/WhatsApp — does this change affect a
    webhook payload, a freight calculation input, or a notification trigger?
14. Security: re-read §3 — does this change introduce a new admin-only
    surface? If so, gate it the correct way from the start.
