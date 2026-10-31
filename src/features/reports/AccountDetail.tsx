import { Card, cx, Dot, Icon, Progress } from '@/ui'
import { setUrlParams, useUrlNumber, useUrlParams } from '@/lib/urlState'
import { GREEN, INK, MUTED, RED } from '@/lib/constants'
import { useCategories } from '@/lib/queries'
import type { Account, AccountBalance, Transaction } from '@/lib/database.types'
import { dShort, fmt, pctL, sgn } from '@/lib/format'
import { acctColor } from './model'

const PER = 6

export function AccountDetail({ scope, accts, balances, all, F, T, totalSpend }: {
  scope: Account[]; accts: Account[]; balances: AccountBalance[]; all: Transaction[]; F: string; T: string; totalSpend: number
}) {
  const invId = useUrlParams().get('acc')
  const [page, setPage] = useUrlNumber('accPage', 1)
  const categoryColors = new Map((useCategories().data ?? []).map((c) => [c.name, c.color]))
  const color = (name: string) => categoryColors.get(name) ?? MUTED
  const cur = scope.find((a) => a.id === invId) ?? scope[0]
  if (!cur) return null
  const tx = all.filter((t) => t.account_id === cur.id && t.tx_date >= F && t.tx_date <= T)
  const inn = tx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const out = -tx.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
  const bal = balances.find((b) => b.id === cur.id)?.balance ?? cur.initial_balance + all.filter((t) => t.account_id === cur.id).reduce((s, t) => s + t.amount, 0)
  const cats = new Map<string, number>()
  for (const t of tx) if (t.amount < 0) cats.set(t.category, (cats.get(t.category) ?? 0) - t.amount)
  const icl = [...cats].sort((a, b) => b[1] - a[1])
  const sorted = tx.slice().sort((a, b) => b.tx_date.localeCompare(a.tx_date))
  const pages = Math.max(1, Math.ceil(sorted.length / PER))
  const pg = Math.min(page, pages)
  const recent = sorted.slice((pg - 1) * PER, pg * PER)
  const kpis = [
    { l: 'Entradas', v: `${fmt(inn)} MT`, sub: 'no período', c: GREEN },
    { l: 'Gastos', v: `${fmt(out)} MT`, sub: `${pctL(out, totalSpend)} dos gastos totais`, c: INK },
    { l: 'Resultado', v: `${sgn(inn - out)} MT`, sub: 'entradas − gastos', c: inn - out < 0 ? RED : GREEN },
    { l: 'Saldo actual', v: `${bal < 0 ? '−' : ''}${fmt(bal)} MT`, sub: 'disponível hoje', c: INK },
  ]
  const pgBtn = 'grid size-8 place-items-center rounded-[9px] border border-line-strong bg-white'

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="m-0 text-[15px] font-semibold">Detalhe por conta</h2>
          <div className="text-[13px] text-muted">{cur.name} · {cur.holder}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {scope.map((a) => {
            const on = a.id === cur.id
            return (
              <button key={a.id} type="button" onClick={() => setUrlParams({ acc: a.id, accPage: null })}
                className={cx('flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold', on ? 'border-[#C9C2FB] bg-[#EEECFE] text-accent-strong' : 'border-line-strong bg-white text-ink-2')}>
                <Dot color={acctColor(accts, a.id)} />{a.name}
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
        {kpis.map((k) => (
          <div key={k.l} className="flex min-w-0 flex-col gap-1 rounded-2xl bg-[#F7F7FB] px-[18px] py-4">
            <span className="text-[13px] text-muted">{k.l}</span>
            <span className="tabular text-[22px] font-semibold tracking-[-0.02em]" style={{ color: k.c }}>{k.v}</span>
            <span className="text-xs text-muted">{k.sub}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5">
        <div className="flex flex-col gap-2.5">
          <h3 className="m-0 text-sm font-semibold">Gastos por categoria</h3>
          {!icl.length && <div className="text-sm text-muted">Sem gastos no período.</div>}
          {icl.map(([c, v]) => (
            <div key={c} className="flex flex-col gap-[5px]">
              <div className="flex items-center gap-2 text-[13px]">
                <Dot color={color(c)} size={9} />
                <span className="flex-1">{c}</span>
                <span className="tabular font-semibold">{fmt(v)}</span>
                <span className="w-11 text-right text-muted">{pctL(v, out)}</span>
              </div>
              <Progress value={(v / icl[0][1]) * 100} color={color(c)} />
            </div>
          ))}
        </div>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-line">
          <div className="px-4 py-3 text-sm font-semibold">Movimentos recentes</div>
          {!sorted.length && <div className="border-t border-divider p-4 text-sm text-muted">Sem movimentos no período.</div>}
          {recent.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 border-t border-divider px-4 py-2.5">
              <Dot color={color(t.category)} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{t.title}</span>
                <span className="text-xs text-muted">{dShort(t.tx_date)} · {t.category}</span>
              </span>
              <span className="tabular text-sm font-semibold" style={{ color: t.amount > 0 ? GREEN : INK }}>{sgn(t.amount)}</span>
            </div>
          ))}
          {sorted.length > PER && (
            <div className="flex items-center justify-between gap-2 border-t border-divider px-4 py-2.5">
              <span className="text-xs text-muted">{(pg - 1) * PER + 1}–{Math.min(sorted.length, pg * PER)} de {sorted.length}</span>
              <div className="flex gap-1.5">
                <button type="button" aria-label="Anterior" onClick={() => setPage(Math.max(1, pg - 1))} className={pgBtn}><Icon name="chevron_left" size={18} /></button>
                <button type="button" aria-label="Seguinte" onClick={() => setPage(Math.min(pages, pg + 1))} className={pgBtn}><Icon name="chevron_right" size={18} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
