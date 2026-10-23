# Leads Client Hub

Client relationship manager for Leads: client companies, contact persons, follow-up reminders,
a blocklist, and editable master lists (contact types, departments, nationalities, religions).

## Stack

| Layer     | Technology                                                                    |
| --------- | ----------------------------------------------------------------------------- |
| Framework | TanStack Start — React 19 with server-side rendering and **server functions** |
| UI        | TypeScript, Tailwind CSS v4, lucide icons, sonner (toasts)                    |
| Data (UI) | TanStack Query (caching), TanStack Router (file-based routes)                 |
| Database  | Microsoft SQL Server via the `mssql` driver                                   |
| Build     | Vite 8; Nitro packages the production build as a standalone Node.js server    |

## How it works

Frontend and backend live in **one project and run as one Node.js process** — there is no
separate API server.

```
Browser (React pages)                       Node.js server
─────────────────────                       ─────────────────────────────────────────
src/routes/*.tsx ── useCrm() ──► src/lib/crm.functions.ts ──► src/server/db.server.ts ──► SQL Server
src/components/crm/ui.tsx        (server functions: run on      (connection pool, auto
                                  the server; the browser gets   database creation and
                                  only a small fetch stub)       schema setup)
```

- `src/lib/crm.tsx` (`CrmProvider` / `useCrm()`) loads all clients, contacts and master lists
  once, applies each change on screen immediately, then saves it with a server function. Typing
  in a client field is saved after a short pause. If a save fails, an error toast explains why
  and the data is reloaded from the database.
- **Database setup is automatic:** on the first request the server connects using
  `DATABASE_URL`, creates the database if it does not exist, and applies `database/schema.sql`
  (tables + default master-list values). The script is idempotent, so it is safe on every start.

### Tables

| Table                     | Contents                                                           |
| ------------------------- | ------------------------------------------------------------------ |
| `dbo.master_options`      | Dropdown values per category (types, departments, nationalities, religions) |
| `dbo.clients`             | Client companies, type, relationship, blocklist status, special note |
| `dbo.client_departments`  | Departments linked to each client                                  |
| `dbo.contacts`            | Contact persons of each client, including reminder dates           |

Deleting a client deletes its contacts and departments (`ON DELETE CASCADE`).

## Files

| Path                          | Purpose                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `.env` / `.env.example`       | Configuration (database connection). Never commit `.env`.            |
| `database/schema.sql`         | SQL Server tables; applied automatically at startup                  |
| `src/server/db.server.ts`     | Parses `DATABASE_URL`, connection pool, creates DB, applies schema   |
| `src/lib/crm.functions.ts`    | Server functions: load data, save/delete clients, contacts, master lists |
| `src/lib/crm.tsx`             | `CrmProvider` / `useCrm()` and the shared types                      |
| `src/lib/crm-rules.ts`        | Field limits and all-field search (shared, tested)                   |
| `src/components/crm/ui.tsx`   | App shell, sidebar, form fields, badges                              |
| `src/routes/`                 | Pages: clients, client details, add contact, reminders, blocklist, master lists |
| `src/server.ts`, `src/start.ts` | Server entry, error page and CSRF protection for server functions  |
| `src/test/`                   | Vitest tests (`npm test`)                                            |
| `src/routeTree.gen.ts`        | **Generated** route list — do not edit                               |

## Configuration (`.env`)

| Variable         | Purpose                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | `sqlserver://HOST[\INSTANCE][:PORT];database=NAME;user=...;password=...;encrypt=true;trustServerCertificate=true` |
| `PORT` (optional)| Port to listen on (default 3000)                                                                                 |

Copy `.env.example` to `.env` and fill in your server. If the database does not exist it is
created (the SQL login needs `CREATE DATABASE` permission for that; `sa` has it).

## Run locally

Requires Node.js 20.12 or newer and a reachable SQL Server (TCP/IP enabled).

```sh
npm install        # once, or after package.json changes
npm run dev        # http://localhost:3000, reloads on code changes
```

## Build and host

```sh
npm run build      # creates .output/ (the complete server)
npm start          # runs .output/server/index.mjs with .env, on PORT (default 3000)
```

To deploy, copy **`.output/`, `.env` and `package.json`** to the server (it needs Node.js but
not `node_modules` or the source) and run `npm start` there — or directly
`node --env-file=.env .output/server/index.mjs`. Keep it running with pm2 or as a Windows
service (e.g. NSSM), and put IIS (URL Rewrite + ARR) or nginx in front for HTTPS.

## Other scripts

| Command          | What it does                       |
| ---------------- | ---------------------------------- |
| `npm test`       | Run the Vitest tests               |
| `npm run lint`   | Check code with ESLint             |
| `npm run format` | Auto-format all code with Prettier |
