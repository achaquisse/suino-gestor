import { useOverlays } from '@/app/overlays'
import { useStock } from '@/lib/queries'
import { Button, Card, Progress } from '@/ui'

export default function StockCard() {
  const { openLog } = useOverlays()
  const { data } = useStock()
  const items = data ?? []
  const low = items.filter((s) => s.qty <= s.low_qty).length
  if (!items.length) return null
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-[18px] pt-[18px] pb-2">
        <div>
          <h2 className="m-0 text-[15px] font-semibold">Stock</h2>
          {low > 0 && <div className="text-[13px] text-danger">{low} {low === 1 ? 'item baixo' : 'itens baixos'}</div>}
        </div>
        <Button size="sm" className="rounded-[10px] font-medium" onClick={() => openLog('purchase')}>Registar compra</Button>
      </div>
      {items.map((s) => {
        const isLow = s.qty <= s.low_qty
        return (
          <div key={s.id} className="flex flex-col gap-1.5 border-t border-divider px-[18px] py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{s.name}</span>
              <span className="tabular text-sm" style={{ color: isLow ? 'var(--color-danger)' : '#4A4A5C' }}>{s.qty} {s.unit}</span>
            </div>
            <Progress value={s.max_qty ? (s.qty / s.max_qty) * 100 : 0} color={isLow ? 'var(--color-danger)' : 'var(--color-accent)'} height={4} />
            {(s.note || isLow) && <div className="text-[13px] text-muted">{isLow ? `Baixo${s.note ? ' · ' + s.note : ''}` : s.note}</div>}
          </div>
        )
      })}
    </Card>
  )
}
