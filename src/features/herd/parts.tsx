import { useMemo, type ReactNode } from 'react'
import { setUrlParams, useUrlState } from '@/lib/urlState'
import { Link, useNavigate } from 'react-router'
import { Card, Icon, IconTile, Pager, cx, usePaged } from '@/ui'
import { TONE } from '@/lib/constants'
import { useAnimals, usePens } from '@/lib/queries'
import { ageLabel, dec, plural } from '@/lib/format'
import { SORT_DIRS, SORT_KEYS, defaultDir, enrich, fmtKg, sortAnimals, type HA, type HelpDef, type SortDir, type SortKey } from './lib'

export function useHerd() {
  const animals = useAnimals()
  const pens = usePens()
  const list = useMemo(() => (animals.data && pens.data ? enrich(animals.data, pens.data) : []), [animals.data, pens.data])
  return { animals, pens, list, loading: animals.isPending || pens.isPending, error: animals.error ?? pens.error, refetch: () => { animals.refetch(); pens.refetch() } }
}

export function HelpBtn({ h, size = 'md' }: { h: HelpDef; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <Link to={h.to} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-[10px] px-2 font-medium text-accent-strong hover:bg-accent-tint hover:no-underline',
      size === 'sm' ? 'h-7 rounded-lg text-[13px]' : size === 'lg' ? 'h-9 px-2.5 text-[13px] font-semibold' : 'h-[34px] text-[13px]')}>
      <Icon name="help" size={16} />{h.label}
    </Link>
  )
}

export function Kpi({ label, value, sub, icon, bg, fg, valueColor, onClick, active }: {
  label: string; value: ReactNode; sub: ReactNode; icon: string; bg: string; fg: string; valueColor?: string; onClick?: () => void; active?: boolean
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp type={onClick ? 'button' : undefined} onClick={onClick}
      className={cx('flex min-w-0 flex-col gap-1 rounded-card border bg-white px-[18px] py-4 text-left shadow-card transition-colors',
        active ? 'border-[#F7C6C0]' : 'border-line', onClick && 'cursor-pointer hover:border-[#D9D5FC]')}>
      <span className="flex items-center gap-2 text-[13px] text-muted">
        <IconTile icon={icon} bg={bg} fg={fg} size={28} iconSize={16} className="rounded-[9px]" />{label}
      </span>
      <span className="tabular truncate text-2xl font-semibold tracking-[-0.02em]" style={{ color: valueColor }}>{value}</span>
      <span className="truncate text-xs text-muted">{sub}</span>
    </Comp>
  )
}

export const KpiGrid = ({ children }: { children: ReactNode }) => (
  <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">{children}</div>
)

export function StatusChip({ a, className }: { a: HA; className?: string }) {
  const [bg, fg] = TONE[a.tone]
  return (
    <span className={cx('inline-block max-w-full truncate rounded-full px-[9px] py-[3px] text-xs font-medium', className)} style={{ background: bg, color: fg }}>{a.status}</span>
  )
}

const GRID = 'grid grid-cols-[0.9fr_1fr_0.7fr_1fr_0.8fr_1.1fr_1.4fr_20px] items-center gap-3 px-5'

