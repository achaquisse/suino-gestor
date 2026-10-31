import { TONE } from '@/lib/constants'
import { Button, Card, Icon } from '@/ui'
import type { Alert } from './useAlerts'

export default function AlertsCard({ alerts }: { alerts: Alert[] }) {
  return (
    <Card>
      <h2 className="m-0 px-[18px] pt-[18px] pb-2 text-[15px] font-semibold">Alertas</h2>
      {alerts.length === 0 && <div className="border-t border-divider px-[18px] py-4 text-muted">Sem alertas.</div>}
      {alerts.map((a, i) => (
        <div key={a.key} style={{ animationDelay: `${i * 60}ms` }} className="flex animate-pf-up items-center gap-3 border-t border-divider px-[18px] py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
            style={{ background: a.red ? TONE.red[0] : '#F0F0F6', color: a.red ? TONE.red[1] : '#4A4A5C' }}>
            <Icon name={a.icon} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">{a.title}</div>
            <div className="text-[13px] text-muted">{a.sub}</div>
          </div>
          <Button size="sm" className="rounded-[10px] font-medium" onClick={a.act}>{a.action}</Button>
        </div>
      ))}
    </Card>
  )
}
