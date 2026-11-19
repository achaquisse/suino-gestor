import { readState, sessionFor } from '../support/fixtures.js'
import { storageKey, supabaseEnv } from '../support/env.js'
import { T, button, dialog, field, mainNav, tile, toast, waitText, waitVisible } from '../support/ui.js'

const { I } = inject()
const pw = (desc, fn) => I.usePlaywrightTo(desc, fn)

// ---------------------------------------------------------------- session

Given('I am signed out', () => {
  // Every scenario starts in a fresh browser context: no session, no cached data.
})

Given('I am signed in as the {word}', async (role) => {
  const session = await sessionFor(role)
  const { farm } = readState()
  const key = storageKey(supabaseEnv().url)
  await pw(`sign in as ${role}`, async ({ page }) => {
    // Seed the session once per tab, before the app boots, so later reloads and sign-out behave normally.
    await page.context().addInitScript(({ key, value, farmId }) => {
      if (sessionStorage.getItem('e2e-seeded')) return
      sessionStorage.setItem('e2e-seeded', '1')
      localStorage.setItem(key, value)
      if (farmId) localStorage.setItem('suino-gestor.farm', farmId)
    }, { key, value: JSON.stringify(session), farmId: role === 'admin' ? null : farm.id })
  })
  I.amOnPage(role === 'admin' ? '/admin' : '/herd')
  await pw('wait for the app', async ({ page }) => {
    if (role === 'newcomer') await waitVisible(page.getByText('Ainda não tem acesso a nenhuma granja.'), 'the no-farm screen')
    else if (role === 'admin') await waitVisible(page.getByRole('heading', { name: 'Administração', exact: true }), 'the admin area')
    else await waitVisible(mainNav(page), 'the main navigation')
  })
})

When('I pick the dev account {string}', async (name) => {
  await pw('pick dev account', async ({ page }) => {
    await dialog(page).getByRole('button', { name: new RegExp(name) }).click()
  })
})

When('I sign out from the user menu', async () => {
  const { farm } = readState()
  await pw('sign out', async ({ page }) => {
    await page.locator('header').getByRole('button', { name: new RegExp(farm.name) }).click()
    await page.getByRole('button', { name: 'Terminar sessão', exact: true }).click()
  })
})

When('I switch to my second farm from the user menu', async () => {
  const { farm, secondFarm } = readState()
  await pw('switch farm', async ({ page }) => {
    await page.locator('header').getByRole('button', { name: new RegExp(farm.name) }).click()
    await page.getByRole('button', { name: new RegExp(secondFarm.name) }).click()
  })
})

Then('the header should show my second farm', async () => {
  const { secondFarm } = readState()
  await pw('header farm', async ({ page }) => {
    await waitVisible(page.locator('header').getByRole('button', { name: new RegExp(secondFarm.name) }), `"${secondFarm.name}" in the header`)
  })
})

Then('I should see my email address', () => {
  I.waitForText(readState().users.newcomer.email, 10)
})

// ---------------------------------------------------------------- navigation

When('I open {string}', (path) => {
  I.amOnPage(path)
})

Then('I should be on a page whose URL contains {string}', (part) => {
  I.waitInUrl(part, 10)
})

Then('I should be on a page whose URL ends with {string}', async (suffix) => {
  I.wait(1.5) // let any client-side redirect happen
  const url = await I.grabCurrentUrl()
  const path = new URL(url).pathname
  if (!path.endsWith(suffix) || (suffix === '/' && path !== '/')) throw new Error(`Expected the path to end with "${suffix}" but it was "${path}"`)
})

Then('I should see the main navigation item {string}', async (label) => {
  await pw('nav item', async ({ page }) => {
    await waitVisible(mainNav(page).getByRole('link', { name: label, exact: true }), `navigation item "${label}"`)
  })
})

When('I switch on {string}', async (name) => {
  await pw(`switch ${name}`, async ({ page }) => {
    const sw = dialog(page).getByRole('switch', { name, exact: true })
    if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click()
  })
})

// Client-side navigation: keeps the in-memory cache, like a user moving between pages.
When('I go to {string} in the main navigation', async (label) => {
  await pw(`nav ${label}`, async ({ page }) => {
    await mainNav(page).getByRole('link', { name: label, exact: true }).click()
  })
})

Then('I should not see the main navigation item {string}', async (label) => {
  await pw('no nav item', async ({ page }) => {
    const nav = mainNav(page)
    await waitVisible(nav, 'the main navigation')
    const n = await nav.getByRole('link', { name: label, exact: true }).count()
    if (n) throw new Error(`Navigation item "${label}" should not be visible`)
  })
})

// ---------------------------------------------------------------- generic text / controls

Then('I should see {string}', (text) => {
  I.waitForText(text, 10)
})

Then('I should not see {string}', (text) => {
  I.wait(1)
  I.dontSee(text)
})

Then('I should see the heading {string}', async (name) => {
  await pw('heading', async ({ page }) => {
    await waitVisible(page.getByRole('heading', { name, exact: true }).first(), `heading "${name}"`)
  })
})

Then('I should see the button {string}', async (name) => {
  await pw('button visible', async ({ page }) => {
    await waitVisible(page.getByRole('button', { name, exact: true }).first(), `button "${name}"`)
  })
})

