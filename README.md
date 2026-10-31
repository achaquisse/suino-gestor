# Porkflow

**The pocket farm manager for small pig producers: every animal, pen, metical and task in one simple app that works in the field, even offline.**

Small pig businesses run on notebooks, WhatsApp messages and memory. That works for ten animals and breaks at fifty: a missed vaccine, a sow whose heat (cio) went unnoticed, or feed that runs out on a Sunday costs real money. Owners also struggle to show investors where their money went and whether the business is profitable.

Porkflow is one source of truth. It tells the farmer what to do today, records what was done, and turns those records into a clear picture of herd health, stock and cash. It is multi-tenant from day one: it starts as the tool for one farm and can grow into a product any pig producer signs up for.

## Who it is for

| Persona                | Needs from Porkflow                                                       | Main device          |
| ---------------------- | ------------------------------------------------------------------------- | -------------------- |
| **Owner / manager**    | Costs, sales, profit and investor balances; plan purchases                | Phone and laptop     |
| **Caretaker**          | Today's tasks; quick logging of feeding, treatments, births and deaths    | Phone, often offline |
| **Vet / advisor**      | Animal health history, treatments given, notes                            | Phone                |
| **Investor** (read-only) | What their money funded and the return so far                           | Laptop or phone      |

Each farm is a separate tenant with its own users, roles and data. One person can belong to several farms and switch between them.

## Product principles

1. **Field first.** Frequent actions (log a treatment, record a birth, tick a task) take three taps or fewer, one-handed, on a phone.
2. **Works offline.** Installs to the home screen as a PWA and shows the last-synced farm data without signal.
3. **Calm and minimal.** One accent colour, large touch targets, plain words. Red only when something needs attention today.
4. **Multi-tenant and secure.** Strict per-farm isolation through Postgres RLS and role-based access.
5. **Local by default.** Portuguese UI, meticais (MZN), metric units.
6. **Records become insight.** Every record feeds a reminder, a stock level or a report. One action updates everything it touches.

## What's in the app

A bottom tab bar on mobile (sidebar on desktop) and a floating **+** button for quick logging from anywhere.

| Screen       | Path        | What the user sees                                                                                    |
| ------------ | ----------- | ----------------------------------------------------------------------------------------------------- |
| **Today**    | `/`         | Tasks due and overdue, alerts, stock levels and the calendar                                          |
| **Herd**     | `/herd`     | Pens with occupancy → pen detail → animal timeline (birth, weights, treatments, moves, outcome)       |
| **Money**    | `/money`    | Transactions, funding accounts and splits, recurring expenses, debts and commitments                  |
| **Reports**  | `/reports`  | Summary, cash flow, spend by category, per-account detail and per-batch results                       |
| **Help**     | `/help`     | Playbooks for common scenarios (heat, farrowing, illness, injuries) and reference articles            |
| **Settings** | `/settings` | Farm details, funding accounts, categories, parameters and team                                       |
| **Quick log (+)** | —      | Herd, health and money forms in one sheet, prefilled from context                                     |

The UI implements the Claude Design mockup in `mockup/Porkflow v5.dc.html`.

## Stack

React 19 + Vite, TanStack Query, React Router, Tailwind v4, Zod, Supabase (Postgres + RLS, Auth with Google, Storage).

## Setup

1. **Supabase project**: create one, then apply the migrations in `supabase/migrations/` in order (SQL editor, or `supabase db push` with the CLI).
2. **Google sign-in**
   - Google Cloud Console → _APIs & Services → Credentials_ → create an _OAuth client ID_ (Web application).
     Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Supabase → _Authentication → Sign In / Providers → Google_: enable it and paste the client ID and secret.
   - Supabase → _Authentication → URL Configuration_: set **Site URL** to your production origin and add every origin the app runs on to **Redirect URLs** (e.g. `http://localhost:5173`, `http://localhost:4173`, `https://porkflow.example.com`). The app redirects back to `window.location.origin`.
   - Keep email/password sign-up disabled unless email confirmation is on: invites are matched by email, and `accept_invites()` only honours confirmed addresses.
3. **Env**: `cp .env.example .env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. `npm install && npm run dev`

### Local development login

1. Start the local stack with `npm run db:start` and point `.env` at it. Restart `npm run dev` after editing `.env`: Vite only reads it at startup.
2. Open http://localhost:5173 and enter any email in the **Desenvolvimento · entrar por email** box.
3. Open the local inbox at http://127.0.0.1:54324 and click the **Log In** link in the email.
4. Choose **Criar com dados de exemplo** to load the demo farm.

## Scripts

| Script              | Description                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`       | Dev server (no service worker)                                                          |
| `npm run build`     | Type-check + production build, emits `dist/sw.js`                                       |
| `npm run preview`   | Serve the build. Use this to test install/offline                                       |
| `npm run lint`      | oxlint                                                                                  |
| `npm run typecheck` | `tsc -b`                                                                                |
| `npm run test:sql`  | Applies all migrations to an in-memory Postgres (PGlite) and exercises the RPCs and RLS |
| `npm run gen:types` | Regenerates `src/lib/database.generated.ts` from the migrations (no Docker needed)      |
| `npm run db:start` / `db:stop` / `db:status` / `db:reset` | Manage the local Supabase stack                   |
| `npm run db:lint`   | Lint the database schema with the Supabase CLI                                          |

## Access model

Every row carries `farm_id`; RLS checks membership through `is_member` / `has_role`.

| Role           | Herd & tasks          | Finance      | Settings & team |
| -------------- | --------------------- | ------------ | --------------- |
| owner          | read / write / delete | read / write | manage          |
| caretaker, vet | read / write          | —            | read            |
| investor       | read                  | read         | read            |

Multi-step operations (treatments, births, sales, payments…) are Postgres functions so they apply atomically and re-check the caller's role. A farm always keeps at least one owner.

## Database types

`src/lib/database.types.ts` is hand-written so it can be narrower than Postgres (literal unions for CHECK constraints, typed jsonb like `Split[]`). `src/lib/database.check.ts` compares it with the generated schema at compile time, so after changing a migration run `npm run gen:types` and `tsc` will name any table column, nullability or RPC argument that no longer matches.

## React

The [React Compiler](https://react.dev/learn/react-compiler) runs at build time (`vite.config.ts`, Babel 7, since the compiler doesn't support Babel 8 yet), so components are memoized automatically. A few form sheets are skipped by the compiler because of `try/finally` in their event handlers; they behave normally.

## PWA and offline

`src/pwa/sw.js` is a template; the build plugin in `vite.config.ts` writes `dist/sw.js` with this build's file list. The app shell and fonts work offline; Supabase requests always go to the network. Installing on phones requires HTTPS.

The React Query cache is persisted to IndexedDB (`src/lib/queryClient.ts`) for up to 7 days, so the last-synced farm data shows without a connection. It is wiped on sign-out and whenever the app starts without a valid session. Bump `buster` there when cached row shapes change.

Writes still need a connection: saving offline fails straight away with "Sem ligação à internet", and nothing is queued.
