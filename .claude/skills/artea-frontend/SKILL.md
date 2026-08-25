---
name: artea-frontend
description: React/Vite frontend conventions for Artea Joias — actual stack, folder responsibilities, component/CSS patterns, and how pages talk to Supabase directly from the browser. Load before adding or changing any page, component, or client-side data-fetching code.
---

# Artea Joias — Frontend

Covers `src/` only. For business rules and cross-cutting invariants (pricing,
approval, order lifecycle) see `artea`; for anything about what the backend
actually allows/enforces see `artea-supabase`.

Provenance: **[CODE]** verified in source, **[README]** README-only,
**[DIVERGENCE]** the two disagree.

## 1. Stack — as actually used, not as advertised

- **React 19.2** + **react-dom 19.2** (`package.json`). **[DIVERGENCE]**
  README says "React 18" — code is on React 19.
- **Vite 7** (`vite`, `@vitejs/plugin-react`), plain **JavaScript with JSX**
  (`.jsx`/`.js`) — **no TypeScript** anywhere in `src/` despite `@types/react`
  being a devDependency (that's editor-only ambient typing, not an active `.ts`
  toolchain). Don't introduce `.ts`/`.tsx` files without discussing it first;
  it would be a new convention, not a continuation of one.
- **react-router-dom 7**, client-side only, single `BrowserRouter` in
  `App.jsx`.
