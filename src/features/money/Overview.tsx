import { ACC, GREEN, INK, MUTED, RED, TONE } from '@/lib/constants'
import type { AccountBalance, Account, Transaction } from '@/lib/database.types'
import { MONTHS, addDays, addMonths, fmt, pctL, sgn, todayISO } from '@/lib/format'
import { Card, IconTile, Progress, Segmented, cx } from '@/ui'
import { isIncome, type Lookups } from './model'

export function Kpis({ per, balance, accountCount }: { per: Transaction[]; balance: number; accountCount: number }) {
  const inc = per.filter(isIncome)
  const out = per.filter((t) => t.amount < 0)
  const rev = inc.reduce((a, t) => a + t.amount, 0)
  const exp = -out.reduce((a, t) => a + t.amount, 0)
  const res = rev - exp
  const items = [
    { label: 'Receita', icon: 'payments', bg: '#EEECFE', fg: ACC, value: fmt(rev), color: INK, sub: `${inc.length} ${inc.length === 1 ? 'venda' : 'vendas'}` },
    { label: 'Despesas', icon: 'receipt_long', bg: '#FDF1E2', fg: '#C77A1A', value: fmt(exp), color: INK, sub: `${out.length} registos` },
    { label: 'Resultado', icon: 'trending_up', bg: '#E6F6EE', fg: GREEN, value: sgn(res), color: res < 0 ? RED : GREEN, sub: 'receita menos despesas' },
    { label: 'Saldo disponível', icon: 'account_balance_wallet', bg: '#E6F4F8', fg: '#2A8FB0', value: fmt(balance), color: INK, sub: `em ${accountCount} ${accountCount === 1 ? 'conta' : 'contas'}` },
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
          const funded = a.initial_balance + mine.filter((t) => t.category === 'Aporte').reduce((s, t) => s + t.amount, 0)
          const used = -mine.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
          const income = mine.filter(isIncome).reduce((s, t) => s + t.amount, 0)
          const balance = balances.find((b) => b.id === a.id)?.balance ?? a.initial_balance
          const inv = a.kind === 'Investimento'
          const pct = inv ? (funded ? (balance / funded) * 100 : 0) : income ? (balance / income) * 100 : 0
          return (
            <div key={a.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line p-3.5">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{a.name}</div>
                  <div className="truncate text-xs text-muted">{a.holder}</div>
                </div>
                <span className="tabular whitespace-nowrap font-semibold">{balance < 0 ? '−' : ''}{fmt(balance)} MT</span>
              </div>
              <Progress value={pct} />
              <span className="text-xs text-muted">{inv ? `${fmt(used)} usados de ${fmt(funded)} aportados` : `${fmt(income)} recebidos · ${fmt(used)} pagos`}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

type Bucket = { key: string; month: number; year: number; r: number; e: number; n: number }

export function TrendCard({ base, from, to, chart, onChart, selKey, onSel }: {
  base: Transaction[]; from: string; to: string; chart: 'rv' | 'res'; onChart: (c: 'rv' | 'res') => void; selKey: string | null; onSel: (k: string) => void
}) {
  const monthStart = `${todayISO().slice(0, 8)}01`
  const buckets: Bucket[] = [3, 2, 1, 0].map((i) => {
    const s = addMonths(monthStart, -i)
    const key = s.slice(0, 7)
    const ts = base.filter((t) => t.tx_date.slice(0, 7) === key)
    const r = ts.filter(isIncome).reduce((a, t) => a + t.amount, 0)
    const e = -ts.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0)
    return { key, month: +s.slice(5, 7), year: +s.slice(0, 4), r, e, n: r - e }
  })
  const max = Math.max(1, ...buckets.map((d) => (chart === 'rv' ? Math.max(d.r, d.e) : Math.abs(d.n))))
  const sel = buckets.find((b) => b.key === selKey) ?? buckets[buckets.length - 1]
  const inPeriod = (b: Bucket) => `${b.key}-01` <= to && addDays(addMonths(`${b.key}-01`, 1), -1) >= from
  const legend = chart === 'rv' ? [['Receita', ACC], ['Despesas', '#D6D6E2']] : [['Lucro', GREEN], ['Prejuízo', RED]]

  return (
    <Card className="flex min-w-0 flex-col gap-3.5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Segmented options={[['rv', 'Receita vs despesas'], ['res', 'Resultado']] as const} value={chart} onChange={onChart} />
        <div className="flex gap-3">
          {legend.map(([l, c]) => (
            <span key={l} className="flex items-center gap-1.5 text-xs text-ink-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />{l}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-muted">{MONTHS[sel.month - 1]} {sel.year}</span>
        <span className="tabular text-[22px] font-semibold">{chart === 'rv' ? `${fmt(sel.r)} MT` : `${sgn(sel.n)} MT`}</span>
        <span className="text-xs" style={{ color: chart === 'rv' ? (sel.n < 0 ? RED : GREEN) : MUTED }}>
          {chart === 'rv' ? `despesas ${fmt(sel.e)} MT · resultado ${sgn(sel.n)}` : `margem ${pctL(sel.n, sel.r)}`}
        </span>
      </div>
      <div className="flex h-[180px] items-end gap-2.5">
        {buckets.map((b) => {
          const on = b.key === sel.key
          const h1 = ((chart === 'rv' ? b.r : Math.abs(b.n)) / max) * 100
          const c1 = chart === 'rv' ? 'linear-gradient(180deg,#7A6BFF,#5B4CF0)' : b.n < 0 ? 'linear-gradient(180deg,#F08A80,#D0342C)' : 'linear-gradient(180deg,#4FD394,#15A05A)'
          return (
            <button key={b.key} type="button" onClick={() => onSel(b.key)}
              className={cx('flex h-full flex-1 flex-col items-center justify-end gap-2 rounded-xl border-0 px-1 py-2 transition-opacity', on ? 'bg-accent-wash' : 'bg-transparent', inPeriod(b) ? 'opacity-100' : 'opacity-40')}>
              <div className="flex w-full flex-1 items-end justify-center gap-1">
                <div className="w-[40%] max-w-[26px] rounded-t-md rounded-b-[2px] transition-[height] duration-700 ease-pf" style={{ height: `${h1}%`, background: c1 }} />
                {chart === 'rv' && <div className="w-[40%] max-w-[26px] rounded-t-md rounded-b-[2px] bg-[#D6D6E2] transition-[height] duration-700 ease-pf" style={{ height: `${(b.e / max) * 100}%` }} />}
              </div>
              <span className={cx('text-xs', on ? 'font-semibold text-ink' : 'text-muted')}>{MONTHS[b.month - 1]}</span>
            </button>
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
                <span className="truncate text-sm font-medium">{c}</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: bg, color: fg }}>{g}</span>
                <span className="tabular ml-auto text-sm font-semibold">{fmt(o.v)} MT</span>
                <span className="w-10 text-right text-xs text-muted">{pctL(o.v, total)}</span>
              </div>
              <Progress value={(o.v / list[0][1].v) * 100} color={color} />
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
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
