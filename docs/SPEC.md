# Aptifum ERP — Technical Specifications (v0.1)

> Living document. It will be refined as requirements are validated with stakeholders.

---

## 1. Product vision

Multi-module ERP for **retail/commerce** at medium scale (20–200 users), deployed to the cloud, built with Node.js + TypeScript in a **monorepo** with a domain-driven modular architecture.

The goal is to manage the full commercial and financial lifecycle of a business: inventory, sales, purchasing, accounting, human resources, CRM, and light production (assemblies/kits), with consistent data, full audit trails, and reports.

### Guiding principles
1. **Domain modularity**: modules are independent and communicate via **domain events**, not direct cross-module calls.
2. **Accounting as the financial source of truth**: every economic transaction (sale, purchase, inventory movement) automatically generates its accounting entries.
3. **Full audit trail**: every data mutation is recorded (who, what, when, before/after).
4. **Inventory integrity**: stock only changes through validated movements; concurrency is handled with optimistic locking.
5. **Single stack, single language**: TypeScript end to end (backend, shared libraries, React frontend).

---

## 2. Tech stack

| Layer            | Technology                                                   |
|------------------|--------------------------------------------------------------|
| Monorepo         | **Turborepo** + pnpm                                         |
| Language         | TypeScript (strict mode)                                     |
| Backend          | **NestJS** (apps/api), domain-driven modular structure         |
| ORM              | **TypeORM** + PostgreSQL                                     |
| Database         | PostgreSQL 16 (transactional, ACID)                          |
| Auth             | JWT (access + refresh), **bcrypt** (password hashing)                       |
| Authorization    | RBAC + per-resource permissions (casl or custom guards)      |
| Events           | @nestjs/event-emitter (in-process) + **transactional outbox** pattern |
| Validation       | class-validator + class-transformer                          |
| Documentation    | Swagger/OpenAPI                                              |
| Testing          | **Vitest** (unit + e2e with supertest), data seeders        |
| Quality          | ESLint + Prettier, husky, CI/CD in GitHub Actions            |
| Deployment       | Docker, VPS/cloud (optional Kubernetes later)                |

---

## 3. Monorepo architecture

