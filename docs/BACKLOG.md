# Aptifum ERP — Backlog & Known Gaps (working notes)

> Living scratchpad. Not part of the SPEC; keep `docs/SPEC.md` as the reference for what is defined.
> **Pruned 2026-08:** every item shipped since the SPEC-vs-implementation review was removed — transactional outbox + domain events, email + due-date/approval reminder notifications, supplier bills (AP), web POS, multi-currency + FX revaluation, product variants + lots/expiry, warehouse locations CRUD, stock transfers, Stripe online payments, MX CFDI 4.0 demo timbrado, and US sales tax nexus. Only open gaps remain below.

## 1. Open (defined in SPEC, not implemented)

- **Real PAC timbrado** (§23, §11 #1): CFDI is demo-only — documents are generated and signed locally with self-signed per-tenant certificates and a demo TFD (PAC `XND000000000`); there is no SAT submission and cancellation just flips the status. The production hook is a real PAC integration: submission, real UUID, confirmation webhook, and real cancellation.
- **Webhook / integration consumers for ready-made domain events** (§1.1, §4): `supplier_bill.issued`, `payroll.posted`, `production.completed` are emitted but only logged by the email consumer; they plug in where webhooks/ERP integrations land.
- **Bank feeds and additional payment gateways** (§1.2, §4 #7): Stripe is shipped; bank feeds and other gateways remain open.
- **SMS notifications** (§3, §4 #2, §11 #4): email and due-date/approval reminders are shipped; SMS is deferred to F4.
- **Bank / tax / e-commerce integrations** (§3, §11): F4 platform extensions.

## 2. Deferred by decision (revisit only if requested)

- **Customer statement** (§6.2): explicitly dropped; the orphan DTO was deleted.
- **Offline / desktop POS** (§11 #2): web POS shipped; a desktop or offline client is not planned.
- **i18n** (§3, §9, §11 #5): English only for now.
