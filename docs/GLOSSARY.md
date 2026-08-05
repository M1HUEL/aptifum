# Aptifum ERP — Domain Glossary

> Living document. Terms follow the names used in the codebase (`packages/core`, `packages/database`, `apps/api`) and `docs/SPEC.md`.

---

## 1. General / platform

| Term | Definition |
|------|------------|
| **Tenant** | Company/organization that owns the data. Every business record is scoped to a `tenant_id`; isolation is structural. |
| **TenantBaseEntity** | Base entity for all business tables: UUID `id`, `created_at`/`updated_at`/`deleted_at`, plus `tenant_id`. |
| **Soft delete** | Logical deletion via `deleted_at` instead of physical removal (`DELETE` in the API deactivates; `PATCH` reactivates). |
| **Optimistic lock** | Concurrency control using a `version` column; a write fails if the version read is stale. Used on `products`, `product_stock`, `sales_orders`, `invoices`. |
| **Audit log** | Append-only record of every mutation (`audit_logs`): user, module, entity, action, before/after JSON, request id. |
| **RBAC** | Role-based access control. Roles (`admin`, `accountant`, `seller`, `warehouse`, `hr`) bundle granular permissions per module/action (e.g. `inventory:adjust`). |
| **Permission** | String `module:action` (e.g. `sales:write`, `invoicing:read`) checked by guards on each route. |
| **Idempotency key** | Client-supplied header (`Idempotency-Key`) that deduplicates financial POSTs; the server stores the response keyed by it (`idempotency_keys`). |
| **Request id** | Traceable identifier (`x-request-id`) propagated through logs and error responses. |
| **Domain event** | Cross-module notification (e.g. `sale.invoiced`, `payment.received`); modules communicate via events, not direct imports. |

## 2. Inventory

| Term | Definition |
|------|------------|
| **SKU** | Stock keeping unit: the unique code identifying a sellable product within a tenant. |
| **Product** | An item sold or stocked (`products`), with prices (purchase/sale), category, brand, unit of measure, barcode. |
| **Category** | Hierarchical classification of products (`categories`), with optional parent (tree). |
| **Warehouse** | Physical storage location (`warehouses`), identified by a unique `code` within the tenant. |
| **Warehouse location** | A named spot inside a warehouse (`warehouse_locations`); informational in F1. |
| **Product stock** | Current stock snapshot per `(product, warehouse)` (`product_stock`): `quantity`, `reserved_quantity`, `average_cost`. Single source of truth for on-hand totals. |
| **Stock movement** | Append-only record of any change to stock (`stock_movements`): signed `quantity`, `unit_cost`, source document reference, user. Each movement is validated and transactional. |
| **MovementType** | Enum: `inbound`, `outbound`, `adjustment`, `transfer`, `return`, `disposal`. |
| **Weighted average cost** | Default valuation: `new_avg = (prev_qty * prev_cost + qty * unit_cost) / (prev_qty + qty)`; applied on inbound movements. |
| **COGS** | Cost of goods sold; posted when an invoice moves stock out, at the current `average_cost`. |
| **Inbound** | Stock-in movement (receipt, purchase, initial stock). |
| **Outbound** | Stock-out movement (sale). |
| **Adjustment** | Authorized change to correct or set stock (`inventory:adjust`); the only movement allowed to fix discrepancies. |
| **Transfer** | Movement between warehouses; not yet implemented (service rejects it). |
| **Return** | Stock reintegration, e.g. from a credit note. |
| **Disposal** | Stock-out for damaged/expired goods. |
| **Reserved quantity** | Stock committed to open orders (field exists; reservation not yet implemented). |

## 3. Sales and billing

| Term | Definition |
|------|------------|
| **Customer** | Buyer of goods (`customers`): trade/legal name, tax id, contacts, currency, credit limit, price category. |
| **Quote** | Non-binding sales document (`sales_orders` with `kind = quote`); convertible to an order. |
| **Sales order** | Confirmed customer commitment (`sales_orders` with `kind = order`); statuses `draft → confirmed → invoiced`, or `cancelled`. |
| **SalesOrderKind** | Enum: `quote`, `order`. |
| **SalesOrderStatus** | Enum: `draft`, `confirmed`, `invoiced`, `cancelled`. |
| **Invoice** | Issued billing document (`invoices`, `type = invoice`), typically generated from a confirmed order or directly. Issuing it moves stock out in the same transaction. |
| **Credit note (NC)** | Document that reverses an invoice (`invoices`, `type = credit_note`); returns stock to the warehouse when applicable. |
| **InvoiceType** | Enum: `invoice`, `credit_note`. |
| **InvoiceStatus** | Enum: `draft`, `issued`, `cancelled`. |
| **Document series** | Per-tenant numbering configuration (`document_series`): kind, prefix, `next_number`. Numbers are assigned atomically under a row lock (e.g. `INV-000001`). |
| **DocumentSeriesKind** | Enum: `quote`, `order`, `invoice`, `credit_note`. |
| **Line total** | `quantity × unit_price` before discount/tax, per item. |
| **Discount** | Reduction applied at line level or globally to the document (`subtotal − discount → taxable → + tax = total`). |
| **Tax** | Configured tax rate (`taxes`), `kind` sales/purchase; applied per line via `tax_rate`/`tax_amount`. |
| **Payment** | Money received against an invoice (`payments`): method, amount, received date, reference. Partials allowed. |
| **PaymentMethod** | Enum: `cash`, `card`, `transfer`, `other`. |
| **Paid amount / balance due** | Running totals on the invoice updated with every payment; `balance_due = total − paid_amount`. |
| **Accounts receivable (AR)** | Outstanding customer balances derived from unpaid invoices. |
| **Collections** | Process of recording and tracking customer payments (F1: payment recording per invoice). |

## 4. References

- Model and relationships: `docs/SPEC.md` §13.
- Enums: `packages/core/src/index.ts`.
- Entities: `packages/database/src/entities/`.
- Stock logic: `packages/database/src/services/stock.ts`.
