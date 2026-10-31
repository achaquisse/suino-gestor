import { Icon, Select, cx } from '@/ui'
import type { Account } from '@/lib/database.types'
import { fmt, numP } from '@/lib/format'
import type { SplitDraft } from './model'

const equal = (k: number) => {
  const b = Math.floor(100 / k)
  return Array.from({ length: k }, (_, i) => String(i === k - 1 ? 100 - b * (k - 1) : b))
}

export default function SplitEditor({ value, onChange, accounts, amount }: { value: SplitDraft[]; onChange: (v: SplitDraft[]) => void; accounts: Account[]; amount: number }) {
  const n = value.length
  const pct = (s: SplitDraft) => numP(s.pct) || 0
  const total = value.reduce((a, s) => a + pct(s), 0)
  const ok = Math.abs(total - 100) < 0.01

  const setAccount = (i: number, id: string) => onChange(value.map((s, j) => (j === i ? { ...s, account_id: id } : s)))
  const setPct = (i: number, v: string) => {
    if (n === 2) {
      const other = String(Math.max(0, 100 - (numP(v) || 0)))
      onChange(value.map((s, j) => (j === i ? { ...s, pct: v } : { ...s, pct: other })))
    } else onChange(value.map((s, j) => (j === i ? { ...s, pct: v } : s)))
  }
  const remove = (i: number) => {
    const rest = value.filter((_, j) => j !== i)
    const ps = rest.length === 1 ? ['100'] : equal(rest.length)
    onChange(rest.map((s, j) => ({ ...s, pct: ps[j] })))
  }
  const add = () => {
    const used = value.map((s) => s.account_id)
    const next = accounts.find((a) => !used.includes(a.id)) ?? accounts[0]
    const ps = n === 1 ? ['50', '50'] : equal(n + 1)
    onChange([...value, { account_id: next.id, pct: '' }].map((s, j) => ({ ...s, pct: ps[j] })))
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((s, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_minmax(70px,auto)_36px] items-center gap-2">
          <Select value={s.account_id} onChange={(e) => setAccount(i, e.target.value)} className="h-11">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <label className={cx('flex h-11 items-center gap-1 rounded-[12px] border border-line-strong px-2.5', n === 1 ? 'bg-[#F7F7FB]' : 'bg-white')}>
            <input type="number" min={1} max={100} step="any" value={s.pct} disabled={n === 1} aria-label="Percentagem"
              onChange={(e) => setPct(i, e.target.value)}
              className="tabular w-full min-w-0 border-0 bg-transparent text-right text-sm outline-none" />
            <span className="text-sm text-muted">%</span>
          </label>
          <span className="tabular whitespace-nowrap text-right text-[13px] text-muted">{amount && n > 1 ? `${fmt((amount * pct(s)) / 100)} MT` : ''}</span>
          <button type="button" aria-label="Remover conta" onClick={() => remove(i)}
            className={cx('grid h-9 w-9 place-items-center rounded-[10px] border-0 bg-transparent text-muted hover:bg-hover', n > 1 ? 'visible' : 'invisible')}>
            <Icon name="close" size={18} />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {n < accounts.length && (
          <button type="button" onClick={add} className="flex h-9 items-center gap-1.5 rounded-[10px] border-0 bg-transparent px-2.5 text-[13px] font-semibold text-accent-strong hover:bg-accent-wash">
            <Icon name="call_split" size={18} />Dividir com outra conta
          </button>
        )}
        {n > 1 && (
          <span className={cx('tabular ml-auto text-[13px] font-semibold', ok ? 'text-success-strong' : 'text-danger')}>
            Total {Math.round(total * 100) / 100}%
          </span>
        )}
      </div>
    </div>
  )
}
