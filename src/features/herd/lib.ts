import { ACC, MUTED, RED, SGC, TONE, stageGroup, type StageGroup } from '@/lib/constants'
import type { Animal, Pen } from '@/lib/database.types'
import { MONTHS3, addDays, ageDays, dShort, daysTo, todayISO } from '@/lib/format'
import type { LogType } from '@/lib/constants'

export type CatId = 'doenca' | 'med' | 'cio' | 'parto' | 'car'

export type HelpDef = { label: string; to: string }
export const pb = (id: string, label: string): HelpDef => ({ label, to: `/help/playbooks/${id}` })
export const art = (id: string, label: string): HelpDef => ({ label, to: `/help/articles/${id}` })

export const CAT_HELP: Record<CatId, HelpDef[]> = {
  doenca: [pb('flu', 'Gripe e tosse'), pb('diar', 'Diarreia')],
  med: [art('vacinas', 'Vacinação e ferro')],
  cio: [pb('heat', 'Guia do cio')],
  parto: [pb('farrow', 'Guia do parto')],
  car: [art('carencia', 'Período de carência')],
}

export const ACAT: { id: CatId; title: string; short: string; icon: string; tint: string; ink: string; hint: string; action: string; log: LogType | null }[] = [
  { id: 'doenca', title: 'Doença', short: 'Doença', icon: 'sick', tint: TONE.red[0], ink: TONE.red[1], hint: 'Isolar, observar e tratar', action: 'Registar tratamento', log: 'treatment' },
  { id: 'med', title: 'Medicação em atraso', short: 'Medicação', icon: 'vaccines', tint: TONE.amber[0], ink: TONE.amber[1], hint: 'Ferro, vitaminas e vacinas', action: 'Registar tratamento', log: 'treatment' },
  { id: 'cio', title: 'Verificar cio', short: 'Verificar cio', icon: 'favorite', tint: '#FCE7F3', ink: '#B0306E', hint: 'Observar hoje · cobrir se firme', action: 'Registar cobertura', log: 'mating' },
  { id: 'parto', title: 'Parto nos próximos 7 dias', short: 'Parto próximo', icon: 'child_care', tint: '#EEECFE', ink: '#4B3CD6', hint: 'Preparar maternidade', action: 'Registar parto', log: 'birth' },
  { id: 'car', title: 'Em carência', short: 'Em carência', icon: 'block', tint: '#F0F0F6', ink: '#55556A', hint: 'Não vender até ao fim do prazo', action: 'Ver lista', log: null },
]

const monthIdx = (m: string) => MONTHS3.findIndex((x) => x.toLowerCase() === m.toLowerCase())

