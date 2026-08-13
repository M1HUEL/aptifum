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
| **Product variant** | A variation of a product (`product_variants`, e.g. size/color) with its own SKU, barcode, attributes (jsonb) and prices; SKU unique per tenant. |
| **Category** | Hierarchical classification of products (`categories`), with optional parent (tree). |
| **Warehouse** | Physical storage location (`warehouses`), identified by a unique `code` within the tenant. |
| **Warehouse location** | A named spot inside a warehouse (`warehouse_locations`); informational in F1. |
| **Product stock** | Current stock snapshot per `(product, warehouse)` (`product_stock`): `quantity`, `reserved_quantity`, `average_cost`. Single source of truth for on-hand totals. |
| **Stock movement** | Append-only record of any change to stock (`stock_movements`): signed `quantity`, `unit_cost`, source document reference, user. Each movement is validated and transactional. |
| **MovementType** | Enum: `inbound`, `outbound`, `adjustment`, `transfer`, `return`, `disposal`. |
| **Weighted average cost** | Default valuation: `new_avg = (prev_qty * prev_cost + qty * unit_cost) / (prev_qty + qty)`; applied on inbound movements. |
| **COGS** | Cost of goods sold; posted when an invoice moves stock out, at the current `average_cost`. Always expressed in the functional currency. |
| **Inbound** | Stock-in movement (receipt, purchase, initial stock). |
| **Outbound** | Stock-out movement (sale). |
| **Adjustment** | Authorized change to correct or set stock (`inventory:adjust`); the only movement allowed to fix discrepancies. |
| **Transfer** | Movement between warehouses: `transferStock` (pessimistic locks on both warehouses, preserves origin average cost, weighted-avg into destination, records a `transfer` movement per side) via `POST /inventory/transfers`. |
| **Return** | Stock reintegration, e.g. from a credit note. |
| **Disposal** | Stock-out for damaged/expired goods. |
| **Reserved quantity** | Stock committed to confirmed orders (`reserved_quantity`); reserved when an order is confirmed, released on cancel, consumed by the outbound movement when invoiced. Available stock = `quantity - reserved_quantity`. |

## 3. Sales and billing

