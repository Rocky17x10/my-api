# IT Asset Management — API

NestJS 12 + TypeORM API for tracking company equipment: assets, assignments, employee requests and returns, maintenance, support tickets, notifications, reports and an audit log. The web frontend is the separate [`my-app`](https://github.com/Rocky17x10/my-app) repository.

## Requirements

- Node.js **24.9 or newer** (the test runner loads ESM-only Nest packages)
- MySQL 8 or MariaDB 10.4+ (set `DATABASE_TYPE` to match)
- npm 12 for changing dependencies (`npx -y npm@latest install …`): the npm bundled with Node 24.0–24.x may strip platform fields from `package-lock.json`

## Set up

```bash
npm ci
cp .env.example .env          # fill in the database user, JWT secret (32+ chars), FRONTEND_URL
npm run build
npm run migration:run         # creates or updates the schema
SEED_ADMIN_EMAIL=you@company.com SEED_ADMIN_PASSWORD='<12+ characters>' npm run seed
npm run start:dev             # http://localhost:3001 (API under /api/v1, health at /health)
```

The app refuses to start when a setting is missing or invalid and names the setting. Every setting is described in [`.env.example`](.env.example).

`npm run seed -- --demo` also adds three demo employees and nine demo assets (refused when `NODE_ENV=production`; needs `SEED_DEMO_PASSWORD`).

## Scripts

| Script | Purpose |
|---|---|
| `start:dev` / `start:prod` | Watch mode / run the compiled build (`node dist/main`) |
| `build` | Compile to `dist/` (migrations and the seed run from there) |
| `migration:run` / `migration:revert` / `migration:show` | Apply / roll back / list migrations |
| `migration:generate -- src/database/migrations/<Name>` | Write a migration for entity changes |
| `test` | Unit tests |
| `test:e2e` | End-to-end tests against the real HTTP pipeline on a throwaway database |
| `lint` | oxlint (type-aware) |

### End-to-end tests

They run against a separate database whose name **must end in `_test`** (default `myapp_test`; override with `E2E_DATABASE_NAME`), because every run drops its tables and rebuilds them from the migrations. Create it once, for example:

```sql
CREATE DATABASE myapp_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON myapp_test.* TO '<DATABASE_USERNAME>'@'localhost';
```

## How it works (short)

- **Auth:** HttpOnly cookies — a 15-minute access JWT and a 7-day single-use refresh token (rotation, reuse detection), plus a `session` hint cookie the frontend uses for redirects. Login is throttled; writes from unknown browser origins are refused.
- **Roles:** `super_admin`, `admin`, `user` (employee). Every route declares its roles; routes without them are denied.
- **Data integrity:** all input goes through DTO validation; schema changes only through migrations; audit-log entries and notifications are written in the same transaction as the change.

## Documentation

The project documentation lives in the workspace `docs/` folder (separate repository):

- `API_DOCUMENTATION.md` — every endpoint, request and response
- `ARCHITECTURE.md` — modules, data model, request pipeline
- `DATABASE_MIGRATIONS.md` — migrations, seeding, test database
- `DEPLOYMENT.md` — production setup
- `SECURITY.md` — security model and how to report issues
