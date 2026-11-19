import { addMonths, dISO, todayISO } from './format'

/** Date presets shared by Despesas and Relatórios. */
export type PresetKey = 'mes' | 'mes-1' | 'mes-2' | 'semestre' | 'ano' | 'ano-1' | 'tudo'

export const DEFAULT_PERIOD: PresetKey = 'mes'

export const PERIODS: readonly (readonly [PresetKey, string])[] = [
  ['mes', 'Este mês'],
  ['mes-1', 'Mês passado'],
  ['mes-2', 'Mês antepassado'],
  ['semestre', 'Este semestre'],
  ['ano', 'Este ano'],
  ['ano-1', 'Ano passado'],
  ['tudo', 'Desde o início até hoje'],
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
    case 'mes': return [thisMonth, today]
    case 'mes-1': { const f = addMonths(thisMonth, -1); return [f, monthEnd(f)] }
    case 'mes-2': { const f = addMonths(thisMonth, -2); return [f, monthEnd(f)] }
    case 'semestre': return [m <= 6 ? `${y}-01-01` : `${y}-07-01`, today]
    case 'ano': return [`${y}-01-01`, today]
    case 'ano-1': return [`${y - 1}-01-01`, `${y - 1}-12-31`]
    case 'tudo': return [start && start < today ? start : `${y}-01-01`, today]
  }
}

/** First date with data: the earliest of the given dates (ISO strings or timestamps). */
export const firstDate = (dates: (string | null | undefined)[]) =>
  dates.reduce<string | null>((min, d) => (d && (!min || d.slice(0, 10) < min) ? d.slice(0, 10) : min), null)