| Term | Definition |
|------|------------|
| **Customer** | Buyer of goods (`customers`): trade/legal name, tax id, contacts, currency, credit limit, price category. MX customers also carry `uso_cfdi` and `regimen_fiscal` (CFDI §5); US customers carry `state` + `tax_exempt` for sales tax (§6). |
| **Quote** | Non-binding sales document (`sales_orders` with `kind = quote`); convertible to an order. |
| **Sales order** | Confirmed customer commitment (`sales_orders` with `kind = order`); statuses `draft → confirmed → invoiced`, or `cancelled`. |
| **SalesOrderKind** | Enum: `quote`, `order`. |
| **SalesOrderStatus** | Enum: `draft`, `confirmed`, `invoiced`, `cancelled`. |
| **Invoice** | Issued billing document (`invoices`, `type = invoice`), typically generated from a confirmed order or directly. Issuing it moves stock out in the same transaction. Carries a `currency` and an `exchange_rate` against the tenant's functional currency. |
| **Credit note (NC)** | Document that reverses an invoice (`invoices`, `type = credit_note`); returns stock to the warehouse when applicable. Reuses the original invoice's `exchange_rate`. |
| **InvoiceType** | Enum: `invoice`, `credit_note`. |
| **InvoiceStatus** | Enum: `draft`, `issued`, `cancelled`. |
| **Document series** | Per-tenant numbering configuration (`document_series`): kind, prefix, `next_number`. Numbers are assigned atomically under a row lock (e.g. `INV-000001`). |
| **DocumentSeriesKind** | Enum: `quote`, `order`, `invoice`, `credit_note`. |
| **Line total** | `quantity × unit_price` before discount/tax, per item. |
| **Discount** | Reduction applied at line level or globally to the document (`subtotal − discount → taxable → + tax = total`). |
| **Tax** | Configured tax rate (`taxes`), `kind` sales/purchase; applied per line via `tax_rate`/`tax_amount`. |
| **Payment** | Money received against an invoice (`payments`): method, amount, received date, reference, `exchange_rate`. Partials allowed. |
| **PaymentMethod** | Enum: `cash`, `card`, `transfer`, `other`. |
| **Paid amount / balance due** | Running totals on the invoice updated with every payment; `balance_due = total − paid_amount`. |
| **Accounts receivable (AR)** | Outstanding customer balances derived from unpaid invoices. |
| **Collections** | Process of recording and tracking customer payments (F1: payment recording per invoice). |
| **Functional currency** | The tenant's reporting currency (`tenants.default_currency`, default `USD`). All automatically posted journal entries are expressed in it. |
| **Exchange rate** | Per-tenant rate for a `(base, quote)` currency pair on a given date (`exchange_rates`), unique per `(tenant, base, quote, date)`. Stored as `rate = units of quote per 1 unit of base`. |
| **FX conversion** | Documents issued in a currency other than the functional one store `exchange_rate = functional → document currency` and their automatic entries post converted amounts (AR/sales/VAT, AP/cash). Inventory valuation (COGS/stock) is kept in functional currency and is not converted. |
| **FX gain / FX loss** | Reserved accounts `4200 Foreign exchange gain` / `6100 Foreign exchange loss` in the seeded chart of accounts. Posted by the revaluation and settlement-FX flows (SPEC §11 #3): `POST /accounting/revaluations` revalues open balances; payments realize the FX difference vs the booked rate. |

## 4. Payments (online card)

| Term | Definition |
|------|------------|
| **Payment provider** | External online payment processor configured per tenant (`payment_providers`): provider, environment, secrets (Stripe key + webhook signing secret), `is_enabled`. |
| **PaymentProvider** | Enum of supported gateways; today only `stripe`. |
| **PaymentProviderEnvironment** | Enum `test` / `live` for a provider config. |
| **Masked secret** | Provider configs never return raw secrets; responses expose `secretKeyMasked` / `webhookSecretMasked` (`first6********last4`, or `********` for secrets ≤ 8 chars). |
| **Stripe** | Payment gateway used for online card checkout (`stripe-client.service.ts`); the API builds sessions server-side and hosts a signature-verified webhook endpoint. |
| **Checkout session** | A Stripe Checkout Session created per invoice (`checkout:<invoiceId>` idempotency key); returns a hosted redirect URL where the customer pays. |
| **Stripe signature** | Webhook header `t=<timestamp>,v1=<hmac-sha256>`; verified against the tenant's stored `webhook_secret` with a ±300 s timestamp tolerance over the exact (raw) request body. |
| **Webhook** | Server-to-server HTTP callback (`POST /api/v1/webhooks/stripe`, public); `checkout.session.completed` is recorded as a **card payment**. |
| **Card payment** | A `payments` row with `method = card` and `reference = Stripe session id`, recorded by the webhook through the standard payment flow (journal entry + outbox `payment.received`). The session id makes replays idempotent. |

## 5. Tax compliance (CFDI)

| Term | Definition |
|------|------------|
| **RFC** | Mexican fiscal registration number (`customers.tax_id` / `tenants.tax_id`): 12 chars for legal entities, 13 for individuals. Validated/normalized by `validateRfc`/`normalizeRfc` in `packages/core`. |
| **EIN** | US Employer Identification Number: 9 digits (formatted 2-1-4). Validated by `validateEin`. |
| **CFDI** | Comprobante Fiscal Digital por Internet — Mexican e-invoice. This project emits **CFDI 4.0** (Ingreso `I` / Egreso `E`) for MX tenants, self-contained: XML + cadena original + digital seal + TFD. |
| **TFD** | Timbre Fiscal Digital (`tfd:TimbreFiscalDigital` 1.1): the SAT-stamped receipt block with `UUID`, `FechaTimbrado`, `RfcProvCertif`, `SelloCFD`. Here it is **demo**: the UUID is locally generated (not SAT) and the PAC is the demo `XND000000000` ("Aptifum Demo PAC"). |
| **PAC** | Proveedor Autorizado de Certificación — the authorized third party that timbres a CFDI. Production would submit to a real PAC; today the document is signed locally (demo). |
| **Cadena original** | Canonical string that the digital seal is computed over (CFDI 4.0 comprobante chain + TFD 1.1 chain), `||`-delimited; whitespace collapsed and `|` escaped to `||`. |
| **Sello** | Digital seal: `RSA-SHA256` signature over the cadena original, base64 (`cfdi_documents.sello`). |
| **Uso CFDI** | SAT tax-usage code for the receptor (`customers.uso_cfdi`, catalog `USO_CFDI`, default `G03`). |
| **Régimen fiscal** | SAT fiscal regime code for emitter/receptor (`FISCAL_REGIMES`; defaults emitter `601` / receptor `616`). |
| **FormaPago / MetodoPago** | CFDI payment form/method attributes (`CFDI_PAYMENT_FORMS`, `CFDI_PAYMENT_METHODS`; defaults `99` / `PUE`). |
| **ClaveProdServ / ClaveUnidad** | SAT product key and unit key (`SAT_PRODUCT_KEYS`, `SAT_UNITS`); the unit maps from the product's unit via `satUnitForKey` (e.g. piece → `H87`, kg → `KGM`, service → `E48`). |
| **CfdiCertificate** | Per-tenant self-signed certificate (`cfdi_certificates`, kinds `emisor`/`pac`) generated with `selfsigned` (async WebCrypto); serial normalized to 20 hex digits, PEMs stored in the DB. |

## 6. US sales tax

| Term | Definition |
|------|------------|
| **US sales tax** | A consumption tax on retail sales that a US seller collects from the buyer based on the seller's **nexus** in the buyer's state. Each sale line's `tax_rate` defaults to the resolved rate when the tenant country is `US`. |
| **Nexus** | A seller's obligation to collect sales tax in a state (physical/economic presence). Configured per tenant as `tenants.config.usSalesTax.nexusStates`; sales to states outside nexus resolve to a `0` rate. |
| **Sales tax rate** | Fraction applied per line (`tax_rate`, `numeric(6,4)`). Base state-level rates come from `US_STATES` in `packages/core`; a tenant can override any nexus state via `config.usSalesTax.rates`. |
| **Tax exempt** | A customer flagged `customers.tax_exempt` (create/update via the API, checkbox in the web form) is never charged sales tax — the resolver returns `0`. |
| **Tax resolver** | `resolveUsSalesTaxRate` (`packages/core`) + `UsSalesTaxService.resolveRate` (`apps/api/src/modules/tax/`): `customerState` + `tax_exempt` + nexus config → line `tax_rate`. An explicit per-line rate always wins. |
| **US_STATES** | Catalog of 50 states + DC with `{ name, baseRate }` (fraction), served to the client by `GET /tax/us-sales-tax/states`. |

## 7. References

- Model and relationships: `docs/SPEC.md` §13, §22, §23, §24.
- Enums: `packages/core/src/index.ts`.
- Entities: `packages/database/src/entities/`.
- Stock logic: `packages/database/src/services/stock.ts`.
- CFDI builder/certs: `apps/api/src/modules/tax/`.
