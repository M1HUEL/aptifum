# Aptifum ERP — Backlog & Known Gaps (working notes)

> Living scratchpad. Collected from a SPEC-vs-implementation review (2026-08). Not part of the SPEC; keep `docs/SPEC.md` as the reference for what is defined.

## 1. Gaps (declared in SPEC, not implemented)

### 1.1 Architecture

- **Domain events + transactional outbox** (§1, §2, §6.2, §8): ~~SPEC declares modules communicate via domain events with a transactional outbox (`sale.invoiced`, `payment.received`, `credit_note.issued`, ...). Nothing exists today: no `@nestjs/event-emitter`, no outbox table, no dispatcher. Biggest architectural debt.~~ **DONE:** `outbox_events` table, `OutboxService.emit` (same transaction as source document), `OutboxDispatcher` cron every 10s with retry/fail, events emitted by sales/purchasing/hr/production. Remaining: consumers beyond email (webhooks, integrations, supplier bills).
- **Cross-module calls**: several flows already call services/helpers directly across module boundaries (e.g. `postJournalEntry` reused by purchasing/hr/production). When the outbox lands, revisit whether these should become events.

### 1.2 Functional (defined in SPEC, not built)

- **Product variants** (§6.1 / §13.1 `product_variants`): ~~entity does not exist (size/color, per-variant sku/barcode/price)~~ **DONE** — `product_variants` entity + migration + nested CRUD (`/inventory/products/:productId/variants`), variants embedded in product list/get; SKU unique per tenant. **Variants in stock/POS done (2026-08):** per-variant `variant_id` on `product_stock` / `stock_movements` / `invoice_items` / `sales_order_items`, stock helpers take `variantId` (receive/reserve/release/consume/adjust), POS catalog merges product + variant rows with variant sku/barcode search, POS ticket merges lines by `productId + variantId`; migration `VariantStock1786800000000`. Remaining: lots/expiry.
- **Warehouse locations CRUD** (§13.1): ~~`warehouse_locations` entity exists, but there is no controller/endpoint for it.~~ **DONE (2026-08):** `GET/POST /inventory/warehouses/:id/locations` (list ordered by name + add with per-warehouse unique code, duplicate → 400) now joined by `PATCH`/`DELETE /inventory/warehouses/:id/locations/:locationId` (update code/name/active, deactivate via soft delete consistent with warehouses/categories, cross-warehouse or already-deleted → 404). Web: locations table under each warehouse with Edit/Deactivate. e2e `warehouse-locations.e2e-spec.ts`.
- **Lot/expiry tracking** (§6.1 "lot/expiry tracking for perishables"): ~~not implemented.~~ **DONE (2026-08):** `product_lots` entity + migration `LotTracking1787000000000` (per `tenant/product/variant/warehouse/lotNumber`, `quantity` numeric, `expiry_date`); `stock_movements.lot_id` (+index, no FK) traces the lot; stock helpers are lot-aware — inbound with `lotNumber` upserts the lot (quantity+expiry) or with `lotId` adds to that lot, outbound with `lotId` deducts that lot, outbound without `lotId` consumes **FEFO** (expiry ASC, lot ASC) recording one movement per lot + one for the non-lot remainder, `transferStock` moves lots with the same lot number FEFO origin→destination. Exposed via `GET /inventory/lots` (warehouseId/productId/status active|expiring|expired, expiringInDays, paginated, computed status) and `POST /inventory/movements` (`lotNumber`/`expiryDate`/`lotId`); receiving (`goods receipts`) accepts `lotNumber`/`expiryDate`. Web: "Lots" tab in Stock page with warehouse/status filters and expiry badges; e2e `lots-expiry.e2e-spec.ts`. Valuation stays weighted average (§6.1) — lots track quantity/expiry only.
- **Supplier invoice / AP with supplier bills** (§6.3, §15.3): ~~only supplier payments exist (Dr AP / Cr Cash). No supplier bill with PO→receipt→bill reconciliation, no due dates, no payments-per-bill. (Payment-only was a conscious scope decision; the gap remains in the SPEC.)~~ **DONE:** `supplier_bills` (+items) with draft → issued → paid/cancelled, number from `SB` series at issue, AP posted as variance vs the linked receipt (Dr/Cr COGS for the difference, full entry when no receipt), optional payments per bill (`bill_id` on `supplier_payments`, PAID when balance hits zero), outbox event `supplier_bill.issued`; AP reports (aging, dashboard payables, overdue alerts) now span bills + unbilled receipts.
- **Stock transfer between warehouses** (§6.1): ~~`MovementType` has `transfer` / `disposal` / `return`, but the flow only applies generic signed movements; no two-sided origin→destination transfer operation.~~ **DONE (2026-08):** `transferStock` helper (single transaction, pessimistic locks on both warehouses, preserves origin average cost, weighted-avg into destination, records a `transfer` movement per side: −qty origin / +qty destination) + `POST /inventory/transfers` (`CreateTransferDto`, productId/variantId/fromWarehouseId/toWarehouseId/quantity/notes); rejects same-warehouse (400), insufficient stock (400), unknown product/variant/destination (404).
- **Customer statement** (§6.2): explicitly dropped by decision; orphan DTO deleted. Revisit only if requested.

