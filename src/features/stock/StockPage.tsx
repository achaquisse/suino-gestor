import { useMemo, useState } from 'react'
import { useFarm } from '@/app/farm'
import type { StockItem } from '@/lib/database.types'
import { dShort, money } from '@/lib/format'
import { useParam, useStock, useStockMovements } from '@/lib/queries'
import { setUrlParams, useUrlState } from '@/lib/urlState'
import { Button, Card, Chip, Empty, ErrorState, IconButton, Loading, PageHeader, Pager, Progress, SearchInput, Select, Stat, Tabs, usePaged } from '@/ui'
import { expiryDays, isExpiring, isLow, qf, qtyLabel } from './model'
import { blankDraft, draftOf, ItemFormSheet, ItemSheet, MovementRow, MoveSheet, type MoveTarget } from './sheets'

type Tab = 'artigos' | 'movimentos'
type ItemFilter = 'all' | 'low' | 'expiring' | 'inactive'
type MoveFilter = 'all' | 'in' | 'out'

export default function StockPage() {
  const { isOwner, canEditHerd, canSeeMoney } = useFarm()
  const stock = useStock()
  const notice = useParam('expiry_notice_days', 30)
  const [tab] = useUrlState<Tab>('tab', 'artigos', ['artigos', 'movimentos'])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [move, setMove] = useState<MoveTarget | null>(null)
  const [form, setForm] = useState<ReturnType<typeof blankDraft> | null>(null)

  const all = useMemo(() => stock.data ?? [], [stock.data])
  const active = useMemo(() => all.filter((s) => s.active), [all])
  const detail = all.find((s) => s.id === detailId) ?? null

  if (stock.isLoading) return <Loading />
  if (stock.error) return <ErrorState error={stock.error} retry={() => stock.refetch()} />

  const low = active.filter(isLow).length
  const expiring = active.filter((s) => isExpiring(s, notice)).length
  const value = active.reduce((sum, s) => sum + (s.unit_price ?? 0) * s.qty, 0)
  const openMove = (t: MoveTarget) => setMove(t)
  const changeTab = (t: Tab) => setUrlParams({ tab: t === 'artigos' ? null : t, q: null, itemsPage: null, movesPage: null })

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Stock" sub="Artigos, entradas, saídas e contagens"
        right={<>
          {canEditHerd && <Button icon="swap_vert" variant={isOwner ? 'secondary' : 'primary'} disabled={!active.length} onClick={() => openMove({ item: null, kind: 'in' })}>Registar movimento</Button>}
          {isOwner && <Button icon="add" variant="primary" onClick={() => setForm(blankDraft())}>Registar artigo</Button>}
        </>} />

      <div className="grid grid-cols-2 gap-3 wide:grid-cols-4">
        <Stat label="Artigos activos" value={active.length} icon="inventory_2" tint="#EEECFE" ink="#4B3CD6" delay={0} />
        <Stat label="Stock baixo" value={low} valueColor={low ? 'var(--color-danger)' : undefined} icon="trending_down" tint="#FDECEA" ink="#C0302A" delay={40} />
        <Stat label="A expirar" value={expiring} sub={`Nos próximos ${notice} dias`} icon="event_busy" tint="#FDF1E2" ink="#A2601A" delay={80} />
        {canSeeMoney
          ? <Stat label="Valor em stock" value={money(value)} sub="Pelo preço por unidade" icon="payments" tint="#E6F6EE" ink="#0F7A44" delay={120} />
          : <Stat label="Inactivos" value={all.length - active.length} icon="block" tint="#F0F0F6" ink="#55556A" delay={120} />}
      </div>

      <Tabs options={[['artigos', 'Artigos', 'inventory_2'], ['movimentos', 'Movimentos', 'history']] as const} value={tab} onChange={changeTab} />

      {tab === 'artigos'
        ? <ItemsCard items={all} notice={notice} canMove={canEditHerd} onOpen={(s) => setDetailId(s.id)} onMove={openMove}
            onAdd={isOwner ? () => setForm(blankDraft()) : undefined} />
        : <MovementsCard items={all} />}

      <ItemSheet item={move || form ? null : detail} onClose={() => setDetailId(null)} onMove={openMove} onEdit={(s) => setForm(draftOf(s))} />
      <MoveSheet target={move} items={active} onClose={() => setMove(null)} />
      <ItemFormSheet draft={form} item={form?.id ? all.find((s) => s.id === form.id) : null} onClose={() => setForm(null)} />
    </div>
  )
}

