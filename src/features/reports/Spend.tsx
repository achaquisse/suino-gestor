import { Card, cx, Icon } from '@/ui'
import { setUrlParams, useUrlParams } from '@/lib/urlState'
import { INK, MUTED } from '@/lib/constants'
import type { Account, Transaction } from '@/lib/database.types'
import { fmt, kfmt, pctL } from '@/lib/format'
import { acctColor, type Bucket } from './model'

export function Spend({ scope, accts, all, buckets, weekly, F, T }: {
  scope: Account[]; accts: Account[]; all: Transaction[]; buckets: Bucket[]; weekly: boolean; F: string; T: string
}) {
  const params = useUrlParams()
  const stack = params.get('stack') !== '0'
  const setStack = (v: boolean) => setUrlParams({ stack: v ? null : '0' })
  const hidden = params.get('hide')?.split(',').filter(Boolean) ?? []
  const setHidden = (ids: string[]) => setUrlParams({ hide: ids.join(',') })
  const selRaw = params.get('bucket')
  const sel = selRaw != null && /^\d+$/.test(selRaw) ? +selRaw : null
  const setSel = (i: number) => setUrlParams({ bucket: i })
  const vis = scope.filter((a) => !hidden.includes(a.id))
  const exp = (id: string, lo: string, hi: string) =>
    -all.filter((t) => t.account_id === id && t.amount < 0 && t.tx_date >= lo && t.tx_date <= hi).reduce((s, t) => s + t.amount, 0)
  const data = buckets.map((b) => {
    const vals = vis.map((a) => ({ a, v: exp(a.id, b.a, b.b) }))
    return { ...b, vals, total: vals.reduce((s, x) => s + x.v, 0), mxs: Math.max(0, ...vals.map((x) => x.v)) }
  })
  const MX = Math.max(1, ...data.map((b) => (stack ? b.total : b.mxs)))
  const selI = sel != null && sel < data.length ? sel : data.length - 1
  const cur = data[selI]
  const spendTot = vis.reduce((s, a) => s + exp(a.id, F, T), 0)
  const toggle = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]
    if (scope.every((a) => next.includes(a.id))) return
    setHidden(next)
  }

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="m-0 text-[15px] font-semibold">Gastos por conta</h2>
          <div className="text-[13px] text-muted">Total {fmt(spendTot)} MT · por {weekly ? 'semana' : 'mês'}</div>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-sunken p-1">
          {([[true, 'Combinado', 'stacked_bar_chart'], [false, 'Por conta', 'bar_chart']] as const).map(([v, l, i]) => (
            <button key={l} type="button" onClick={() => setStack(v)}
              className={cx('flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[9px] border-0 px-3.5 text-sm font-semibold', stack === v ? 'bg-white text-accent shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'bg-transparent text-ink-2')}>
              <Icon name={i} size={18} />{l}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {scope.map((a) => {
          const off = hidden.includes(a.id)
          return (
            <button key={a.id} type="button" onClick={() => toggle(a.id)}
              className={cx('flex h-9 items-center gap-2 rounded-full border bg-white px-3 text-[13px] text-ink', off ? 'border-line-strong opacity-45' : 'border-[#C9C2FB]')}>
              <span className="size-2.5 rounded-[3px]" style={{ background: acctColor(accts, a.id) }} />
              <span className="font-semibold">{a.name}</span>
              <span className="tabular text-muted">{fmt(exp(a.id, F, T))} MT</span>
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-end gap-5">
        <div className="flex h-[200px] items-end gap-2">
          {data.map((b, i) => {
            const on = i === selI
            return (
              <button key={b.a} type="button" onClick={() => setSel(i)} className={cx('flex h-full min-w-0 flex-1 flex-col items-center gap-1.5 border-0 bg-transparent p-0', on ? 'opacity-100' : 'opacity-50')}>
                <span className="tabular text-[11px] text-muted">{b.total ? kfmt(b.total) : ''}</span>
                <div className="flex w-full flex-1 items-end justify-center">
                  <div className={cx('flex w-[70%] max-w-[54px] overflow-hidden transition-[height] duration-700 ease-pf', stack ? 'flex-col rounded-t-lg rounded-b-[3px]' : 'items-end gap-[3px]')}
                    style={{ height: `${((stack ? b.total : b.mxs) / MX) * 100}%` }}>
                    {b.vals.map((x) => (
                      <div key={x.a.id} className={stack ? '' : 'rounded-t-md rounded-b-sm'}
                        style={{ flex: stack ? '0 0 auto' : '1 1 0', height: stack ? `${b.total ? (x.v / b.total) * 100 : 0}%` : `${b.mxs ? (x.v / b.mxs) * 100 : 0}%`, background: acctColor(accts, x.a.id) }} />
                    ))}
                  </div>
                </div>
                <span className="text-xs" style={{ color: on ? INK : MUTED, fontWeight: on ? 600 : 400 }}>{b.label}</span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-[#F7F7FB] p-4">
          <span className="text-[13px] text-muted">{cur?.full ?? '—'}</span>
          <span className="tabular text-[22px] font-semibold">{fmt(cur?.total ?? 0)} MT</span>
          {cur?.vals.map((x) => (
            <div key={x.a.id} className="flex items-center gap-2 text-[13px]">
              <span className="size-[9px] rounded-[3px]" style={{ background: acctColor(accts, x.a.id) }} />
              <span className="flex-1">{x.a.name}</span>
              <span className="tabular font-semibold">{fmt(x.v)}</span>
              <span className="w-11 text-right text-muted">{pctL(x.v, cur.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
