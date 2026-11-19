import { dialog, field, waitVisible } from '../support/ui.js'

const { I } = inject()
const pw = (desc, fn) => I.usePlaywrightTo(desc, fn)

When('I add the description {string} in the movement details', async (text) => {
  await pw('movement description', async ({ page }) => {
    const toggle = dialog(page).locator('button[aria-controls="fin-details"]')
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
    const f = await field(page, 'Descrição')
    await waitVisible(f, 'the description field')
    await f.fill(text)
  })
})

When('I choose the expense category {string}', async (name) => {
  await pw(`category ${name}`, async ({ page }) => {
    const input = dialog(page).locator('#fin-category')
    await input.click()
    await input.fill(name)
    await dialog(page).getByRole('option', { name, exact: true }).click()
  })
})

When('I search the movements for {string}', async (q) => {
  await pw('search movements', async ({ page }) => {
    await page.getByPlaceholder('Pesquisar despesas').fill(q)
  })
})

When('I choose the report period {string}', async (label) => {
  await pw(`period ${label}`, async ({ page }) => {
    await page.getByRole('button', { name: /^(Este mês|Mês passado|Mês antepassado|Este semestre|Este ano|Ano passado|Desde o início até hoje|Intervalo)/ }).first().click()
    await page.locator(`xpath=//button[.//span[normalize-space(text())="${label}"]]`).first().click()
  })
})


