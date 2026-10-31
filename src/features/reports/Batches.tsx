import { useState } from 'react'
import { Card, Icon, Pager, Progress, usePaged } from '@/ui'
import { GREEN, MUTED, RED } from '@/lib/constants'
import type { BatchResult } from '@/lib/database.types'
import { fmt, sgn } from '@/lib/format'

const grid = 'grid grid-cols-[1.3fr_1fr_0.6fr_1fr_1fr_1fr_1.3fr] gap-3 px-5'

export function Batches({ rows }: { rows: BatchResult[] }) {
  const [q, setQ] = useState('')
  const lq = q.trim().toLowerCase()
  const list = rows.filter((l) => !lq || `${l.code} ${l.phase}`.toLowerCase().includes(lq))
  const { rows: pageRows, pager } = usePaged(list, 5)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-4">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-[15px] font-semibold">Resultados por lote</h2>
          <span className="text-[13px] text-muted">{list.length}</span>
        </div>
        <label className="flex h-11 w-60 max-w-full items-center gap-2 rounded-xl border border-line-strong bg-white px-3">
          <Icon name="search" size={18} className="text-faint" />
          <input value={q} onChange={(e) => { setQ(e.target.value); pager.setPage(1) }} placeholder="Pesquisar lote ou fase" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className={`${grid} bg-[#F7F7FB] py-2.5 text-[13px] text-muted`}>
            <span>Lote</span><span>Fase</span><span className="text-right">Animais</span><span className="text-right">Custo</span><span className="text-right">Receita</span><span className="text-right">Resultado</span><span>Recuperação do custo</span>
          </div>
          {!list.length && <div className="px-5 py-6 text-center text-muted">Nenhum lote encontrado.</div>}
          {pageRows.map((l) => {
            const res = l.revenue - l.cost
            const rec = l.cost ? (l.revenue / l.cost) * 100 : 0
            const bar = l.active ? 'linear-gradient(180deg,#7A6BFF,#5B4CF0)' : rec >= 100 ? GREEN : '#E8A23A'
            return (
              <div key={l.id} className={`${grid} tabular items-center border-t border-divider py-3 text-sm`}>
                <span className="font-semibold">{l.code}</span>
                <span>
                  <span className="rounded-full px-[9px] py-[3px] text-xs font-medium" style={{ background: l.active ? '#EEECFE' : '#F0F0F6', color: l.active ? '#4B3CD6' : '#55556A' }}>{l.phase}</span>
                </span>
                <span className="text-right">{l.head_count}</span>
                <span className="text-right">{fmt(l.cost)}</span>
                <span className="text-right">{fmt(l.revenue)}</span>
                <span className="text-right font-semibold" style={{ color: res < 0 ? (l.active ? MUTED : RED) : GREEN }}>{sgn(res)}</span>
                <span className="flex items-center gap-2">
                  <Progress className="flex-1" value={Math.min(100, rec)} color={bar} />
                  <span className="w-10 text-right text-xs" style={{ color: l.active ? MUTED : rec >= 100 ? GREEN : '#C77A1A' }}>{Math.round(rec)}%</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <Pager {...pager} options={[5, 10, 25]} />
    </Card>
  )
}
