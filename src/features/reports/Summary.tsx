import { Card, Icon, Sheet } from '@/ui'
import { GREEN, INK, MUTED, RED } from '@/lib/constants'
import type { Account, Category, Transaction } from '@/lib/database.types'
import { dec, dShort, fmt, pctL, sgn } from '@/lib/format'
import { setUrlParams, useUrlParams } from '@/lib/urlState'
import type { Bucket, Statement } from './model'

const GRAD = 'linear-gradient(180deg,#7A6BFF,#5B4CF0)'

export function KpiStrip({ s }: { s: Statement }) {
  const items = [
    { l: 'Receita', v: `${fmt(s.revenue)} MT`, sub: `${s.salesCount} ${s.salesCount === 1 ? 'venda' : 'vendas'}`, c: INK },
    { l: 'Custos de investimento', v: `${fmt(s.direct)} MT`, sub: `${pctL(s.direct, s.revenue)} da receita`, c: INK },
    { l: 'Despesas operacionais', v: `${fmt(s.opex)} MT`, sub: `${pctL(s.opex, s.revenue)} da receita`, c: INK },
    { l: 'Resultado líquido', v: `${sgn(s.net)} MT`, sub: `margem líquida ${pctL(s.net, s.revenue)}`, c: s.net < 0 ? RED : GREEN },
  ]
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
      {items.map((k) => (
        <Card key={k.l} as="div" className="flex min-w-0 flex-col gap-1 px-[18px] py-4">
          <span className="text-[13px] text-muted">{k.l}</span>
          <span className="tabular text-[22px] font-semibold tracking-[-0.02em]" style={{ color: k.c }}>{k.v}</span>
          <span className="text-xs text-muted">{k.sub}</span>
        </Card>
      ))}
    </div>
  )
}

export function Waterfall({ s }: { s: Statement }) {
  const { revenue: Rv, direct: D, gross: G, opex: O, net: N } = s
  const mx = Math.max(1, Rv, D)
  const H = (v: number) => `${(Math.abs(v) / mx) * 100}%`
  const bars = [
    { l: 'Receita', val: fmt(Rv), b: '0%', h: H(Rv), bg: GRAD, vc: INK },
    { l: 'Custos de investimento', val: `−${fmt(D)}`, b: H(Math.max(G, 0)), h: H(Math.min(D, Rv) || D), bg: '#F7C6C0', vc: RED },
    { l: 'Lucro bruto', val: fmt(G), b: '0%', h: H(G), bg: G < 0 ? '#F7C6C0' : '#8FE0B5', vc: G < 0 ? RED : INK },
    { l: 'Despesas op.', val: `−${fmt(O)}`, b: H(Math.max(N, 0)), h: H(G > 0 ? Math.min(O, G) : O), bg: '#F7C6C0', vc: RED },
    { l: 'Resultado', val: sgn(N), b: '0%', h: H(N), bg: N < 0 ? 'linear-gradient(180deg,#F08A80,#D0342C)' : 'linear-gradient(180deg,#4FD394,#15A05A)', vc: N < 0 ? RED : GREEN },
  ]
  return (
    <Card className="flex flex-col gap-[18px] p-5">
      <div>
        <h2 className="m-0 text-[15px] font-semibold">Demonstração de resultados</h2>
        <div className="text-[13px] text-muted">Da receita ao resultado líquido · investimento em infra-estrutura {fmt(s.infra)} MT</div>
      </div>
      <div className="flex h-[220px] items-end gap-2.5">
        {bars.map((w) => (
          <div key={w.l} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="relative w-full flex-1">
                <div className="absolute right-[15%] left-[15%] rounded-md transition-[height,bottom] duration-700 ease-pf" style={{ bottom: w.b, height: w.h, background: w.bg }} />
              </div>
              <span className="tabular whitespace-nowrap text-[11px] font-semibold sm:text-xs" style={{ color: w.vc }}>{w.val}</span>
              <span className="min-h-7 text-center text-[11px] text-muted">{w.l}</span>
            </div>
        ))}
      </div>
    </Card>
  )
}

type DetailRow = { label: string; value: number; sub?: boolean; line?: boolean; color?: string; income?: boolean }