## 2. Ambiguities / inconsistencies in SPEC

- **§11 roadmap table**: ~~F2 and F3 are merged into one row with a stray `||`~~ **DONE** — split them.
- **§6.8 vs §21.1**: §6.8 says exports "CSV, Excel, PDF"; §21.1 only mentions `?format=csv`. In practice csv/pdf/xlsx exist for most reports **except** the dashboard (csv/xlsx only — add PDF).
- **§16.4 auto-posting table**: ~~missing rows for the newer auto-posts already in code (supplier payment, payroll, production)~~ **DONE** — added them (and the supplier-bill variance).
- **§14 "Next steps" item 5**: ~~says "F4 platform extensions (web frontend, integrations, exports Excel/PDF)" but the web app and Excel/PDF exports already exist~~ **DONE** — updated.
- **§2 auth**: ~~says "bcrypt/argon2"; code uses bcrypt only~~ **DONE** — pinned to bcrypt (§2, §5).
- **§6.8**: "Export: CSV, Excel, PDF" — no single shared export contract documented (per-endpoint format handling is duplicated); consider centralizing.

## 3. Deferred features (by decision, §11)

- Multi-currency **revaluation** — exchange rates **shipped** (2026-08, see §4 item 5); **revaluation + settlement FX shipped (2026-08, see §4 item 5)**.
- Notifications (email/SMS for due dates, orders, approvals) — F4. Email for invoices/payments/receipts **shipped** (via outbox); due-date/approval reminders and SMS remain F4.
- Physical POS / offline — web POS **shipped**; offline/desktop client not planned.
- Country tax compliance: MX CFDI/e-invoicing (timbrado), US sales tax per state/nexus — F4.
- i18n — English only for now.
- Bank/tax/e-commerce integrations — F4.

## 4. Big feature candidates (ordered by recommendation)

1. ~~**Outbox + domain events**~~ — **DONE** — closes the architectural debt; unblocks notifications, webhooks, integrations, supplier bills.
2. ~~**Email notifications**~~ — **DONE** — consume outbox events; build on existing `email` module. Emails: invoices/credit notes/payments to customers, receipts to suppliers. Not covered: due-date and approval reminders.
3. ~~**Supplier bills (AP full)**~~ — **DONE** — PO→receipt→bill reconciliation, due dates, payments per bill; integrates with outbox.
4. ~~**Web POS / cashier**~~ — **DONE** — point of sale with catalog, ticket, and payment collection.
5. ~~**Multi-currency**~~ — **DONE** — per-tenant `exchange_rates` + CRUD API; invoices/credit notes/customer payments/supplier bills/supplier payments store `exchange_rate` and post to the tenant's functional currency (inventory/COGS stay in functional currency, not converted); FX gain/loss accounts seeded. **Revaluation shipped (2026-08):** `POST /accounting/revaluations` revalues open foreign-currency balances (`date` + optional `currency`), posting `fx_revaluation` journal entries (Dr/Cr AR·AP vs 4200/6100) with automatic reversal of prior revaluations for the same document before re-posting, so re-runs are idempotent; payments now realize the FX difference vs the booked rate (Dr/Cr FX gain/loss) so AR/AP always nets to zero. **POS multi-currency shipped (2026-08):** invoice create/payment accept `currency` + `exchangeRate` (manual rate or resolved from `exchange_rates`), POS cashier picks sale currency + rate (auto-filled from latest configured rate), totals/payment in sale currency, posting stays functional.
6. **Product variants + lots/expiry** — retail/perishable support. **Variants shipped (partial):** catalog + CRUD done (2026-08); variants in stock/POS done (2026-08); **lots/expiry done (2026-08)** — `product_lots`, FEFO consumption on outbound/transfer, `stock_movements.lot_id`, `GET /inventory/lots` + status filters, receiving by lot, "Lots" tab in Stock, e2e covered.
7. **Payment/bank integrations** (Stripe, bank feeds).
8. **MX/US tax compliance** (CFDI/timbrado, sales tax nexus) — largest effort, biggest differentiator.

## 5. Proposed sequence (first pass)

1. ~~Outbox + events (foundation, no UI/API-contract change).~~ **DONE** (2026-08).
2. ~~Email notifications (first consumer of events).~~ **DONE** (2026-08).
3. ~~Supplier bills AP (closes §6.3; built on outbox).~~ **DONE** (2026-08).
4. ~~POS~~ **DONE** — catalog, ticket, and payment collection on the web app.
5. ~~Multi-currency exchange rates + functional-currency posting.~~ **DONE** (2026-08). ~~Remaining: revaluation.~~ **Revaluation + settlement FX done (2026-08).**

## 6. Minor cleanup items

- Dashboard report: add `?format=pdf` to match other reports.
- §16.4 table: ~~add supplier-payment / payroll / production posting rows~~ **DONE** — added (plus supplier-bill variance and the functional-currency note).
- §14 item 5: ~~mark web frontend + Excel/PDF as done~~ **DONE**.
- Pin single password hashing library in §2: ~~bcrypt/argon2~~ **DONE** — bcrypt.
- §11 roadmap markdown fix (F2/F3 split): **DONE**.
