import type { EventKind, Role, Stage, Tone } from './database.types'

export const ACC = '#5B4CF0'
export const RED = '#D0342C'
export const INK = '#16161F'
export const MUTED = '#6B6B80'
export const GREEN = '#15A05A'

export const TONE: Record<Tone | 'success', readonly [bg: string, fg: string]> = {
  accent: ['#EEECFE', '#4B3CD6'],
  red: ['#FDECEA', '#C0302A'],
  neutral: ['#F0F0F6', '#55556A'],
  amber: ['#FDF1E2', '#A2601A'],
  success: ['#E6F6EE', '#0F7A44'],
}

export const EV: Record<EventKind, { c: string; l: string }> = {
  task: { c: 'oklch(0.6 0.19 280)', l: 'Tarefa' },
  health: { c: 'oklch(0.68 0.13 210)', l: 'Saúde' },
  breeding: { c: 'oklch(0.66 0.16 10)', l: 'Reprodução' },
  money: { c: 'oklch(0.74 0.14 70)', l: 'Finanças' },
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Proprietário',
  caretaker: 'Tratador',
  vet: 'Veterinário',
  investor: 'Investidor',
}

export const SWATCH = ['#5B4CF0', '#3BA9C7', '#2FA684', '#15A05A', '#E8A23A', '#E0607A', '#C1579B', '#A88BF2', '#9A9AAE']
export const FREQS = ['Semanal', 'Mensal', 'Trimestral', 'Anual'] as const
export const FMUL: Record<string, number> = { Semanal: 4.33, Mensal: 1, Trimestral: 1 / 3, Anual: 1 / 12 }
export const PGROUPS = ['Reprodução', 'Crescimento', 'Vendas', 'Stock', 'Saúde', 'Finanças'] as const

export const STAGES: Stage[] = ['Leitão', 'Desmamado', 'Recria', 'Engorda', 'Leitoa', 'Porca', 'Varrasco']
export const STAGE_AGE: Record<Stage, number> = { 'Leitão': 10, 'Desmamado': 42, 'Recria': 84, 'Engorda': 150, 'Leitoa': 240, 'Porca': 600, 'Varrasco': 700 }

export type StageGroup = 'rep' | 'lei' | 'cre' | 'rec' | 'eng' | 'var'
export const stageGroup = (s: Stage): StageGroup =>
  s === 'Porca' || s === 'Leitoa' ? 'rep' : s === 'Leitão' ? 'lei' : s === 'Desmamado' ? 'cre' : s === 'Recria' ? 'rec' : s === 'Engorda' ? 'eng' : 'var'
export const SGL: Record<StageGroup | 'all', string> = { all: 'Todos', rep: 'Reprodutoras', lei: 'Leitões', cre: 'Creche', rec: 'Recria', eng: 'Engorda', var: 'Varrasco' }
export const SGC: Record<StageGroup, string> = {
  rep: 'oklch(0.66 0.16 10)', lei: 'oklch(0.74 0.14 70)', cre: 'oklch(0.68 0.13 210)', rec: 'oklch(0.62 0.15 160)', eng: 'oklch(0.6 0.19 280)', var: '#6B6B80',
}

export type LogType =
  | 'birth' | 'illness' | 'transfer' | 'mating' | 'treatment' | 'weight' | 'death' | 'sale' | 'expense' | 'purchase' | 'buyAnimals' | 'activity'
export const LOG_TYPES: { id: LogType; label: string; icon: string }[] = [
  { id: 'birth', label: 'Parto', icon: 'child_care' },
  { id: 'illness', label: 'Doença', icon: 'sick' },
  { id: 'transfer', label: 'Transferência', icon: 'move_down' },
  { id: 'mating', label: 'Cobertura', icon: 'favorite' },
  { id: 'treatment', label: 'Tratamento', icon: 'vaccines' },
  { id: 'weight', label: 'Peso', icon: 'monitor_weight' },
  { id: 'death', label: 'Morte', icon: 'heart_broken' },
  { id: 'sale', label: 'Venda', icon: 'sell' },
  { id: 'expense', label: 'Despesa', icon: 'receipt_long' },
  { id: 'buyAnimals', label: 'Compra de animais', icon: 'add_shopping_cart' },
  { id: 'activity', label: 'Actividade', icon: 'event' },
]

export const HCAT: Record<string, readonly [icon: string, bg: string, fg: string]> = {
  'Saúde': ['health_and_safety', '#FDECEA', '#C0302A'],
  'Reprodução': ['favorite', '#FCE7F3', '#B0306E'],
  'Alimentação': ['nutrition', '#FDF1E2', '#A2601A'],
  'Maneio': ['fence', '#E6F6EE', '#0F7A44'],
  'Usar o Suino Gestor': ['devices', '#EEECFE', '#4B3CD6'],
}

export const PEN_ICON = (name: string, kind: string): readonly [icon: string, bg: string, fg: string] => {
  const s = `${name} ${kind}`.toLowerCase()
  if (/matern|parto/.test(s)) return ['child_care', '#FCE7F3', '#B0306E']
  if (/creche|desmam/.test(s)) return ['nest_eco_leaf', '#E6F4F8', '#1F7894']
  if (/recria/.test(s)) return ['trending_up', '#E6F6EE', '#0F7A44']
  if (/engorda/.test(s)) return ['scale', '#EEECFE', '#4B3CD6']
  if (/gesta/.test(s)) return ['favorite', '#FCE7F3', '#B0306E']
  if (/varrasco/.test(s)) return ['male', '#F0F0F6', '#55556A']
  return ['fence', '#F0F0F6', '#55556A']
}
