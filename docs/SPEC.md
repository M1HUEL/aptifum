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
5. **Single stack, single language**: TypeScript end to end (backend, shared libraries, future frontend).

---

## 2. Tech stack

| Layer            | Technology                                                   |
|------------------|--------------------------------------------------------------|
| Monorepo         | **Turborepo** + pnpm                                         |
| Language         | TypeScript (strict mode)                                     |
| Backend          | **NestJS** (apps/api), domain-driven modular structure         |
| ORM              | **TypeORM** + PostgreSQL                                     |
| Database         | PostgreSQL 16 (transactional, ACID)                          |
| Auth             | JWT (access + refresh), bcrypt/argon2                        |
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
│   │           ├── inventory/        # Products, stock, movements, warehouses
│   │           ├── sales/            # Customers, quotes, orders, invoices
│   │           ├── invoicing/        # Billing, credit/debit notes, collections
│   │           ├── purchasing/       # Suppliers, POs, receiving, AP
│   │           ├── accounting/       # Chart of accounts, entries, closings
│   │           ├── hr/               # Employees, attendance, payroll
│   │           ├── crm/              # Opportunities, pipeline, activities
│   │           ├── production/       # BOMs/recipes, production orders
│   │           └── reporting/        # Reports, exports
│   └── web/                          # (Future) Frontend dashboard
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
- **Sensitive data:** hashed passwords (argon2), secrets in env/vault, never in the repo.

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
- **Customers:** tax data, contacts, credit limit, assigned category/pricing.
- **Quotes:** valid for X days, convertible to order.
- **Orders (sales orders):** optional stock reservation, discounts, shipping, status (draft → confirmed → invoiced).
- **Billing:** per-tenant automatic document series and numbering, taxes (VAT), line/global discounts, credit/debit notes, returns (stock reintegration).
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
- **Currency:** default functional currency; multi-currency as an extension (exchange rates, revaluation).

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
- **i18n:** English only (single language); UI and API strings are English, no i18n layer for now (see §11).
- **Observability:** structured JSON logs; optional metrics (OpenTelemetry) for request duration and errors.
- **Accountability:** full audit of all mutations (see §4).

---

## 10. Phased roadmap

| Phase | Content | Deliverable |
|-------|---------|-------------|
| **F0 · Foundation** | Monorepo scaffold (Turborepo + pnpm), NestJS API, PostgreSQL, auth + RBAC + tenants, audit, CI/CD, seeders, Swagger | Deployable base API with login and user management |
| **F1 · Commercial core** | Inventory (products, warehouses, movements, valuation) + Sales/billing (customers, quotes, orders, invoices, collections) | Complete sales flow with stock integration |
| **F2 · Finance** | Purchasing (suppliers, POs, receiving, AP) + Accounting (chart of accounts, automatic entries, reports) | Operational accounting close || **F3 · Organization** | CRM + Human Resources + Production | Fully integrated modules |
| **F4 · Analytics and platform** | BI reports, dashboard, exports, integrations (banks, tax, e-commerce), web frontend | Complete ERP for 20–200 users |

---

## 11. Resolved decisions

The following decisions were settled and now constrain the product (see §6 and §8 for impact):

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Country-specific tax rules | **US + Mexico.** Tenants carry a `country` (`US`/`MX`) with seeded tax presets: US → `Sales Tax` 8% (sales), MX → `IVA` 16% (sales). Tax IDs follow the local format (US EIN 9 digits, MX RFC 12–13 chars). Full compliance (CFDI e-invoicing/timbrado, US *sales tax* per state/nexus) is deferred to **F4**. |
| 2 | Physical POS / offline sales | **Web-only** for now. A web POS/cashier flow is a possible F4 addition; no offline/desktop client. |
| 3 | Multi-currency | **Single functional currency per tenant** (`default_currency`). Multi-currency (exchange rates, revaluation) is an F4 extension. |
| 4 | Notifications | **Email notifications shipped** for invoice/credit-note issuance, payments and goods receipts, delivered by the transactional outbox dispatcher (see §8). SMS and due-date/approval reminders deferred to **F4**. |
| 5 | Languages | **English only** (single language). UI and API strings are English; no i18n layer for now. |
| 6 | Team | **Single developer.** Conventions stay simple; lightweight CI. |
| 7 | Pilot business | **No real pilot yet.** Business rules are validated with synthetic examples; SPEC remains the reference. |

