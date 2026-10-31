import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useOverlays } from '@/app/overlays'
import { useCalendarEvents, useParam, useStock, useTasks } from '@/lib/queries'
import { addDays, dFull, dShort, daysBetween, todayISO } from '@/lib/format'

export type Alert = {
  key: string
  icon: string
  title: string
  sub: string
  action: string
  red?: boolean
  act: () => void
}

export function overdueLabel(due: string, today: string) {
  const n = daysBetween(due, today)
  return n === 1 ? 'ontem' : `há ${n} dias`
}

export function useAlerts() {
  const nav = useNavigate()
  const { openLog } = useOverlays()
  const today = todayISO()
  const tasks = useTasks(undefined, today).data
  const upcoming = useCalendarEvents(today, addDays(today, 7)).data
  const stock = useStock().data
  const notice = useParam('expiry_notice_days', 30)

  return useMemo<Alert[]>(() => {
    const out: Alert[] = []
    for (const t of tasks ?? []) {
      if (t.done_at || t.due_date >= today) continue
      const treat = t.action?.startsWith('treatment:')
      out.push({
        key: `task-${t.id}`,
        icon: treat ? 'vaccines' : 'assignment_late',
        title: `${t.title} em atraso`,
        sub: `${t.location ? t.location + ' · ' : ''}era para ${overdueLabel(t.due_date, today) === 'ontem' ? 'ontem' : dShort(t.due_date)}`,
        action: treat ? 'Registar' : 'Ver',
        red: true,
        act: treat
          ? () => openLog('treatment', { product: t.action!.split(':')[1], taskId: t.id, penId: t.pen_id ?? undefined })
          : () => nav('/'),
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
        act: () => nav(`/herd/animals/${tag}`),
      })
    }
    for (const s of stock ?? []) {
      if (!s.active) continue
      const low = s.qty <= s.low_qty
      const exp = s.expires_on ? daysBetween(today, s.expires_on) : null
      const expiring = exp !== null && exp <= notice
      if (!low && !expiring) continue
      out.push({
        key: `stock-${s.id}`,
        icon: expiring && !low ? 'medication' : 'inventory_2',
        title: expiring && !low ? `${s.name} expira em breve` : `${s.name} em baixo`,
        sub: `${s.qty} ${s.unit}${expiring && s.expires_on ? ' · ' + dShort(s.expires_on) : ''}`,
        action: 'Encomendar',
        act: () => openLog('purchase', { stockCode: s.code }),
      })
    }
    return out
  }, [tasks, upcoming, stock, notice, today, nav, openLog])
}
