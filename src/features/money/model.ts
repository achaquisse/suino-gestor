import { MUTED } from '@/lib/constants'
import type { Account, Category, Split, Transaction } from '@/lib/database.types'
import { dShort, numP } from '@/lib/format'
import { DEFAULT_PERIOD, PERIODS, isPreset, presetRange, type PresetKey } from '@/lib/periods'

export type PeriodKey = PresetKey | 'custom'
export type Period = { key: PeriodKey; from: string; to: string }
export { PERIODS }

/** `start` is the first date with data ("Desde o início"). */
export const periodBounds = (key: PresetKey, start?: string | null): [string, string] => presetRange(key, start)

export const rangeLabel = (from: string, to: string) =>
  from === to ? `${dShort(from)} ${to.slice(0, 4)}` : `${dShort(from)}${from.slice(0, 4) === to.slice(0, 4) ? '' : ' ' + from.slice(0, 4)} – ${dShort(to)} ${to.slice(0, 4)}`

export const periodLabel = (p: Period) => (p.key === 'custom' ? 'Intervalo' : PERIODS.find(([k]) => k === p.key)?.[1] ?? '')

export const makePeriod = (key: PresetKey, start?: string | null): Period => {
  const [from, to] = periodBounds(key, start)
  return { key, from, to }
}

export const defaultPeriod = (start?: string | null): Period => makePeriod(DEFAULT_PERIOD, start)

export const isIncome = (t: Transaction) => t.amount > 0 && t.category !== 'Injeção de capital'

export const shortAcct = (n: string) => n.replace('Investidor ', 'Inv. ')

export type SplitDraft = { account_id: string; pct: string }

export const splitsOf = (x: { splits: Split[] | null; account_id: string }): Split[] =>
  x.splits && x.splits.length > 1 ? x.splits : [{ account_id: x.account_id, pct: 100 }]

export const splitDraftOf = (x: { splits: Split[] | null; account_id: string }): SplitDraft[] =>
  splitsOf(x).map((s) => ({ account_id: s.account_id, pct: String(s.pct) }))

export const splitLabel = (sp: Split[], name: (id: string) => string) =>
  sp.length > 1 ? sp.map((s) => `${shortAcct(name(s.account_id))} ${s.pct}%`).join(' · ') : name(sp[0].account_id)

export const splitCheck = (sp: SplitDraft[]) => {
  const p = (s: SplitDraft) => numP(s.pct)
  const total = sp.reduce((a, s) => a + (p(s) || 0), 0)
  if (sp.some((s) => !s.account_id)) return 'Escolha a conta.'
  if (sp.some((s) => !(p(s) > 0))) return 'Cada conta precisa de uma percentagem maior que zero.'
  if (new Set(sp.map((s) => s.account_id)).size < sp.length) return 'A mesma conta aparece mais de uma vez.'
  if (Math.abs(total - 100) > 0.01) return `As percentagens têm de somar 100% (agora ${Math.round(total * 100) / 100}%).`
  return ''
}

export const toSplits = (sp: SplitDraft[]): Split[] => sp.map((s) => ({ account_id: s.account_id, pct: numP(s.pct) }))

export type Lookups = {
  accountName: (id: string) => string
  accountColor: (id: string) => string
  categoryColor: (name: string) => string
  categoryGroup: (name: string) => string
}

const ACCT_PALETTE = ['#5B4CF0', '#3BA9C7', '#E8A23A', '#2FA684', '#E0607A', '#A88BF2', '#C1579B']

export function makeLookups(accounts: Account[], categories: Category[]): Lookups {
  const accIdx = new Map(accounts.map((a, i) => [a.id, { name: a.name, color: a.color || ACCT_PALETTE[i % ACCT_PALETTE.length] }]))
  const cat = new Map(categories.map((c) => [c.name, c]))
  return {
    accountName: (id) => accIdx.get(id)?.name ?? '—',
    accountColor: (id) => accIdx.get(id)?.color ?? MUTED,
    categoryColor: (n) => cat.get(n)?.color ?? MUTED,
    categoryGroup: (n) => cat.get(n)?.grp ?? (n === 'Pagamento de dívida' ? 'Dívida' : 'Investimento'),
  }
}

export const siblingKey = (t: Transaction) => `${t.created_at}|${t.tx_date}|${t.title}|${t.category}|${t.created_by_name}`

export function siblingsOf(t: Transaction, all: Transaction[]) {
  const k = siblingKey(t)
  return all.filter((x) => siblingKey(x) === k)
}

export function pctOf(t: Transaction, all: Transaction[]) {
  const sibs = siblingsOf(t, all)
  if (sibs.length < 2) return null
  const tot = sibs.reduce((a, x) => a + Math.abs(x.amount), 0)
  return Math.round((Math.abs(t.amount) / tot) * 100)
}

export const fileSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MB`)

export const stampLabel = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dShort(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`
}

export type Filters = {
  period: Period
  acct: string
  cat: string | null
  q: string
  sort: 'new' | 'old' | 'high' | 'low'
}

export const defaultFilters = (start?: string | null): Filters => ({ period: defaultPeriod(start), acct: 'all', cat: null, q: '', sort: 'new' })

const SORTS: readonly Filters['sort'][] = ['new', 'old', 'high', 'low']
const ISO = /^\d{4}-\d{2}-\d{2}$/

export function filtersFromParams(p: URLSearchParams, start?: string | null): Filters {
  const d = defaultFilters(start)
  const key = p.get('period')
  const from = p.get('from') ?? ''
  const to = p.get('to') ?? ''
  const period: Period = key === 'custom' && ISO.test(from) && ISO.test(to) && from <= to ? { key: 'custom', from, to } : isPreset(key) ? makePeriod(key, start) : d.period
  const sort = p.get('sort') as Filters['sort']
  return {
    period,
    acct: p.get('acct') || d.acct,
    cat: p.get('cat') || d.cat,
    q: p.get('q') ?? d.q,
    sort: SORTS.includes(sort) ? sort : d.sort,
  }
}

export function filtersToParams(f: Partial<Filters>): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  if (f.period) Object.assign(out, f.period.key === 'custom' ? { period: 'custom', from: f.period.from, to: f.period.to } : { period: f.period.key === DEFAULT_PERIOD ? null : f.period.key, from: null, to: null })
  if ('acct' in f) out.acct = f.acct === 'all' ? null : f.acct ?? null
  if ('cat' in f) out.cat = f.cat ?? null
  if ('q' in f) out.q = f.q || null
  if ('sort' in f) out.sort = f.sort === 'new' ? null : f.sort ?? null
  return out
}

export const isFiltered = (f: Filters) => f.period.key !== DEFAULT_PERIOD || f.acct !== 'all' || !!f.cat || !!f.q

export function groupSiblings(all: Transaction[]) {
  const m = new Map<string, Transaction[]>()
  for (const t of all) {
    const k = siblingKey(t)
    const l = m.get(k)
    if (l) l.push(t)
    else m.set(k, [t])
  }
  return m
}

export function pctIn(t: Transaction, groups: Map<string, Transaction[]>) {
  const sibs = groups.get(siblingKey(t))
  if (!sibs || sibs.length < 2) return null
  const tot = sibs.reduce((a, x) => a + Math.abs(x.amount), 0)
  return Math.round((Math.abs(t.amount) / tot) * 100)
}
