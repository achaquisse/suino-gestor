import { Icon, Pager, Segmented, SearchInput, Select, Card, cx, type usePaged } from '@/ui'
import { CATC, MUTED } from '@/lib/constants'
import type { Transaction } from '@/lib/database.types'
import { dShort, sgn } from '@/lib/format'
import { pctIn, type Filters, type Lookups } from './model'

type Pg = ReturnType<typeof usePaged<Transaction>>

export default function TransactionsCard({ rows, pager, total, categories, filters, onFilters, lookups, groups, withFiles, onOpen }: {
  rows: Transaction[]; pager: Pg['pager']; total: number; categories: string[]; filters: Filters; onFilters: (p: Partial<Filters>) => void
  lookups: Lookups; groups: Map<string, Transaction[]>; withFiles: Set<string>; onOpen: (t: Transaction) => void
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-baseline gap-2.5">
            <h2 className="m-0 text-[15px] font-semibold">Movimentos</h2>
            <span className="text-[13px] text-muted">{total} {total === 1 ? 'movimento' : 'movimentos'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={filters.q} onChange={(q) => onFilters({ q })} placeholder="Pesquisar movimentos" className="w-60 max-w-full" />
            <Segmented options={[['all', 'Todos'], ['in', 'Entradas'], ['out', 'Saídas']] as const} value={filters.type} onChange={(type) => onFilters({ type })} />
            <Select value={filters.sort} onChange={(e) => onFilters({ sort: e.target.value as Filters['sort'] })} className="h-11 w-auto! rounded-xl">
              <option value="new">Mais recentes</option>
              <option value="old">Mais antigos</option>
              <option value="high">Maior valor</option>
              <option value="low">Menor valor</option>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[null, ...categories].map((c) => {
            const on = filters.cat === c
            return (
              <button key={c ?? 'all'} type="button" onClick={() => onFilters({ cat: c })}
                className={cx('flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold', on ? 'border-[#C9C2FB] bg-accent-soft text-accent-strong' : 'border-line-strong bg-white text-ink-2')}>
                {c && <span className="h-2 w-2 rounded-full" style={{ background: lookups.categoryColor(c) || CATC[c] || MUTED }} />}
                {c ?? 'Todas'}
              </button>
            )
          })}
        </div>
      </div>
      {!rows.length && <div className="border-t border-divider px-5 py-8 text-center text-muted">Nenhum movimento encontrado.</div>}
      {rows.map((t, i) => {
        const pct = pctIn(t, groups)
        return (
          <button key={t.id} type="button" onClick={() => onOpen(t)} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            className="flex w-full animate-pf-fade items-center gap-3 border-0 border-t border-divider bg-white px-5 py-3 text-left hover:bg-[#FBFBFD]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: lookups.categoryColor(t.category) }} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{t.title}</span>
              <span className="truncate text-xs text-muted">{dShort(t.tx_date)} · {t.category} · {lookups.accountName(t.account_id)}{pct ? ` · ${pct}%` : ''}</span>
            </span>
            {withFiles.has(t.id) && <span title="Com anexos"><Icon name="attach_file" size={18} className="text-faint" /></span>}
            <span className={cx('tabular whitespace-nowrap font-semibold', t.amount > 0 && 'text-success')}>{sgn(t.amount)}</span>
          </button>
        )
      })}
      <Pager {...pager} options={[10, 25, 50]} />
    </Card>
  )
}