- **lucide-react** for all icons (plus one hand-rolled `WhatsAppIcon.jsx` for
  the one icon lucide doesn't have).
- **CSS Custom Properties**, one file per component/page
  (`ComponentName.css` next to `ComponentName.jsx`), no CSS-in-JS, no
  Tailwind, no CSS modules.
- **`@supabase/supabase-js`** called directly from page/component code — there
  is no repository/data-access layer, no React Query/SWR, no global store
  beyond `AuthContext`. Every page fetches its own data with `useEffect` +
  `useState`.
- **xlsx** (Excel import/export — `utils/excelImport.js`, admin import/reports
  screens), **jspdf** + **jspdf-autotable** (client-side PDF generation,
  `utils/pdfGenerator.js` — separate from the `generate-romaneio-pdf` Edge
  Function, see `artea` §6), **qrcode.react** (PIX QR codes),
  **@mercadopago/sdk-react** (MP payment brick).
- Do not add a new dependency to solve something one of the above already
  does — check `package.json` first.

## 2. Folder responsibilities (as implemented)

```
src/components/          shared, cross-cutting UI (not page-specific)
src/components/common/   CenteredLoader, ConfirmationModal, Toast, ImageUpload
src/components/layout/   AdminLayout+Sidebar+Header, ClientLayout+Header
src/components/ui/       PasswordInput, PhoneInput, PortalDropdown, countries.js
src/components/client/   small client-area-specific pieces (ClosedLotScreen, LotTermsBlock)
src/components/icons/    hand-rolled icons lucide doesn't have
src/pages/admin/*        one subfolder per admin section (products, lots, clients,
                          orders, romaneios, separacao, reports, marketing,
                          financeiro, users, whatsapp, settings, import)
src/pages/client/*        client-facing screens — flat, not further nested
src/pages/auth/*          Login, Register, ForgotPassword, ResetPassword
src/contexts/             AuthContext only (auth/session/role/client profile)
src/hooks/                useIntegrations.js (+ useMercadoPago/useCorreios/usePix)
src/lib/supabase.js       the one supabase-js client instance — import this,
                          never call createClient() again elsewhere
src/services/             integration clients (Correios, Mercado Pago, PIX,
                          WhatsApp) + PaymentConfigService
src/utils/                pure functions: pricing, availability, dynamic fees,
                          Excel import, client-side PDF generation
```

Note the admin/client asymmetry: admin pages are deeply nested by domain
(`pages/admin/lots/LotDetail.jsx`), client pages are flat
(`pages/client/Cart.jsx`). Follow whichever convention matches the area
you're adding to — don't nest client pages or flatten admin ones without a
reason.

**[DIVERGENCE — dead file, verified unimported]**: `src/components/layout/ClientLayout.jsx`
also exists and looks like a plausible client layout, but `App.jsx` imports the
client layout from `./pages/client/ClientLayout` instead (with an inline
comment "`// Componente Novo`" — "new component" — marking it as the
intended replacement). Nothing in `src/` imports `components/layout/ClientLayout`.
Treat `pages/client/ClientLayout.jsx` as the live client shell; don't edit the
`components/layout` one expecting it to affect anything, and don't delete it
either without asking (per this task's no-changes scope, and generally because
"unused" should be confirmed with the user before removal).

**[DIVERGENCE — legacy duplication, verify before editing]**: `src/services/correios.js`
and `src/services/mercadopago.js` exist **alongside**
`src/services/integrations/correios.js` and `src/services/integrations/mercadopago.js`.
`useIntegrations.js` and `services/integrations/index.js` both import from the
`integrations/` subfolder versions. Before modifying either Correios/MP
service, `grep -rn` for which one is actually imported by the screen you're
changing — do not assume the top-level or the subfolder copy is "the real
one" without checking, and do not edit both hoping one is a re-export of the
other (they are not, as far as could be verified — they read as independent
implementations).

## 3. Componentization patterns actually in use

- **Toast** (`components/common/Toast.jsx`): a `ToastProvider` context +
  `useToast()` hook exposing `toast.success/error/warning/info(message)`.
  This is the only feedback-banner mechanism in the app — don't build a
  second one or call `alert()`.
- **ConfirmationModal** (`components/common/ConfirmationModal.jsx`): a
  controlled `isOpen`/`onClose`/`onConfirm` modal with `variant="danger"|"primary"`
  and an `isLoading` prop that swaps the confirm button label to "Aguarde...".
  Use this for every destructive action (delete client/product/lot, cancel
  romaneio) instead of `window.confirm()` or a bespoke modal.
- **PortalDropdown** (`components/ui/PortalDropdown.jsx`): renders via
  `createPortal` and computes its own position with `useLayoutEffect`
  specifically to dodge `overflow`/z-index clipping on mobile tables. Use this
  for any new dropdown/menu inside a scrollable table or card, rather than a
  plain absolutely-positioned `<div>`.
- **CenteredLoader** (`components/common/CenteredLoader.jsx`): the standard
  loading spinner, with a `fullHeight` prop for full-page loading (used by
  `ProtectedRoute` itself). Use this instead of a bespoke spinner.
- **PhoneInput / PasswordInput** (`components/ui/`): standardized inputs for
  the two most sensitive form fields (login identity + credential) — phone
  formatting/country handling and password show/hide. Reuse these on any new
  form asking for a phone or password rather than a plain `<input>`.
- **ImageUpload** (`components/common/ImageUpload.jsx`): the standard product
  image upload widget, talks to Supabase Storage.
- Admin list pages follow a repeated shape: `toolbar` (search + filters +
  primary action button) → `product-grid`/`table` → row actions
  (edit/delete icon buttons) → a form either inline or in a separate
  `*Form.jsx` route. `ProductList.jsx`, `ClientList.jsx`/`ClientForm.jsx`,
  `LotList.jsx`/`LotForm.jsx` are representative examples to copy the shape
  from for a new admin section, rather than inventing a new layout.
- **Known megacomponents** — `pages/admin/lots/LotDetail.jsx` (~2600 lines)
  and, to a lesser extent, `pages/client/Cart.jsx` (~870 lines) and
  `pages/client/Catalog.jsx` (~1200 lines) already carry a lot of
  responsibility (product management, romaneios tab, separação tab, PIX/MP
  payment UI all inside `LotDetail.jsx`). Don't make these larger by habit —
  if you're adding a substantial new tab/section, consider whether it should
  be its own component file even though the existing code doesn't do that
  consistently. Don't attempt a drive-by full refactor of these files as a
  side effect of an unrelated change.

## 4. Design system — reuse before inventing

The real design system lives in **`src/styles/index.css`**, imported directly
by `App.jsx` (`import './styles/index.css'`); that file in turn `@import`s
`./mobile.css` and `./responsive.css`. **[CODE note — dead files, verified
unimported]**: `src/index.css` (repo root, dark-mode Vite scaffold default)
and `src/App.css` (the Vite scaffold's spinning-logo/`#root` styles, including
its own conflicting `.card { padding: 2em; }` rule) are both **never imported
anywhere** (`App.jsx` only imports `./styles/index.css`, nothing else) — they
are inert leftovers from `create-vite`. Don't "fix" the design by editing
either of them, and don't be misled by `App.css`'s `.card` rule when grepping
for card styles — the live one is in `src/styles/index.css`.

Key tokens (`:root` in `src/styles/index.css`):
- Color: `--color-primary` (#3498db) and `-dark`/`-light` variants,
  `--color-success`/`--color-warning`/`--color-danger`/`--color-info` (+
  `-light` background variants for badges), `--sidebar-*`, `--header-*`,
  `--bg-primary`/`--bg-secondary`/`--bg-card`, `--text-primary`/`-secondary`/`-muted`.
- Layout: `--border-radius` (6px) / `--border-radius-lg` (10px),
  `--shadow-sm`/`-md`/`-lg`, `--spacing-xs..xl` (4/8/16/24/32px),
  `--sidebar-width` (260px desktop, collapses to `0px` on mobile via a
  second `:root` override), `--header-height` (60px).
- Font: `Inter` (loaded via Google Fonts `@import`), `--font-size-xs..3xl`.
- Reusable utility classes already defined: `.btn`/`.btn-primary`/`.btn-success`/
  `.btn-danger`/`.btn-warning`/`.btn-secondary`/`.btn-outline(-primary|-danger)`/
  `.btn-sm`/`.btn-lg`/`.btn-icon`, `.card`/`.card-header`/`.card-body`/`.card-footer`,
  `.badge-*` (including cadastro-specific `.badge-completo`/`-incompleto`/`-pendente`),
  `.table`/`.table-container`, `.form-group`/`.form-label`/`.form-input`/`.form-select`,
  `.toolbar`/`.toolbar-left`/`.toolbar-right`, `.search-bar`, `.dropdown-menu`,
  `.page-header`, `.tabs`/`.tab`, `.product-card` family, plus spacing/flex
  utility classes (`.mt-md`, `.gap-sm`, `.flex`, `.w-full`, etc).
- **Mobile-first**: base styles target mobile; `@media (min-width: 768px)`
  (tablet), `1024px` (desktop, 3-col product grid), `1280px` (large desktop,
  4-col product grid) progressively enhance. `src/styles/mobile.css` and
  `responsive.css` carry additional mobile-specific overrides and fixes
  (there's also a one-off `pages/admin/lots/mobile-fixes.css` scoped to the
  lots screens specifically) — when fixing a mobile layout bug, check whether
  it already has a targeted fix file before adding another override layer.

**Rule**: before writing new CSS for a button, badge, card, table, form field,
or toolbar, check whether one of the classes above already does it. Per-page
`.css` files should hold layout/composition specific to that page, not
redefine primitives that already exist globally.

## 5. UX patterns to follow

- **Loading**: `CenteredLoader` for full-page/section loads; inline
  `loading-spinner` class + disabled button for in-flight form submits
  (see `Register.jsx`/`ConfirmationModal.jsx` for the pattern:
  `{loading ? <span className="loading-spinner" /> : <>...</>}`).
- **Empty state**: simple centered message + icon inline in the page (e.g.
  "Nenhum grupo encontrado" in `ClientLinks.jsx`), not a shared component —
  match that plain style rather than introducing a fancier empty-state
  component unprompted.
- **Errors**: inline `.auth-error`/`.field-error` banners on auth/forms (see
  `Register.jsx`'s per-field validation pattern —
  `validateField(name, value)` + `formErrors` state, called both on blur/change
  and again on submit); `Toast.error()` for action-level failures elsewhere
  (save/delete/network).
- **Success**: `Toast.success()` for most actions; a full-screen success
  modal overlay for signup specifically (`Register.jsx`'s `success` state) —
  that's a deliberate exception because the user is signed out immediately
  after registering and redirected to `/login`.
- **Confirmation before destructive actions**: always `ConfirmationModal`,
  never a bare button that fires the delete/cancel immediately.
- **Forms**: controlled inputs, one `formData` state object per form,
  per-field validators returning an error string or `''`, formatted
  masks applied in the `onChange` handler itself (see CPF/CNPJ and CEP
  formatting in `Register.jsx`) rather than on blur or via a masking library.
- **Responsiveness**: mobile-first as above; admin tables/grids collapse to
  stacked cards or full-width single-column below 768px — check
  `mobile.css`/`responsive.css` for the existing breakpoint behavior of a
  similar screen before hand-rolling new breakpoints.

## 6. How the frontend talks to Supabase

- One client instance: `import { supabase } from '../lib/supabase'` (or
  relative equivalent) — **never** call `createClient()` a second time
  anywhere in `src/`.
- **Auth/session/role**: always through `useAuth()` (`AuthContext`) — `user`
  (Supabase auth user), `client` (the `clients` row), `isAdmin` (boolean,
  DB-role-authoritative per `artea-supabase` §3), `loading`. Don't read
  `supabase.auth.getSession()` directly in a page component; the context
  already does this and keeps it in sync.
- **Tables/views**: direct `supabase.from('table').select(...)` in the
  page/component that needs it, generally inside a `useEffect` + a local
  `load*()` async function + `loading` state. There is no shared query-hook
  layer to route through — this is the established pattern, not a gap to
  "fix" by introducing React Query, unless the user asks for that change
  explicitly.
- **RPCs**: `supabase.rpc('function_name', { p_param: value })` — parameter
  names in calls must match the Postgres function's `p_`-prefixed parameter
  names exactly (see `artea-supabase` for current RPC signatures before
  wiring up a call).
- **Edge Functions**: some screens use `supabase.functions.invoke(name, {
  body })`, others use a plain `fetch` to the function URL with manually-set
  headers (`reset-password` flow) — check the existing call site for a given
  function before assuming which style to copy for a new call to the *same*
  function (staying consistent with existing callers of that function
  matters more than picking one style project-wide).
- **Storage**: `ImageUpload.jsx` is the reference implementation for
  uploading to a bucket; reuse it rather than writing a new
  `supabase.storage.from(...).upload(...)` call from scratch.
- **Realtime**: not used anywhere in `src/` as far as this review found — all
  data is fetched on mount/action, not subscribed. Don't assume a realtime
  channel exists for a given table.

## 7. Security — the frontend is not the authorization layer

- **Every RLS/role assumption belongs in `artea-supabase`, not here** — but
  concretely, for frontend code: hiding a menu item, disabling a button, or
  checking `isAdmin` in a component **only controls what's easy to click**,
  it is not what stops a `cliente` session from reading/writing something.
  Never write a comment like "safe because the button is hidden for
  non-admins" — the real gate has to be RLS or a `SECURITY DEFINER` RPC.
- **`isAdmin` and `client.role` from `AuthContext` are for UI branching
  only** (which layout, which nav items, which route guard). Don't use them
  as the sole justification for sending privileged data to a screen.
- **Never add `custo` or `margem_pct` to a query reachable from
  `src/pages/client/*` or any shared component that could render in the
  client area.** This is already violated in `Catalog.jsx` and `Cart.jsx`
  (see `artea` §2 rule 1 and `artea-supabase` §5) — don't extend the pattern
  to new screens, and flag it rather than quietly copying it if you're
  writing something similar.
- **Never reference `SUPABASE_SERVICE_ROLE_KEY` or any Edge-Function-only
  secret from `src/`.** Only `import.meta.env.VITE_SUPABASE_URL` and
  `import.meta.env.VITE_SUPABASE_ANON_KEY` belong in frontend code
  (`src/lib/supabase.js` is the only file that should read either).
- **`AuthContext`'s cart-isolation logic is a real (if lightweight) security/
  privacy measure**, not incidental: it clears `cart_*`/`cart-warn-*`
  `localStorage` keys on sign-out and whenever it detects the signed-in
  `session.user.id` differs from the last-seen `cart_owner_id`, specifically
  to stop one account's cart leaking into another account's session on a
  shared device. Preserve this behavior if you touch cart storage or the
  auth state listener.

## 8. Rules for adding or changing UI

Before writing a new page or component:
1. Look for an equivalent component in `components/common|layout|ui` first.
2. Look for an equivalent page in the same area (`admin/*` vs `client/*`) to
   copy the toolbar/list/form shape from.
3. Check `src/styles/index.css` for an existing class before writing new CSS.
4. Check `services/`, `hooks/`, and `utils/` for an existing data/calculation
   helper (`pricing.js`, `lotAvailability.js`, `dynamicFee.js`,
   `useIntegrations.js`) before recomputing something inline.
5. Check the relevant table's schema **and RLS** in `artea-supabase` before
   writing a new `select()` — especially whether the columns you need are
   safe for the area (admin vs client) you're building for.
6. Reuse existing abstractions rather than introducing a parallel one "just
   for this screen."

Avoid:
- Growing `LotDetail.jsx`/`Cart.jsx`/`Catalog.jsx` further without
  considering extraction (§3).
- Duplicating logic that already exists in `utils/` or `services/`
  (especially pricing/availability math — always go through `pricing.js`/
  `lotAvailability.js`).
- Supabase queries scattered with ad hoc column lists when an existing
  page already queries the same shape nearby — check for a reusable
  `select()` string/pattern first.
- New CSS files that redefine `--color-*`/spacing tokens instead of using the
  existing ones.
- Inline `style={{ ... }}` for anything the utility classes already cover
  (the codebase does use inline styles occasionally for one-off
  positioning — that's tolerated, but don't use it for colors/spacing that
  have a token).
- Adding a new dependency (date library, UI kit, state manager, HTTP client)
  without checking `package.json` and this document first — this project
  deliberately has a small, specific dependency list.
