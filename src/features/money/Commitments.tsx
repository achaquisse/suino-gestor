import { FMUL, GREEN, INK, RED, TONE } from '@/lib/constants'
import type { Debt, RecurringExpense } from '@/lib/database.types'
import { daysTo, dLong, dueStatus, fmt } from '@/lib/format'
import { Button, Card, Icon, Segmented } from '@/ui'
import { splitLabel, splitsOf, type Lookups } from './model'

export type CommitTab = 'rec' | 'debt'

const sum = <T,>(l: T[], fn: (x: T) => number) => l.reduce((a, x) => a + fn(x), 0)

function StatusChip({ label, tone }: { label: string; tone: 'success' | 'red' | 'amber' | 'neutral' }) {
  const [bg, fg] = TONE[tone]
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: bg, color: fg }}>{label}</span>
}

export default function Commitments({ tab, onTab, recs, debts, lookups, canWrite, onAdd, onEditRec, onEditDebt, onPayRec, onPayDebt }: {
  tab: CommitTab; onTab: (t: CommitTab) => void; recs: RecurringExpense[]; debts: Debt[]; lookups: Lookups; canWrite: boolean
  onAdd: () => void; onEditRec: (r: RecurringExpense) => void; onEditDebt: (d: Debt) => void; onPayRec: (r: RecurringExpense) => void; onPayDebt: (d: Debt) => void
}) {
  const open = debts.filter((d) => d.total > d.paid)
  const over = recs.filter((r) => daysTo(r.next_due) < 0)
  const soon = recs.filter((r) => daysTo(r.next_due) <= 30)
  const dOver = open.filter((d) => d.next_due && daysTo(d.next_due) < 0)
  const dSoon = open.filter((d) => d.next_due && daysTo(d.next_due) <= 30)
  const inst = (d: Debt) => Math.min(d.installment, d.total - d.paid)

  const kpis = tab === 'rec'
    ? [
        { l: 'A pagar nos próximos 30 dias', v: `${fmt(sum(soon, (r) => r.amount))} MT`, sub: `${soon.length} pagamentos`, c: INK },
        { l: 'Em atraso', v: `${fmt(sum(over, (r) => r.amount))} MT`, sub: over.length ? `${over.length} por confirmar` : 'tudo em dia', c: over.length ? RED : GREEN },
        { l: 'Custo fixo mensal', v: `${fmt(sum(recs.filter((r) => r.cost_type === 'Fixo'), (r) => r.amount * FMUL[r.frequency]))} MT`, sub: `variável ≈ ${fmt(sum(recs.filter((r) => r.cost_type !== 'Fixo'), (r) => r.amount * FMUL[r.frequency]))} MT/mês`, c: INK },
      ]
    : [
        { l: 'Dívida em aberto', v: `${fmt(sum(open, (d) => d.total - d.paid))} MT`, sub: `${open.length} credores`, c: INK },
        { l: 'Prestações nos próximos 30 dias', v: `${fmt(sum(dSoon, inst))} MT`, sub: `${dSoon.length} pagamentos`, c: INK },
        { l: 'Em atraso', v: `${fmt(sum(dOver, inst))} MT`, sub: dOver.length ? `${dOver.length} por pagar` : 'tudo em dia', c: dOver.length ? RED : GREEN },
      ]
  const empty = tab === 'rec' ? !recs.length : !debts.length

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="m-0 text-[15px] font-semibold">Compromissos</h2>
          <Segmented options={[['rec', `Recorrentes · ${recs.length}`], ['debt', `Dívidas · ${open.length}`]] as const} value={tab} onChange={onTab} />
        </div>
        {canWrite && <Button variant="soft" icon="add" onClick={onAdd}>{tab === 'rec' ? 'Nova recorrente' : 'Nova dívida'}</Button>}
      </div>
      <div className="px-5 pb-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
          {kpis.map((k) => (
            <div key={k.l} className="flex min-w-0 flex-col gap-1 rounded-2xl bg-[#F7F7FB] px-[18px] py-4">
              <span className="text-[13px] text-muted">{k.l}</span>
              <span className="tabular text-[22px] font-semibold tracking-[-0.02em]" style={{ color: k.c }}>{k.v}</span>
              <span className="text-xs text-muted">{k.sub}</span>
            </div>
          ))}
        </div>
      </div>
      {empty && <div className="border-t border-divider px-5 py-6 text-center text-muted">Ainda não há registos.</div>}

      {tab === 'rec' && recs.map((r) => {
        const st = dueStatus(r.next_due)
        const fx = r.cost_type === 'Fixo'
        const [cbg, cfg] = fx ? TONE.accent : ['#E6F4F8', '#1F7894']
        return (
          <div key={r.id} onClick={canWrite ? () => onEditRec(r) : undefined}
            className={`flex flex-wrap items-center gap-3 border-t border-divider px-5 py-3.5 ${canWrite ? 'cursor-pointer hover:bg-[#FBFBFD]' : ''}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: lookups.categoryColor(r.category) }} />
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.name}</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: cbg, color: cfg }}>{r.cost_type}</span>
              </div>
              <span className="text-xs text-muted">{r.category} · {r.frequency} · {splitLabel(splitsOf(r), lookups.accountName)}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="tabular font-semibold">{fx ? '' : '≈ '}{fmt(r.amount)} MT</span>
              <span className="text-xs text-muted">{fx ? 'valor fixo' : 'estimativa'}</span>
            </div>
            <div className="flex min-w-[120px] flex-col items-end gap-1">
              <span className="text-[13px]">{dLong(r.next_due)}</span>
              <StatusChip label={st.label} tone={st.tone} />
            </div>
            {canWrite && <Button size="sm" icon="check" className="h-[38px]" onClick={(e) => { e.stopPropagation(); onPayRec(r) }}>Pagar</Button>}
          </div>
        )
      })}

      {tab === 'debt' && debts.map((d) => {
        const rem = d.total - d.paid
        const isOpen = rem > 0
        const st = isOpen ? dueStatus(d.next_due) : dueStatus(null)
        const pct = d.total ? Math.min(100, (d.paid / d.total) * 100) : 0
        return (
          <div key={d.id} onClick={canWrite ? () => onEditDebt(d) : undefined}
            className={`flex flex-wrap items-center gap-3 border-t border-divider px-5 py-3.5 ${canWrite ? 'cursor-pointer hover:bg-[#FBFBFD]' : ''} ${isOpen ? '' : 'opacity-65'}`}>
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
              <div>
                <span className="font-semibold">{d.creditor}</span>
                {d.description && <span className="text-xs text-muted"> · {d.description}</span>}
              </div>
              <div className="h-1.5 overflow-hidden rounded-md bg-sunken">
                <div className="h-full rounded-md" style={{ width: `${pct}%`, background: isOpen ? 'linear-gradient(90deg,#7A6BFF,#5B4CF0)' : GREEN }} />
              </div>
              <span className="text-xs text-muted">{Math.round(pct)}% pago de {fmt(d.total)} MT · {splitLabel(splitsOf(d), lookups.accountName)}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="tabular font-semibold">{fmt(rem)} MT</span>
              <span className="text-xs text-muted">prestação {isOpen ? `${fmt(inst(d))} MT` : '—'}</span>
            </div>
            <div className="flex min-w-[120px] flex-col items-end gap-1">
              <span className="text-[13px]">{isOpen && d.next_due ? dLong(d.next_due) : '—'}</span>
              <StatusChip label={st.label} tone={st.tone} />
            </div>
            {canWrite && isOpen && (
              <Button size="sm" className="h-[38px]" onClick={(e) => { e.stopPropagation(); onPayDebt(d) }}><Icon name="payments" size={18} />Pagar</Button>
            )}
          </div>
        )
      })}
    </Card>
  )
}