Then('I should not see the button {string}', async (name) => {
  I.wait(1)
  await pw('button hidden', async ({ page }) => {
    const n = await page.getByRole('button', { name, exact: true }).filter({ visible: true }).count()
    if (n) throw new Error(`Button "${name}" should not be visible`)
  })
})

When('I click the button {string}', async (name) => {
  await pw(`click ${name}`, async ({ page }) => {
    const b = await button(page, name)
    await waitVisible(b, `button "${name}"`)
    await b.click()
  })
})

When('I click the tab {string}', async (name) => {
  await pw(`tab ${name}`, async ({ page }) => {
    await page.getByRole('tab', { name, exact: true }).first().click()
  })
})

Then('I should see the tabs:', async (table) => {
  const names = table.parse().hashes().map((r) => r.tab)
  await pw('tabs', async ({ page }) => {
    for (const name of names) await waitVisible(page.getByRole('tab', { name, exact: true }).first(), `tab "${name}"`)
  })
})

Then('I should not see the tabs:', async (table) => {
  const names = table.parse().hashes().map((r) => r.tab)
  await pw('no tabs', async ({ page }) => {
    for (const name of names) {
      if (await page.getByRole('tab', { name, exact: true }).count()) throw new Error(`Tab "${name}" should not be visible`)
    }
  })
})

When('I fill {string} with {string}', async (label, value) => {
  await pw(`fill ${label}`, async ({ page }) => {
    const f = await field(page, label)
    await waitVisible(f, `field "${label}"`)
    await f.fill(value)
  })
})

When('I select {string} in {string}', async (option, label) => {
  await pw(`select ${label}`, async ({ page }) => {
    await (await field(page, label)).selectOption({ label: option })
  })
})

When('I select the option starting with {string} in {string}', async (prefix, label) => {
  await pw(`select ${label}`, async ({ page }) => {
    const sel = await field(page, label)
    const labels = await sel.locator('option').allTextContents()
    const hit = labels.find((l) => l.trim().startsWith(prefix))
    if (!hit) throw new Error(`No option starting with "${prefix}" in "${label}" (have: ${labels.join(' | ')})`)
    await sel.selectOption({ label: hit })
  })
})

// ---------------------------------------------------------------- sheets & feedback

Then('the sheet {string} should be open', async (title) => {
  await pw('sheet open', async ({ page }) => {
    await waitVisible(dialog(page).getByRole('heading', { name: title, exact: true }), `sheet "${title}"`)
  })
})

When('I submit the sheet with {string}', async (name) => {
  await pw(`submit ${name}`, async ({ page }) => {
    const b = dialog(page).getByRole('button', { name, exact: true }).last()
    await waitVisible(b, `sheet button "${name}"`)
    await b.click()
  })
})

Then('the sheet should show the error {string}', async (text) => {
  await pw('sheet error', async ({ page }) => {
    await waitVisible(dialog(page).getByRole('alert').filter({ hasText: text }).first(), `error "${text}" in the sheet`)
  })
})

Then('the sheet should show an error', async () => {
  await pw('sheet error', async ({ page }) => {
    await waitVisible(dialog(page).getByRole('alert').first(), 'an error in the sheet', 5000)
  })
})

Then('I should see the toast {string}', async (text) => {
  await pw('toast', async ({ page }) => {
    await waitVisible(toast(page, text), `toast "${text}"`)
  })
})

Then('I should not see the toast {string}', async (text) => {
  I.wait(2)
  await pw('no toast', async ({ page }) => {
    if (await toast(page, text).count()) throw new Error(`Toast "${text}" should not appear`)
  })
})

Then('the breadcrumb should show {string}', async (text) => {
  await pw('breadcrumb', async ({ page }) => {
    await waitText(page.getByRole('navigation', { name: 'Navegação' }), text, 'the breadcrumb')
  })
})

When('the device goes offline', async () => {
  await pw('offline', async ({ page }) => { await page.context().setOffline(true) })
})

// ---------------------------------------------------------------- downloads

let lastDownload = null

When('I download the file from the button {string}', async (name) => {
  lastDownload = null
  await pw(`download via ${name}`, async ({ page }) => {
    const b = page.getByRole('button', { name, exact: true }).first()
    await waitVisible(b, `button "${name}"`)
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: T }), b.click()])
    lastDownload = download.suggestedFilename()
  })
})

When('I download the file from the {string} menu option {string}', async (menu, option) => {
  lastDownload = null
  await pw(`download via ${menu} → ${option}`, async ({ page }) => {
    await page.getByRole('button', { name: menu, exact: true }).first().click()
    const item = tile(page, option).first()
    await waitVisible(item, `menu option "${option}"`)
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: T }), item.click()])
    lastDownload = download.suggestedFilename()
  })
})

Then('the downloaded file name should end with {string}', (suffix) => {
  if (!lastDownload?.endsWith(suffix)) throw new Error(`Expected a download ending with "${suffix}", got "${lastDownload}"`)
})

Then('the downloaded file name should match {string}', (pattern) => {
  if (!lastDownload || !new RegExp(`^${pattern}$`).test(lastDownload)) throw new Error(`Expected a download matching /${pattern}/, got "${lastDownload}"`)
})

