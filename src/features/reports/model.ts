import { DIRECT, OPEX, SWATCH } from '@/lib/constants'
import type { Account, AccountBalance, Batch, Transaction } from '@/lib/database.types'
import { addDays, dISO, dShort, dUTC, isoOf, MONTHS, MONTHS3, pad, todayISO } from '@/lib/format'

export type Period = 'mes' | '3m' | 'ano' | 'custom'
export const PERIODS: readonly (readonly [Exclude<Period, 'custom'>, string])[] = [['mes', 'Este mês'], ['3m', 'Últimos 3 meses'], ['ano', 'Este ano']]

export const periodRange = (p: Exclude<Period, 'custom'>, today = todayISO()): [string, string] => {
  const y = +today.slice(0, 4)
  const m = +today.slice(5, 7)
  if (p === 'mes') return [`${y}-${pad(m)}-01`, today]
  if (p === 'ano') return [`${y}-01-01`, today]
  const d = new Date(y, m - 3, 1)
  return [isoOf(d), today]
}

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
  revenueByBatch: [string, number][]; directByCat: [string, number][]; opexByCat: [string, number][]
}

export function statement(per: Transaction[], batches: Batch[]): Statement {
  const outBy = (cs: string[]) => -sum(per.filter((t) => t.amount < 0 && cs.includes(t.category)))
  const byCat = (cs: string[]): [string, number][] =>
    cs.map((c) => [c, -sum(per.filter((t) => t.amount < 0 && t.category === c))] as [string, number]).filter((x) => x[1] > 0)
  const inc = per.filter((t) => t.amount > 0 && t.category !== 'Aporte')
  const revenue = sum(inc)
  const direct = outBy(DIRECT)
  const opex = outBy(OPEX)
  const il = new Map<string, number>()
  for (const t of inc) {
    const k = batches.find((b) => b.id === t.batch_id)?.code ?? 'Outras vendas'
    il.set(k, (il.get(k) ?? 0) + t.amount)
  }
  return {
    revenue, direct, gross: revenue - direct, opex, net: revenue - direct - opex, infra: outBy(['Infra-estrutura']), salesCount: inc.length,
    revenueByBatch: [...il], directByCat: byCat(DIRECT), opexByCat: byCat(OPEX),
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
