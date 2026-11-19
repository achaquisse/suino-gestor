import type { StockItem, StockMovement } from '@/lib/database.types'
import { daysTo } from '@/lib/format'

export type MoveKind = 'in' | 'out' | 'count'

/** Must match public.stock_reasons() (20261119000400_stock_entry_purchase.sql). */
export const REASONS = {
  /** "Compra" also records the purchase expense; only the owner can use it. */
  in: ['Compra', 'Doação', 'Devolução'],
  out: ['Consumo', 'Perda ou dano', 'Expirado', 'Oferta', 'Outra saída'],
} as const

export const KIND_LABEL: Record<MoveKind, string> = { in: 'Entrada', out: 'Saída', count: 'Contagem' }

/** Quantities: up to 2 decimals, Portuguese decimal comma. */
export const qf = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',')
type Units = Pick<StockItem, 'unit' | 'unit_singular'>
/** Singular for exactly one, plural otherwise ("1 saco", "2 sacos", "0,5 sacos"). */
export const unitFor = (n: number, item: Units) => (Math.abs(n) === 1 ? item.unit_singular || item.unit : item.unit)
export const qtyLabel = (n: number, item: Units) => `${qf(n)} ${unitFor(n, item)}`

export const isLow = (s: StockItem) => s.active && s.qty <= s.low_qty
export const expiryDays = (s: StockItem) => (s.expires_on ? daysTo(s.expires_on) : null)
export const isExpiring = (s: StockItem, notice: number) => {
  const d = expiryDays(s)
  return s.active && d != null && d <= notice
}

export function movementStyle(m: Pick<StockMovement, 'reason' | 'delta'>): { icon: string; bg: string; fg: string } {
  if (m.reason === 'Contagem' || m.reason === 'Ajuste') return { icon: 'fact_check', bg: '#EEECFE', fg: '#4B3CD6' }
  if (m.reason === 'Tratamento') return { icon: 'vaccines', bg: '#FDF1E2', fg: '#A2601A' }
  if (m.reason === 'Compra') return { icon: 'shopping_cart', bg: '#E6F6EE', fg: '#0F7A44' }
  return m.delta > 0 ? { icon: 'south_west', bg: '#E6F6EE', fg: '#0F7A44' } : { icon: 'north_east', bg: '#FDECEA', fg: '#C0302A' }
}
