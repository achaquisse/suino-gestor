import { SWATCH } from '@/lib/constants'
import type { Account, AccountBalance, Category, Transaction } from '@/lib/database.types'
import { addDays, dISO, dShort, dUTC, MONTHS, MONTHS3, pad } from '@/lib/format'
import { DEFAULT_PERIOD, PERIODS, isPreset, presetRange, type PresetKey } from '@/lib/periods'

export type Period = PresetKey | 'custom'
export { PERIODS, DEFAULT_PERIOD, isPreset }
export const periodRange = (p: PresetKey, start?: string | null): [string, string] => presetRange(p, start)

export const rangeLabel = (f: string, t: string) =>
  f === t ? `${dShort(f)} ${f.slice(0, 4)}` : `${dShort(f)}${f.slice(0, 4) === t.slice(0, 4) ? '' : ' ' + f.slice(0, 4)} – ${dShort(t)} ${t.slice(0, 4)}`

export type Bucket = { a: string; b: string; label: string; full: string }

export function buildBuckets(F: string, T: string): { buckets: Bucket[]; weekly: boolean } {
  const span = (dUTC(T) - dUTC(F)) / 86_400_000 + 1
  const weekly = span <= 35
  const buckets: Bucket[] = []
  if (weekly) {
    for (let s = F; s <= T; s = addDays(s, 7)) {
      const e = addDays(s, 6) > T ? T : addDays(s, 6)
      const label = s.slice(5, 7) === e.slice(5, 7) ? `${+s.slice(8, 10)}–${+e.slice(8, 10)} ${MONTHS3[+e.slice(5, 7) - 1]}` : `${dShort(s)}–${dShort(e)}`
      buckets.push({ a: s, b: e, label, full: label })
    }
  } else {
    let y = +F.slice(0, 4)
    let mo = +F.slice(5, 7)
    for (;;) {
      const first = `${y}-${pad(mo)}-01`
      if (first > T) break
      const last = dISO(Date.UTC(y, mo, 0))
      buckets.push({ a: first < F ? F : first, b: last > T ? T : last, label: MONTHS3[mo - 1], full: `${MONTHS[mo - 1]} ${y}` })
      mo++
      if (mo > 12) { mo = 1; y++ }
    }
  }
  return { buckets, weekly }
}

export const acctColor = (accts: Account[], id: string) => {
  const i = accts.findIndex((a) => a.id === id)
  return accts[i]?.color || SWATCH[Math.max(0, i) % SWATCH.length]
}

const sum = (rows: Transaction[]) => rows.reduce((s, t) => s + t.amount, 0)

export type Statement = {
  revenue: number; direct: number; gross: number; opex: number; net: number; infra: number; salesCount: number
  revenueByCat: [string, number][]; directByCat: [string, number][]; opexByCat: [string, number][]
}

export function statement(per: Transaction[], categories: Category[]): Statement {
  const groups = new Map(categories.map((c) => [c.name, c.grp]))
  const isDirect = (name: string) => name !== 'Infra-estrutura' && groups.get(name) === 'Investimento'
  const isOpex = (name: string) => groups.get(name) === 'Operacional'
  const inc = per.filter((t) => t.amount > 0 && t.category !== 'Injeção de capital')
  const byCat = (rows: Transaction[]) => {
    const values = new Map<string, number>()
    for (const t of rows) values.set(t.category, (values.get(t.category) ?? 0) + Math.abs(t.amount))
    return [...values] as [string, number][]
  }
  const directByCat = byCat(per.filter((t) => t.amount < 0 && isDirect(t.category)))
  const opexByCat = byCat(per.filter((t) => t.amount < 0 && isOpex(t.category)))
  const revenue = sum(inc)
  const direct = directByCat.reduce((n, [, v]) => n + v, 0)
  const opex = opexByCat.reduce((n, [, v]) => n + v, 0)
  return {
    revenue, direct, gross: revenue - direct, opex, net: revenue - direct - opex,
    infra: -sum(per.filter((t) => t.amount < 0 && t.category === 'Infra-estrutura')), salesCount: inc.length,
    revenueByCat: byCat(inc), directByCat, opexByCat,
  }
}

export type CashRow = { id: string; name: string; person: string; color: string; open: number; inP: number; outP: number; close: number; total?: boolean }

export function cashRows(scope: Account[], all: Transaction[], balances: AccountBalance[], F: string, T: string, accts: Account[]): CashRow[] {
  const rows: CashRow[] = scope.map((a) => {
    const tx = all.filter((t) => t.account_id === a.id)
    const inP = sum(tx.filter((t) => t.tx_date >= F && t.tx_date <= T && t.amount > 0))
    const outP = -sum(tx.filter((t) => t.tx_date >= F && t.tx_date <= T && t.amount < 0))
    const bal = balances.find((b) => b.id === a.id)?.balance ?? a.initial_balance + sum(tx)
    const close = bal - sum(tx.filter((t) => t.tx_date > T))
    return { id: a.id, name: a.name, person: a.holder, color: acctColor(accts, a.id), open: close - (inP - outP), inP, outP, close }
  })
  if (rows.length > 1) {
    const S = (k: 'open' | 'inP' | 'outP' | 'close') => rows.reduce((s, c) => s + c[k], 0)
    rows.push({ id: 'total', name: 'Total', person: 'Todas as contas', color: 'transparent', open: S('open'), inP: S('inP'), outP: S('outP'), close: S('close'), total: true })
  }
  return rows
}

export const csvOf = (rows: string[][]) =>
  '\uFEFF' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n')

export function downloadFile(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
