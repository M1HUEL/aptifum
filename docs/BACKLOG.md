# Aptifum ERP — Backlog & Known Gaps (working notes)

> Living scratchpad. Not part of the SPEC; keep `docs/SPEC.md` as the reference for what is defined.
> **Pruned 2026-08:** every item shipped since the SPEC-vs-implementation review was removed — transactional outbox + domain events, email + due-date/approval reminder notifications, supplier bills (AP), web POS, multi-currency + FX revaluation, product variants + lots/expiry, warehouse locations CRUD, stock transfers, Stripe online payments, MX CFDI 4.0 demo timbrado, US sales tax nexus, and the bilingual web dashboard (EN/ES + shared UI components). Only open gaps remain below.

## 1. Open (defined in SPEC, not implemented)

- **Real PAC timbrado** (§23, §11 #1): CFDI is demo-only — documents are generated and signed locally with self-signed per-tenant certificates and a demo TFD (PAC `XND000000000`); there is no SAT submission and cancellation just flips the status. The production hook is a real PAC integration: submission, real UUID, confirmation webhook, and real cancellation.
- **Webhook / integration consumers for ready-made domain events** (§1.1, §4): `supplier_bill.issued`, `payroll.posted`, `production.completed` are emitted but only logged by the email consumer; they plug in where webhooks/ERP integrations land.
- **Bank feeds and additional payment gateways** (§1.2, §4 #7): Stripe is shipped; bank feeds and other gateways remain open.
- **SMS notifications** (§3, §4 #2, §11 #4): email and due-date/approval reminders are shipped; SMS is deferred to F4.
- **Bank / tax / e-commerce integrations** (§3, §11): F4 platform extensions.

## 2. Deferred by decision (revisit only if requested)

- **Customer statement** (§6.2): explicitly dropped; the orphan DTO was deleted.
- **Offline / desktop POS** (§11 #2): web POS shipped; a desktop or offline client is not planned.

> Note: i18n is no longer deferred — the web UI is bilingual (EN/ES, §11 #5). Localizing the API-side email/notification templates remains a possible improvement (see §3).

## 3. Future improvements (ideas, not committed)

- **CSV bulk import** (products, customers, suppliers, initial stock): there is no file-upload infrastructure today; a multipart CSV import with a per-row validation report is the top onboarding feature.
- **In-app notifications center:** outbox/reminders today only reach email/SMTP (or demo mode); a bell with in-app notifications (invoices, payments, reminders) would be a high-visibility UX win.
- **Outbound webhooks:** domain events (`invoice.issued`, `payment.received`, `supplier_bill.issued`, ...) are emitted but only consumed by email; deliver them to external integrations.
- **Document attachments:** file-upload infrastructure (multer) + attachments on invoices, orders, customers.
- **Reorder points / purchase suggestions:** derive reorder alerts from the existing low-stock report and suggest purchase orders.
- **Localized notification templates:** outbox/reminders email templates are English-only; localize them (or key them by tenant language) to match the bilingual web UI.
- **Share form validation between web and API:** zod form schemas are hand-maintained in `apps/web/src/api/schemas.ts`; generating them from the OpenAPI schema or sharing the `packages/core` DTOs would prevent drift.
- **Expand Playwright e2e coverage** (currently auth, inventory, POS, RBAC, reports, sales) and add a coverage threshold in CI.
- **Barcode scanning and bulk operations** in the POS and inventory pages.
- **Realtime updates** (WebSocket/SSE) for POS, stock and dashboard metrics instead of polling.
