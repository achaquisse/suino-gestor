import { useState } from 'react'
import { Button, cx, Field, Icon, Input, Select, usePopover } from '@/ui'
import type { Account } from '@/lib/database.types'
import { PERIODS, periodRange, rangeLabel, type Period } from './model'

const menuCls = 'absolute top-[calc(100%+6px)] z-40 flex animate-pf-pop flex-col gap-0.5 rounded-[18px] border border-line bg-white p-1.5 shadow-pop'

export function Toolbar({ start, period, from, to, onPeriod, onCustom, acct, onAcct, accounts, filtered, onClear, onCsv, onStockCsv, onPrint, rangeText }: {
  start: string | null; period: Period; from: string; to: string; onPeriod: (p: Exclude<Period, 'custom'>) => void; onCustom: (f: string, t: string) => void
  acct: string; onAcct: (v: string) => void; accounts: Account[]; filtered: boolean; onClear: () => void
  onCsv: () => void; onStockCsv?: () => void; onPrint: () => void; rangeText: string
}) {
  const { open: pOpen, setOpen: setPOpen, ref: pRef } = usePopover()
  const { open: eOpen, setOpen: setEOpen, ref: eRef } = usePopover()
  const [dFrom, setDFrom] = useState(from)
  const [dTo, setDTo] = useState(to)
  const err = !dFrom || !dTo || dFrom > dTo
  const label = period === 'custom' ? 'Intervalo' : (PERIODS.find((p) => p[0] === period) ?? PERIODS[0])[1]

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div ref={pRef} className="relative">
        <Button onClick={() => setPOpen((o) => !o)} icon="date_range" className="h-11 px-3.5">
          <span>{label}</span><Icon name="expand_more" size={18} />
        </Button>
        {pOpen && (
          <div className={cx(menuCls, 'left-0 w-[min(320px,calc(100vw-32px))]')}>
            {PERIODS.map(([v, l]) => {
              const [f, t] = periodRange(v, start)
              const on = period === v
              return (
                <button key={v} type="button" onClick={() => { onPeriod(v); setPOpen(false) }}
                  className={cx('flex min-h-[46px] items-center gap-2.5 rounded-xl border-0 px-3 text-left text-ink hover:bg-[#F3F3F9]', on ? 'bg-[#F5F3FF]' : 'bg-transparent')}>
                  <span className="flex flex-1 flex-col">
                    <span className={cx('text-sm', on ? 'font-semibold' : 'font-medium')}>{l}</span>
                    <span className="text-xs text-muted">{rangeLabel(f, t)}</span>
                  </span>
                  <Icon name="check" size={18} className={cx('text-accent', on ? 'opacity-100' : 'opacity-0')} />
                </button>
              )
            })}
            <div className="mx-1.5 my-1 h-px bg-divider" />
            <div className="flex flex-col gap-2 px-2.5 pt-2 pb-2.5">
              <span className="text-xs font-semibold text-ink-2">Intervalo personalizado</span>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" aria-label="De" value={dFrom} onChange={(e) => setDFrom(e.target.value)} className="h-11" />
                <Input type="date" aria-label="Até" value={dTo} onChange={(e) => setDTo(e.target.value)} className="h-11" />
              </div>
              {err && <span className="text-xs text-danger">A data inicial deve ser anterior à final.</span>}
              <Button variant="primary" className="h-10 justify-center" disabled={err} onClick={() => { onCustom(dFrom, dTo); setPOpen(false) }}>Aplicar intervalo</Button>
            </div>
          </div>
        )}
      </div>
      <Field className="w-auto">
        <Select aria-label="Conta" value={acct} onChange={(e) => onAcct(e.target.value)} className="h-11 w-auto">
          <option value="all">Todas as contas</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      {filtered && <Button variant="ghost" size="md" icon="close" onClick={onClear} className="text-accent-strong hover:bg-accent-wash">Limpar</Button>}
      <div ref={eRef} className="relative">
        <Button variant="primary" onClick={() => setEOpen((o) => !o)} icon="download" className="h-11">Exportar<Icon name="expand_more" size={18} /></Button>
        {eOpen && (
          <div className={cx(menuCls, 'right-0 w-[min(290px,calc(100vw-32px))]')}>
            <div className="px-2.5 py-2 text-xs text-muted">Período: {rangeText}</div>
            {([
              ['PDF', 'Relatório formatado para partilhar', 'picture_as_pdf', '#FDECEA', '#C0302A', onPrint],
              ['Excel', 'Folha com todos os movimentos', 'table_view', '#E6F6EE', '#15A05A', onCsv],
              ...(onStockCsv ? [['Stock (Excel)', 'Compras e consumo por artigo', 'inventory_2', '#EEECFE', '#4B3CD6', onStockCsv]] as const : []),
            ] as const).map(([l, sub, icon, bg, fg, fn]) => (
              <button key={l} type="button" onClick={() => { setEOpen(false); fn() }}
                className="flex min-h-[52px] items-center gap-3 rounded-xl border-0 bg-transparent px-2.5 text-left text-ink hover:bg-[#F3F3F9]">
                <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px]" style={{ background: bg, color: fg }}><Icon name={icon} size={18} /></span>
                <span className="flex flex-col gap-px"><span className="text-sm font-semibold">{l}</span><span className="text-xs text-muted">{sub}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
