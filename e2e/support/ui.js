// Playwright-native locator helpers used by the step definitions (via I.usePlaywrightTo).
// They locate elements the way a user does: role + accessible name, visible labels and text.
// Material icons render as aria-hidden ligature text, so exact text matching uses direct
// text nodes (text()) rather than the element's full textContent.

export const T = 10000

/** Quote a string for XPath 1.0. */
export const xq = (s) => (s.includes('"') ? `concat("${s.split('"').join('", \'"\', "')}")` : `"${s}"`)

/** The top-most open sheet/dialog, or the page when none is open. */
export async function scope(page) {
  const dialogs = page.getByRole('dialog')
  return (await dialogs.count()) ? dialogs.last() : page
}

export const dialog = (page) => page.getByRole('dialog').last()

/** A form control inside a <label> whose caption is exactly `label` (the app's Field component). */
export async function field(page, label) {
  const root = await scope(page)
  return root.locator(`xpath=.//label[.//span[normalize-space(text())=${xq(label)}]]//*[self::input or self::select or self::textarea]`).first()
}

/** A button whose own caption span is exactly `label` (menu tiles, quick-log options). */
export function tile(root, label) {
  return root.locator(`xpath=.//button[.//span[normalize-space(text())=${xq(label)}]]`)
}

/** Prefer a matching button in the open sheet; otherwise anywhere on the page. */
export async function button(page, name) {
  const root = await scope(page)
  const inScope = root.getByRole('button', { name, exact: true })
  if (root !== page && (await inScope.count())) return inScope.first()
  return page.getByRole('button', { name, exact: true }).first()
}

export const mainNav = (page) => page.getByRole('navigation', { name: 'Principal' }).filter({ visible: true }).first()

/** KPI tile value: the span right after the label span (which also holds an icon). */
export const kpiValue = (page, label) =>
  page.locator(`xpath=//span[text()[normalize-space()=${xq(label)}]]/following-sibling::span[1]`).first()

export const toast = (page, text) => page.getByRole('status').filter({ hasText: text }).first()

export async function waitVisible(locator, what, timeout = T) {
  try {
    await locator.waitFor({ state: 'visible', timeout })
  } catch {
    throw new Error(`Expected to see ${what} within ${timeout / 1000}s`)
  }
}

export async function waitText(locator, expected, what, timeout = T) {
  const end = Date.now() + timeout
  let last = ''
  while (Date.now() < end) {
    last = ((await locator.textContent({ timeout: 1000 }).catch(() => '')) ?? '').replace(/\s+/g, ' ').trim()
    if (last.includes(expected)) return last
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Expected ${what} to contain "${expected}" but it was "${last}"`)
}
