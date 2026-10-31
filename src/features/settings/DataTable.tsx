import type { ReactNode } from 'react'
import { Card, Empty, IconButton, Pager, SearchInput, Select, usePaged, Button } from '@/ui'

export type Col<T> = { head: string; width: string; align?: 'right'; cell: (r: T) => ReactNode }

export function DataTable<T extends { id: string }>({
  title, sub, addLabel, onAdd, search, onSearch, filter, rows, cols, onEdit, onDelete, dim, emptyMsg, readOnly, minW = 640,
}: {
  title: string; sub?: string; addLabel?: string; onAdd?: () => void
  search: string; onSearch: (v: string) => void
  filter?: { value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[] }
  rows: T[]; cols: Col<T>[]; onEdit: (r: T) => void; onDelete?: (r: T) => void
  dim?: (r: T) => boolean; emptyMsg: string; readOnly: boolean; minW?: number
}) {
  const paged = usePaged(rows)
  const grid = `${cols.map((c) => c.width).join(' ')} ${readOnly ? '' : '84px'}`
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 className="m-0 text-base font-semibold">{title}</h2>
          {sub && <p className="m-0 mt-0.5 text-[13px] text-muted">{sub}</p>}
        </div>
        {!readOnly && onAdd && <Button variant="primary" icon="add" onClick={onAdd}>{addLabel}</Button>}
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-4">
        <SearchInput className="w-[280px] max-w-full" value={search} onChange={(v) => { onSearch(v); paged.reset() }} placeholder="Pesquisar" />
        {filter && (
          <Select className="!w-auto" value={filter.value} onChange={(e) => { filter.onChange(e.target.value); paged.reset() }}>
            {filter.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        )}
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: minW }}>
          <div className="grid gap-3 bg-[#F7F7FB] px-5 py-2.5 text-[13px] text-muted" style={{ gridTemplateColumns: grid }}>
            {cols.map((c) => <span key={c.head} className={c.align === 'right' ? 'text-right' : ''}>{c.head}</span>)}
            {!readOnly && <span />}
          </div>
          {!rows.length && <Empty icon="search_off" title={emptyMsg} />}
          {paged.rows.map((r) => (
            <div key={r.id} onClick={() => !readOnly && onEdit(r)}
              className={`grid items-center gap-3 border-t border-divider px-5 py-3 text-sm ${readOnly ? '' : 'cursor-pointer hover:bg-[#FAFAFD]'} ${dim?.(r) ? 'opacity-50' : ''}`}
              style={{ gridTemplateColumns: grid }}>
              {cols.map((c) => <div key={c.head} className={`min-w-0 ${c.align === 'right' ? 'flex justify-end text-right' : ''}`}>{c.cell(r)}</div>)}
              {!readOnly && (
                <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <IconButton icon="edit" label="Editar" size={34} iconSize={18} onClick={() => onEdit(r)} />
                  {onDelete && <IconButton icon="delete" label="Eliminar" size={34} iconSize={18} className="hover:!bg-danger-soft hover:!text-danger" onClick={() => onDelete(r)} />}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <Pager {...paged.pager} />
    </Card>
  )
}