```
aptifum/
├── apps/
│   ├── api/                          # NestJS API (single initial deployment)
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts         # Composes database packages + feature modules
│   │       └── modules/              # Each folder is a NestJS module
│   │           ├── auth/             # Login, tokens, refresh, sessions
│   │           ├── users/            # System users
│   │           ├── rbac/             # Roles, permissions, assignments
│   │           ├── tenants/          # Company/tenant, business configuration
│   │           ├── audit/            # Audit log
│   │           ├── inventory/        # Products, variants, stock, movements, warehouses, transfers
│   │           ├── sales/            # Customers, quotes, orders, invoices, credit notes, payments, series
│   │           ├── purchasing/       # Suppliers, POs, receiving, bills, supplier payments (AP)
│   │           ├── accounting/       # Chart of accounts, entries, closings, FX revaluation
│   │           ├── exchange-rates/   # Exchange rates for multi-currency posting
│   │           ├── hr/               # Employees, attendance, leaves, payroll
│   │           ├── crm/              # Contacts, leads, opportunities, activities
│   │           ├── production/       # BOMs/recipes, production orders
│   │           ├── tax/              # MX CFDI 4.0 documents + certificates, US sales tax nexus
│   │           ├── payments/         # Online card payments (Stripe), webhooks
│   │           ├── reports/          # BI reports, CSV/PDF/XLSX exports
│   │           ├── outbox/           # Transactional outbox, dispatcher + consumers
│   │           ├── reminders/        # Due-date / approval reminders cron
│   │           └── email/            # Email notifications consumer
│   └── web/                          # React dashboard
├── packages/
│   ├── core/                         # Shared types, enums, DTOs, constants
│   ├── config/                       # Env validation (zod) and configuration
│   ├── database/                     # DataSource, entities, migrations, seeders
│   └── logger/                       # Structured logging (JSON)
├── docs/
├── docker-compose.yml                # Local PostgreSQL + services
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

### Architecture rules (enforced via Turborepo/ESLint)
- `packages/*` **must not depend** on `apps/*`.
- `apps/api/src/modules/*` **must not import each other**; they communicate via events and through shared services from `packages/core` or `packages/database` (entities).
- Exposed API modules are registered in `app.module.ts`.

---

## 4. Multitenancy and data

- **Model:** shared schema with a `tenant_id` column on every business table + global filter (TypeORM `@MultiTenant()` or custom middleware/repository).
- A user can belong to one or more companies (`user_tenants`).
- Every HTTP-context query injects `tenant_id` automatically (interceptor + guard).
- **Deletion:** soft delete (`deleted_at`) on all business entities.
- **Audit:** `audit_log` table with `tenant_id`, `user_id`, `module`, `entity`, `entity_id`, `action`, `before/after` (JSONB), `ip`, `timestamp`.

---

## 5. Security and permissions

- **Auth:** short-lived JWT (access, ~15 min) + rotating refresh token (httpOnly cookie).
- **Authorization:** global RBAC (admin, accountant, seller, warehouse, HR, ...) + **fine-grained per-resource/action permissions** (e.g., `invoice:approve`, `stock:adjust`).
- **Tenant isolation:** guard that validates the resource belongs to the token's tenant.
- **Sensitive data:** hashed passwords (bcrypt), secrets in env/vault, never in the repo.

---

## 6. Modules — Functional scope

### 6.0 Core
- **Auth:** login, logout, refresh, password recovery, password change.
- **Users:** user CRUD, active/inactive status, role assignment.
- **RBAC:** predefined roles + custom roles, permissions per module/action.
- **Tenants:** company configuration (name, tax ID, default currency, country with US/MX tax presets, taxes, document series).

### 6.1 Inventory
- **Products:** SKU, name, description, category, brand, unit of measure, variants (size/color), barcodes, image, purchase/sale prices, VAT/tax.
- **Warehouses and locations:** multi-warehouse, locations within each warehouse.
- **Stock movements:** inbound, outbound, adjustment, warehouse transfer, return, disposal. Each movement references a source document and a user.
- **Valuation:** **weighted average cost** (default) with FIFO support as an extension.
- **Rules:** stock never negative (except authorized adjustments with `stock:adjust` permission), low-stock alerts, lot/expiry tracking for perishables.
- **Concurrency:** versioning (optimistic lock) on `product_stock`; movements inside a DB transaction.

### 6.2 Sales and Billing
- **Customers:** tax data (RFC/EIN by country), contacts, credit limit, assigned category/pricing, US billing `state` + `tax_exempt` flag (drives automatic US sales tax, §24).
- **Quotes:** valid for X days, convertible to order.
- **Orders (sales orders):** optional stock reservation, discounts, shipping, status (draft → confirmed → invoiced).
- **Billing:** per-tenant automatic document series and numbering, taxes (VAT), line/global discounts, credit/debit notes, returns (stock reintegration). For US tenants, line tax rates default to the **resolved sales tax rate** from the customer's state and the tenant's nexus configuration (§24).
- **Collections / Accounts receivable:** payment recording (cash, card, transfer), partials, due dates, customer statement.
- **Idempotency:** financial operations accept an `Idempotency-Key` to prevent double entries.
- **Emits events:** `sale.invoiced`, `payment.received`, `credit_note.issued`.

### 6.3 Purchasing
- **Suppliers:** tax data, contacts, payment terms, usual items.
- **Purchase orders:** role-based approval, status tracking, partial/full receiving.
- **Goods receipt:** generates an inventory inbound and updates cost.
- **Supplier invoice and AP:** reconciliation with PO and receipt, due dates, supplier payments.

### 6.4 Accounting
- **Chart of accounts:** hierarchical tree, account type (asset, liability, equity, income, expense), per tenant with a default initial catalog.
- **Entries (journal):** double entry, open/closed accounting period, balance validation (debits = credits).
- **Automatic entries:** generated from sales/credit invoices, collections, payments, inventory movements (valuation), payroll, production.
- **Accounting close:** period closing, general ledger, journal, trial balance, balance sheet, income statement reports.
- **Currency:** default functional currency per tenant; exchange rates implemented so foreign-currency documents post in the functional currency. Revaluation of open foreign-currency balances and settlement FX are shipped (see §11 #3 and §16.7).

### 6.5 Human Resources
- **Employees:** file, department, position, salary, bank, tax data.
- **Attendance:** clock in/out (manual or import), absences, time off, vacations.
- **Payroll:** salary calculation, deductions, provisions; generates accounting entries.
- **Module roles:** who can view salaries vs. who only sees attendance.

### 6.6 CRM
- **Contacts/leads:** source, contact data.
- **Opportunities:** pipeline stage (new → proposal → negotiation → won/lost), estimated amount, probability.
- **Activities:** calls, meetings, tasks, notes; linked to contact/opportunity/customer.
- **Integration:** won opportunity creates a customer from its linked lead (no quote/order).

### 6.7 Production (light / assembly)
- **BOM / Recipes:** component list with quantities and waste (%).
- **Production orders:** status (planned → in progress → completed / cancelled), material consumption (inventory outbound) and finished-good inbound.
- **Costing:** order cost = consumed materials + labor + overhead; automatic journal entry on completion (see §8).
- **Retail scenarios:** kits, repacking, prepared food.

### 6.8 Reporting
- Inventory: valuation, movements, low stock, profitability per product.
- Sales: by seller, product, customer, period; accounts receivable (aging).
- Purchasing: by supplier, accounts payable (aging).
- Financial: balance sheet, income statement, cash flow.
- Export: CSV, Excel, PDF.
- Executive dashboard (key metrics).
- **Implemented (F4):** read-only endpoints under `/reports/...` deriving everything from existing tables (no new entities). Module permission `reporting:read`. CSV export via `?format=csv`. See §21.

### 6.9 Payments (online card)

- **Payment providers:** per-tenant configuration (`payment_providers`): provider, environment (`test`/`live`), Stripe secret key + webhook signing secret, enabled flag. Secrets are **never returned** — every response exposes a masked form (`first6********last4`).
- **Checkout:** `POST /payments/invoices/:id/checkout` creates a Stripe **Checkout Session** for an issued invoice with an outstanding balance and returns the hosted redirect URL; creation is idempotent per invoice (`Idempotency-Key: checkout:<invoiceId>`).
- **Webhook:** `POST /webhooks/stripe` is public but signature-verified (HMAC-SHA256, timestamp tolerance ±300 s) against the tenant's stored signing secret, then records the card payment through the standard payment flow → journal entry + outbox `payment.received`. Replays are safe (Stripe session id is stored as the payment `reference` and the flow is idempotent). The **raw** body is captured before JSON parsing so the signature verifies the exact bytes sent by Stripe.
- **Emits events:** `payment.received` (already emitted by the standard collection flow).

---

## 7. API design

- **Style:** REST, JSON, versioned (`/api/v1/...`).
- **Per-resource structure:** `GET /v1/inventory/products`, `POST /v1/inventory/products/:id/movements`.
- **Conventions:**
  - Pagination: `?page=&limit=` (response includes `meta.total`).
  - Filters: `?filter[field]=value`, ordering: `?sort=-field`.
  - Soft delete: `DELETE` deactivates; `PATCH` to reactivate.
  - Standardized errors: `{ code, message, details, requestId }`.
  - Idempotency: `Idempotency-Key` header on financial POSTs.
  - Webhooks: webhook routes capture the **raw** request body (the server disables the default body parser for `/api/v1/webhooks/*` and buffers the bytes) so signature verification is exact.
- **Swagger** enabled at `/docs` (only in non-production environments if desired).
- **Traceability:** `requestId` in logs and error responses.

---

## 8. Automatic accounting integration (key flow)

```
[Sales invoice]
   ├─> stock: sale_movement (products out)   ─┐
   │                                          ├─> automatic entry
   └─> customer_balance: +amount              ─┘      (accounts: sales, VAT,
                                                        inventory/COGS, customers)
[PO -> Receipt -> Supplier invoice]
   ├─> stock: purchase_incoming ─┐
   ├─> supplier_balance: +amount ├─> automatic entry
   └─> cost: update              ─┘
[Payroll / Production / Payments]  ->  automatic entry
```

Entries are generated within the **same transaction** as the source document (outbox pattern) to guarantee consistency.

---

## 9. Non-functional requirements

- **Performance:** p95 < 500 ms on standard CRUD operations; properly indexed listings.
- **Scalability:** stateless API; horizontal API replicas on the same DB; optional workers for heavy processes (reports, payroll).
- **Availability:** daily backups + PITR, healthchecks (`/health`).
- **Maintainability:** lint + typecheck + tests in CI; ≥ 80% coverage on financial flows.
- **i18n:** bilingual web UI — **English and Spanish** (Spanish default), persisted in localStorage and switchable from the sidebar/settings (see §11 #5). API responses and outbox email templates remain English.
- **Observability:** structured JSON logs; optional metrics (OpenTelemetry) for request duration and errors.
- **Accountability:** full audit of all mutations (see §4).

---

## 10. Phased roadmap

| Phase | Content | Deliverable |
|-------|---------|-------------|
| **F0 · Foundation** | Monorepo scaffold (Turborepo + pnpm), NestJS API, PostgreSQL, auth + RBAC + tenants, audit, CI/CD, seeders, Swagger | Deployable base API with login and user management |
| **F1 · Commercial core** | Inventory (products, warehouses, movements, valuation) + Sales/billing (customers, quotes, orders, invoices, collections) | Complete sales flow with stock integration |
| **F2 · Finance** | Purchasing (suppliers, POs, receiving, AP) + Accounting (chart of accounts, automatic entries, reports) | Operational accounting close |
| **F3 · Organization** | CRM + Human Resources + Production | Fully integrated modules |
| **F4 · Analytics and platform** | BI reports, dashboard, exports, **online card payments (Stripe)**, integrations (banks, tax, e-commerce), web frontend | Complete ERP for 20–200 users |

---

## 11. Resolved decisions

The following decisions were settled and now constrain the product (see §6 and §8 for impact):

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Country-specific tax rules | **US + Mexico.** Tenants carry a `country` (`US`/`MX`) with seeded tax presets: US → `Sales Tax` 8% (sales), MX → `IVA` 16% (sales). Tax IDs follow the local format (US EIN 9 digits, MX RFC 12–13 chars). **MX CFDI 4.0 e-invoicing shipped (2026-08, §23):** self-contained XML + digital seal + demo TFD (self-signed per-tenant certificates, no real PAC). **US sales tax per state/nexus shipped (2026-08, §24):** automatic rate resolution from customer state + tenant nexus config. Real PAC timbrado remains **F4**. |
| 2 | Physical POS / offline sales | **Web-only** — a web POS/cashier (catalog, ticket, payment collection) is **shipped** on the dashboard; no offline/desktop client. |
| 3 | Multi-currency | **Single functional currency per tenant** (`default_currency`). Exchange rates are **implemented** (per-tenant `exchange_rates`, foreign-currency invoices/payments/supplier bills post in the functional currency, see §16.7). **Revaluation + settlement FX shipped (2026-08):** `POST /accounting/revaluations` revalues open foreign-currency balances (idempotent re-runs, automatic reversal of prior revaluations) and payments realize the FX difference vs the booked rate. |
| 4 | Notifications | **Email notifications shipped** for invoice/credit-note issuance, payments and goods receipts, delivered by the transactional outbox dispatcher (see §8). **Due-date/approval reminders shipped (2026-08)**: a daily cron emits `reminder.*` outbox events (overdue AR/AP, purchase orders pending approval ≥ 2 days) delivered to customers and permissioned tenant users. SMS deferred to **F4**. |
| 5 | Languages | **Bilingual web UI shipped.** The dashboard is English + Spanish (Spanish default) via i18next/react-i18next with a language switcher in the sidebar and settings; the API and outbox email templates remain English. |
| 6 | Team | **Single developer.** Conventions stay simple; lightweight CI. |
| 7 | Pilot business | **No real pilot yet.** Business rules are validated with synthetic examples; SPEC remains the reference. |
| 8 | Online payments | **Stripe shipped (2026-08).** Per-tenant provider config (`test`/`live`), server-side Checkout Sessions for issued invoices with an outstanding balance, and a signature-verified webhook that records card payments idempotently (see §6.9, §22). Bank feeds and other gateways remain **F4**. |

---

## 12. Progress

- [x] Monorepo scaffold (F0): Turborepo + pnpm, NestJS API, PostgreSQL, auth + RBAC + tenants + audit, seeders, Swagger, Vitest.
- [x] F1 data model definition (§13).
- [x] F1 Inventory module (entities, migration, CRUD, movements, valuation).
- [x] Product variants (catalog + nested CRUD under `/inventory/products/:productId/variants`; per-variant sku/barcode/attributes/price; variants embedded in product list/get).
- [x] Product variants in stock/POS: per-variant stock rows and movements (`variant_id` on `product_stock`/`stock_movements`), stock helpers accept `variantId`, POS catalog merges product + variant rows (variant sku/barcode search), invoice/order items carry `variantId`, POS ticket merges lines by `productId + variantId`; migration `VariantStock1786800000000`.
- [x] F1 Sales/billing module (customers, orders, invoices, payments, series, idempotency).
- [x] F1 Stock reservation: confirming an order reserves stock (`reserved_quantity`), cancel releases it, invoicing consumes it (available = quantity − reserved).
- [x] Domain glossary (`docs/GLOSSARY.md`).
- [x] F2.1 Purchasing (suppliers, purchase orders, goods receipts) — defined in §15.
- [x] F2.2 Supplier payments (AP): record payment → Dr AP / Cr Cash, AP aging and dashboard payables net of payments — defined in §15.
- [x] F2.2 Accounting (chart of accounts, automatic entries, closing) — defined in §16.
- [x] F3 CRM (contacts, leads, opportunities, activities) — defined in §17.
- [x] F3 CRM integration: marking an opportunity won creates a customer from its linked lead (no quote/order) — defined in §17.
- [x] F3 Accounting reports (trial balance, general ledger) — defined in §18.
- [x] F3 HR (departments, employees, attendance, leaves, payroll) — defined in §19.
- [x] F3 Production (BOMs, production orders, costing + auto journal entry) — defined in §20.
- [x] F4 Reporting (BI reports, dashboard, CSV exports) — defined in §21.
- [x] Transactional outbox + domain events (`invoice.issued`, `credit_note.issued`, `payment.received`, `purchase_receipt`, `payroll.posted`, `production.completed`) — defined in §1, §2, §6.2, §8.
- [x] Email notifications consuming outbox events (customers on invoices/credit notes/payments, suppliers on goods receipts) — see §11 #4.
- [x] F2.2 Supplier bills (AP): PO→receipt→bill reconciliation, draft → issued → paid/cancelled, `SB` series numbering at issue, AP variance entry vs the linked receipt, payments per bill, outbox event `supplier_bill.issued`, AP aging / dashboard payables / overdue alerts spanning bills + unbilled receipts — defined in §15.
- [x] F4 Multi-currency: `exchange_rates` table + CRUD API; invoices, credit notes, customer payments, supplier bills and supplier payments store `exchange_rate` and post to the tenant's functional currency; FX gain/loss accounts seeded (not yet posted); revaluation deferred — defined in §13.2, §15.2, §16.4, §16.7.
- [x] Web POS / cashier: catalog, ticket, and payment collection on the dashboard (F4, §11 #2).
- [x] F4 Online card payments (Stripe): per-tenant `payment_providers` config with masked secrets, `POST /payments/invoices/:id/checkout` → Stripe Checkout Session, and `POST /webhooks/stripe` signature-verified webhook that records card payments idempotently — defined in §22.
- [x] MX/US tax compliance backend (CFDI 4.0): RFC/EIN validation on customers by tenant country, `cfdi_documents` + `cfdi_certificates`, self-contained CFDI 4.0 XML with SAT-compliant cadena original + RSA-SHA256 seal + demo TFD 1.1 (self-signed per-tenant emisor/PAC certificates), outbox consumer auto-generates on `invoice.issued`, `/tax/...` settings/catalogs/cancel/xml endpoints — defined in §23. Web: CFDI UUID + XML download in the invoice detail modal.
- [x] F4 US sales tax nexus (§24): per-tenant config in `tenants.config.usSalesTax` (`nexusStates` + optional per-state rate overrides over the `US_STATES` defaults, seeded `['CA','TX']`), `customers.state` / `customers.tax_exempt`, and automatic line `tax_rate` resolution on invoice/order creation (explicit per-line rate wins); `/tax/us-sales-tax` read/update + `/tax/us-sales-tax/states` catalog. Web: Settings page (`/settings`) for nexus/rates and customer form state/tax-exempt fields.
- [x] Web dashboard (§25): full React dashboard covering every module (POS, sales, purchasing, inventory, production, HR, CRM, accounting, reports, users/roles, audit, settings), bilingual EN/ES (i18next), light/dark theme, permission-gated grouped navigation, Playwright e2e specs.
- [x] Shared web UI components: `Input`/`Select`/`Textarea` form primitives, unified `Button` with variants + `loading` state, composable `Card` (Radix `Slot`), `ConfirmDialog` for destructive actions, collapsible sidebar with collapse persistence + active accent + focus-visible rings, theme-aware branding on login/auth pages.
- [x] Reports additions: `GET /reports/alerts`, `GET /reports/financial/cash-flow`, `GET /reports/hr/payroll`, and XLSX export (`?format=xlsx`) across reports (§21).

## 13. F1 data model (inventory + sales/billing)

### 13.0 Common conventions

- Every business entity extends `TenantBaseEntity` (`BaseEntity` + `tenant_id uuid not null`), so tenant isolation is structural.
- UUID primary keys; `timestamptz` timestamps; soft delete (`deleted_at`) on all business entities.
- **Optimistic lock:** `version` column on high-contention entities (`products`, `product_stock`, `sales_orders`, `invoices`).
- **Money:** `numeric(14,2)` (no floats). **Quantities:** `numeric(18,4)`. **Tax rates:** `numeric(6,4)`.
- **Source-document references** are polymorphic: `reference_type` (module/entity name) + `reference_id` (UUID).
- Enums live in `packages/core`; every table with a `tenant_id` gets a composite index starting with `tenant_id`.
- **Global multitenancy filter:** TypeORM custom repository/base repository injects `tenant_id` from the request context on every query (interceptor + guard, see §4).

### 13.1 Inventory

| Table | Columns (besides base + tenant) | Notes / indexes |
|-------|--------------------------------|-----------------|
| `categories` | `name`, `parent_id` (self-ref, nullable), `active` | tree; index `(tenant_id, parent_id)` |
| `products` | `sku`, `name`, `description`, `category_id`, `brand`, `unit_of_measure`, `barcode`, `image_url`, `purchase_price`, `sale_price`, `default_tax_id`, `enabled`, `version` | `sku` unique per tenant; index `(tenant_id, sku)`, `(tenant_id, name)` |
| `product_variants` | `product_id`, `sku`, `barcode`, `attributes` (jsonb: size/color), `purchase_price`, `sale_price` | per-variant sku/barcode/price; `sku` **unique per tenant**; FK → `products`; index `(tenant_id, product_id)`; soft delete |
| `warehouses` | `code`, `name`, `address`, `active` | index `(tenant_id, code)` |
| `warehouse_locations` | `warehouse_id`, `code`, `name`, `active` | index `(tenant_id, warehouse_id)` |
| `product_stock` | `product_id`, `warehouse_id`, `quantity` (default 0), `reserved_quantity` (default 0), `average_cost` (default 0), `version` | stock per warehouse in F1 (locations are informational); **unique** `(tenant_id, product_id, warehouse_id)`; optimistic lock |
| `stock_movements` | `movement_type` (enum), `product_id`, `warehouse_id`, `location_id`, `quantity` (signed), `unit_cost`, `reference_type`, `reference_id`, `user_id`, `notes`, `occurred_at` | append-only; index `(tenant_id, product_id, occurred_at)` |

**Rules**
- Stock is never negative (except authorized adjustments with `stock:adjust`).
- Every movement runs inside a DB transaction; inbound updates `average_cost`:
  `new_avg = (prev_qty * prev_cost + qty * cost) / (prev_qty + qty)`.
- `stock_movements` is the single source of truth; `product_stock` is the current snapshot.

### 13.2 Sales & billing

| Table | Columns (besides base + tenant) | Notes / indexes |
|-------|--------------------------------|-----------------|
| `customers` | `code`, `trade_name`, `legal_name`, `tax_id`, `email`, `phone`, `address`, `currency`, `credit_limit`, `price_category`, `uso_cfdi` (nullable, MX), `regimen_fiscal` (nullable, MX), `state` (nullable, US), `tax_exempt` (default false), `active`, `version` | index `(tenant_id, code)`, `(tenant_id, tax_id)` |
| `taxes` | `name`, `rate` `numeric(6,4)`, `kind` (enum: sales/purchase), `active` | country-agnostic; tenant configures |
| `document_series` | `kind` (enum: quote/order/invoice/credit_note), `prefix`, `next_number` (bigint), `active` | per-tenant automatic numbering; atomic increment (row lock/serializable) |
| `sales_orders` | `number` (unique per tenant), `kind` (enum: quote/order), `status` (enum: draft/confirmed/invoiced/cancelled), `customer_id`, `warehouse_id`, `issue_date`, `due_date`, `currency`, `subtotal`, `discount`, `tax`, `total`, `notes`, `version` | quotes and orders share this table; index `(tenant_id, number)`, `(tenant_id, customer_id, issue_date)` |
| `sales_order_items` | `order_id`, `product_id`, `description`, `quantity`, `unit_price`, `discount`, `tax_rate`, `tax_amount`, `line_total` | index `(tenant_id, order_id)` |
| `invoices` | `number` (unique per tenant), `series_id`, `type` (enum: invoice/credit_note), `status` (enum: draft/issued/cancelled), `customer_id`, `order_id` (nullable), `warehouse_id` (nullable, source warehouse for COGS/returns), `issue_date`, `due_date`, `currency`, `exchange_rate` (default 1), `subtotal`, `discount`, `tax`, `total`, `paid_amount`, `balance_due`, `notes`, `version` | index `(tenant_id, number)`, `(tenant_id, customer_id, issue_date)` |
| `invoice_items` | `invoice_id`, `product_id`, `description`, `quantity`, `unit_price`, `discount`, `tax_rate`, `tax_amount`, `line_total` | index `(tenant_id, invoice_id)` |
| `payments` | `invoice_id`, `method` (enum: cash/card/transfer/other), `amount`, `exchange_rate` (default 1), `received_at`, `reference`, `notes` | partial payments; index `(tenant_id, invoice_id, received_at)` |
| `idempotency_keys` | `key` (unique), `request_hash`, `response` (jsonb), `created_at` | dedupe on financial POSTs (`Idempotency-Key`) |

### 13.3 Key relationships

```
categories ─1:N─ products ─1:N─ product_variants
products ─1:N─ product_stock ─N:1─ warehouses ─1:N─ warehouse_locations
stock_movements → product / warehouse / (optional) location  (reference_type+id → invoices, orders)

customers ─1:N─ sales_orders ─1:N─ sales_order_items → products
customers ─1:N─ invoices ─1:N─ invoice_items → products
invoices ─1:N─ payments
invoices → order (nullable); invoices → stock_movements (COGS outbound)
document_series → invoices / sales_orders (numbering)
```

### 13.4 Key flows (F1)

1. **Quote → Order → Invoice:** a confirmed order can be converted to an issued invoice; the invoice series number is assigned atomically from `document_series`.
2. **Sale invoices stock out:** issuing an invoice creates one `stock_movement` (outbound) per line inside the **same transaction**, posting COGS at the current `average_cost`.
3. **Collections:** `payments` are recorded per invoice (partials allowed); `paid_amount` / `balance_due` update on the invoice.
4. **Inbound stock:** in F1 stock enters via `adjustment`/`inbound` movements (purchasing arrives in F2).
5. **Idempotency:** invoice issue and payment POSTs accept `Idempotency-Key` to prevent duplicate entries.

### 13.5 Enums to add in `packages/core`

- `MovementType`: inbound, outbound, adjustment, transfer, return, disposal
- `SalesOrderKind`: quote, order
- `SalesOrderStatus`: draft, confirmed, invoiced, cancelled
- `InvoiceType`: invoice, credit_note
- `InvoiceStatus`: draft, issued, cancelled
- `PaymentMethod`: cash, card, transfer, other
- `TaxKind`: sales, purchase
- `DocumentSeriesKind`: quote, order, invoice, credit_note

---

## 14. Next steps

1. [x] Implement F1 **Inventory** module (entities, migration, CRUD, movements, valuation).
2. [x] Implement F1 **Sales/billing** module (customers, orders, invoices, payments, series).
3. [x] Resolve open decisions in §11 (tax country US/MX, currency, POS, language, team, pilot) — see §11.
4. [x] Create the **domain glossary** (`docs/GLOSSARY.md`).
5. [x] Web frontend (React dashboard) and CSV/Excel/PDF exports (see §6.8, §21).
6. [x] MX/US tax compliance backend (CFDI 4.0 demo timbrado + EIN/RFC validation, see §23).
7. [ ] Next phases (see §10): F4 platform extensions (integrations/bank feeds, real PAC timbrado).

---

## 15. F2 purchasing data model (F2.1)

### 15.1 Conventions

Same as §13.0 (TenantBaseEntity, UUID PK, `numeric(14,2)` money, `numeric(18,4)` quantities, `version` optimistic lock on `suppliers`/`purchase_orders`).

### 15.2 Tables

| Table | Columns (besides base + tenant) | Notes / indexes |
|-------|--------------------------------|-----------------|
| `suppliers` | `code`, `trade_name`, `legal_name`, `tax_id`, `email`, `phone`, `address`, `currency`, `payment_terms`, `credit_limit` `numeric(14,2)`, `active`, `version` | `code` unique per tenant; index `(tenant_id, code)`, `(tenant_id, tax_id)` |
| `purchase_orders` | `number` (unique per tenant), `status` (enum: draft/approved/received/cancelled), `supplier_id`, `warehouse_id`, `issue_date`, `expected_at`, `currency`, `subtotal`, `discount`, `tax`, `total`, `notes`, `version` | index `(tenant_id, number)`, `(tenant_id, supplier_id, issue_date)` |
| `purchase_order_items` | `order_id`, `product_id`, `description`, `quantity`, `unit_cost`, `discount`, `tax_rate`, `tax_amount`, `line_total`, `received_quantity` (default 0) | `received_quantity` tracks partial receiving; index `(tenant_id, order_id)` |
| `goods_receipts` | `number` (unique per tenant), `order_id`, `supplier_id`, `warehouse_id`, `received_at`, `notes` | append-only; index `(tenant_id, number)`, `(tenant_id, order_id)` |
| `goods_receipt_items` | `receipt_id`, `order_item_id`, `product_id`, `quantity`, `unit_cost` | index `(tenant_id, receipt_id)` |
| `supplier_payments` | `supplier_id`, `bill_id` (nullable), `method` (enum: cash/card/transfer/other), `amount` `numeric(14,2)`, `exchange_rate` (default 1), `paid_at`, `reference`, `notes` | append-only; index `(tenant_id, supplier_id)`, `(tenant_id, bill_id)` |
| `supplier_bills` | `number` (nullable until issued, unique per tenant), `status` (enum: draft/issued/paid/cancelled), `supplier_id`, `order_id` (nullable), `receipt_id` (nullable), `bill_date`, `due_date` (nullable), `currency`, `exchange_rate` (default 1), `subtotal`, `tax`, `total`, `paid_amount`, `balance_due`, `notes`, `issued_at`, `version` | index `(tenant_id, number)`, `(tenant_id, supplier_id, bill_date)` |
| `supplier_bill_items` | `bill_id`, `product_id` (nullable), `description`, `quantity`, `unit_price`, `tax_rate`, `line_total` | index `(tenant_id, bill_id)` |

### 15.3 Key flows

1. **PO lifecycle:** `draft → approved → received`, or `cancelled` (from draft/approved only). Receive requires an approved order.
2. **Receiving (partial or full):** each goods receipt creates one `stock_movement` (`inbound`) per line **in the same transaction** (`reference_type='purchase_receipt'`, `reference_id=<receipt id>`), posting `unit_cost` from the PO line and updating `average_cost`. `purchase_order_items.received_quantity` increments per line; when every line is fully received the PO moves to `received`.
3. **Numbering:** `document_series` kinds `purchase_order` (prefix `PO`), `goods_receipt` (prefix `GR`) and `supplier_bill` (prefix `SB`), assigned atomically like sales.
4. **Supplier payments (AP):** `POST /purchasing/payments` records a payment against a supplier in a transaction: saves the `supplier_payments` row and posts a journal entry **Dr `2000` Accounts payable, Cr `1000` Cash** (`reference_type='supplier_payment'`, `reference_id=<payment id>`), reusing the PO receiving journal-entry pattern. Closed period or unbalanced → 400/409 like other auto-postings. `GET /purchasing/payments` lists payments (optionally filtered by `supplierId`). When `billId` is provided the payment must belong to an `issued` bill of the same supplier, cannot exceed `balance_due`, and updates `paid_amount`/`balance_due` (status → `paid` when the balance reaches zero).
5. **Supplier bills (AP reconciliation):** `POST /purchasing/bills` creates a **draft** bill (validates the supplier; optional linked receipt — rejects a draft for a receipt already billed and receipts of another supplier; totals from items via `computeTotals`). `POST /purchasing/bills/:id/issue` requires a draft, assigns the next `SB` series number, stamps `issued_at`, and posts the AP entry **in the same transaction** (outbox pattern) as the **variance vs the linked receipt**: received amount = Σ `goods_receipt_items.quantity × unit_cost`; equal → no entry; bill > receipt → **Dr `5000` COGS, Cr `2000` AP** for the difference; bill < receipt → inverse; no receipt → full amount **Dr `5000`, Cr `2000`**. Emits outbox event `supplier_bill.issued`. `POST /purchasing/bills/:id/cancel` only cancels drafts. `GET /purchasing/bills` lists (optional `supplierId` filter), `GET /purchasing/bills/:id` returns the bill with supplier and items. AP reports (aging, dashboard payables, overdue alerts) span issued bills (`balance_due`) plus receipts without a non-cancelled bill, net of payments not linked to a bill (FIFO).
6. **Multi-currency in purchasing:** bills and payments issued in a currency other than the tenant's functional currency resolve the rate `functional → document currency` at `bill_date` / `paid_at` (missing rate → 400), store it as `exchange_rate`, and post the AP entry converted to the functional currency. The received amount (`goods_receipt_items.quantity × unit_cost`) is already in functional currency (stock is valued in it), so the variance is computed as `round2(total × rate) − received`.

### 15.4 Enums to add in `packages/core`

- `PurchaseOrderStatus`: draft, approved, received, cancelled
- `SupplierBillStatus`: draft, issued, paid, cancelled
- `DocumentSeriesKind` += `purchase_order`, `goods_receipt`, `supplier_bill`

## 16. F2.2 Accounting data model

### 16.1 Conventions

Same as §13.0 (TenantBaseEntity, UUID PK, `numeric(14,2)` money, `version` optimistic lock on `chart_accounts`/`journal_entries`). No `numeric` for quantities here.

### 16.2 Tables

| Table | Columns (besides base + tenant) | Notes / indexes |
|-------|--------------------------------|-----------------|
| `chart_accounts` | `code` (varchar 20), `name` (varchar 255), `type` (enum: asset/liability/equity/revenue/expense), `normal_balance` (enum: debit/credit), `parent_id` (nullable), `active`, `description`, `version` | `code` unique per tenant; index `(tenant_id, code)`, `(tenant_id, parent_id)`; self-FK `parent_id → chart_accounts(id)` |
| `accounting_periods` | `period` `char(7)` `YYYY-MM` (unique per tenant), `label`, `start_date`, `end_date`, `status` (enum: open/closed), `closed_at`, `closed_by` | auto-created on first posting; index `(tenant_id, period)` |
| `journal_entries` | `number` (varchar 30, unique per tenant), `period_id`, `entry_date`, `status` (enum: draft/posted/reversed), `reference_type`, `reference_id`, `currency` (default USD), `description`, `debit_total`, `credit_total`, `posted_at`, `posted_by`, `reversed_by_entry_id`, `version` | balance enforced (|debit − credit| ≤ 0.005); index `(tenant_id, number)`, `(tenant_id, entry_date)`, `(tenant_id, reference_type, reference_id)` |
| `journal_entry_lines` | `entry_id`, `account_id`, `line_index`, `description`, `debit`, `credit` | exactly one of debit/credit > 0; index `(tenant_id, entry_id)`, `(tenant_id, account_id)`; FKs to `journal_entries` and `chart_accounts` |

### 16.3 Chart of accounts (seeded per tenant)

| Code | Name | Type | Normal balance |
|------|------|------|----------------|
| 1000 | Cash and banks | asset | debit |
| 1100 | Accounts receivable | asset | debit |
| 1200 | Inventory | asset | debit |
| 2000 | Accounts payable | liability | credit |
| 2001 | Payroll payable | liability | credit |
| 2002 | Withholdings and deductions payable | liability | credit |
| 2100 | Sales tax payable | liability | credit |
| 3000 | Retained earnings | equity | credit |
| 4000 | Sales revenue | revenue | credit |
| 4100 | Sales returns | revenue | debit |
| 4200 | Foreign exchange gain | revenue | credit |
| 5000 | Cost of goods sold | expense | debit |
| 6000 | Payroll expense | expense | debit |
| 6100 | Foreign exchange loss | expense | debit |

### 16.4 Auto-posting rules (§8)

| Trigger | Debits | Credits |
|---------|--------|---------|
| Invoice issued (direct or from order) | 1100 (total); 5000 (cogs) | 4000 (subtotal − discount); 2100 (tax); 1200 (cogs) |
| Credit note | 4100 (subtotal − discount); 2100 (tax); 1200 (cogs) | 1100 (total); 5000 (cogs) |
| Payment received | 1000 (amount) | 1100 (amount) |
| Goods receipt | 1200 (received amount) | 2000 (received amount) |
| Supplier payment | 2000 (amount) | 1000 (amount) |
| Supplier bill variance | 5000 (bill − received, if positive) | 2000 (bill − received); inverse when negative |
| Payroll posted | 6000 (gross) | 2001 (net); 2002 (deductions) |
| Production completed | 1200 (total cost) | 1200 (material cost); 6000 (total − material) |

COGS is taken from `product_stock.average_cost` before the outbound movement. Auto-posted entries use `reference_type` `invoice` / `credit_note` / `payment` / `purchase_receipt` / `supplier_payment` / `supplier_bill` / `payroll` / `production_order` and `reference_id` of the source document. A closed period rejects any new posting (409).

**Multi-currency:** every auto-posted entry is denominated in the tenant's **functional currency** (`tenants.default_currency`, default `USD`). For documents in another currency the AR/sales/VAT and AP/cash amounts are converted at the document's stored `exchange_rate` (`round2(amount × rate)`); inventory movements, COGS and stock costs are already in functional currency and are never converted. Missing exchange rate for a pair on the document date → 400. FX gain/loss accounts (`4200`/`6100`) are posted by the revaluation and settlement-FX flows (§11 #3).

### 16.5 Key flows

1. **Periods:** created lazily as `YYYY-MM` of the entry date; only `open` periods accept postings. Closing is idempotent per period.
2. **Manual entries:** created via the API, validated balanced, numbered `JE-######` from `document_series` kind `journal_entry`. Reversal of a posted entry creates an inverse entry with `status=reversed` on the original and `reference_type='journal_reversal'`.
3. **Numbering:** `document_series` kind `journal_entry` (prefix `JE`), atomic like sales.

### 16.6 Enums to add in `packages/core`

- `AccountType`: asset, liability, equity, revenue, expense
- `AccountNormalBalance`: debit, credit
- `AccountingPeriodStatus`: open, closed
- `JournalEntryStatus`: draft, posted, reversed
- `DocumentSeriesKind` += `journal_entry`

### 16.7 Multi-currency (exchange rates)

**Table** (`exchange_rates`, extends `TenantBaseEntity`)

| Column | Notes |
|--------|-------|
| `base_currency` `char(3)` | base currency (e.g. `USD`) |
| `quote_currency` `char(3)` | quote currency (e.g. `EUR`) |
| `rate_date` `date` | default `CURRENT_DATE` |
| `rate` `numeric(18,6)` | `rate = units of quote per 1 unit of base` |

**Unique** `(tenant_id, base_currency, quote_currency, rate_date)`; the latest rate at or before a date is used for conversion.

**API surface** (`/exchange-rates/...`, module permission `ACCOUNTING` with `read`, `write`)

- `GET /exchange-rates?page=&limit=&base=&quote=` — paginated list, newest first.
- `GET /exchange-rates/latest?base=&quote=&date=` — latest rate for a pair at or before `date` (defaults to the most recent one); `date`/`base`/`quote` optional.
- `POST /exchange-rates` — body `{ baseCurrency, quoteCurrency, rate, rateDate? }`; rejects equal base/quote (`400`) and duplicate pair+date (`409`).
- `DELETE /exchange-rates/:id` — soft delete.

**Resolution rule:** `resolveRate(tenantId, base, quote, date)` returns the latest rate for `(base, quote)` with `rate_date <= date`; `base === quote` returns `1`; missing rate → `400`. Callers post in functional currency (see §16.4).

## 17. F3 CRM data model

### 17.1 Conventions

- Same base conventions as §13.0 (tenant isolation, soft delete, `numeric(14,2)` money, enums in `packages/core`).
- Leads are numbered through the existing `document_series` machinery with prefix `LD` (`DocumentSeriesKind.lead`), unique per tenant.
- `Customer` remains the central entity; CRM entities reference it instead of duplicating company data.

### 17.2 Tables

| Table | Columns (besides base + tenant) | Notes / indexes |
|-------|--------------------------------|-----------------|
| `crm_contacts` | `full_name`, `customer_id` (FK → customers, nullable), `title`, `email`, `phone`, `mobile`, `address`, `notes`, `active` | index `(tenant_id, full_name)`; `customer_id` FK ON DELETE NO ACTION |
| `crm_leads` | `number` (unique per tenant), `source`, `company_name`, `contact_name`, `email`, `phone`, `status` (enum), `estimated_amount` (numeric(14,2)), `currency`, `assigned_user_id`, `notes`, `converted_customer_id` (FK → customers, nullable), `version` | **unique** `(tenant_id, number)`; index `(tenant_id, status)` |
| `crm_opportunities` | `name`, `customer_id` (FK, nullable), `lead_id` (FK → crm_leads, nullable), `stage` (enum), `amount`, `currency`, `probability` (int %), `expected_close_date`, `assigned_user_id`, `won_at`, `lost_at`, `notes`, `version` | index `(tenant_id, stage)`; FKs ON DELETE NO ACTION |
| `crm_activities` | `activity_type` (enum), `subject`, `description`, `due_at`, `completed_at`, `assignee_id`, `reference_type`, `reference_id` | polymorphic reference; index `(tenant_id, reference_type)`, `(tenant_id, reference_id)` |

**Enums added in `packages/core`**

- `LeadStatus`: new, contacted, qualified, disqualified, converted
- `OpportunityStage`: prospecting, qualification, proposal, negotiation, won, lost
- `ActivityType`: call, meeting, task, note
- `DocumentSeriesKind` += `lead`

### 17.3 Key flows

- **Lead conversion:** `POST /crm/leads/:id/convert` runs in a transaction: creates a `Customer` (code `CUST-<last6 of lead number>`, trade name = company/contact), marks the lead `converted`, links `converted_customer_id`. Re-conversion and edits/deletes of converted leads are rejected (`400`).
- **Pipeline:** `mark-won`/`mark-lost` set `stage`, `probability = 100` and stamp `won_at`/`lost_at`; once won/lost the opportunity cannot be edited or deleted (`400`).
- **Won → customer:** `mark-won` runs in a transaction and, if the opportunity has no `customer_id` but has a linked `lead`, creates a `Customer` from it (code `CUST-<last6 of lead number>`, trade name = company/contact, email/phone/currency from the lead) before stamping the stage. No quote/order is generated.
- **Activities:** freely linked via `reference_type`/`reference_id` to a lead, opportunity or customer; list supports filtering by reference and `q` full-text-ish search.

### 17.4 API surface (`/crm/...`, module permission `CRM`)

- `GET/POST /crm/contacts`, `GET/PATCH/DELETE /crm/contacts/:id`
- `GET/POST /crm/leads`, `GET/PATCH/DELETE /crm/leads/:id`, `POST /crm/leads/:id/convert`
- `GET/POST /crm/opportunities`, `GET/PATCH/DELETE /crm/opportunities/:id`, `POST /crm/opportunities/:id/mark-won`, `POST /crm/opportunities/:id/mark-lost`
- `GET/POST /crm/activities`, `GET/PATCH/DELETE /crm/activities/:id` (filters `referenceType`, `referenceId`, `q`)

## 18. F3 Accounting reports (trial balance + general ledger)

- Raw SQL over `journal_entry_lines` × `journal_entries` × `chart_accounts`, always filtered by `tenant_id`, soft-deletes, and `je.status <> 'draft'`.
- `GET /accounting/reports/trial-balance?periodId=&from=&to=` returns per-account `debit`, `credit` and `balance` computed from `normal_balance` (debit accounts: `debit - credit`, credit accounts: `credit - debit`), filtering out zero-balance accounts, plus `totals {debit, credit}` for balance verification.
- `GET /accounting/reports/ledger/:accountId?from=&to=` returns posted lines ordered by `entry_date, created_at, line_index` with a running balance; unknown account → `404`.
- Filters are parameter-positional (`$1..$N`) built from the tenant and optional period/date bounds.

## 19. F3 HR data model

### 19.1 Conventions

- Same base conventions as §13.0 (tenant isolation, soft delete, `numeric(14,2)` money, enums in `packages/core`).
- Payrolls are numbered through `document_series` with prefix `PR` (`DocumentSeriesKind.payroll`), unique per tenant and period.
- Employees get an auto code `EMP-000001..` (tenant-scoped counter over existing rows).
- Salary fields are sensitive: only users with `hr:approve` (or `*`) see them in responses; others get them stripped.

### 19.2 Tables

| Table | Columns (besides base + tenant) | Notes / indexes |
|-------|--------------------------------|-----------------|
| `hr_departments` | `code` (unique per tenant), `name`, `manager_employee_id` (FK → hr_employees, nullable), `active` | unique `(tenant_id, code)` |
| `hr_employees` | `employee_no` (unique per tenant), `names`, `email`, `phone`, `department_id` (FK → hr_departments), `position`, `hire_date`, `termination_date`, `salary` (numeric(14,2)), `salary_frequency`, `bank_name`, `bank_account`, `tax_id`, `address`, `status` (enum), `version` | unique `(tenant_id, employee_no)`; index `(tenant_id, department_id)` |
| `hr_attendance` | `employee_id` (FK), `work_date` (date), `clock_in_at`/`clock_out_at` (timestamptz), `worked_minutes` (int), `status` (enum), `notes` | **unique** `(tenant_id, employee_id, work_date)` |
| `hr_leaves` | `employee_id` (FK), `leave_type` (enum), `start_date`, `end_date`, `days` (int), `status` (enum), `reason`, `approved_by` (FK → users), `approved_at` | index `(tenant_id, employee_id, start_date)` |
| `hr_payrolls` | `number` (unique per tenant), `period` (`YYYY-MM`), `status` (enum), `currency`, `total_gross`, `total_deductions`, `total_net` (numeric(14,2)), `paid_at`, `posted_entry_id` (FK → journal_entries, nullable), `posted_at`, `version` | unique `(tenant_id, number)`, `(tenant_id, period)` |
| `hr_payroll_lines` | `payroll_id` (FK → hr_payrolls), `employee_id` (FK), `gross`, `bonus`, `overtime`, `deductions`, `net` (numeric(14,2)) | unique `(tenant_id, payroll_id, employee_id)` |

**Enums added in `packages/core`**

- `EmployeeStatus`: active, inactive
- `AttendanceStatus`: present, late, absent, leave
- `LeaveType`: vacation, sick, personal, other
- `LeaveStatus`: pending, approved, rejected, cancelled
- `PayrollStatus`: draft, posted, cancelled
- `DocumentSeriesKind` += `payroll`
- `ACCOUNT_CODES` += `PAYROLL_PAYABLE: '2001'`, `PAYROLL_DEDUCTIONS_PAYABLE: '2002'`, `PAYROLL_EXPENSE: '6000'`

### 19.3 Key flows

- **Clock in/out:** `POST /hr/attendance/clock` (`action: in|out`) upserts the day's record; `worked_minutes` recomputed on clock-out; second clock-in / clock-out of the same day → `409`.
- **Leaves:** `days` computed from range; only `pending` leaves can be edited, deleted, approved or rejected; approve/reject requires `hr:approve` and stamps `approved_by`/`approved_at`.
- **Payroll generate:** transaction validating employees and `net >= 0`, computing `gross = salary + bonus + overtime`, `net = gross - deductions`, totals, and allocating the next `PR` number; duplicate period → `409`.
- **Payroll post:** requires `hr:read` + `hr:approve`; in a transaction, `postJournalEntry` with entry date = last day of the period, debit `6000` `total_gross`, credit `2001` `total_net`, credit `2002` `total_deductions` (only if > 0), description `Payroll <number> (<period>)`, `reference_type = 'payroll'`; marks the payroll `posted` with `posted_entry_id`. Only `draft` payrolls can be posted or cancelled (`400`).

### 19.4 API surface (`/hr/...`, module permission `HR` with `read`, `write`, `approve`)

- `GET/POST /hr/departments`, `GET/PATCH/DELETE /hr/departments/:id`
- `GET/POST /hr/employees`, `GET/PATCH/DELETE /hr/employees/:id` (`?includeSalary=true` gated on `hr:approve`)
- `GET/POST /hr/attendance`, `GET/PATCH/DELETE /hr/attendance/:id`, `POST /hr/attendance/clock`
- `GET/POST /hr/leaves`, `GET/PATCH/DELETE /hr/leaves/:id`, `POST /hr/leaves/:id/approve`, `POST /hr/leaves/:id/reject`
- `GET/POST /hr/payrolls`, `GET /hr/payrolls/:id`, `POST /hr/payrolls/generate`, `POST /hr/payrolls/:id/post`, `POST /hr/payrolls/:id/cancel`

---

## 20. F3 Production data model

### 20.1 Conventions

- Same as §13.0; business entities extend `TenantBaseEntity` (soft delete, `tenant_id` isolation).
- Quantities `numeric(18,4)`; waste rate `numeric(6,2)` (percent); money `numeric(14,2)`; currency from the tenant (`tenants.default_currency`).
- Cost is computed at completion using the stock's current `average_cost` for each consumed component.

### 20.2 Tables

| Table | Columns (besides base + tenant) | Notes / indexes |
|-------|--------------------------------|-----------------|
| `production_boms` | `name`, `product_id`, `output_quantity` (default 1), `active`, `version` | BOM for a finished product; index `(tenant_id, product_id)`, `(tenant_id, name)` |
| `production_bom_lines` | `bom_id`, `product_id`, `quantity`, `waste_rate` (default 0) | per-unit quantity of the component (relative to order quantity); a component cannot be the finished product itself; index `(tenant_id, bom_id)` |
| `production_orders` | `number`, `product_id`, `bom_id` (nullable), `quantity`, `status` (enum), `warehouse_id`, `currency`, `labor_cost`, `overhead`, `material_cost`, `total_cost`, `completed_at`, `notes`, `version` | `number` per tenant via series `MO`; **unique** `(tenant_id, number)`; index `(tenant_id, status)`, `(tenant_id, product_id)`, `(tenant_id, warehouse_id)` |
| `production_order_lines` | `order_id`, `product_id`, `planned_quantity`, `consumed_quantity`, `unit_cost`, `line_cost` | material consumption snapshot at completion; **unique** `(tenant_id, order_id, product_id)` |

**Enums added in `packages/core`**

- `ProductionOrderStatus`: planned, in_progress, completed, cancelled
- `DocumentSeriesKind` += `production_order`
- Role `warehouse` gains `production:read` / `production:write`.

### 20.3 Key flows

- **BOM create/update:** validates every component product exists and that no component equals the finished product (`400`); update soft-deletes existing lines and recreates them inside the transaction.
- **Order create:** validates product, warehouse and BOM (BOM must produce the order's product, else `400`); allocates the next `MO` number; default status `planned`.
- **Update/delete:** only allowed while `planned` (`400` otherwise).
- **Start:** `planned → in_progress`; does **not** validate stock.
- **Complete:** `in_progress → completed`; re-reads the order inside the transaction (state guard). For each BOM line consumes `round4(quantity × order.quantity × (1 + waste_rate/100))` as an outbound movement (`unit_cost` = current `average_cost`); insufficient stock → `400`. Then receives `order.quantity` of the finished product inbound with `unit_cost = round2(total_cost / quantity)`. Writes `production_order_lines`, computes `material_cost` (sum of line costs), `total_cost = material_cost + labor_cost + overhead`, stamps `completed_at`. Posts a balanced journal entry (same transaction): **Dr `1200` Inventory `total_cost`, Cr `1200` Inventory `material_cost`, Cr `6000` Payroll expense `total_cost - material_cost`** (only if positive), description `Production <number>`, `reference_type = 'production_order'`. `ChartAccountNotFoundError → 400`, `PeriodClosed/Unbalanced → 409`.
- **Cancel:** `planned` or `in_progress → cancelled`; no stock/accounting side effects.
- **Series:** `MO` (document series kind `production_order`), default prefix `MO` in seeds.

### 20.4 API surface (`/production/...`, module permission `PRODUCTION` with `read`, `write`)

- `GET/POST /production/boms`, `GET/PATCH/DELETE /production/boms/:id`
- `GET/POST /production/orders`, `GET/PATCH/DELETE /production/orders/:id`
- `POST /production/orders/:id/start`, `POST /production/orders/:id/complete`, `POST /production/orders/:id/cancel`

---

## 21. F4 Reporting data model (BI reports)

### 21.1 Conventions

- **No new tables or entities.** All reports derive from existing tables: `invoices`, `invoice_items`, `stock_movements`, `product_stock`, `goods_receipts`, `purchase_orders`, `supplier_payments`, `production_orders`, `journal_entries`, `journal_entry_lines`, `payments`.
- Read-only, tenant-scoped SQL (parametrized, `$1 = tenant_id`), respecting soft deletes and `journal_entries.status <> 'draft'`.
- Module permission: `reporting:read` (role `accountant` has it seeded). All routes under `/reports/...`; every endpoint supports `?format=csv|pdf|xlsx` (CSV/XLSX returned as `Content-Disposition` attachments, PDF rendered with pdfkit).

### 21.2 Endpoints

| Endpoint | Output |
|----------|--------|
| `GET /reports/dashboard` | salesToday, salesMonth, monthInvoices, receivables, payables, inventoryValue, lowStockProducts, openPurchaseOrders, productionInProgress, netIncomeMonth (+ range variants `rangeInvoices`, `netIncomeRange` with `from`/`to`) |
| `GET /reports/alerts` | actionable alerts feed: low stock, overdue receivables and payables |
| `GET /reports/inventory/valuation?warehouseId=` | rows per product/warehouse (quantity × average cost) + totals |
| `GET /reports/inventory/movements?productId=&warehouseId=&movementType=&from=&to=&page=&limit=` | paginated stock movements (+ count) |
| `GET /reports/inventory/low-stock?threshold=` | products at or below threshold (default 10) |
| `GET /reports/sales/summary?groupBy=day\|month\|quarter\|year&from=&to=` | period buckets (revenue net of discounts, tax, total; credit notes negative) + totals |
| `GET /reports/sales/by-product?from=&to=` | per product: quantity, revenue, COGS, grossProfit, margin + totals |
| `GET /reports/sales/by-customer?from=&to=` | per customer: invoices, totalSold (net), totalPaid, balance (AR) + totals |
| `GET /reports/aging/ar` | AR per customer bucketed by `CURRENT_DATE - COALESCE(due_date, issue_date)` (current / 1–30 / 31–60 / 61–90 / 90+) |
| `GET /reports/aging/ap` | AP per supplier bucketed by `bill_date` (bills) / `received_at` (unbilled receipts) age, **net of `supplier_payments` not linked to a bill** (payments applied FIFO to the oldest buckets first; total = max(0, received − paid)) |
| `GET /reports/financial/income-statement?periodId=&from=&to=` | revenue / cost of sales / operating expenses sections + net income |
| `GET /reports/financial/balance-sheet?asOf=` | assets / liabilities / equity sections (equity includes current-period net income) |
| `GET /reports/financial/cash-flow?from=&to=` | monthly cash-flow statement: inflows / outflows / net per period + running cash balance |
| `GET /reports/hr/payroll?from=&to=` | payroll summary per period |

### 21.3 Formulas (source of truth)

- **COGS (sales) per product:** `SUM(-sm.quantity × sm.unit_cost)` over `stock_movements` with `reference_type IN ('invoice','credit_note')`. Invoice outbound movements carry the real average cost (`invoices.service.ts` `applyOutbound`).
- **Income statement:** revenue from `invoices` (issued, credit notes as negative); `costOfSales`/`operatingExpenses` from `journal_entry_lines` joined to expense accounts (`account_code` LIKE `5%` / `6%`); `netIncome = revenue - cogs - opex`.
- **Balance sheet:** journal entries with `entry_date <= asOf`; equity includes **Net income (current period)** computed from the 1st of the month to `asOf`.
- **Dashboard:** sales today/month, monthly invoice count, AR balance (sum `balance_due`), AP (issued bill balances + goods receipts minus `supplier_payments` not linked to a bill), inventory value (physical stock × avg cost), low stock (≤ threshold), open POs (`approved`), production in progress, net income month.

---

## 22. F4 Payments data model (online card via Stripe)

### 22.1 Conventions

Same as §13.0 (TenantBaseEntity, UUID PK, enums in `packages/core`). Secrets (Stripe secret key, webhook signing secret) are stored per tenant and **never returned**: responses expose `secretKeyMasked` / `webhookSecretMasked` (`first6********last4`, or `********` when ≤ 8 chars).

### 22.2 Tables

| Table | Columns (besides base + tenant) | Notes / indexes |
|-------|--------------------------------|-----------------|
| `payment_providers` | `provider` (enum: stripe), `environment` (enum: test/live), `secret_key`, `webhook_secret`, `is_enabled` (default false) | one row per `(tenant_id, provider)`; index `(tenant_id, provider)` |

**Enums added in `packages/core`**

- `PaymentProvider`: stripe
- `PaymentProviderEnvironment`: test, live

### 22.3 API surface

Module permission `PAYMENTS` (`read`, `write`) for `/payments/...`; `/webhooks/...` is `@Public()`.

- `GET /payments/providers` — list configured providers with masked secrets (`payments:read`).
- `PUT /payments/providers/:provider` — create or update a provider config (`{ environment, secretKey, webhookSecret, isEnabled? }`); secrets are stored and masked in the response (`payments:write`).
- `POST /payments/invoices/:id/checkout` — requires an **issued** invoice with `balance_due > 0` and an enabled provider; creates a Stripe Checkout Session server-side (amount = `balance_due`, currency = invoice currency, unit amounts in cents, metadata `invoiceId`/`tenantId`, idempotency key `checkout:<invoiceId>`) and returns `{ url }` (`invoicing:write`). No config → `400`; provider disabled → `400`; unknown invoice → `404`; not issued / fully paid → `400`.
- `POST /webhooks/stripe` — **public**, signature-verified. Verifies the `Stripe-Signature` header (`t=<ts>,v1=<hmac-sha256>`, timestamp tolerance ±300 s) against the enabled Stripe config's `webhook_secret` (any tenant whose secret matches), then for `checkout.session.completed` records a card payment on the referenced invoice (`method = card`, `reference = session id`, `amount_total`/`currency` from the session) via the standard payment flow → journal entry + outbox `payment.received`. Missing/invalid signature → `400`; unrelated event types → `{ received: true }`.

### 22.4 Key flows

1. **Configure:** an admin stores the Stripe secret key and webhook signing secret (`PUT /payments/providers/stripe`) and enables the provider.
2. **Checkout:** the dashboard calls the checkout endpoint with an issued invoice; the API builds a Stripe Checkout Session and returns the hosted redirect URL (success/cancel URLs derive from the request `Origin`/`Referer`, defaulting to `http://localhost:5173`).
3. **Payment:** after the customer pays, Stripe posts `checkout.session.completed` back to `POST /webhooks/stripe`. The API verifies the signature over the **raw** body (captured before `express.json`), then records the payment. The session id (stored as the payment `reference`) makes replays idempotent: a duplicated webhook records no second payment and the outbox holds a single `payment.received` event.

---

## 23. MX/US tax compliance data model (CFDI 4.0)

### 23.1 Conventions

Same as §13.0 (TenantBaseEntity, UUID PK, enums in `packages/core`). The feature is **MX-only and demo-timbrado**: CFDI 4.0 documents are generated locally and self-contained (XML + cadena original + RSA-SHA256 `sello` + Timbre Fiscal Digital 1.1), signed with **self-signed per-tenant certificates** (emisor + a demo PAC `XND000000000`). There is **no real PAC**: no SAT submission, UUIDs are locally generated, and cancellation just flips the status. Real PAC integration is the production hook (F4).

### 23.2 Tables

| Table | Columns (besides base + tenant) | Notes / indexes |
|-------|--------------------------------|-----------------|
| `cfdi_documents` | `invoice_id`, `uuid`, `serie` (nullable), `folio` (nullable), `version` (default `4.0`), `type` (`I`/`E`), `status` (enum `CfdiStatus`: pending/stamped/cancelled, default pending), `emitter_rfc`, `emitter_name`, `emitter_regime`, `receiver_rfc`, `receiver_name`, `receiver_uso` (nullable), `payment_form`, `payment_method`, `exportacion` (default `01`), `place_of_expedition`, `currency`, `exchange_rate` (default 1), `subtotal`, `discount`, `tax`, `total`, `xml` (text), `cadena_original` (text), `sello` (text), `cert_number`, `rfc_prov_certif`, `cert_sat_number`, `stamped_at` (nullable), `cancelled_at` (nullable) | **unique** `(tenant_id, invoice_id)` and `(tenant_id, uuid)`; indexes `(tenant_id)`, `(tenant_id, invoice_id)`, `(tenant_id, uuid)`, `(tenant_id, status)` |
| `cfdi_certificates` | `kind` (`emisor`/`pac`), `rfc`, `name`, `serial_number`, `valid_from`, `valid_to`, `certificate_pem` (text), `private_key_pem` (text), `active` (default true) | **unique** `(tenant_id, kind)`; per-tenant lazily-created self-signed certs |
| `tenants` (+): | `fiscal_regime` (nullable), `fiscal_address` (jsonb: street/exterior/interior/zip/city), `config.cfdi` (jsonb: `{ enabled, paymentForm, paymentMethod, placeOfExpedition }`) | `placeOfExpedition` falls back to `fiscal_address.zip`, then `00000` |

**Enums and constants added in `packages/core`**

- `CfdiStatus`: pending, stamped, cancelled
- `ModuleName.TAX` (permissions `tax:read`, `tax:write`; seeded: accountant read+write, seller read)
- RFC/EIN validators: `validateRfc` (MX: length 12–13, homoclave; returns the reason on failure) + `normalizeRfc` (upper, strips spaces/dashes), `validateEin` (US: 2-1-4 or 9 digits), generic RFCs `XAXX010101000` (receptor) / `XEXX010101000` (emisor)
- Catalogs: `FISCAL_REGIMES`, `USO_CFDI`, `CFDI_PAYMENT_FORMS`, `CFDI_PAYMENT_METHODS`, `SAT_PRODUCT_KEYS`, `SAT_UNITS` + `satUnitForKey` (maps product unit → SAT `ClaveUnidad`, e.g. `H87` for piece, `KGM` for kg, `E48` for service)

### 23.3 Document generation

- **Trigger:** the outbox consumer `CfdiService.handle` processes `invoice.issued` / `credit_note.issued` and calls `generateForInvoice` (never throws). Generation is **idempotent** — returns the existing record on `(tenant_id, invoice_id)`, and a unique-violation retry re-fetches on race. Skips (returns `null`) when `tenant.country !== 'MX'` or `settings.enabled === false`.
- **Inputs:** invoice (+ items with product SKU/unit), tenant (name, RFC from `tax_id`, `fiscalRegime` default `601`, `fiscalAddress`), customer (name, RFC from `tax_id`, `usoCfdi` default `G03`, `regimenFiscal` default `616`), and the per-tenant certificates. Generic RFCs (`XAXX010101000`/`XEXX010101000`) are used when the emitter/receptor RFC is missing.
- **XML:** CFDI 4.0 `cfdi:Comprobante` (`Version 4.0`, `TipoDeComprobante I`/`E`, `Serie`/`Folio` split from the invoice number via `/^([A-Za-z0-9]+)-(\d+)$/` → `INV`/`000001`), `Cfdi:Impuestos` (`001` ISR / `002` IVA / `003` IEPS with `Tasa` type factors), SAT `ClaveProdServ` default `01010101`, `Exportacion 01`, `LugarExpedicion` from settings. TFD 1.1 (`tfd:TimbreFiscalDigital`, `Version 1.1`, `UUID`, `FechaTimbrado`, `RfcProvCertif` = demo PAC `XND000000000`, `SelloCFD`, `NoCertificadoSAT`) is appended.
- **Cadena original:** CFDI 4.0 comprobante chain + TFD 1.1 chain (`||...||` delimited); `cadenaClean` trims, collapses whitespace, escapes `|` → `||`, removes `\r\n\t`; `sello` = `RSA-SHA256` over the cadena original, base64.
- **Certificates:** `generateDemoCertificate` (selfsigned 5.5.0, async WebCrypto) creates per-tenant emisor + PAC certs on first use; serial number normalized to 20 hex digits via `crypto.X509Certificate`; `validFrom`/`validTo` stored as `YYYY-MM-DD`; PEMs kept in DB (see `certificate.util.ts`).
- **Stored UUIDs** are lowercase (Postgres `uuid`); the TFD XML keeps the uppercase canonical form.

### 23.4 API surface (`/tax/...`, module permission `TAX`)

- `GET /tax/settings`, `PUT /tax/settings` — read/update `{ enabled, paymentForm, paymentMethod, placeOfExpedition }` (persisted in `tenant.config.cfdi`); response also includes `rfc`, `regime`, `country` (`tax:read`/`tax:write`).
- `GET /tax/cfdi?page=&limit=&status=` — paginated list (`tax:read`).
- `GET /tax/cfdi/invoices/:invoiceId` — the CFDI for an invoice, `404` if none (`tax:read`).
- `POST /tax/cfdi/invoices/:invoiceId/generate` — idempotent on-demand generation (`tax:write`).
- `GET /tax/cfdi/:id`, `GET /tax/cfdi/:id/xml` — document and XML download (`application/xml`, `Content-Disposition: attachment; filename="<UUID>.xml"`) (`tax:read`).
- `PUT /tax/cfdi/:id/cancel` — demo cancel: sets `status = cancelled` + `cancelled_at` (no PAC cancellation) (`tax:write`).
- `GET /tax/catalogs` — `{ regimes, usos, paymentForms, paymentMethods, productKeys }` (`tax:read`).
- `GET /tax/us-sales-tax`, `PUT /tax/us-sales-tax`, `GET /tax/us-sales-tax/states` — US sales tax nexus config + state catalog (see §24) (`tax:read`/`tax:write`).

### 23.5 Customer validation

`customers.service.ts` validates/normalizes `tax_id` by tenant country on create/update: MX → `validateRfc` + `normalizeRfc`, US → `validateEin` (dashes stripped), others → trim. Customer create/update DTOs accept `uso_cfdi` / `regimen_fiscal` constrained to `USO_CFDI` / `FISCAL_REGIMES` keys (`@IsIn`). Web: the invoice detail modal shows the CFDI UUID, status, total and a "Download XML" button (`GET /tax/cfdi/invoices/:invoiceId` + `GET /tax/cfdi/:id/xml`).

---

## 24. US sales tax (nexus)

### 24.1 Conventions

US-only feature for tenants with `country = 'US'`. Sales tax is applied per sale line: each line's `tax_rate` defaults to the **resolved rate** for the customer's billing state, governed by the tenant's nexus configuration. Non-US tenants, states without nexus, unknown states, and tax-exempt customers all resolve to `0`. An explicit per-line `taxRate` on the request always wins over the resolved default.

### 24.2 Configuration and data model

| Item | Type | Notes |
|------|------|-------|
| `tenants.config.usSalesTax` | jsonb | `{ nexusStates: string[], rates: Record<string, number> }`; seeded `{ nexusStates: ['CA','TX'], rates: {} }` for US tenants. |
| `customers.state` | varchar(2) nullable | US state code of the billing address. |
| `customers.tax_exempt` | boolean, default false | Exempt customers are never charged sales tax. |
| `US_STATES` (in `packages/core`) | `Record<string, { name, rate }>` | 50 states + DC with base state-level sales tax rates (fraction); `config.rates` overrides win over these defaults. |

### 24.3 Resolution rule

`UsSalesTaxService.resolveRate(tenantId, customerState, taxExempt)` (`apps/api/src/modules/tax/us-sales-tax.service.ts`):

- `0` when there is no tenant context, the tenant country is not `US`, the customer is `tax_exempt`, or `customerState` is missing;
- `0` when the state is not in `nexusStates` or is unknown;
- otherwise `config.rates[state] ?? US_STATES[state].rate`.

Resolution happens during invoice/order creation (`invoices.service.ts`, `orders.service.ts`): line `tax_rate = item.taxRate ?? resolved`, and `tax_amount`/totals are computed from it as usual (§8, §16.4). The web POS posts through the same invoice endpoint, so POS lines without an explicit rate are auto-taxed the same way.

### 24.4 API surface (`/tax/...`, module permission `TAX` with `read`/`write`)

- `GET /tax/us-sales-tax` — `{ nexusStates, rates, country }` (`tax:read`).
- `PUT /tax/us-sales-tax` — body `{ nexusStates?, rates? }`; unknown state → `400`; rate outside 0–0.5 → `400`; only nexus-state rate overrides persist (`tax:write`).
- `GET /tax/us-sales-tax/states` — `US_STATES` catalog `code → { name, rate }` (`tax:read`).

Web: Settings page (`/settings`, nav gated on `tax:read`) edits nexus checkboxes and per-state rate overrides; the customer form captures `state` (US state dropdown) and `tax_exempt`.

---

## 25. Web dashboard (F4)

### 25.1 Stack

- React 19 + Vite 7 + React Router 7, TanStack Query (server state), Tailwind CSS 4, Radix UI primitives (dialog, select, checkbox, toast, `Slot`), lucide-react icons, recharts charts, react-hook-form + zod validation.
- i18next/react-i18next with `en`/`es` resources (`apps/web/src/locales/`), Spanish default, persisted in localStorage (`aptifum.language`); switcher in the sidebar and settings.
- Light/dark theme persisted in localStorage (`aptifum.theme`), defaults to the system preference.
- Typed API client generated from the OpenAPI spec (`pnpm --filter @aptifum/web gen:api` → `src/api/schema.ts`); CI fails on drift.

### 25.2 Pages and navigation

Navigation is permission-gated and grouped via `apps/web/src/auth/route-permissions.ts` (`RouteGuard` + `NavGroup`):

| Group | Routes |
|-------|--------|
| overview | dashboard (`reporting:read`), profile |
| sales | POS (`invoicing:read`), invoices, customers, sales orders (`sales:read`) |
| purchasing | purchase orders, suppliers (`purchasing:read`) |
| inventory | products, stock, warehouses (`inventory:read`) |
| finance | accounting, chart of accounts (`accounting:read`) |
| crm | contacts/leads/opportunities/activities (`crm:read`) |
| hr | employees, attendance/leaves (`hr:read`) |
| production | production orders (`production:read`) |
| system | reports (`reporting:read`), users & roles (`users:read`), audit (`audit:read`), settings (`tax:read`) |

Protected routes render `Forbidden`/`NotFound` and redirect to login when unauthenticated. The sidebar collapses on desktop (state persisted) and becomes a drawer under 900 px; the active route shows an accent bar and nav links expose focus-visible rings. Login and auth pages (forgot/reset password, accept invite) use theme-aware branding (CSS `--color-primary`).

### 25.3 Shared components

Shared primitives live in `apps/web/src/components/ui/*`: `Input`, `Select`, `Textarea`, `Button` (variants + `loading` state), `Card` (composable, Radix `Slot.asChild`), `Dialog`, `ConfirmDialog` (destructive confirmations with `busy` state), `Table`, `Badge`, `Checkbox`, `SearchableSelect`. All forms use react-hook-form + zod; destructive actions always go through the shared `ConfirmDialog`.

### 25.4 Testing

- **Unit:** Vitest + Testing Library (`pnpm --filter @aptifum/web test`) — components, i18n and helpers (~75 tests).
- **E2E:** Playwright (`apps/web/playwright.config.ts`) covering auth, inventory, POS, RBAC, reports and sales flows.
- **CI:** web unit tests and the OpenAPI drift check run in GitHub Actions; Playwright e2e is run locally (`pnpm --filter @aptifum/web test:e2e`).