---

## 12. Progress

- [x] Monorepo scaffold (F0): Turborepo + pnpm, NestJS API, PostgreSQL, auth + RBAC + tenants + audit, seeders, Swagger, Vitest.
- [x] F1 data model definition (§13).
- [x] F1 Inventory module (entities, migration, CRUD, movements, valuation).
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
| `product_variants` | `product_id`, `sku`, `barcode`, `attributes` (jsonb: size/color), `purchase_price`, `sale_price` | optional for F1 |
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
| `customers` | `code`, `trade_name`, `legal_name`, `tax_id`, `email`, `phone`, `address`, `currency`, `credit_limit`, `price_category`, `active`, `version` | index `(tenant_id, code)`, `(tenant_id, tax_id)` |
| `taxes` | `name`, `rate` `numeric(6,4)`, `kind` (enum: sales/purchase), `active` | country-agnostic; tenant configures |
| `document_series` | `kind` (enum: quote/order/invoice/credit_note), `prefix`, `next_number` (bigint), `active` | per-tenant automatic numbering; atomic increment (row lock/serializable) |
| `sales_orders` | `number` (unique per tenant), `kind` (enum: quote/order), `status` (enum: draft/confirmed/invoiced/cancelled), `customer_id`, `warehouse_id`, `issue_date`, `due_date`, `currency`, `subtotal`, `discount`, `tax`, `total`, `notes`, `version` | quotes and orders share this table; index `(tenant_id, number)`, `(tenant_id, customer_id, issue_date)` |
| `sales_order_items` | `order_id`, `product_id`, `description`, `quantity`, `unit_price`, `discount`, `tax_rate`, `tax_amount`, `line_total` | index `(tenant_id, order_id)` |
| `invoices` | `number` (unique per tenant), `series_id`, `type` (enum: invoice/credit_note), `status` (enum: draft/issued/cancelled), `customer_id`, `order_id` (nullable), `warehouse_id` (nullable, source warehouse for COGS/returns), `issue_date`, `due_date`, `currency`, `subtotal`, `discount`, `tax`, `total`, `paid_amount`, `balance_due`, `notes`, `version` | index `(tenant_id, number)`, `(tenant_id, customer_id, issue_date)` |
| `invoice_items` | `invoice_id`, `product_id`, `description`, `quantity`, `unit_price`, `discount`, `tax_rate`, `tax_amount`, `line_total` | index `(tenant_id, invoice_id)` |
| `payments` | `invoice_id`, `method` (enum: cash/card/transfer/other), `amount`, `received_at`, `reference`, `notes` | partial payments; index `(tenant_id, invoice_id, received_at)` |
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
5. [ ] Next phases (see §10): F4 platform extensions (web frontend, integrations, exports Excel/PDF).

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
| `supplier_payments` | `supplier_id`, `bill_id` (nullable), `method` (enum: cash/card/transfer/other), `amount` `numeric(14,2)`, `paid_at`, `reference`, `notes` | append-only; index `(tenant_id, supplier_id)`, `(tenant_id, bill_id)` |
| `supplier_bills` | `number` (nullable until issued, unique per tenant), `status` (enum: draft/issued/paid/cancelled), `supplier_id`, `order_id` (nullable), `receipt_id` (nullable), `bill_date`, `due_date` (nullable), `currency`, `subtotal`, `tax`, `total`, `paid_amount`, `balance_due`, `notes`, `issued_at`, `version` | index `(tenant_id, number)`, `(tenant_id, supplier_id, bill_date)` |
| `supplier_bill_items` | `bill_id`, `product_id` (nullable), `description`, `quantity`, `unit_price`, `tax_rate`, `line_total` | index `(tenant_id, bill_id)` |

### 15.3 Key flows

