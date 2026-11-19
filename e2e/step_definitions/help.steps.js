import { waitVisible, xq } from '../support/ui.js'

const { I } = inject()
const pw = (desc, fn) => I.usePlaywrightTo(desc, fn)

When('I search the help for {string}', async (q) => {
  await pw('help search', async ({ page }) => {
    await page.getByPlaceholder(/^Pesquisar: cio/).fill(q)
  })
})

const helpResult = (page, title) => page.locator(`xpath=//a[.//span[normalize-space(text())=${xq(title)}]]`).first()

Then('I should see the help result {string}', async (title) => {
  await pw('help result', async ({ page }) => {
    await waitVisible(helpResult(page, title), `help result "${title}"`)
  })
})

When('I click the help result {string}', async (title) => {
  await pw('open help result', async ({ page }) => {
    const r = helpResult(page, title)
    await waitVisible(r, `help result "${title}"`)
    await r.click()
  })
})