function ItemsCard({ items, notice, canMove, onOpen, onMove, onAdd }: {
  items: StockItem[]; notice: number; canMove: boolean
  onOpen: (s: StockItem) => void; onMove: (t: MoveTarget) => void; onAdd?: () => void
}) {
  const [q, setQ] = useUrlState('q', '')
  const [filter, setFilter] = useUrlState<ItemFilter>('estado', 'all', ['all', 'low', 'expiring', 'inactive'])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items
      .filter((s) => filter === 'inactive' ? !s.active : s.active)
      .filter((s) => filter !== 'low' || isLow(s))
      .filter((s) => filter !== 'expiring' || isExpiring(s, notice))
      .filter((s) => !needle || `${s.code} ${s.name} ${s.category}`.toLowerCase().includes(needle))
  }, [items, q, filter, notice])
  const paged = usePaged(rows, 25, 'items')

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap gap-2 px-5 pt-5 pb-4">
        <SearchInput className="w-[280px] max-w-full" value={q} onChange={(v) => { setQ(v); paged.reset() }} placeholder="Pesquisar artigo" />
        <Select className="!w-auto" value={filter} onChange={(e) => { setFilter(e.target.value as ItemFilter); paged.reset() }}>
          <option value="all">Todos os activos</option>
          <option value="low">Stock baixo</option>
          <option value="expiring">A expirar</option>
          <option value="inactive">Inactivos</option>
        </Select>
      </div>
      {!rows.length && (items.length
        ? <Empty icon="search_off" title="Nenhum artigo encontrado" />
        : <Empty icon="inventory_2" title="Ainda não há artigos" sub="Registe ração, medicamentos e outros materiais para acompanhar o stock."
            action={onAdd && <Button size="sm" variant="primary" icon="add" onClick={onAdd}>Registar artigo</Button>} />)}
      {paged.rows.map((s) => {
        const lowNow = isLow(s)
        const exp = expiryDays(s)
        return (
          <div key={s.id} role="button" tabIndex={0} onClick={() => onOpen(s)} onKeyDown={(e) => e.key === 'Enter' && onOpen(s)}
            className={`flex cursor-pointer items-center gap-3 border-t border-divider px-5 py-3 hover:bg-[#FAFAFD] ${s.active ? '' : 'opacity-55'}`}>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold">{s.name}</span>
                <span className="tabular shrink-0 text-sm font-semibold" style={{ color: lowNow ? 'var(--color-danger)' : undefined }}>{qtyLabel(s.qty, s)}</span>
              </div>
              <Progress value={s.max_qty ? Math.min(100, (s.qty / s.max_qty) * 100) : 0} color={lowNow ? 'var(--color-danger)' : 'var(--color-accent)'} height={4} />
              <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                <span className="truncate">{s.category} · mín. {qf(s.low_qty)}</span>
                {lowNow && <Chip tone="red">Baixo</Chip>}
                {isExpiring(s, notice) && <Chip tone="amber">{exp! < 0 ? 'Expirado' : `Expira ${dShort(s.expires_on!)}`}</Chip>}
              </div>
            </div>
            {canMove && s.active && (
              <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                <IconButton icon="add" label={`Entrada de ${s.name}`} size={36} iconSize={20} className="bg-[#E6F6EE] !text-[#0F7A44]" onClick={() => onMove({ item: s, kind: 'in' })} />
                <IconButton icon="remove" label={`Saída de ${s.name}`} size={36} iconSize={20} className="bg-[#FDECEA] !text-[#C0302A]" disabled={s.qty <= 0} onClick={() => onMove({ item: s, kind: 'out' })} />
              </div>
            )}
          </div>
        )
      })}
      <Pager {...paged.pager} />
    </Card>
  )
}

function MovementsCard({ items }: { items: StockItem[] }) {
  const [itemId, setItemId] = useUrlState('artigo', '')
  const [dir, setDir] = useUrlState<MoveFilter>('tipo', 'all', ['all', 'in', 'out'])
  const [q, setQ] = useUrlState('q', '')
  const moves = useStockMovements(itemId || undefined)
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (moves.data ?? [])
      .filter((m) => dir === 'all' || (dir === 'in' ? m.delta > 0 : m.delta < 0))
      .filter((m) => !needle || `${byId.get(m.item_id)?.name ?? ''} ${m.reason} ${m.note} ${m.created_by_name}`.toLowerCase().includes(needle))
  }, [moves.data, dir, q, byId])
  const paged = usePaged(rows, 25, 'moves')

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap gap-2 px-5 pt-5 pb-4">
        <SearchInput className="w-[240px] max-w-full" value={q} onChange={(v) => { setQ(v); paged.reset() }} placeholder="Pesquisar motivo, nota..." />
        <Select className="!w-auto max-w-full" value={itemId} onChange={(e) => { setItemId(e.target.value); paged.reset() }}>
          <option value="">Todos os artigos</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </Select>
        <Select className="!w-auto" value={dir} onChange={(e) => { setDir(e.target.value as MoveFilter); paged.reset() }}>
          <option value="all">Entradas e saídas</option>
          <option value="in">Só entradas</option>
          <option value="out">Só saídas</option>
        </Select>
      </div>
      {moves.isLoading && <Loading />}
      {moves.error && <div className="px-5 pb-4"><ErrorState error={moves.error} retry={() => moves.refetch()} /></div>}
      {moves.data && !rows.length && <Empty icon="history" title="Sem movimentos" sub="As entradas, saídas, compras, tratamentos e contagens aparecem aqui." />}
      {paged.rows.map((m) => <MovementRow key={m.id} m={m} item={byId.get(m.item_id)} showItem />)}
      <Pager {...paged.pager} />
    </Card>
  )
}
