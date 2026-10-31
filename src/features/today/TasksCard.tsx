import { useFarm } from '@/app/farm'
import { useOverlays } from '@/app/overlays'
import { errorMessage } from '@/lib/supabase'
import { useTableMutations } from '@/lib/queries'
import { todayISO } from '@/lib/format'
import type { Task } from '@/lib/database.types'
import { Button, Card, Icon, Progress, cx, useToast } from '@/ui'
import { overdueLabel } from './useAlerts'

const nowISO = () => new Date().toISOString()

export default function TasksCard({ tasks }: { tasks: Task[] }) {
  const { user, canEditHerd } = useFarm()
  const { openLog } = useOverlays()
  const toast = useToast()
  const { update } = useTableMutations('tasks')
  const today = todayISO()
  const done = tasks.filter((t) => t.done_at).length
  const pct = tasks.length ? (done / tasks.length) * 100 : 0

  const toggle = (t: Task) => {
    const isDone = !!t.done_at
    update.mutate(
      { id: t.id, done_at: isDone ? null : nowISO(), done_by: isDone ? null : user.name },
      {
        onSuccess: () => { if (!isDone) toast(`Feito · ${t.title}`) },
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2.5 px-[18px] pt-[18px] pb-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-[15px] font-semibold">Tarefas</h2>
          <span className="tabular text-[13px] text-muted">{done} de {tasks.length} feitas</span>
        </div>
        <Progress value={pct} height={4} />
      </div>
      {tasks.length === 0 && <div className="border-t border-divider px-[18px] py-4 text-muted">Sem tarefas para hoje.</div>}
      {tasks.map((t, i) => {
        const isDone = !!t.done_at
        const overdue = t.due_date < today && !isDone
        const time = t.due_date < today ? `Em atraso · ${overdueLabel(t.due_date, today)}` : t.due_time ? t.due_time.slice(0, 5) : 'Hoje'
        const treat = t.action?.startsWith('treatment:') && !isDone && canEditHerd
        return (
          <div key={t.id} style={{ animationDelay: `${i * 50}ms` }} className="flex min-h-16 animate-pf-up items-center gap-3.5 border-t border-divider px-[18px] py-3">
            <button type="button" aria-label="Marcar como feita" onClick={() => toggle(t)} disabled={!canEditHerd}
              className={cx('grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-2 p-0 text-white transition-[background,border-color,transform] duration-300 active:scale-[0.85]',
                isDone ? 'border-accent bg-accent' : overdue ? 'border-danger bg-transparent' : 'border-[#D4D4E2] bg-transparent')}>
              <Icon name="check" size={16} className={cx('transition-all duration-300', isDone ? 'scale-100 opacity-100' : 'scale-0 opacity-0')} />
            </button>
            <div className="min-w-0 flex-1">
              <div className={cx('font-medium', isDone ? 'text-muted line-through' : 'text-ink')}>{t.title}</div>
              <div className="flex flex-wrap gap-1.5 text-[13px] text-muted">
                <span className={overdue ? 'font-semibold text-danger' : undefined}>{time}</span>
                {t.location && <><span>·</span><span>{t.location}</span></>}
              </div>
            </div>
            {treat && (
              <Button size="sm" variant="soft" className="rounded-[10px]"
                onClick={() => openLog('treatment', { product: t.action!.split(':')[1], taskId: t.id, penId: t.pen_id ?? undefined })}>
                Registar
              </Button>
            )}
            {t.assignee && (
              <div title={t.assignee} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sunken text-[11px] font-semibold text-ink-2">
                {t.assignee[0]}
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}
