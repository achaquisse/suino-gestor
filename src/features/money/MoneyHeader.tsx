import { useState } from 'react'
import type { Account } from '@/lib/database.types'
import { Button, Icon, Input, Select, cx, usePopover } from '@/ui'
import { PERIODS, makePeriod, periodBounds, periodLabel, rangeLabel, type Filters, type Period } from './model'

function PeriodPicker({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const { open, setOpen, ref, toggle } = usePopover()
  const [from, setFrom] = useState(period.from)
  const [to, setTo] = useState(period.to)
  const err = !from || !to || from > to

  return (
    <div ref={ref} className="relative">
      <Button size="md" icon="date_range" onClick={toggle} aria-expanded={open}>
        {periodLabel(period)}
        <Icon name="expand_more" size={18} />
      </Button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-40 flex w-[min(320px,calc(100vw-32px))] animate-pf-pop flex-col gap-0.5 rounded-[18px] border border-line bg-white p-1.5 shadow-pop">
          {PERIODS.map(([k, l]) => {
            const [f, t] = periodBounds(k)
            const on = period.key === k
            return (
              <button key={k} type="button" onClick={() => { onChange(makePeriod(k)); setOpen(false) }}
                className={cx('flex min-h-[46px] items-center gap-2.5 rounded-xl border-0 px-3 text-left hover:bg-hover', on ? 'bg-accent-wash' : 'bg-transparent')}>
                <span className="flex flex-1 flex-col">
                  <span className={cx('text-sm', on ? 'font-semibold' : 'font-medium')}>{l}</span>
                  <span className="text-xs text-muted">{rangeLabel(f, t)}</span>
                </span>
                {on && <Icon name="check" size={18} className="text-accent" />}
              </button>
            )
          })}
          <div className="mx-1.5 my-1 h-px bg-divider" />
          <div className="flex flex-col gap-2 px-2.5 pt-2 pb-2.5">
            <span className="text-xs font-semibold text-ink-2">Intervalo personalizado</span>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl px-3" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl px-3" />
            </div>
            {err && from && to && <span className="text-xs text-danger">A data inicial deve ser anterior à final.</span>}
            <Button variant="primary" size="sm" className="h-10 justify-center" disabled={err}
              onClick={() => { onChange({ key: 'custom', from, to }); setOpen(false) }}>
              Aplicar intervalo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MoneyHeader({ filters, accounts, filtered, canWrite, onChange, onClear, onNew }: {
  filters: Filters; accounts: Account[]; filtered: boolean; canWrite: boolean
  onChange: (p: Partial<Filters>) => void; onClear: () => void; onNew: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 animate-pf-up">
      <PeriodPicker key={filters.period.key + filters.period.from + filters.period.to} period={filters.period} onChange={(period) => onChange({ period })} />
      <Select value={filters.acct} onChange={(e) => onChange({ acct: e.target.value })} className="h-11 w-auto! rounded-xl">
        <option value="all">Todas as contas</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>
      {filtered && <Button variant="ghost" icon="close" className="text-accent-strong" onClick={onClear}>Limpar</Button>}
      {canWrite && <Button variant="primary" icon="add" onClick={onNew}>Novo movimento</Button>}
    </div>
  )
}
