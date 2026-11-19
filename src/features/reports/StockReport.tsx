import { useMemo } from 'react'
import { INK, MUTED } from '@/lib/constants'
import type { StockItem, StockMovement, Transaction } from '@/lib/database.types'
import { daysBetween, fmt, kfmt, todayISO } from '@/lib/format'
import { setUrlParams, useUrlParams } from '@/lib/urlState'
import { Card, Empty, Select, Stat, cx } from '@/ui'
import { qf, qtyLabel } from '@/features/stock/model'
import type { Bucket } from './model'

// Purchases vs consumption. Two series, validated (light surface): accent + amber, CVD ΔE 38.
const BUY = '#5B4CF0'
const USE = '#E8A23A'

const CONSUME = new Set(['Consumo', 'Tratamento'])
const LOSS = new Set(['Perda ou dano', 'Expirado'])
const PURCHASE = new Set(['Compra', 'Compra anulada'])
const COUNT = new Set(['Contagem', 'Ajuste'])

export type StockRow = {
  item: StockItem
  bought: number; boughtValue: number
  consumed: number; consumedValue: number
  losses: number; otherOut: number; otherIn: number; adjust: number
  perDay: number; coverDays: number | null
}

/** Per-item totals for the period. Consumption value uses the item's default unit price. */
export function stockRows(items: StockItem[], moves: StockMovement[], txs: Transaction[], F: string, T: string): StockRow[] {
  const end = T < todayISO() ? T : todayISO()
  return items.map((item) => {
    // The rate counts from the period start, or from when the item was registered if later.
    const created = item.created_at.slice(0, 10)
    const days = Math.max(1, daysBetween(created > F ? created : F, end) + 1)
    const mine = moves.filter((m) => m.item_id === item.id)
    const sumOf = (pred: (m: StockMovement) => boolean) => mine.filter(pred).reduce((s, m) => s + m.delta, 0)
    const bought = sumOf((m) => PURCHASE.has(m.reason))
    const consumed = -sumOf((m) => m.delta < 0 && CONSUME.has(m.reason))
    const losses = -sumOf((m) => m.delta < 0 && LOSS.has(m.reason))
    const otherOut = -sumOf((m) => m.delta < 0 && !CONSUME.has(m.reason) && !LOSS.has(m.reason) && !PURCHASE.has(m.reason) && !COUNT.has(m.reason))
    const otherIn = sumOf((m) => m.delta > 0 && !PURCHASE.has(m.reason) && !COUNT.has(m.reason) && m.reason !== 'Stock inicial')
    const adjust = sumOf((m) => COUNT.has(m.reason))
    const boughtValue = -txs.filter((t) => t.source === 'stock' && t.source_id === item.id && t.amount < 0 && t.tx_date >= F && t.tx_date <= T)
      .reduce((s, t) => s + t.amount, 0)
    const perDay = consumed / days
    return {
      item, bought, boughtValue, consumed, consumedValue: consumed * (item.unit_price ?? 0), losses, otherOut, otherIn, adjust,
      perDay, coverDays: perDay > 0 ? item.qty / perDay : null,
    }
  })
}

