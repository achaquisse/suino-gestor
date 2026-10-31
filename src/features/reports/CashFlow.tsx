import { Card } from '@/ui'
import { GREEN, RED } from '@/lib/constants'
import { fmt, sgn } from '@/lib/format'
import type { CashRow } from './model'

const grid = 'grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 px-5'
const sN = (v: number) => (v < 0 ? '−' : '') + fmt(v)

export function CashFlow({ rows }: { rows: CashRow[] }) {
  const cmx = Math.max(1, ...rows.filter((c) => !c.total).map((c) => Math.max(c.inP, c.outP)))
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4"><h2 className="m-0 text-[15px] font-semibold">Fluxo de caixa por conta</h2></div>
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className={`${grid} bg-[#F7F7FB] py-2.5 text-[13px] text-muted`}>
            <span>Conta</span><span className="text-right">Saldo inicial</span><span className="text-right">Entradas</span><span className="text-right">Saídas</span><span className="text-right">Saldo final</span><span />
          </div>
          {rows.map((c) => {
            const net = c.inP - c.outP
            const mx = c.total ? Math.max(1, c.inP, c.outP) : cmx
            return (
              <div key={c.id} className={`${grid} tabular items-center border-t border-divider py-3 text-sm ${c.total ? 'bg-[#FAFAFD] font-medium' : 'bg-white'}`}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-[9px] shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="flex flex-col"><span className="font-semibold">{c.name}</span><span className="text-xs font-normal text-muted">{c.person}</span></span>
                </span>
                <span className="text-right">{sN(c.open)}</span>
                <span className="text-right" style={{ color: GREEN }}>+{fmt(c.inP)}</span>
                <span className="text-right">−{fmt(c.outP)}</span>
                <span className="text-right font-semibold">{sN(c.close)}</span>
                <span className="flex flex-col gap-[3px]">
                  <span className="h-[5px] rounded bg-success" style={{ width: `${(c.inP / mx) * 100}%` }} />
                  <span className="h-[5px] rounded bg-[#D6D6E2]" style={{ width: `${(c.outP / mx) * 100}%` }} />
                  <span className="text-[11px]" style={{ color: net < 0 ? RED : GREEN }}>variação {sgn(net)}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