export function AnimalTable({ title, rows, thirdCol, showSearch, emptyText = 'Nenhum animal encontrado.', toolbar, id }: {
  title: string; rows: HA[]; thirdCol: 'pen' | 'parents'; showSearch?: boolean; emptyText?: string
  /** Search and filters shown inside the list section, under its title. */
  toolbar?: ReactNode; id?: string
}) {
  const nav = useNavigate()
  const [sort] = useUrlState<SortKey>('sort', 'tag', SORT_KEYS)
  const [rawDir] = useUrlState<SortDir | ''>('dir', '', SORT_DIRS)
  const dir = rawDir || defaultDir(sort)
  const toggleSort = (k: SortKey) => {
    const next = k === sort ? (dir === 'asc' ? 'desc' : 'asc') : defaultDir(k)
    setUrlParams({ sort: k === 'tag' ? null : k, dir: next === defaultDir(k) ? null : next, page: null })
  }
  const [q] = useUrlState('q', '')
  const setQ = (v: string) => setUrlParams({ q: v, page: null })
  const ql = q.trim().toLowerCase()
  const filtered = useMemo(
    () => sortAnimals(showSearch && ql ? rows.filter((a) => `${a.tag} ${a.stage} ${a.status}`.toLowerCase().includes(ql)) : rows, sort, dir),
    [rows, sort, dir, ql, showSearch],
  )
  const cols: [SortKey, string, boolean?][] = [
    ['tag', 'Brinco'], ['stage', 'Fase'], ['sex', 'Sexo'], ['age', 'Idade'], ['kg', 'Peso', true],
    thirdCol === 'pen' ? ['pen', 'Curral'] : ['parents', 'Pais'], ['status', 'Estado'],
  ]
  const { rows: page, pager } = usePaged(filtered, 25)
  return (
    <Card className="scroll-mt-24 overflow-hidden" {...(id ? { id } : {})}>
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-4">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
          <span className="text-[13px] text-muted">{plural(filtered.length, 'animal', 'animais')}</span>
        </div>
        {showSearch && (
          <label className="flex h-11 w-[220px] max-w-full items-center gap-2 rounded-xl border border-line-strong bg-white px-3">
            <Icon name="search" size={18} className="text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar neste curral" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
          </label>
        )}
      </div>
      {toolbar && <div className="flex flex-col gap-2.5 px-5 pb-4">{toolbar}</div>}
      <div className="no-scrollbar overflow-x-auto">
        <div className="min-w-[780px]">
          <div role="row" className={cx(GRID, 'bg-[#F7F7FB] py-1.5 text-[13px] text-muted')}>
            {cols.map(([k, l, right]) => {
              const on = sort === k
              return (
                <span key={k} role="columnheader" aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cx('flex min-w-0', right && 'justify-end')}>
                  <button type="button" onClick={() => toggleSort(k)} title={`Ordenar por ${l.toLowerCase()}`}
                    className={cx('group -mx-1.5 flex h-8 min-w-0 items-center gap-0.5 rounded-lg border-0 bg-transparent px-1.5 text-[13px] hover:bg-[#ECECF4] hover:text-ink',
                      right && 'flex-row-reverse', on ? 'font-semibold text-ink' : 'font-normal text-muted')}>
                    <span className="truncate">{l}</span>
                    <Icon name={on && dir === 'desc' ? 'arrow_downward' : 'arrow_upward'} size={15}
                      className={cx('shrink-0', on ? 'text-accent-strong' : 'opacity-0 group-hover:opacity-50')} />
                  </button>
                </span>
              )
            })}
            <span />
          </div>
          {!filtered.length && <div className="px-5 py-8 text-center text-muted">{emptyText}</div>}
          {page.map((a) => (
            <button key={a.id} type="button" onClick={() => nav(`/herd/animals/${encodeURIComponent(a.tag)}`)}
              className={cx(GRID, 'w-full border-0 border-t border-divider bg-white py-3 text-left text-sm text-ink hover:bg-[#FAFAFD]')}>
              <span className="tabular flex items-center gap-2 font-semibold"><span className="size-2 shrink-0 rounded-full" style={{ background: a.gc }} />{a.tag}</span>
              <span>{a.stage}</span>
              <span className="text-ink-2">{a.sex}</span>
              <span className="text-ink-2">{ageLabel(a.born_on)}</span>
              <span className="tabular text-right">{fmtKg(a.weight_kg)}</span>
              <span className="truncate text-ink-2">{thirdCol === 'pen' ? a.penName : a.parents || '—'}</span>
              <span className="min-w-0"><StatusChip a={a} /></span>
              <Icon name="chevron_right" size={18} className="text-[#B5B5C6]" />
            </button>
          ))}
        </div>
      </div>
      <Pager {...pager} />
    </Card>
  )
}

export const avgOf = (list: HA[]) => (list.length ? list.reduce((x, a) => x + a.weight_kg, 0) / list.length : 0)
export const avgLabel = (v: number) => (v ? `${v < 10 ? dec(v) : Math.round(v)} kg` : '—')
