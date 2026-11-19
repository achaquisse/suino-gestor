import { INK, RED, TONE } from '@/lib/constants'
import type { AccountBalance, Account, Transaction } from '@/lib/database.types'
import { fmt, pctL } from '@/lib/format'
import { Card, IconTile, Progress, Segmented } from '@/ui'
import type { Lookups } from './model'

export function Kpis({ per, balance, accountCount }: { per: Transaction[]; balance: number; accountCount: number }) {
  const out = per.filter((t) => t.amount < 0)
  const exp = -out.reduce((a, t) => a + t.amount, 0)
  const items = [
    { label: 'Despesas', icon: 'receipt_long', bg: '#FDF1E2', fg: '#C77A1A', value: fmt(exp), color: INK, sub: `${out.length} ${out.length === 1 ? 'registo' : 'registos'} no período` },
    { label: 'Saldo disponível', icon: 'account_balance_wallet', bg: '#E6F4F8', fg: '#2A8FB0', value: `${balance < 0 ? '−' : ''}${fmt(balance)}`, color: balance < 0 ? RED : INK, sub: `em ${accountCount} ${accountCount === 1 ? 'conta' : 'contas'}` },
  ]
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
      {items.map((k, i) => (
        <Card key={k.label} as="div" className="flex min-w-0 animate-pf-up flex-col gap-1 px-[18px] py-4" style={{ animationDelay: `${i * 60}ms` }}>
          <span className="flex items-center gap-2 text-[13px] text-muted">
            <IconTile icon={k.icon} bg={k.bg} fg={k.fg} size={28} iconSize={16} className="rounded-[9px]" />
            {k.label}
          </span>
          <span className="tabular text-2xl font-semibold tracking-[-0.02em]" style={{ color: k.color }}>
            {k.value} <span className="text-[13px] font-medium text-faint">MT</span>
          </span>
          <span className="text-xs text-muted">{k.sub}</span>
        </Card>
      ))}
    </div>
  )
}

export function AccountsCard({ accounts, balances, txs }: { accounts: Account[]; balances: AccountBalance[]; txs: Transaction[] }) {
  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <h2 className="m-0 text-[15px] font-semibold">Contas</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
        {accounts.map((a) => {
          const mine = txs.filter((t) => t.account_id === a.id)
          const funded = a.initial_balance + mine.filter((t) => t.category === 'Injeção de capital').reduce((s, t) => s + t.amount, 0)
          const used = -mine.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
          const balance = balances.find((b) => b.id === a.id)?.balance ?? a.initial_balance
          const inv = a.kind === 'Investimento'
          const pct = funded ? (balance / funded) * 100 : 0
          return (
            <div key={a.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line p-3.5">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{a.name}</div>
                  <div className="truncate text-xs text-muted">{a.holder}</div>
                </div>
                <span className="tabular whitespace-nowrap font-semibold">{balance < 0 ? '−' : ''}{fmt(balance)} MT</span>
              </div>
              {inv && <Progress value={pct} />}
              <span className="text-xs text-muted">{inv ? `${fmt(used)} usados de ${fmt(funded)} injetados` : `${fmt(used)} pagos no período`}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export type CatGroup = 'all' | 'Investimento' | 'Operacional'

export function CategoriesCard({ per, lookups, group, onGroup, onPick }: {
  per: Transaction[]; lookups: Lookups; group: CatGroup; onGroup: (g: CatGroup) => void; onPick: (c: string) => void
}) {
  const map = new Map<string, { v: number; n: number; ac: Map<string, number> }>()
  for (const t of per.filter((x) => x.amount < 0)) {
    const o = map.get(t.category) ?? { v: 0, n: 0, ac: new Map<string, number>() }
    o.v -= t.amount
    o.n++
    o.ac.set(t.account_id, (o.ac.get(t.account_id) ?? 0) - t.amount)
    map.set(t.category, o)
  }
  const list = [...map.entries()].filter(([c]) => group === 'all' || lookups.categoryGroup(c) === group).sort((a, b) => b[1].v - a[1].v)
  const total = list.reduce((a, x) => a + x[1].v, 0)
  const tone: Record<string, readonly [string, string]> = { Investimento: TONE.accent, Operacional: TONE.amber, 'Dívida': TONE.neutral }

  return (
    <Card className="flex min-w-0 flex-col gap-3.5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="m-0 text-[15px] font-semibold">Despesas por categoria</h2>
          <div className="text-[13px] text-muted">{fmt(total)} MT no período</div>
        </div>
        <Segmented options={[['all', 'Todas'], ['Investimento', 'Investimento'], ['Operacional', 'Operacional']] as const} value={group} onChange={onGroup} />
      </div>
      {!list.length && <div className="py-4 text-center text-muted">Sem despesas neste período.</div>}
      <div className="flex flex-col gap-0.5">
        {list.map(([c, o]) => {
          const g = lookups.categoryGroup(c)
          const [bg, fg] = tone[g] ?? TONE.neutral
          const color = lookups.categoryColor(c)
          return (
            <button key={c} type="button" onClick={() => onPick(c)} className="flex flex-col gap-1.5 rounded-xl border-0 bg-transparent p-2.5 text-left hover:bg-[#F7F7FB]">
              <div className="flex w-full items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                <span className="min-w-0 truncate text-sm font-medium">{c}</span>
                <span className="hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline" style={{ background: bg, color: fg }}>{g}</span>
                <span className="tabular ml-auto shrink-0 whitespace-nowrap text-sm font-semibold">{fmt(o.v)} MT</span>
                <span className="w-11 shrink-0 text-right text-xs text-muted">{pctL(o.v, total)}</span>
              </div>
              <Progress value={(o.v / list[0][1].v) * 100} color={color} />
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span className="font-semibold sm:hidden" style={{ color: fg }}>{g} ·</span>
                {o.n} movimentos ·
                {[...o.ac.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => (
                  <span key={id} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: lookups.accountColor(id) }} />{lookups.accountName(id).replace('Investidor ', 'Inv. ')}</span>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
