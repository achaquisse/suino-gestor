# Suino Gestor — E2E Test Plan

## 1. Purpose

Verify, through the browser and against a real backend, that the core user journeys of Suino Gestor work end to end: signing in, finding animals, logging field events, recording money, reading reports, getting help and administering the farm. The suite also encodes a few behaviours the product *should* have (from the README and normal user expectations) that may not exist yet, so the gap is visible and tracked.

## 2. Scope

### In scope

| Area | What is covered |
| --- | --- |
| Authentication | Login screen, dev account sign-in, sign-out, deep-link while signed out |
| Onboarding | User with no farm creates a farm (with demo data) |
| Navigation & access control | Main nav per role, money/reports gating, not-found route, farm switching |
| Herd | KPIs, search, stage filters, pens/list views, pen detail, animal detail |
| Quick log (field events) | Weight, treatment, mating, birth, transfer, death, sale, activity; validation and permissions |
| Animal management | Buying animals into a pen, editing an animal |
| Money | Money overview, new expense, validation, read-only and no-access roles |
| Reports | Summary statement, period switch, CSV export, access gating |
| Help | Search, empty results, opening a guide |
| Settings | Tabs per role, new funding account, inviting a team member |
| Resilience | Saving while offline shows a clear error |
| Expected-but-missing features | Tagged `@future`; failures are expected and reported separately |

### Out of scope

- Real Google OAuth (third-party; replaced by Supabase password sessions).
- PWA install / service worker offline cache (needs a production build over HTTPS).
- Visual regression, performance and load testing.
- Database RLS/RPC unit tests (already covered by `npm run test:sql`).
- Cross-browser matrix (Chromium only for now; Firefox/WebKit can be enabled in config).

## 3. Approach

- **BDD:** scenarios are written in Gherkin (`e2e/features/*.feature`) so product owners can read them. Step definitions in `e2e/step_definitions/` drive the browser through CodeceptJS.
- **Driver:** CodeceptJS 4 with the Playwright helper (Chromium, headless by default, viewport 1280×800 = desktop layout).
- **Locators:** user-facing ones first: ARIA role + accessible name, visible labels and text. The app UI is Portuguese, so the steps use the exact Portuguese strings the user reads. No CSS-class locators.
- **Test data isolation:** the suite never touches developer data. At bootstrap it uses the local Supabase service key to create:
  - a fresh owner, caretaker, investor and a "new user" with no farm (unique per run),
  - a demo farm (`create_farm(..., p_demo = true)`) plus a second empty farm for the owner.
  Teardown deletes those farms and users. Each mutating scenario works on a different seeded animal, so scenarios are independent of order.
- **Authentication in tests:** one scenario signs in through the real dev login UI. All other scenarios sign in via the Supabase password API and inject the session into `localStorage` before the app loads. That is fast and avoids depending on the login UI in every test.
- **Tags:**
  - `@smoke`: minimal health check of the main journeys
  - `@mutation`: writes data (runs on the isolated farm)
  - `@rbac`: role-based access
  - `@future`: expected behaviour not implemented yet. These failures are expected and are a backlog, not a regression.

## 4. Environment

| Item | Value |
| --- | --- |
| App | Vite dev server, `http://localhost:5173` (override with `E2E_BASE_URL`); started automatically if not running |
| Backend | Local Supabase stack (`npm run db:start`), URL/keys read from `.env` + `supabase status` (or `E2E_SUPABASE_*` env vars) |
| Browser | Chromium (Playwright 1.65), headless (`E2E_HEADED=1` to watch) |
| Runner | `npm run test:e2e` (all), `npm run test:e2e:smoke`, `npm run test:e2e:core` (excludes `@future`) |
| Artifacts | `e2e/output/`: failure screenshots, Playwright traces, run state |

## 5. Entry / exit criteria

**Entry:** local Supabase running with migrations applied, dependencies installed, Chromium installed (`npx playwright install chromium`).

**Exit:**
- 100% of `@smoke` scenarios pass.
- At least 95% of non-`@future` scenarios pass. Every failure is either fixed or logged as a defect with a screenshot and trace.
- `@future` results are reported as a feature-gap list.

## 6. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Shared mutable demo data causes flaky order-dependent tests | Isolated farm per run; one animal per mutating scenario |
| Animations and toasts are timing-sensitive | `I.waitForText` / `waitForElement` with timeouts, not fixed sleeps |
| Seed data changes (tags, pen names) break tests | Test data is centralised in `support/data.js` |
| Date-dependent seed statuses (e.g. withdrawal end date) | Scenarios that depend on dates assert on behaviour, not exact dates |
| Locale or number formatting differences | Assert on digits or key words, not full formatted strings |

## 7. Deliverables

1. This test plan
2. `TEST_CASES.md`: the test case catalogue with IDs, priorities and expected results
3. Feature files and step definitions (`e2e/`)
4. A run report (console output plus `e2e/output/`)
