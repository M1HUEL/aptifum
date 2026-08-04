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
- **Tenants:** company configuration (name, tax ID, default currency, taxes, document series).

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
- **Integration:** won opportunity converts into customer + quote/order.

### 6.7 Production (light / assembly)
- **BOM / Recipes:** component list with quantities and waste.
- **Production orders:** status (planned → in progress → completed), material consumption (inventory outbound) and finished-good inbound.
- **Costing:** order cost = consumed materials + labor + overhead.
- **Retail scenarios:** kits, repacking, prepared food.

### 6.8 Reporting
- Inventory: valuation, movements, low stock, profitability per product.
- Sales: by seller, product, customer, period; accounts receivable (aging).
- Purchasing: by supplier, accounts payable (aging).
- Financial: balance sheet, income statement, cash flow.
- Export: CSV, Excel, PDF.
- Executive dashboard (key metrics).

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
- **i18n:** UI in Spanish (es) with room for more languages; localized dates/numbers.
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
| **F4 · Analytics and platform** | BI reports, dashboard, exports, integrations (banks, tax, e-commerce), web frontend | Complete ERP for 20–200 users |

---

## 11. Open decisions (to resolve)

1. **Country-specific tax rules** (VAT, e-invoicing, tax IDs). Single country initially?
2. **Physical POS / offline sales** — required in F1 or web-only?
3. **Multi-currency** — needed or single currency per company?
4. **Notifications** — email/SMS for due dates, orders, approvals?
5. **Languages** — Spanish only or multi-language from the start?
6. **Team** — does more than one person work on the repo? (affects conventions and CI rules)
7. **User stories / concrete examples** — is there a real pilot business to validate business rules?

---

## 12. Progress

- [x] Monorepo scaffold (F0): Turborepo + pnpm, NestJS API, PostgreSQL, auth + RBAC + tenants + audit, seeders, Swagger, Vitest.
- [x] F1 data model definition (§13).

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
| `invoices` | `number` (unique per tenant), `series_id`, `type` (enum: invoice/credit_note), `status` (enum: draft/issued/cancelled), `customer_id`, `order_id` (nullable), `issue_date`, `due_date`, `currency`, `subtotal`, `discount`, `tax`, `total`, `paid_amount`, `balance_due`, `notes`, `version` | index `(tenant_id, number)`, `(tenant_id, customer_id, issue_date)` |
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

1. Implement F1 **Inventory** module (entities, migration, CRUD, movements, valuation).
2. Implement F1 **Sales/billing** module (customers, orders, invoices, payments, series).
3. Resolve open decisions in §11 as they become blocking (tax country, currency, POS).
4. Create the **domain glossary**.
