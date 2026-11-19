import { dialog, tile, waitVisible } from '../support/ui.js'

const { I } = inject()
const pw = (desc, fn) => I.usePlaywrightTo(desc, fn)

const SHEET_TITLE = { Vender: 'Venda', Transferir: 'Transferência' }

When("I choose {string} from the animal's Registar menu", async (item) => {
  await pw(`Registar → ${item}`, async ({ page }) => {
    await page.getByRole('button', { name: 'Registar', exact: true }).click()
    const option = tile(page, item).filter({ visible: true }).first()
    await waitVisible(option, `menu item "${item}"`)
    await option.click()
    const title = SHEET_TITLE[item] ?? item
    await waitVisible(dialog(page).getByRole('heading', { name: title, exact: true }), `sheet "${title}"`)
  })
})

When('I open the quick log', async () => {
  await pw('quick log', async ({ page }) => {
    await page.getByRole('button', { name: 'Novo', exact: true }).click()
    await waitVisible(dialog(page).getByRole('heading', { name: 'Registar', exact: true }), 'the quick log sheet')
  })
})

When('I pick {string} in the sheet', async (label) => {
  await pw(`pick ${label}`, async ({ page }) => {
    await tile(dialog(page), label).first().click()
    await waitVisible(dialog(page).getByRole('heading', { name: label, exact: true }), `sheet "${label}"`)
  })
})

const options = (table) => table.parse().hashes().map((r) => r.option)

Then('the sheet should offer the options:', async (table) => {
  await pw('options offered', async ({ page }) => {
    for (const o of options(table)) await waitVisible(tile(dialog(page), o).first(), `option "${o}"`)
  })
})

Then('the sheet should not offer the options:', async (table) => {
  await pw('options not offered', async ({ page }) => {
    for (const o of options(table)) {
      if (await tile(dialog(page), o).count()) throw new Error(`Option "${o}" should not be offered`)
    }
  })
})

Then('the sale total should be {int} meticais', async (amount) => {
  await pw('sale total', async ({ page }) => {
    const total = dialog(page).locator('xpath=.//div[normalize-space()="Total da venda"]/following-sibling::div[1]')
    const end = Date.now() + 10000
    let digits = ''
    while (Date.now() < end) {
      digits = ((await total.textContent()) ?? '').replace(/\D/g, '')
      if (digits === String(amount)) return
      await page.waitForTimeout(200)
    }
    throw new Error(`Expected the sale total to be ${amount} MT, got digits "${digits}"`)
  })
})


