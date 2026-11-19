import { createClient } from '@supabase/supabase-js'
import { readState } from '../support/fixtures.js'
import { supabaseEnv } from '../support/env.js'
import { kpiValue, waitText, waitVisible, xq } from '../support/ui.js'

const { I } = inject()
const pw = (desc, fn) => I.usePlaywrightTo(desc, fn)

When('I search the herd for {string}', async (q) => {
  await pw('search herd', async ({ page }) => {
    await page.getByPlaceholder('Procurar brinco, fase ou curral').fill(q)
  })
})

Then('the herd KPI {string} should show {string}', async (label, value) => {
  await pw(`KPI ${label}`, async ({ page }) => {
    await waitText(kpiValue(page, label), value, `the "${label}" KPI`)
  })
})

When('I click the herd KPI {string}', async (label) => {
  await pw(`KPI ${label}`, async ({ page }) => {
    await page.locator(`xpath=//button[./span[text()[normalize-space()=${xq(label)}]]]`).first().click()
  })
})

Then('the animal list should show {string}', async (count) => {
  await pw('list count', async ({ page }) => {
    await waitVisible(page.locator(`xpath=//h2/following-sibling::span[normalize-space()=${xq(count)}]`).first(), `list count "${count}"`)
  })
})

Then('I should see the animal {string} in the list', async (tag) => {
  await pw('animal row', async ({ page }) => {
    await waitVisible(page.locator(`xpath=//button[./span[normalize-space()=${xq(tag)}]]`).first(), `animal row ${tag}`)
  })
})

When('I open the pen {string}', async (name) => {
  if (!(await I.grabCurrentUrl()).match(/\/herd(\?|$)/)) I.amOnPage('/herd')
  await pw(`open pen ${name}`, async ({ page }) => {
    const card = page.locator(`xpath=//button[.//div[normalize-space(text())=${xq(name)}]]`).first()
    await waitVisible(card, `pen card "${name}"`)
    await card.click()
    await waitVisible(page.getByRole('heading', { level: 1, name, exact: true }), `pen page "${name}"`)
  })
})

When('I open the animal {string}', async (tag) => {
  I.amOnPage(`/herd/animals/${encodeURIComponent(tag)}`)
  await pw(`animal ${tag}`, async ({ page }) => {
    await waitVisible(page.getByRole('heading', { level: 1, name: tag, exact: true }), `animal page ${tag}`)
  })
})

// ---------------------------------------------------------------- order-independent count checks

const noted = {}
const firstInt = (s) => parseInt((s.match(/\d+/) ?? ['NaN'])[0], 10)

When('I note the herd KPI {string}', async (label) => {
  await pw(`note KPI ${label}`, async ({ page }) => {
    const v = kpiValue(page, label)
    await waitVisible(v, `the "${label}" KPI`)
    noted[label] = firstInt((await v.textContent()) ?? '')
  })
})

Then('the herd KPI {string} should have increased by {int}', async (label, delta) => {
  const expected = noted[label] + delta
  await pw(`KPI ${label} +${delta}`, async ({ page }) => {
    await waitText(kpiValue(page, label), `${expected} /`, `the "${label}" KPI (was ${noted[label]})`)
  })
})

Then('the herd KPI {string} should match the number of live animals in the farm', async (label) => {
  const { url, serviceKey } = supabaseEnv()
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { count, error } = await admin.from('animals').select('id', { count: 'exact', head: true })
    .eq('farm_id', readState().farm.id).is('removed_at', null)
  if (error) throw new Error(`DB oracle failed: ${error.message}`)
  await pw(`KPI ${label} = ${count}`, async ({ page }) => {
    const v = kpiValue(page, label)
    const end = Date.now() + 10000
    let got = NaN
    while (Date.now() < end && got !== count) {
      got = firstInt((await v.textContent().catch(() => '')) ?? '')
      if (got !== count) await page.waitForTimeout(200)
    }
    if (got !== count) throw new Error(`Expected the "${label}" KPI to be ${count} (live animals in DB) but it was ${got}`)
  })
})

Then('the animal list count should equal the herd KPI {string}', async (label) => {
  await pw('list count = KPI', async ({ page }) => {
    const kpi = kpiValue(page, label)
    await waitVisible(kpi, `the "${label}" KPI`)
    const n = firstInt((await kpi.textContent()) ?? '')
    const want = n === 1 ? '1 animal' : `${n} animais`
    await waitVisible(page.locator(`xpath=//h2/following-sibling::span[normalize-space()=${xq(want)}]`).first(), `list count "${want}"`)
  })
})
