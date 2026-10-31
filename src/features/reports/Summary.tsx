import { Card } from '@/ui'
import { CATC, GREEN, INK, MUTED, RED } from '@/lib/constants'
import { fmt, pctL, sgn } from '@/lib/format'
import type { Statement } from './model'

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
  type Row = { l: string; v: string; p: string; main?: boolean; sub?: boolean; line?: boolean; c?: string; dot?: string }
  const rows: Row[] = [
    { l: 'Receita de vendas', v: fmt(Rv), p: pctL(Rv, Rv), main: true },
    ...s.revenueByBatch.map(([k, v]): Row => ({ l: k, v: fmt(v), p: pctL(v, Rv), sub: true, dot: GREEN })),
    { l: 'Custos de investimento', v: `− ${fmt(D)}`, p: pctL(D, Rv), main: true },
    ...s.directByCat.map(([k, v]): Row => ({ l: k, v: fmt(v), p: pctL(v, Rv), sub: true, dot: CATC[k] ?? MUTED })),
    { l: 'Lucro bruto', v: fmt(G), p: pctL(G, Rv), main: true, line: true },
    { l: 'Despesas operacionais', v: `− ${fmt(O)}`, p: pctL(O, Rv), main: true },
    ...s.opexByCat.map(([k, v]): Row => ({ l: k, v: fmt(v), p: pctL(v, Rv), sub: true, dot: CATC[k] ?? MUTED })),
    { l: 'Resultado líquido', v: sgn(N), p: pctL(N, Rv), main: true, line: true, c: N < 0 ? RED : GREEN },
  ]
  return (
    <Card className="flex flex-col gap-[18px] p-5">
      <div>
        <h2 className="m-0 text-[15px] font-semibold">Demonstração de resultados</h2>
        <div className="text-[13px] text-muted">Da receita ao resultado líquido · investimento em infra-estrutura {fmt(s.infra)} MT</div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-6">
        <div className="flex h-[220px] items-end gap-2.5">
          {bars.map((w) => (
            <div key={w.l} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="relative w-full flex-1">
                <div className="absolute right-[15%] left-[15%] rounded-md transition-[height,bottom] duration-700 ease-pf" style={{ bottom: w.b, height: w.h, background: w.bg }} />
              </div>
              <span className="tabular text-xs font-semibold" style={{ color: w.vc }}>{w.val}</span>
              <span className="min-h-7 text-center text-[11px] text-muted">{w.l}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          {rows.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 border-t ${r.line ? 'border-[#E3E3EC]' : 'border-divider'} ${r.sub ? 'py-[7px] text-[13px] font-normal' : 'py-3 text-sm font-semibold'}`}
              style={{ color: r.c ?? (r.sub ? '#4A4A5C' : INK) }}>
              <span className="h-[7px] shrink-0 rounded-full" style={{ width: r.sub ? 7 : 0, background: r.dot ?? 'transparent' }} />
              <span className="min-w-0 flex-1">{r.l}</span>
              <span className="tabular">{r.v}</span>
              <span className="w-[52px] text-right text-xs font-normal text-muted">{r.p}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
