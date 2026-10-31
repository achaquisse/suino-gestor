export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const MONTHS3 = MONTHS.map((m) => m.slice(0, 3))
export const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
export const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const DAY = 86_400_000

export const fmt = (n: number) => Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
export const sgn = (v: number) => (v < 0 ? '−' : '+') + fmt(v)
export const money = (v: number) => `${v < 0 ? '−' : ''}${fmt(v)} MT`
export const pctL = (v: number, t: number) => (t ? (v / t * 100).toFixed(1).replace('.', ',').replace(',0', '') + '%' : '—')
export const kfmt = (v: number) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1).replace('.', ',').replace(',0', '') + 'k' : fmt(v))
export const dec = (v: number, digits = 1) => v.toFixed(digits).replace('.', ',')
export const kg = (v: number) => (v < 10 ? dec(v) : String(Math.round(v))) + ' kg'
export const numP = (v: string | number) => {
  const raw = String(v).trim()
  const valid = /^[+-]?(?:(?:\d+|\d{1,3}(?:\s\d{3})+)(?:[.,]\d*)?|[.,]\d+)$/.test(raw)
  const parsed = valid ? Number(raw.replace(/\s/g, '').replace(',', '.')) : NaN
  return Number.isFinite(parsed) ? parsed : NaN
}
export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'

export const pad = (n: number) => String(n).padStart(2, '0')
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => isoOf(new Date())
export const dUTC = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
export const dISO = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const addDays = (s: string, n: number) => dISO(dUTC(s) + n * DAY)
export const addMonths = (s: string, n: number) => {
  const d = new Date(dUTC(s))
  d.setUTCMonth(d.getUTCMonth() + n)
  return dISO(d.getTime())
}
export const daysBetween = (a: string, b: string) => Math.round((dUTC(b) - dUTC(a)) / DAY)
export const daysTo = (s: string) => daysBetween(todayISO(), s)
export const localDate = (s: string) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))

export const mon3 = (s: string) => MONTHS3[+s.slice(5, 7) - 1]
export const dShort = (s: string) => `${+s.slice(8, 10)} ${mon3(s)}`
export const dLong = (s: string) => `${+s.slice(8, 10)} ${mon3(s)} ${s.slice(0, 4)}`
export const dTimeline = (s: string) => `${s.slice(8, 10)} ${mon3(s)} ${s.slice(0, 4)}`
export const dFull = (s: string) => {
  const d = localDate(s)
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}
export const weekdayShort = (s: string) => DOW[(localDate(s).getDay() + 6) % 7]

export const ageDays = (born: string | null) => (born ? daysBetween(born, todayISO()) : 0)
export const ageLabel = (born: string | null) => {
  if (!born) return '—'
  const dd = ageDays(born)
  if (dd < 14) return dd + (dd === 1 ? ' dia' : ' dias')
  if (dd < 120) return Math.round(dd / 7) + ' semanas'
  const m = Math.floor(dd / 30.44)
  if (m < 24) return m + ' meses'
  const y = Math.floor(m / 12)
  const r = m % 12
  return r ? `${y} a ${r} m` : `${y} anos`
}

export const dueStatus = (s: string | null): { label: string; tone: 'success' | 'red' | 'amber' | 'neutral' } => {
  if (!s) return { label: 'Liquidada', tone: 'success' }
  const n = daysTo(s)
  if (n < 0) return { label: `Em atraso · ${-n}${n === -1 ? ' dia' : ' dias'}`, tone: 'red' }
  if (n === 0) return { label: 'Vence hoje', tone: 'amber' }
  if (n <= 7) return { label: `Vence em ${n}${n === 1 ? ' dia' : ' dias'}`, tone: 'amber' }
  return { label: 'Agendado', tone: 'neutral' }
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