1. **PO lifecycle:** `draft → approved → received`, or `cancelled` (from draft/approved only). Receive requires an approved order.
2. **Receiving (partial or full):** each goods receipt creates one `stock_movement` (`inbound`) per line **in the same transaction** (`reference_type='purchase_receipt'`, `reference_id=<receipt id>`), posting `unit_cost` from the PO line and updating `average_cost`. `purchase_order_items.received_quantity` increments per line; when every line is fully received the PO moves to `received`.
3. **Numbering:** `document_series` kinds `purchase_order` (prefix `PO`), `goods_receipt` (prefix `GR`) and `supplier_bill` (prefix `SB`), assigned atomically like sales.
4. **Supplier payments (AP):** `POST /purchasing/payments` records a payment against a supplier in a transaction: saves the `supplier_payments` row and posts a journal entry **Dr `2000` Accounts payable, Cr `1000` Cash** (`reference_type='supplier_payment'`, `reference_id=<payment id>`), reusing the PO receiving journal-entry pattern. Closed period or unbalanced → 400/409 like other auto-postings. `GET /purchasing/payments` lists payments (optionally filtered by `supplierId`). When `billId` is provided the payment must belong to an `issued` bill of the same supplier, cannot exceed `balance_due`, and updates `paid_amount`/`balance_due` (status → `paid` when the balance reaches zero).
5. **Supplier bills (AP reconciliation):** `POST /purchasing/bills` creates a **draft** bill (validates the supplier; optional linked receipt — rejects a draft for a receipt already billed and receipts of another supplier; totals from items via `computeTotals`). `POST /purchasing/bills/:id/issue` requires a draft, assigns the next `SB` series number, stamps `issued_at`, and posts the AP entry **in the same transaction** (outbox pattern) as the **variance vs the linked receipt**: received amount = Σ `goods_receipt_items.quantity × unit_cost`; equal → no entry; bill > receipt → **Dr `5000` COGS, Cr `2000` AP** for the difference; bill < receipt → inverse; no receipt → full amount **Dr `5000`, Cr `2000`**. Emits outbox event `supplier_bill.issued`. `POST /purchasing/bills/:id/cancel` only cancels drafts. `GET /purchasing/bills` lists (optional `supplierId` filter), `GET /purchasing/bills/:id` returns the bill with supplier and items. AP reports (aging, dashboard payables, overdue alerts) span issued bills (`balance_due`) plus receipts without a non-cancelled bill, net of payments not linked to a bill (FIFO).

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
| 5000 | Cost of goods sold | expense | debit |
| 6000 | Payroll expense | expense | debit |

### 16.4 Auto-posting rules (§8)

| Trigger | Debits | Credits |
|---------|--------|---------|
| Invoice issued (direct or from order) | 1100 (total); 5000 (cogs) | 4000 (subtotal − discount); 2100 (tax); 1200 (cogs) |
| Credit note | 4100 (subtotal − discount); 2100 (tax); 1200 (cogs) | 1100 (total); 5000 (cogs) |
| Payment received | 1000 (amount) | 1100 (amount) |
| Goods receipt | 1200 (received amount) | 2000 (received amount) |

COGS is taken from `product_stock.average_cost` before the outbound movement. Auto-posted entries use `reference_type` `invoice` / `credit_note` / `payment` / `purchase_receipt` and `reference_id` of the source document. A closed period rejects any new posting (409).

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
- Module permission: `reporting:read` (role `accountant` has it seeded). All routes under `/reports/...`; every endpoint supports `?format=csv` (returns `text/csv` with `Content-Disposition` attachment).

### 21.2 Endpoints

| Endpoint | Output |
|----------|--------|
| `GET /reports/dashboard` | salesToday, salesMonth, monthInvoices, receivables, payables, inventoryValue, lowStockProducts, openPurchaseOrders, productionInProgress, netIncomeMonth |
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

### 21.3 Formulas (source of truth)

- **COGS (sales) per product:** `SUM(-sm.quantity × sm.unit_cost)` over `stock_movements` with `reference_type IN ('invoice','credit_note')`. Invoice outbound movements carry the real average cost (`invoices.service.ts` `applyOutbound`).
- **Income statement:** revenue from `invoices` (issued, credit notes as negative); `costOfSales`/`operatingExpenses` from `journal_entry_lines` joined to expense accounts (`account_code` LIKE `5%` / `6%`); `netIncome = revenue - cogs - opex`.
- **Balance sheet:** journal entries with `entry_date <= asOf`; equity includes **Net income (current period)** computed from the 1st of the month to `asOf`.
- **Dashboard:** sales today/month, monthly invoice count, AR balance (sum `balance_due`), AP (issued bill balances + goods receipts minus `supplier_payments` not linked to a bill), inventory value (physical stock × avg cost), low stock (≤ threshold), open POs (`approved`), production in progress, net income month.

---

