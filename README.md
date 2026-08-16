# Aptifum

Multi-tenant ERP with sales, purchasing, inventory, manufacturing, HR, accounting and reporting — served from a single API with a React dashboard.

## Stack

- **Monorepo** — [pnpm](https://pnpm.io) workspaces + [Turborepo](https://turbo.build)
- **API** — NestJS 11, TypeORM, PostgreSQL 18
- **Web** — React 19, Vite, React Router, TanStack Query, Tailwind CSS 4, Radix UI, lucide-react, recharts, react-hook-form + zod
- **Packages** — shared core (domain enums/utilities), typed config (zod), database entities/seeders, logger
- **Auth** — JWT access/refresh with session rotation, RBAC permissions, throttling
- **Web UI** — bilingual interface (**English / Spanish**, Spanish default) with a language switcher, light/dark theme, collapsible sidebar and mobile drawer; typed API client generated from the OpenAPI spec (CI fails on drift)
- **Multi-currency** — per-tenant exchange rates; invoices, payments and supplier bills post to the tenant's functional currency
- **Online payments** — Stripe checkout for issued invoices with signature-verified webhooks recording card payments idempotently
- **Tax compliance** — MX CFDI 4.0 e-invoicing (self-contained XML, digital seal, demo TFD with per-tenant self-signed certificates; real PAC is a production hook) plus RFC/EIN validation by tenant country; **US sales tax** auto-calculated from the customer's state and the tenant's nexus configuration (per-state rates configurable in Settings)
- **Docs** — PDF (pdfkit), CSV and XLSX export across reports and invoices

## Repository layout

```
apps/
  api/        NestJS API (REST, Swagger at /docs)
  web/        React dashboard (POS, reports, admin UI)
packages/
  core/       Domain enums, permissions, shared utilities
  config/     Environment validation (zod) and app env
  database/   Entities, migrations, seeders
  logger/     Shared logger
docs/         Product spec, domain glossary, backlog
```

## Prerequisites

- Node.js >= 20
- pnpm 11.20.0 (`corepack enable`)
- PostgreSQL 18

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env          # then fill in DB and JWT secrets

# 3. Run migrations and seed base data (tenant, roles, admin, chart of accounts)
pnpm --filter @aptifum/database migration:run
pnpm db:seed

# 4. Optionally seed demo data (warehouses, products, stock, partners, employees)
pnpm db:seed:demo

# 5. Start API and web in dev mode
pnpm dev

# API:   http://localhost:3000        (Swagger: http://localhost:3000/docs)
# Web:   http://localhost:5173
```

The seeded admin login is `admin@aptifum.dev` / `Admin123!`. Change it before any real use.

### Demo data

`pnpm db:seed:demo` seeds 2 warehouses, 4 categories, 13 products with initial stock, 6 customers, 5 suppliers, 3 departments, 5 employees and USD→EUR exchange rates. Customers and suppliers can carry their own currency (e.g. Cafe Europa in EUR), so foreign-currency invoices, payments and supplier bills post in the tenant's functional currency at the stored rate. It is idempotent and requires the base seed (tenant) to have run first.

`pnpm db:seed:demo:transactions` additionally seeds a set of realistic demo transactions (sales orders, invoices, payments, purchases, goods receipts, supplier bills and payroll) so the reports and dashboard show historical data.

### User invitations

Admins can invite users by email from **Users & Roles**. When `SMTP_HOST` is configured, the API delivers real emails (invites, password resets, notifications/reminders). Without SMTP the API runs in demo mode: the invite endpoint returns the acceptance token and the dashboard shows a copyable link (`/accept-invite?token=...`) that the invited user opens to set their password.

## Web dashboard

The dashboard (`apps/web`) covers the full product: POS/cashier, customers, sales orders, invoices, purchasing, inventory (products, variants, stock, transfers, warehouses), production, HR (employees, attendance/leaves, payroll), CRM (contacts, leads, opportunities, activities), accounting (chart of accounts, journal, financial reports), analytics reports, settings, users & roles and the audit log. Navigation is permission-gated and grouped (see `apps/web/src/auth/route-permissions.ts`).

The UI is bilingual (**English / Spanish**, Spanish by default) via i18next with a language switcher in the sidebar and settings, supports a light/dark theme (persisted, follows the system preference by default), and ships a desktop-collapsible sidebar with a mobile drawer. Shared components live in `apps/web/src/components/ui/*` — `Input`, `Select`, `Textarea`, `Button` (variants + loading), `Card`, `Dialog`, `ConfirmDialog`, `Table`, `Badge`, `Checkbox`, `SearchableSelect`. Destructive actions are confirmed with a shared `ConfirmDialog`, and login/auth pages use theme-aware branding.

## Scripts

| Script                           | Description                                                    |
| -------------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                       | Run all apps in watch mode                                     |
| `pnpm build`                     | Build all packages and apps                                    |
| `pnpm lint`                      | ESLint across the monorepo                                     |
| `pnpm typecheck`                 | TypeScript type-checking                                       |
| `pnpm test`                      | API unit and e2e tests (needs a `aptifum_test` database)       |
| `pnpm db:seed`                   | Seed base data (tenant, roles, admin, accounts, series, taxes) |
| `pnpm db:seed:demo`              | Seed demo business data                                        |
| `pnpm db:seed:demo:transactions` | Seed demo business data plus realistic transactions            |

## Environment variables

| Variable                       | Default                | Description                                                                                  |
| ------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------- |
| `NODE_ENV`                     | `development`          | Runtime environment                                                                          |
| `PORT`                         | `3000`                 | API port                                                                                     |
| `DB_HOST` / `DB_PORT`          | `localhost` / `5432`   | PostgreSQL host and port                                                                     |
| `DB_USER` / `DB_PASSWORD`      | `aptifum`              | PostgreSQL credentials                                                                       |
| `DB_NAME`                      | `aptifum`              | Main database                                                                                |
| `DB_NAME_TEST`                 | `aptifum_test`         | Database used by e2e tests                                                                   |
| `JWT_ACCESS_SECRET`            | —                      | Access token signing secret (min 16 chars)                                                   |
| `JWT_REFRESH_SECRET`           | —                      | Refresh token signing secret (min 16 chars)                                                  |
| `JWT_ACCESS_TTL`               | `15m`                  | Access token lifetime                                                                        |
| `JWT_REFRESH_TTL`              | `7d`                   | Refresh token lifetime                                                                       |
| `MAX_ACTIVE_SESSIONS_PER_USER` | `5`                    | Active sessions per user                                                                     |
| `SESSION_RETENTION_DAYS`       | `30`                   | Days expired sessions are kept                                                               |
| `PASSWORD_RESET_TTL`           | `15m`                  | Password reset token lifetime                                                                |
| `INVITE_TTL`                   | `72h`                  | User invitation token lifetime                                                               |
| `SMTP_HOST`                    | _(empty)_              | SMTP server for real email delivery; empty = demo mode (tokens returned in the API response) |
| `SMTP_PORT`                    | `2525`                 | SMTP port                                                                                    |
| `SMTP_USER` / `SMTP_PASS`      | _(empty)_              | SMTP credentials                                                                             |
| `SMTP_FROM_EMAIL`              | `no-reply@aptifum.dev` | Outgoing sender address                                                                      |
| `SMTP_FROM_NAME`               | `Aptifum`              | Outgoing sender name                                                                         |

## Testing

Unit and e2e tests live in `apps/api/test`. E2e specs run migrations against the `aptifum_test` database on every run, so make sure PostgreSQL is up with the credentials in `.env` and that the test database exists.

```bash
pnpm test
```

Web unit tests run with Vitest + Testing Library (`pnpm --filter @aptifum/web test`); Playwright end-to-end specs cover auth, inventory, POS, RBAC, reports and sales flows (`pnpm --filter @aptifum/web test:e2e`, needs the dev server and database running).

The GitHub Actions CI workflow runs lint, typecheck, build, API tests, web unit tests and an OpenAPI drift check on every push/PR.

## Docker deployment

A production `docker-compose.yml` is included:

```bash
cp .env.production.example .env   # fill in secrets
docker compose up --build -d
```

- Web: http://localhost:8080
- API: http://localhost:8080/api/v1 (Swagger: http://localhost:8080/docs)

## License

Proprietary.
