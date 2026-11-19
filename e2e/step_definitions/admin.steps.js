import { readState } from '../support/fixtures.js'
import { button, dialog, field, waitVisible } from '../support/ui.js'

const { I } = inject()
const pw = (desc, fn) => I.usePlaywrightTo(desc, fn)

// Farm names get the run id so they never collide with other runs or the developer's data.
const named = (name) => `${name} ${readState().run}`
const farmRow = (page, name) =>
  page.getByRole('list', { name: 'Granjas' }).getByRole('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) }).first()

When('I create the farm {string} for the invitee', async (name) => {
  const { invitee } = readState()
  await pw('create farm', async ({ page }) => {
    await (await button(page, 'Nova granja')).click()
    await waitVisible(dialog(page).getByRole('heading', { name: 'Nova granja', exact: true }), 'the new farm sheet')
    await (await field(page, 'Nome da granja')).fill(named(name))
    await (await field(page, 'Email do proprietário')).fill(invitee)
    await dialog(page).getByRole('button', { name: 'Criar granja', exact: true }).click()
  })
})

When('I try to create a farm without a name', async () => {
  await pw('create farm without name', async ({ page }) => {
    await (await button(page, 'Nova granja')).click()
    await dialog(page).getByRole('button', { name: 'Criar granja', exact: true }).click()
  })
})

Then('I should see the toast for the new farm {string}', async (name) => {
  await pw('farm toast', async ({ page }) => {
    await waitVisible(page.getByRole('status').filter({ hasText: `Granja criada · ${named(name)}` }).first(), 'the farm-created toast')
  })
})

Then('the farm {string} should be listed with the invitee as pending owner', async (name) => {
  const { invitee } = readState()
  await pw('farm listed', async ({ page }) => {
    const row = farmRow(page, named(name))
    await waitVisible(row, `farm "${named(name)}" in the list`)
    await waitVisible(row.getByText(`${invitee} (convite)`), 'the invited owner')
    await waitVisible(row.getByText('1 convite'), 'the pending invite chip')
  })
})

Then('the E2E demo farm should be listed with its owner', async () => {
  const { farm, users } = readState()
  await pw('demo farm listed', async ({ page }) => {
    const row = farmRow(page, farm.name)
    await waitVisible(row, `farm "${farm.name}" in the list`)
    await waitVisible(row.getByText(users.owner.name), 'the owner name')
    await waitVisible(row.getByText('64 animais'), 'the animal count')
  })
})

When('I search the admin farms for the E2E demo farm', async () => {
  await pw('search farms', async ({ page }) => {
    await page.getByPlaceholder('Pesquisar granja ou proprietário').fill(readState().farm.name)
  })
})

Then('the admin farm list should show only the E2E demo farm', async () => {
  await pw('one farm', async ({ page }) => {
    const list = page.getByRole('list', { name: 'Granjas' })
    await waitVisible(farmRow(page, readState().farm.name), 'the demo farm')
    const n = await list.getByRole('article').count()
    if (n !== 1) throw new Error(`Expected 1 farm after searching, found ${n}`)
  })
})

When('I rename the farm {string} to {string}', async (from, to) => {
  await pw('rename farm', async ({ page }) => {
    await page.getByRole('button', { name: `Renomear ${named(from)}`, exact: true }).click()
    const input = await field(page, 'Nome da granja')
    await waitVisible(input, 'the farm name field')
    await input.fill(named(to))
    await dialog(page).getByRole('button', { name: 'Guardar', exact: true }).click()
  })
})

When('I delete the farm {string}', async (name) => {
  await pw('delete farm', async ({ page }) => {
    await page.getByRole('button', { name: `Eliminar ${named(name)}`, exact: true }).click()
    await dialog(page).getByRole('button', { name: 'Eliminar', exact: true }).click()
  })
})

Then('the farm {string} should be listed', async (name) => {
  await pw('farm listed', async ({ page }) => {
    await waitVisible(farmRow(page, named(name)), `farm "${named(name)}" in the list`)
  })
})

Then('the farm {string} should not be listed', async (name) => {
  await pw('farm gone', async ({ page }) => {
    await farmRow(page, named(name)).waitFor({ state: 'detached', timeout: 10000 })
      .catch(() => { throw new Error(`Farm "${named(name)}" is still listed`) })
  })
})

When('I open the cost types of the E2E demo farm', async () => {
  const { farm } = readState()
  await pw('open cost types', async ({ page }) => {
    await farmRow(page, farm.name).getByRole('button', { name: `Tipos de custo de ${farm.name}`, exact: true }).click()
  })
})

When('I open the catalogs of the E2E demo farm', async () => {
  const { farm } = readState()
  await pw('open catalogs', async ({ page }) => {
    await farmRow(page, farm.name).getByRole('button', { name: `Catálogos de ${farm.name}`, exact: true }).click()
  })
})

When('I enter the E2E demo farm from the admin area', async () => {
  await pw('enter farm', async ({ page }) => {
    await farmRow(page, readState().farm.name).getByRole('button', { name: 'Entrar', exact: true }).click()
  })
})

Then('the header should show the E2E demo farm', async () => {
  const { farm } = readState()
  await pw('header farm', async ({ page }) => {
    await waitVisible(page.locator('header').getByRole('button', { name: new RegExp(farm.name) }), `"${farm.name}" in the header`)
  })
})

Then('the users list should show the owner with the E2E demo farm', async () => {
  const { farm, users } = readState()
  await pw('users list', async ({ page }) => {
    const row = page.getByRole('list', { name: 'Utilizadores' }).getByRole('article').filter({ hasText: users.owner.email }).first()
    await waitVisible(row, `user ${users.owner.email}`)
    await waitVisible(row.getByText(`${farm.name} · Proprietário`), 'the owner membership')
  })
})

Then('the users list should mark me as super admin', async () => {
  const { users } = readState()
  await pw('super admin chip', async ({ page }) => {
    const row = page.getByRole('list', { name: 'Utilizadores' }).getByRole('article').filter({ hasText: users.admin.email }).first()
    await waitVisible(row.getByText('Super admin', { exact: true }), 'the super admin chip')
  })
})
