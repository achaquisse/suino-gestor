import { addMonths, dISO, todayISO } from './format'

/** Date presets shared by Despesas and Relatórios. */
export type PresetKey = 'this-month' | 'last-month' | 'two-months-ago' | 'this-half' | 'this-year' | 'last-year' | 'all-time'

export const DEFAULT_PERIOD: PresetKey = 'this-month'

export const PERIODS: readonly (readonly [PresetKey, string])[] = [
  ['this-month', 'Este mês'],
  ['last-month', 'Mês passado'],
  ['two-months-ago', 'Mês antepassado'],
  ['this-half', 'Este semestre'],
  ['this-year', 'Este ano'],
  ['last-year', 'Ano passado'],
  ['all-time', 'Desde o início até hoje'],
]

export const isPreset = (v: string | null): v is PresetKey => PERIODS.some(([k]) => k === v)

const monthEnd = (first: string) => dISO(Date.UTC(+first.slice(0, 4), +first.slice(5, 7), 0))

/**
 * [from, to] for a preset. `start` is the first date with data, used by "Desde o início";
 * without it that preset starts on 1 January of this year.
 */
export function presetRange(key: PresetKey, start?: string | null, today = todayISO()): [string, string] {
  const y = +today.slice(0, 4)
  const m = +today.slice(5, 7)
  const thisMonth = `${today.slice(0, 8)}01`
  switch (key) {
    case 'this-month': return [thisMonth, today]
    case 'last-month': { const f = addMonths(thisMonth, -1); return [f, monthEnd(f)] }
    case 'two-months-ago': { const f = addMonths(thisMonth, -2); return [f, monthEnd(f)] }
    case 'this-half': return [m <= 6 ? `${y}-01-01` : `${y}-07-01`, today]
    case 'this-year': return [`${y}-01-01`, today]
    case 'last-year': return [`${y - 1}-01-01`, `${y - 1}-12-31`]
    case 'all-time': return [start && start < today ? start : `${y}-01-01`, today]
  }
}

/** First date with data: the earliest of the given dates (ISO strings or timestamps). */
export const firstDate = (dates: (string | null | undefined)[]) =>
  dates.reduce<string | null>((min, d) => (d && (!min || d.slice(0, 10) < min) ? d.slice(0, 10) : min), null)