export function StockReport({ items, moves, txs, buckets, weekly, F, T }: {
  items: StockItem[]; moves: StockMovement[]; txs: Transaction[]; buckets: Bucket[]; weekly: boolean; F: string; T: string
}) {
  const params = useUrlParams()
  const itemId = params.get('artigo') ?? ''
  const item = items.find((i) => i.id === itemId) ?? null
  const selRaw = params.get('sbucket')
  const sel = selRaw != null && /^\d+$/.test(selRaw) ? +selRaw : null
  const setSel = (i: number) => setUrlParams({ sbucket: i })

  const rows = useMemo(() => stockRows(items, moves, txs, F, T), [items, moves, txs, F, T])
  const active = rows.filter((r) => r.bought || r.consumed || r.losses || r.otherOut || r.otherIn || r.adjust || r.item.active)
  const totals = rows.reduce((t, r) => ({ buy: t.buy + r.boughtValue, use: t.use + r.consumedValue, loss: t.loss + r.losses * (r.item.unit_price ?? 0) }), { buy: 0, use: 0, loss: 0 })
  const stockValue = items.filter((i) => i.active).reduce((s, i) => s + i.qty * (i.unit_price ?? 0), 0)

  // Per bucket: money for all items, or quantities in the item's unit when one item is chosen.
  const data = buckets.map((b) => {
    const inB = (m: StockMovement) => m.moved_on >= b.a && m.moved_on <= b.b && (!item || m.item_id === item.id)
    const priceOf = (id: string) => items.find((i) => i.id === id)?.unit_price ?? 0
    const used = moves.filter((m) => inB(m) && m.delta < 0 && CONSUME.has(m.reason))
    const buy = item
      ? moves.filter((m) => inB(m) && PURCHASE.has(m.reason)).reduce((s, m) => s + m.delta, 0)
      : -txs.filter((t) => t.source === 'stock' && t.amount < 0 && t.tx_date >= b.a && t.tx_date <= b.b).reduce((s, t) => s + t.amount, 0)
    const use = item ? -used.reduce((s, m) => s + m.delta, 0) : -used.reduce((s, m) => s + m.delta * priceOf(m.item_id), 0)
    return { ...b, buy: Math.max(0, buy), use }
  })
  const MX = Math.max(1, ...data.map((b) => Math.max(b.buy, b.use)))
  const selI = sel != null && sel < data.length ? sel : data.length - 1
  const cur = data[selI]
  const unit = item ? item.unit : 'MT'
  const val = (v: number) => (item ? qtyLabel(v, item) : `${fmt(v)} MT`)
  const short = (v: number) => (item ? qf(v) : kfmt(v))

  return (
    <section className="flex flex-col gap-5" aria-labelledby="stock-report-title">
      <div className="mt-3 flex flex-col gap-0.5 border-t border-line pt-6">
        <h2 id="stock-report-title" className="m-0 text-xl font-semibold tracking-tight">Stock</h2>
        <p className="m-0 text-[13px] text-muted">Compras e consumo de artigos no período · todas as contas</p>
      </div>
      <div className="grid grid-cols-2 gap-3 wide:grid-cols-4">
        <Stat label="Compras de stock" value={`${fmt(totals.buy)} MT`} sub="Despesas ligadas a artigos" icon="shopping_cart" tint="#EEECFE" ink="#4B3CD6" />
        <Stat label="Consumo" value={`${fmt(totals.use)} MT`} sub="Ao preço padrão dos artigos" icon="restaurant" tint="#FDF1E2" ink="#A2601A" />
        <Stat label="Perdas e expirados" value={`${fmt(totals.loss)} MT`} sub="Ao preço padrão" icon="delete_sweep" tint="#FDECEA" ink="#C0302A" />
        <Stat label="Valor em stock" value={`${fmt(stockValue)} MT`} sub="Hoje, ao preço padrão" icon="inventory_2" tint="#E6F6EE" ink="#0F7A44" />
      </div>

      <Card className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h2 className="m-0 text-[15px] font-semibold">Compras e consumo ao longo do tempo</h2>
            <div className="text-[13px] text-muted">{item ? `${item.name} · em ${item.unit}` : 'Todos os artigos · em MT'} · por {weekly ? 'semana' : 'mês'}</div>
          </div>
          <Select aria-label="Artigo" className="!w-auto max-w-full" value={itemId} onChange={(e) => setUrlParams({ artigo: e.target.value || null, sbucket: null })}>
            <option value="">Todos os artigos (MT)</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
        </div>
        <div className="flex flex-wrap gap-4 text-[13px]" aria-label="Legenda">
          <span className="flex items-center gap-2"><span className="size-2.5 rounded-[3px]" style={{ background: BUY }} />Compras</span>
          <span className="flex items-center gap-2"><span className="size-2.5 rounded-[3px]" style={{ background: USE }} />Consumo</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-end gap-5">
          <div className="flex h-[200px] items-end gap-2" role="list" aria-label="Compras e consumo por período">
            {data.map((b, i) => {
              const on = i === selI
              return (
                <button key={b.a} type="button" role="listitem" onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)}
                  aria-label={`${b.full}: compras ${val(b.buy)}, consumo ${val(b.use)}`}
                  className={cx('flex h-full min-w-0 flex-1 flex-col items-center gap-1.5 border-0 bg-transparent p-0', on ? 'opacity-100' : 'opacity-55')}>
                  <div className="flex w-full flex-1 items-end justify-center gap-[2px]">
                    {([[b.buy, BUY], [b.use, USE]] as const).map(([v, c], k) => (
                      <div key={k} className="w-[34%] max-w-[24px] rounded-t-[4px] transition-[height] duration-700 ease-pf"
                        style={{ height: `${(v / MX) * 100}%`, minHeight: v > 0 ? 2 : 0, background: c }} />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: on ? INK : MUTED, fontWeight: on ? 600 : 400 }}>{b.label}</span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-col gap-2 rounded-2xl bg-[#F7F7FB] p-4">
            <span className="text-[13px] text-muted">{cur?.full ?? '—'}</span>
            {([['Compras', cur?.buy ?? 0, BUY], ['Consumo', cur?.use ?? 0, USE]] as const).map(([l, v, c]) => (
              <div key={l} className="flex items-center gap-2 text-[13px]">
                <span className="size-[9px] rounded-[3px]" style={{ background: c }} />
                <span className="flex-1">{l}</span>
                <span className="tabular font-semibold">{val(v)}</span>
              </div>
            ))}
            <div className="mt-1 border-t border-divider pt-2 text-xs text-muted">
              Saldo do período: <span className="tabular font-semibold text-ink">{cur ? `${cur.buy - cur.use >= 0 ? '+' : '−'}${short(Math.abs(cur.buy - cur.use))} ${unit}` : '—'}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="m-0 text-[15px] font-semibold">Movimento por artigo</h2>
          <p className="m-0 mt-0.5 text-[13px] text-muted">Consumo inclui saídas por consumo e tratamentos. A cobertura estima quantos dias o stock actual dura ao ritmo de consumo do período.</p>
        </div>
        {!active.length ? <Empty icon="inventory_2" title="Sem artigos de stock" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#F7F7FB] text-left text-[13px] text-muted">
                  {['Artigo', 'Comprado', 'Valor comprado', 'Consumido', 'Perdas', 'Consumo / dia', 'Em stock', 'Cobertura'].map((h, i) => (
                    <th key={h} scope="col" className={cx('px-3 py-2.5 font-normal first:pl-5 last:pr-5', i > 0 && 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...active].sort((a, b) => b.consumedValue - a.consumedValue || b.boughtValue - a.boughtValue).map((r) => {
                  const low = r.item.active && r.item.qty <= r.item.low_qty
                  return (
                    <tr key={r.item.id} className={cx('border-t border-divider', !r.item.active && 'opacity-55')}>
                      <th scope="row" className="px-3 py-3 pl-5 text-left font-semibold">{r.item.name}<div className="text-xs font-normal text-muted">{r.item.category}</div></th>
                      <td className="tabular px-3 text-right">{r.bought ? `${qtyLabel(r.bought, r.item)}` : '—'}</td>
                      <td className="tabular px-3 text-right">{r.boughtValue ? `${fmt(r.boughtValue)} MT` : '—'}</td>
                      <td className="tabular px-3 text-right">{r.consumed ? `${qtyLabel(r.consumed, r.item)}` : '—'}</td>
                      <td className="tabular px-3 text-right">{r.losses ? `${qtyLabel(r.losses, r.item)}` : '—'}</td>
                      <td className="tabular px-3 text-right">{r.perDay ? `${qtyLabel(r.perDay, r.item)}` : '—'}</td>
                      <td className="tabular px-3 text-right" style={{ color: low ? 'var(--color-danger)' : undefined }}>{qtyLabel(r.item.qty, r.item)}</td>
                      <td className="tabular px-3 pr-5 text-right">{r.coverDays == null ? '—' : r.coverDays >= 365 ? '> 1 ano' : `${Math.floor(r.coverDays)} dias`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  )
}

export function stockCsv(rows: StockRow[]): string[][] {
  return [['Artigo', 'Categoria', 'Unidade', 'Comprado', 'Valor comprado (MT)', 'Consumido', 'Valor consumido (MT)', 'Perdas', 'Outras saídas', 'Outras entradas', 'Acertos de contagem', 'Consumo por dia', 'Em stock', 'Cobertura (dias)'],
    ...rows.map((r) => [r.item.name, r.item.category, r.item.unit, qf(r.bought), r.boughtValue.toFixed(2).replace('.', ','), qf(r.consumed),
      r.consumedValue.toFixed(2).replace('.', ','), qf(r.losses), qf(r.otherOut), qf(r.otherIn), qf(r.adjust), qf(r.perDay), qf(r.item.qty),
      r.coverDays == null ? '' : String(Math.floor(r.coverDays))])]
}
