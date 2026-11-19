import { setup, teardown } from './support/fixtures.js'

const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:5173'

export const config = {
  name: 'suino-gestor-e2e',
  output: './output',
  tests: [],
  timeout: 90,

  gherkin: {
    features: './features/*.feature',
    steps: [
      './step_definitions/common.steps.js',
      './step_definitions/herd.steps.js',
      './step_definitions/quicklog.steps.js',
      './step_definitions/money.steps.js',
      './step_definitions/help.steps.js',
      './step_definitions/admin.steps.js',
    ],
  },

  helpers: {
    Playwright: {
      url: baseUrl,
      browser: 'chromium',
      show: !!process.env.E2E_HEADED,
      windowSize: '1280x800',
      waitForTimeout: 10000,
      waitForNavigation: 'load',
      trace: true,
      keepTraceForPassedTests: false,
      emulate: { locale: 'pt-PT', timezoneId: 'Africa/Maputo', acceptDownloads: true },
    },
  },

  // Reuses a dev server that is already running; otherwise starts Vite.
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: baseUrl,
    cwd: '..',
    timeout: 60000,
    enabled: !process.env.E2E_BASE_URL,
  },

  async bootstrap() {
    await setup()
  },
  async teardown() {
    await teardown()
  },

  plugins: {
    screenshotOnFail: { enabled: true },
    retryFailedStep: { enabled: true, retries: 2 },
  },
}
