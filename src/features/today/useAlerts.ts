import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useFarm } from '@/app/farm'
import { useOverlays } from '@/app/overlays'
import { useCalendarEvents, useParam, useStock, useTableMutations, useTasks } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { addDays, dFull, dShort, daysBetween, todayISO } from '@/lib/format'
import { useToast } from '@/ui'
import { qtyLabel } from '@/features/stock/model'

export type Alert = {
  key: string
  icon: string
  title: string
  sub: string
  action: string
  red?: boolean
  dismissible?: boolean
  act: () => void
}

export function overdueLabel(due: string, today: string) {
  const n = daysBetween(due, today)
  return n === 1 ? 'ontem' : `há ${n} dias`
}

export function useAlerts() {
  const nav = useNavigate()
  const { openLog } = useOverlays()
  const { user, canEditHerd } = useFarm()
  const { update } = useTableMutations('tasks')
  const toast = useToast()
  const today = todayISO()
  const tasks = useTasks(undefined, today).data
  const upcoming = useCalendarEvents(today, addDays(today, 7)).data
  const stock = useStock().data
  const notice = useParam('expiry_notice_days', 30)

  return useMemo<Alert[]>(() => {
    const out: Alert[] = []
    for (const t of tasks ?? []) {
      const treat = t.action?.startsWith('treatment:')
      if (t.done_at || (t.due_date >= today && !(t.due_date === today && treat))) continue
      const overdue = t.due_date < today
      out.push({
        key: `task-${t.id}`,
        icon: treat ? 'vaccines' : 'assignment_late',
        title: `${t.title}${overdue ? ' em atraso' : ' hoje'}`,
        sub: `${t.location ? t.location + ' · ' : ''}${overdue ? `era para ${overdueLabel(t.due_date, today) === 'ontem' ? 'ontem' : dShort(t.due_date)}` : 'tratamento previsto para hoje'}`,
        action: canEditHerd ? (treat ? 'Registar' : 'Concluir') : 'Ver',
        red: true,
        act: !canEditHerd ? () => nav('/herd') : treat
          ? () => openLog('treatment', { product: t.action!.split(':')[1], taskId: t.id, penId: t.pen_id ?? undefined })
          : () => update.mutate({ id: t.id, done_at: new Date().toISOString(), done_by: user.name }, {
            onSuccess: () => toast(`Feito · ${t.title}`),
            onError: (e) => toast(errorMessage(e), 'error'),
          }),
      })
    }
    const seen = new Set<string>()
    for (const e of upcoming ?? []) {
      if (e.kind !== 'breeding' || !e.title.includes('com parto previsto')) continue
      const tag = e.title.split(' ')[0]
      if (seen.has(tag)) continue
      seen.add(tag)
      out.push({
        key: `farrow-${e.id}`,
        icon: 'child_care',
        title: `${tag} com parto previsto`,
        sub: dFull(e.event_date),
        action: 'Ver',
        dismissible: true,
        act: () => nav(`/herd/animals/${encodeURIComponent(tag)}`),
      })
    }
    for (const s of stock ?? []) {
      if (!s.active) continue
      const low = s.qty <= s.low_qty
      const exp = s.expires_on ? daysBetween(today, s.expires_on) : null
      const expiring = exp !== null && exp <= notice
      if (low) out.push({
        key: `stock-low-${s.id}`,
        icon: 'inventory_2',
        title: `${s.name} em baixo`,
        sub: qtyLabel(s.qty, s),
        action: 'Encomendar',
        act: () => openLog('purchase', { stockCode: s.code }),
      })
      if (expiring) out.push({
        key: `stock-expiry-${s.id}-${s.expires_on}`,
        icon: 'medication',
        title: `${s.name} ${exp! < 0 ? 'expirou' : 'expira em breve'}`,
        sub: dShort(s.expires_on!),
        action: 'Ver stock',
        dismissible: true,
        act: () => nav('/stock?status=expiring'),
      })
    }
    return out
  }, [tasks, upcoming, stock, notice, today, nav, openLog, canEditHerd, update, user.name, toast])
}
