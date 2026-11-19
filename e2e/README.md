# E2E tests (CodeceptJS + Gherkin + Playwright)

- [TEST_PLAN.md](TEST_PLAN.md): scope, approach, environment, exit criteria
- [TEST_CASES.md](TEST_CASES.md): test case catalogue (IDs match the `@TAG` on each scenario)
- `features/`: Gherkin scenarios, `step_definitions/`: step code, `support/`: fixtures and locator helpers

## Run

```sh
npm run db:start                    # local Supabase (once)
npx playwright install chromium     # once
npm run test:e2e                    # everything, including @future gaps
npm run test:e2e:core               # without @future
npm run test:e2e:smoke              # @smoke only
npx codeceptjs run --config e2e/codecept.conf.js --grep @LOG-11   # one case
```

The Vite dev server on :5173 is reused if running, otherwise started. Each run creates its own throw-away users and demo farm and deletes them afterwards (`E2E_KEEP_DATA=1` keeps them). Set `E2E_HEADED=1` to watch the browser. Failure screenshots and Playwright traces (`npx playwright show-trace <zip>`) go to `e2e/output/`.

Env overrides: `E2E_BASE_URL`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_KEY`.
