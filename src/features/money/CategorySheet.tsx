import { fmt, dShort, pctL, sgn } from '@/lib/format'
import type { Transaction } from '@/lib/database.types'
import { Button, Sheet } from '@/ui'
import type { Lookups } from './model'

export default function CategorySheet({ category, rows, totalExpenses, lookups, onClose, onOpenTx, onFilter }: {
  category: string; rows: Transaction[]; totalExpenses: number; lookups: Lookups; onClose: () => void; onOpenTx: (t: Transaction) => void; onFilter: () => void
}) {
  const total = -rows.reduce((a, t) => a + t.amount, 0)
  const byAcct = new Map<string, { v: number; n: number }>()
  for (const t of rows) {
    const o = byAcct.get(t.account_id) ?? { v: 0, n: 0 }
    o.v -= t.amount
    o.n++
    byAcct.set(t.account_id, o)
  }
  const list = [...byAcct.entries()].sort((a, b) => b[1].v - a[1].v)
  const kpis = [
    { l: 'Total', v: `${fmt(total)} MT` },
    { l: 'Movimentos', v: String(rows.length) },
    { l: 'Média', v: `${fmt(rows.length ? total / rows.length : 0)} MT` },
    { l: 'Das despesas', v: pctL(total, totalExpenses) },
  ]

  return (
    <Sheet open onClose={onClose} title={`${category} · ${lookups.categoryGroup(category)}`} maxWidth={640}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2.5">
          {kpis.map((k) => (
            <div key={k.l} className="flex flex-col gap-0.5 rounded-[14px] bg-[#F7F7FB] p-3">
              <span className="text-xs text-muted">{k.l}</span>
              <span className="tabular font-semibold">{k.v}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Por conta</span>
          {list.map(([id, o]) => (
            <div key={id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="h-[9px] w-[9px] rounded-full" style={{ background: lookups.accountColor(id) }} />
                <span className="flex-1">{lookups.accountName(id)} · {o.n} {o.n === 1 ? 'movimento' : 'movimentos'}</span>
                <span className="tabular font-semibold">{fmt(o.v)}</span>
                <span className="w-11 text-right text-muted">{pctL(o.v, total)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-md bg-sunken">
                <div className="h-full rounded-md" style={{ width: `${(o.v / list[0][1].v) * 100}%`, background: lookups.accountColor(id) }} />
              </div>
            </div>
          ))}
        </div>
        <div className="max-h-[280px] overflow-y-auto rounded-[14px] border border-line">
          {rows.map((t) => (
            <button key={t.id} type="button" onClick={() => onOpenTx(t)}
              className="flex w-full items-center gap-2.5 border-0 border-b border-divider bg-white px-3.5 py-2.5 text-left hover:bg-hover">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: lookups.accountColor(t.account_id) }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{t.title}</span>
                <span className="text-xs text-muted">{dShort(t.tx_date)} · {lookups.accountName(t.account_id)}</span>
              </span>
              <span className="tabular text-sm font-semibold">{sgn(t.amount)}</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" icon="filter_list" className="self-start text-accent-strong" onClick={onFilter}>Ver nos movimentos</Button>
      </div>
    </Sheet>
  )
}
