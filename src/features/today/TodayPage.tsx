import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useFarm } from '@/app/farm'
import { useAnimals, useTasks, useTransactions } from '@/lib/queries'
import { MONTHS, dFull, fmt, todayISO } from '@/lib/format'
import { ErrorState, Loading } from '@/ui'
import { useAlerts } from './useAlerts'
import TasksCard from './TasksCard'
import AlertsCard from './AlertsCard'
import StockCard from './StockCard'
import CalendarSection from './CalendarSection'

function StatTile({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="flex flex-col gap-1.5 rounded-card border border-line bg-white p-4 text-left shadow-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-[3px] hover:border-[#D9D5FC] hover:shadow-pop">
      {children}
    </button>
  )
}

export default function TodayPage() {
  const nav = useNavigate()
  const { user, canSeeMoney } = useFarm()
  const today = todayISO()
  const tasksQ = useTasks(undefined, today)
  const animalsQ = useAnimals()
  const txQ = useTransactions(canSeeMoney)
  const alerts = useAlerts()

  const tasks = useMemo(
    () => (tasksQ.data ?? []).filter((t) => t.due_date === today || (t.due_date < today && !t.done_at)),
    [tasksQ.data, today],
  )

  const herd = useMemo(() => {
    const list = animalsQ.data ?? []
    const sows = list.filter((a) => a.stage === 'Porca' || a.stage === 'Leitoa').length
    const boars = list.filter((a) => a.stage === 'Varrasco').length
    return { total: list.length, sows, boars, growing: list.length - sows - boars }
  }, [animalsQ.data])

  const cash = useMemo(() => {
    const ym = today.slice(0, 7)
    const rows = (txQ.data ?? []).filter((t) => t.tx_date.slice(0, 7) === ym && t.kind !== 'Injeção de capital')
    const inT = rows.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0)
    const outT = rows.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0)
    return { inT, outT, net: inT + outT }
  }, [txQ.data, today])

  const monthName = MONTHS[+today.slice(5, 7) - 1]
  const redCount = alerts.filter((a) => a.red).length
  const first = user.name.split(/\s+/)[0] || user.name

  if (tasksQ.isLoading || animalsQ.isLoading) return <Loading />
  if (tasksQ.error) return <ErrorState error={tasksQ.error} retry={() => tasksQ.refetch()} />

  return (
    <div className="flex flex-col gap-6">
      <header className="flex animate-pf-up flex-col gap-1">
        <div className="tabular text-xs uppercase tracking-[0.06em] text-muted">{dFull(today)}</div>
        <h1 className="m-0 text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-balance">Bom dia, {first}</h1>
        <div className="mt-1 flex items-center gap-2 text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ background: redCount ? 'var(--color-danger)' : 'var(--color-success)' }} />
          {redCount ? `${redCount} ${redCount > 1 ? 'assuntos precisam' : 'assunto precisa'} de atenção hoje` : 'Nada urgente hoje'}
        </div>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-5">
        <TasksCard tasks={tasks} />
        <div className="flex flex-col gap-5">
          <AlertsCard alerts={alerts} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <StatTile onClick={() => nav('/herd')}>
              <span className="text-[13px] text-muted">Animais</span>
              <span className="tabular text-[26px] font-semibold tracking-[-0.02em]">{herd.total}</span>
              <span className="text-[13px] text-ink-2">
                {herd.sows} {herd.sows === 1 ? 'porca' : 'porcas'} · {herd.boars} {herd.boars === 1 ? 'varrasco' : 'varrascos'} · {herd.growing} em crescimento
              </span>
            </StatTile>
            {canSeeMoney && (
              <StatTile onClick={() => nav('/expenses')}>
                <span className="text-[13px] text-muted">Caixa · {monthName}</span>
                <div className="tabular flex flex-col gap-0.5 text-sm">
                  <span className="flex justify-between gap-2"><span className="text-muted">Entradas</span><span>{fmt(cash.inT)}</span></span>
                  <span className="flex justify-between gap-2"><span className="text-muted">Saídas</span><span>{fmt(cash.outT)}</span></span>
                </div>
                <span className="flex justify-between border-t border-divider pt-1.5 text-[13px] text-ink-2">
                  <span>Saldo</span><span className="tabular">{cash.net < 0 ? '−' : '+'}{fmt(cash.net)} MZN</span>
                </span>
              </StatTile>
            )}
          </div>
          <StockCard />
        </div>
      </div>

      <CalendarSection />
    </div>
  )
}