export function statusDate(status: string): string | null {
  const m = status.match(/parto (\d{1,2}) (\p{L}{3})/iu)
  if (!m) return null
  const mi = monthIdx(m[2])
  if (mi < 0) return null
  const now = new Date()
  const iso = (y: number) => `${y}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
  let d = iso(now.getFullYear())
  if (daysTo(d) < -60) d = iso(now.getFullYear() + 1)
  return d
}

export function catOf(a: Animal): CatId | null {
  const t = a.status
  if (/cio/i.test(t)) return 'cio'
  if (/em atraso|b12|vacina/i.test(t)) return 'med'
  if (/tosse|febre|diarreia|isolado|doente/i.test(t)) return 'doenca'
  if (/carência/i.test(t) || (a.withdrawal_until && daysTo(a.withdrawal_until) >= 0)) return 'car'
  const d = statusDate(t)
  if (d) {
    const n = daysTo(d)
    if (n >= 0 && n <= 7) return 'parto'
  }
  return null
}

export type HA = Animal & {
  g: StageGroup
  gc: string
  cat: CatId | null
  attn: boolean
  ageD: number
  penName: string
}

export function enrich(animals: Animal[], pens: Pen[]): HA[] {
  const names = new Map(pens.map((p) => [p.id, p.name]))
  return animals.map((a) => {
    const g = stageGroup(a.stage)
    const cat = catOf(a)
    return { ...a, g, gc: SGC[g], cat, attn: !!cat, ageD: ageDays(a.born_on), penName: a.pen_id ? names.get(a.pen_id) ?? '—' : '—' }
  })
}

export const isSow = (a: Pick<Animal, 'stage'>) => a.stage === 'Porca' || a.stage === 'Leitoa'

export const ageShort = (d: number) =>
  d < 60 ? `${Math.round(d / 7)} semanas` : d < 730 ? `${Math.round(d / 30.4)} meses` : `${(d / 365).toFixed(1).replace('.', ',')} anos`

export const parentTags = (parents: string) => parents.split('×').map((x) => x.trim()).filter((x) => x && x !== '—' && !/^compra/i.test(x))

export type PenFlag = { text: string; color: string; icon: string }
export function penFlag(list: HA[]): PenFlag {
  if (!list.length) return { text: 'Vazio', color: MUTED, icon: 'check_circle' }
  const c = (id: CatId) => list.filter((a) => a.cat === id).length
  if (c('doenca')) return { text: `${c('doenca')} com doença`, color: RED, icon: 'error' }
  if (c('med')) return { text: `${c('med')} medicação em atraso`, color: RED, icon: 'error' }
  if (c('cio')) return { text: c('cio') === 1 ? 'Verificar cio hoje' : `${c('cio')} para verificar cio`, color: ACC, icon: 'event' }
  if (c('parto')) return { text: c('parto') === 1 ? 'Parto nos próximos 7 dias' : `${c('parto')} partos em 7 dias`, color: ACC, icon: 'event' }
  if (c('car')) return { text: `${c('car')} em carência`, color: MUTED, icon: 'check_circle' }
  return { text: 'Tudo em ordem', color: MUTED, icon: 'check_circle' }
}

export type PenGroupDef = { id: string; title: string; sub: string; icon: string; tint: string; ink: string; help: HelpDef[] }
export const PEN_GROUPS: PenGroupDef[] = [
  { id: 'mat', title: 'Maternidade', sub: 'Partos e lactação', icon: 'child_care', tint: '#FCE7F3', ink: '#B0306E', help: [pb('farrow', 'Guia do parto'), art('ninhada', 'Registar uma ninhada')] },
  { id: 'cre', title: 'Crescimento', sub: 'Creche, recria e engorda', icon: 'trending_up', tint: '#E6F6EE', ink: '#0F7A44', help: [art('desmame', 'Desmame'), art('densidade', 'Densidade por curral'), art('carencia', 'Carência antes da venda')] },
  { id: 'rep', title: 'Reprodução', sub: 'Gestação e varrasco', icon: 'favorite', tint: '#EEECFE', ink: '#4B3CD6', help: [pb('heat', 'Guia do cio'), art('parto', 'Calcular a data do parto')] },
  { id: 'out', title: 'Outros', sub: 'Restantes currais', icon: 'fence', tint: '#F0F0F6', ink: '#55556A', help: [] },
]

export function penGroupId(p: Pick<Pen, 'name' | 'kind'>): string {
  const s = `${p.name} ${p.kind}`.toLowerCase()
  if (/matern|parto|lacta/.test(s)) return 'mat'
  if (/creche|desmam|recria|engorda|crescimento|acab/.test(s)) return 'cre'
  if (/gesta|varrasco|cobert|reprod|cio/.test(s)) return 'rep'
  return 'out'
}

export function penHelp(p: Pick<Pen, 'name' | 'kind'>): HelpDef[] {
  const s = `${p.name} ${p.kind}`.toLowerCase()
  if (/matern|parto/.test(s)) return [pb('farrow', 'Guia do parto')]
  if (/creche|desmam/.test(s)) return [art('desmame', 'Desmame')]
  if (/recria/.test(s)) return [pb('flu', 'Gripe e tosse')]
  if (/engorda/.test(s)) return [art('carencia', 'Carência'), art('limpeza', 'Limpeza entre lotes')]
  if (/gesta|varrasco/.test(s)) return [pb('heat', 'Guia do cio')]
  return []
}

export const SORTS = [['tag', 'Brinco'], ['kg', 'Mais pesados'], ['age', 'Mais velhos'], ['pen', 'Curral']] as const
export type SortKey = (typeof SORTS)[number][0]

export function sortAnimals(list: HA[], key: SortKey): HA[] {
  const byTag = (a: HA, b: HA) => a.tag.localeCompare(b.tag)
  const cmp: Record<SortKey, (a: HA, b: HA) => number> = {
    tag: byTag,
    kg: (a, b) => b.weight_kg - a.weight_kg,
    age: (a, b) => b.ageD - a.ageD,
    pen: (a, b) => a.penName.localeCompare(b.penName) || byTag(a, b),
  }
  return list.slice().sort(cmp[key])
}

export const fmtKg = (v: number) => `${v < 10 ? v.toFixed(1).replace('.', ',') : Math.round(v)} kg`

export function nextEvent(a: Animal, gestationDays: number, weaningDate: string | null): string {
  const d = statusDate(a.status)
  if (d) return `Parto · ${dShort(d)}`
  const gd = a.status.match(/dia (\d+)/)
  if (gd) return `Parto · ${dShort(addDays(todayISO(), gestationDays - +gd[1]))}`
  if (a.status.includes('cio')) return 'Verificar cio hoje'
  if (a.status === 'Em lactação' && weaningDate) return `Desmame · ${dShort(weaningDate)}`
  return '—'
}