export function ResultDetails({ s, per, categories, accounts, buckets }: {
  s: Statement; per: Transaction[]; categories: Category[]; accounts: Account[]; buckets: Bucket[]
}) {
  const params = useUrlParams()
  const selected = params.get('resultCat')
  const rows: DetailRow[] = [
    { label: 'Receita de vendas', value: s.revenue },
    ...s.revenueByCat.map(([label, value]) => ({ label, value, sub: true, income: true, color: categories.find((c) => c.name === label)?.color ?? GREEN })),
    { label: 'Custos de investimento', value: -s.direct },
    ...s.directByCat.map(([label, value]) => ({ label, value: -value, sub: true, color: categories.find((c) => c.name === label)?.color ?? MUTED })),
    { label: 'Lucro bruto', value: s.gross, line: true },
    { label: 'Despesas operacionais', value: -s.opex },
    ...s.opexByCat.map(([label, value]) => ({ label, value: -value, sub: true, color: categories.find((c) => c.name === label)?.color ?? MUTED })),
    { label: 'Resultado líquido', value: s.net, line: true },
  ]
  const chosen = rows.find((r) => r.sub && `${r.income ? 'in' : 'out'}:${r.label}` === selected)
  const txs = chosen ? per.filter((t) => t.category === chosen.label && (chosen.income ? t.amount > 0 : t.amount < 0)) : []
  const unit = txs.find((t) => t.quantity_unit)?.quantity_unit ?? categories.find((c) => c.name === chosen?.label)?.quantity_unit
  const quantity = txs.reduce((n, t) => n + (t.quantity ?? 0), 0)
  const series = buckets.map((b) => ({ ...b, value: txs.filter((t) => t.tx_date >= b.a && t.tx_date <= b.b).reduce((n, t) => n + Math.abs(t.amount), 0) }))
  const max = Math.max(1, ...series.map((b) => b.value))
  return (
    <>
      <Card className="flex flex-col gap-2 p-5">
        <div>
          <h2 className="m-0 text-[15px] font-semibold">Detalhe da demonstração de resultados</h2>
          <div className="text-[13px] text-muted">Valores em MT · seleccione uma categoria para ver a evolução e as contas</div>
        </div>
        {rows.map((r, i) => {
          const product = r.sub && (categories.find((c) => c.name === r.label)?.item_type === 'Produto' || per.some((t) => t.category === r.label && t.quantity != null))
          const matching = product ? per.filter((t) => t.category === r.label && (r.income ? t.amount > 0 : t.amount < 0)) : []
          const qty = matching.reduce((n, t) => n + (t.quantity ?? 0), 0)
          const rowUnit = matching.find((t) => t.quantity_unit)?.quantity_unit ?? categories.find((c) => c.name === r.label)?.quantity_unit
          return <button key={i} type="button" disabled={!r.sub} onClick={() => setUrlParams({ resultCat: `${r.income ? 'in' : 'out'}:${r.label}` })}
            className={`flex w-full items-center gap-2 border-x-0 border-b-0 border-t bg-transparent text-left ${r.line ? 'border-[#E3E3EC]' : 'border-divider'} ${r.sub ? 'cursor-pointer py-[9px] text-[13px] font-normal hover:bg-hover' : 'cursor-default py-3 text-sm font-semibold'}`}
            style={{ color: r.line && r.label === 'Resultado líquido' ? r.value < 0 ? RED : GREEN : r.sub ? '#4A4A5C' : INK }}>
            <span className="h-[7px] shrink-0 rounded-full" style={{ width: r.sub ? 7 : 0, background: r.color ?? 'transparent' }} />
            <span className="min-w-0 flex-1">{r.label}</span>
            {product && <span className="tabular text-xs text-muted">{qty ? `${dec(qty, 3).replace(/,?0+$/, '')} ${rowUnit ?? ''}` : '—'}</span>}
            <span className="tabular font-semibold">{r.value < 0 ? '− ' : ''}{fmt(r.value)}</span>
            <span className="w-[52px] text-right text-xs font-normal text-muted">{pctL(Math.abs(r.value), s.revenue)}</span>
            {r.sub && <Icon name="chevron_right" size={16} className="text-muted" />}
          </button>
        })}
      </Card>
      <Sheet open={!!chosen} onClose={() => setUrlParams({ resultCat: null })} title={chosen?.label ?? 'Detalhe'} maxWidth={640}>
        {chosen && <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-sunken p-4">
            <div className="text-sm text-muted">{chosen.income ? 'Receita total' : 'Custo total'}</div>
            <div className="tabular text-2xl font-semibold">{fmt(txs.reduce((n, t) => n + Math.abs(t.amount), 0))} MT</div>
            {quantity > 0 && <div className="text-sm text-muted">Quantidade global: {dec(quantity, 3).replace(/,?0+$/, '')} {unit}</div>}
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">{chosen.income ? 'Receita' : 'Custo'} ao longo do tempo</h3>
            <div className="flex h-[180px] items-end gap-1.5">
              {series.map((b) => <div key={b.a} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${b.full}: ${fmt(b.value)} MT`}>
                <span className="tabular text-[10px] text-muted">{b.value ? fmt(b.value) : ''}</span>
                <div className="w-full max-w-10 rounded-t-md" style={{ height: `${Math.max(b.value ? 3 : 0, b.value / max * 100)}%`, background: chosen.income ? GREEN : RED }} />
                <span className="truncate text-[10px] text-muted">{b.label}</span>
              </div>)}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Movimentos e contas</h3>
            {txs.map((t) => <div key={t.id} className="flex items-center gap-3 border-t border-divider py-3 text-sm">
              <div className="min-w-0 flex-1"><div className="font-medium">{t.title}</div><div className="text-xs text-muted">{dShort(t.tx_date)} · {accounts.find((a) => a.id === t.account_id)?.name ?? '—'}{t.quantity != null ? ` · ${dec(t.quantity, 3).replace(/,?0+$/, '')} ${t.quantity_unit ?? ''}` : ''}</div></div>
              <span className="tabular font-semibold">{fmt(Math.abs(t.amount))} MT</span>
            </div>)}
          </div>
        </div>}
      </Sheet>
    </>
  )
}
