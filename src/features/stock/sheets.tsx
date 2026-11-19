import { useState } from 'react'
import { useFarm } from '@/app/farm'
import type { StockItem, StockMovement } from '@/lib/database.types'
import { dLong, dShort, money, numP, todayISO, validDate } from '@/lib/format'
import { useAccounts, useCategories, useParam, useRpc, useStockMovements, useTableMutations } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { Button, Chip, ConfirmSheet, Empty, Field, FormError, Icon, IconTile, Input, Progress, Segmented, Select, Sheet, Spinner, Toggle, useToast } from '@/ui'
import { expiryDays, isExpiring, isLow, KIND_LABEL, movementStyle, qf, qtyLabel, REASONS, unitFor, type MoveKind } from './model'

/* ---------------------------------------------------------------- Item form (owner) */

type Draft = { id?: string; name: string; category: string; qty: string; max_qty: string; low_qty: string; unit_price: string; shelf_life_days: string; active: boolean }
const blank: Draft = { name: '', category: '', qty: '0', max_qty: '10', low_qty: '1', unit_price: '', shelf_life_days: '', active: true }

export const draftOf = (s: StockItem): Draft => ({
  id: s.id, name: s.name, category: s.category, qty: String(s.qty),
  max_qty: String(s.max_qty), low_qty: String(s.low_qty), unit_price: s.unit_price == null ? '' : String(s.unit_price),
  shelf_life_days: s.shelf_life_days == null ? '' : String(s.shelf_life_days), active: s.active,
})
export const blankDraft = () => ({ ...blank })

type Units = Pick<StockItem, 'unit' | 'unit_singular'>

/** A quantity input with its unit shown read-only after it, in singular or plural. */
function QtyInput({ value, onChange, units, readOnly }: { value: string; onChange?: (v: string) => void; units: Units | null; readOnly?: boolean }) {
  const n = numP(value)
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Input type="number" min="0" step="any" inputMode="decimal" value={value} readOnly={readOnly} aria-readonly={readOnly || undefined}
        onChange={(e) => onChange?.(e.target.value)} className={readOnly ? 'cursor-default bg-hover text-muted' : undefined} />
      {units && <span className="shrink-0 text-sm text-muted">{unitFor(Number.isFinite(n) ? n : 0, units)}</span>}
    </div>
  )
}

export function ItemFormSheet({ draft, item, onClose }: { draft: Draft | null; item?: StockItem | null; onClose: () => void }) {
  const all = (useCategories().data ?? []).filter((c) => c.active && (c.grp === 'Investimento' || c.grp === 'Operacional'))
  // Units are set per category by the super admin; only categories with a unit can hold stock.
  const cats = all.filter((c) => c.quantity_unit.trim())
  const { insert, update } = useTableMutations('stock_items')
  const toast = useToast()
  const [d, setD] = useState<Draft>(draft ?? blank)
  const [seen, setSeen] = useState(draft)
  const [error, setError] = useState('')
  if (seen !== draft) { setSeen(draft); setD(draft ?? blank); setError('') }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }))
  const editing = !!d.id
  const category = d.category || cats[0]?.name || ''
  const cat = cats.find((c) => c.name === category)
  // An existing item keeps its own unit until its category changes.
  const units: Units | null = editing && item && item.category === category
    ? item
    : cat ? { unit: cat.quantity_unit, unit_singular: cat.quantity_unit_singular || cat.quantity_unit } : null

  const submit = async () => {
    if (!d.name.trim()) return setError('Indique o nome do artigo.')
    if (!cat && !(editing && item?.category === category)) return setError('Escolha uma categoria com unidade definida.')
    const qty = numP(d.qty), max_qty = numP(d.max_qty), low_qty = numP(d.low_qty), unit_price = d.unit_price.trim() ? numP(d.unit_price) : null
    if (![qty, max_qty, low_qty].every((v) => Number.isFinite(v) && v >= 0) || (unit_price != null && !(unit_price >= 0))) return setError('Indique valores numéricos não negativos.')
    if (low_qty > max_qty) return setError('O limite mínimo não pode exceder o máximo.')
    const shelf = d.shelf_life_days.trim() ? numP(d.shelf_life_days) : null
    if (shelf != null && !(Number.isInteger(shelf) && shelf > 0)) return setError('Indique a validade em dias inteiros, maior que zero.')
    // Code and unit are filled in by the database (code from the name, unit from the category).
    const row = { name: d.name.trim(), category, max_qty, low_qty, unit_price, shelf_life_days: shelf, active: d.active }
    try {
      // The quantity of an existing item changes only through movements, so the history stays complete.
      if (editing) await update.mutateAsync({ id: d.id!, ...row })
      else await insert.mutateAsync({ ...row, qty })
      toast(editing ? 'Artigo actualizado' : 'Artigo registado')
      onClose()
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <Sheet open={!!draft} onClose={onClose} title={editing ? 'Editar artigo' : 'Registar artigo'} maxWidth={480}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={insert.isPending || update.isPending} onClick={submit}>Guardar</Button></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Nome"><Input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Ração de crescimento" autoFocus={!editing} /></Field>
        <Field label="Categoria" hint={all.length > cats.length ? 'Só aparecem as categorias com unidade definida na administração.' : undefined}>
          <Select value={category} onChange={(e) => set('category', e.target.value)}>
            {!cats.length && <option value="">Sem categorias com unidade</option>}
            {editing && item && !cats.some((c) => c.name === item.category) && <option value={item.category}>{item.category}</option>}
            {cats.map((c) => <option key={c.id} value={c.name}>{c.name} · {c.quantity_unit}</option>)}
          </Select>
        </Field>
        <Field label={`Preço por ${units?.unit_singular || 'unidade'} (MT)`}>
          <Input type="number" min="0" step="any" inputMode="decimal" value={d.unit_price} onChange={(e) => set('unit_price', e.target.value)} />
        </Field>
        {editing
          ? <Field label="Quantidade" hint="Altere com uma entrada, saída ou contagem"><QtyInput value={d.qty} units={units} readOnly /></Field>
          : <Field label="Quantidade inicial"><QtyInput value={d.qty} onChange={(v) => set('qty', v)} units={units} /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mínimo"><QtyInput value={d.low_qty} onChange={(v) => set('low_qty', v)} units={units} /></Field>
          <Field label="Máximo"><QtyInput value={d.max_qty} onChange={(v) => set('max_qty', v)} units={units} /></Field>
        </div>
        <Field label="Validade após a compra" hint="Deixe vazio se o artigo não expira.">
          <div className="flex min-w-0 items-center gap-2">
            <Input type="number" min="1" step="1" inputMode="numeric" value={d.shelf_life_days} onChange={(e) => set('shelf_life_days', e.target.value)} placeholder="Ex.: 90" />
            <span className="shrink-0 text-sm text-muted">{numP(d.shelf_life_days) === 1 ? 'dia' : 'dias'}</span>
          </div>
        </Field>
        {editing && <div className="flex items-center justify-between"><span className="text-sm">Activo</span><Toggle checked={d.active} onChange={(v) => set('active', v)} label="Activo" /></div>}
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

/* ---------------------------------------------------------------- Entry / exit / count */

export type MoveTarget = { item: StockItem | null; kind: MoveKind }

export function MoveSheet({ target, items, onClose, onDone }: { target: MoveTarget | null; items: StockItem[]; onClose: () => void; onDone?: (item: StockItem) => void }) {
  const { isOwner } = useFarm()
  const accounts = (useAccounts().data ?? []).filter((a) => a.active)
  const move = useRpc('move_stock')
  const count = useRpc('count_stock')
  const toast = useToast()
  // Purchases create an expense, which only the owner can record.
  const inReasons = REASONS.in.filter((r) => isOwner || r !== 'Compra')
  const reasonsOf = (k: 'in' | 'out'): readonly string[] => (k === 'in' ? inReasons : REASONS.out)
  const [seen, setSeen] = useState<MoveTarget | null>(null)
  const [kind, setKind] = useState<MoveKind>('in')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState<string>(inReasons[0])
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  // Unit price for this entry; starts at the item's default price and can differ per purchase.
  const [pricePick, setPricePick] = useState<{ itemId: string; text: string } | null>(null)
  const [accountId, setAccountId] = useState('')
  const [supplier, setSupplier] = useState('')
  const [error, setError] = useState('')
  if (target !== seen) {
    setSeen(target)
    if (target) {
      setKind(target.kind); setItemId(target.item?.id ?? items[0]?.id ?? ''); setQty('')
      setReason(reasonsOf(target.kind === 'out' ? 'out' : 'in')[0]); setDate(todayISO()); setNote(''); setError('')
      setPricePick(null); setSupplier('')
    }
  }
  const item = items.find((i) => i.id === itemId) ?? null
  const purchase = kind === 'in' && reason === 'Compra'
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0] ?? null
  const n = numP(qty)
  const valid = Number.isFinite(n) && (kind === 'count' ? n >= 0 : n > 0)
  const after = !item || !valid ? null : kind === 'in' ? item.qty + n : kind === 'out' ? item.qty - n : n
  const defaultPrice = item?.unit_price ?? null
  const priceText = pricePick && pricePick.itemId === itemId ? pricePick.text : defaultPrice != null ? String(defaultPrice) : ''
  const unitPrice = Math.round(numP(priceText) * 100) / 100
  const amount = valid && unitPrice > 0 ? Math.round(n * unitPrice * 100) / 100 : 0
  const priceChanged = defaultPrice != null && unitPrice > 0 && unitPrice !== defaultPrice
  const changeKind = (k: MoveKind) => { setKind(k); setError(''); if (k !== 'count') setReason(reasonsOf(k)[0]) }

  const submit = async () => {
    if (!item) return setError('Escolha o artigo.')
    if (!valid) return setError(kind === 'count' ? 'Indique a quantidade contada.' : 'Indique uma quantidade maior que zero.')
    if (!validDate(date) || date > todayISO()) return setError('Indique uma data válida, até hoje.')
    if (kind === 'out' && n > item.qty) return setError(`Quantidade insuficiente: há apenas ${qtyLabel(item.qty, item)} em stock.`)
    if (purchase && !(Number.isFinite(unitPrice) && unitPrice > 0)) return setError('Indique o preço por unidade desta compra.')
    if (purchase && !(amount > 0)) return setError('Indique o preço da compra.')
    if (purchase && !account) return setError('Escolha a conta que paga a compra.')
    try {
      const args = { p_item: item.id, p_note: note.trim(), p_date: date }
      const newQty = kind === 'count'
        ? await count.mutateAsync({ ...args, p_count: n })
        : await move.mutateAsync({ ...args, p_kind: kind, p_qty: n, p_reason: reason,
          ...(purchase ? { p_price: amount, p_account: account!.id, p_supplier: supplier.trim() } : {}) })
      toast(purchase
        ? `Compra registada · ${item.name}: ${qtyLabel(Number(newQty), item)} · despesa de ${money(amount)}`
        : `${KIND_LABEL[kind]} registada · ${item.name}: ${qtyLabel(Number(newQty), item)}`)
      onClose()
      onDone?.({ ...item, qty: Number(newQty) })
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <Sheet open={!!target} onClose={onClose} title="Registar movimento" maxWidth={460}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={move.isPending || count.isPending} onClick={submit}>Registar</Button></>}>
      <div className="flex flex-col gap-3.5">
        <Segmented className="self-start" options={[['in', 'Entrada'], ['out', 'Saída'], ['count', 'Contagem']] as const} value={kind} onChange={changeKind} />
        <Field label="Artigo">
          <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {!items.length && <option value="">Sem artigos activos</option>}
            {items.map((i) => <option key={i.id} value={i.id}>{i.name} · {qtyLabel(i.qty, i)}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={kind === 'count' ? `Quantidade contada${item ? ` (${item.unit})` : ''}` : `Quantidade${item ? ` (${item.unit})` : ''}`}>
            <Input type="number" min="0" step="any" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          </Field>
          {kind === 'count'
            ? <Field label="Data"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            : <Field label="Motivo"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{reasonsOf(kind).map((r) => <option key={r}>{r}</option>)}</Select></Field>}
        </div>
        {purchase && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Preço por ${item?.unit_singular || item?.unit || 'unidade'} (MT)`}
                hint={defaultPrice == null ? 'Artigo sem preço padrão' : priceChanged ? `Padrão: ${money(defaultPrice)}` : 'Preço padrão do artigo'}
                right={priceChanged ? <button type="button" className="border-0 bg-transparent p-0 text-xs font-semibold text-accent hover:underline" onClick={() => setPricePick(null)}>Repor</button> : undefined}>
                <Input type="number" min="0" step="any" inputMode="decimal" value={priceText} onChange={(e) => setPricePick({ itemId, text: e.target.value })} />
              </Field>
              <Field label="Conta">
                <Select value={account?.id ?? ''} onChange={(e) => setAccountId(e.target.value)}>
                  {!accounts.length && <option value="">Sem contas activas</option>}
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Fornecedor"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Opcional" /></Field>
          </>
        )}
        {kind !== 'count' && <Field label="Data"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>}
        <Field label="Nota"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'count' ? 'Inventário mensal' : 'Opcional'} /></Field>
        {item && (
          <div className="flex items-center justify-between gap-3 rounded-[13px] bg-sunken px-3.5 py-3 text-sm">
            <span className="text-muted">Em stock</span>
            <span className="tabular font-semibold">
              {qtyLabel(item.qty, item)}
              {after != null && <> → <span style={{ color: after < 0 ? 'var(--color-danger)' : undefined }}>{qtyLabel(after, item)}</span></>}
            </span>
          </div>
        )}
        {purchase && (
          <div className="flex items-center justify-between gap-3 rounded-[13px] bg-sunken px-3.5 py-3 text-sm">
            <span className="text-muted">Total da compra{valid && unitPrice > 0 ? ` · ${qf(n)} × ${money(unitPrice)}` : ''}</span>
            <span className="tabular font-semibold">{amount > 0 ? `−${money(amount)}` : '—'}</span>
          </div>
        )}
        {purchase && <p className="m-0 flex items-start gap-2 text-[13px] text-muted"><Icon name="receipt_long" size={18} className="shrink-0" />É registada uma despesa de compra em Despesas, na categoria {item?.category ?? 'do artigo'}.</p>}
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

/* ---------------------------------------------------------------- Movement row */

export function MovementRow({ m, item, showItem }: { m: StockMovement; item?: StockItem; showItem?: boolean }) {
  const st = movementStyle(m)
  const unit = item ? unitFor(Math.abs(m.delta), item) : ''
  return (
    <div className="flex items-start gap-3 border-t border-divider px-5 py-3">
      <IconTile icon={st.icon} bg={st.bg} fg={st.fg} size={34} iconSize={18} className="mt-0.5 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium">{showItem ? item?.name ?? 'Artigo removido' : m.reason}</span>
          <span className="tabular shrink-0 font-semibold" style={{ color: m.delta > 0 ? '#0F7A44' : '#C0302A' }}>{m.delta > 0 ? '+' : '−'}{qf(Math.abs(m.delta))} {unit}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-[13px] text-muted">
          <span className="min-w-0 truncate">{[dShort(m.moved_on), showItem && m.reason, m.created_by_name, m.note].filter(Boolean).join(' · ')}</span>
          <span className="tabular shrink-0">Saldo {qf(m.qty_after)}</span>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Item detail + history */

export function ItemSheet({ item, onClose, onMove, onEdit }: {
  item: StockItem | null; onClose: () => void; onMove: (t: MoveTarget) => void; onEdit: (s: StockItem) => void
}) {
  const { isOwner, canEditHerd, canSeeMoney } = useFarm()
  const notice = useParam('expiry_notice_days', 30)
  const moves = useStockMovements(item?.id)
  const { update } = useTableMutations('stock_items')
  const toast = useToast()
  const [confirmOff, setConfirmOff] = useState(false)
  if (!item) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>

  const low = isLow(item)
  const exp = expiryDays(item)
  const facts: [string, string][] = [
    ['Categoria', item.category],
    ['Mínimo / máximo', `${qf(item.low_qty)} / ${qf(item.max_qty)} ${unitFor(item.max_qty, item)}`],
    ...(canSeeMoney && item.unit_price != null ? [[`Preço por ${item.unit_singular || item.unit}`, money(item.unit_price)], ['Valor em stock', money(item.qty * item.unit_price)]] as [string, string][] : []),
    ['Validade', item.shelf_life_days ? `${item.shelf_life_days} ${item.shelf_life_days === 1 ? 'dia' : 'dias'} após a compra` : 'Não expira'],
    ...(item.expires_on ? [['Expira', dLong(item.expires_on)]] as [string, string][] : []),
  ]
  const setActive = (active: boolean) => update.mutate({ id: item.id, active }, {
    onSuccess: () => { toast(active ? 'Artigo reactivado' : 'Artigo desactivado'); setConfirmOff(false); onClose() },
    onError: (e) => toast(errorMessage(e), 'error'),
  })

  return (
    <>
      <Sheet open onClose={onClose} title={item.name} maxWidth={560}>
        <div className="-mx-5 flex flex-col">
          <div className="flex flex-col gap-3 px-5 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-muted">{item.category}</span>
              {!item.active && <Chip>Inactivo</Chip>}
              {low && <Chip tone="red" icon="trending_down">Stock baixo</Chip>}
              {isExpiring(item, notice) && <Chip tone="amber" icon="event_busy">{exp! < 0 ? 'Expirado' : `Expira em ${exp} d`}</Chip>}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="tabular text-[32px] font-semibold tracking-tight" style={{ color: low ? 'var(--color-danger)' : undefined }}>{qf(item.qty)}</span>
              <span className="text-muted">{unitFor(item.qty, item)} em stock</span>
            </div>
            <Progress value={item.max_qty ? Math.min(100, (item.qty / item.max_qty) * 100) : 0} color={low ? 'var(--color-danger)' : 'var(--color-accent)'} height={6} />
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {facts.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-[12px] text-muted">{k}</dt><dd className="m-0 truncate font-medium">{v}</dd></div>)}
            </dl>
            {item.note && <p className="m-0 text-[13px] text-muted">{item.note}</p>}
            {item.active && canEditHerd && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon="add" onClick={() => onMove({ item, kind: 'in' })}>Entrada</Button>
                <Button size="sm" icon="remove" onClick={() => onMove({ item, kind: 'out' })} disabled={item.qty <= 0}>Saída</Button>
                <Button size="sm" icon="fact_check" onClick={() => onMove({ item, kind: 'count' })}>Contagem</Button>
              </div>
            )}
            {isOwner && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" icon="edit" onClick={() => onEdit(item)}>Editar artigo</Button>
                {item.active
                  ? <Button size="sm" variant="ghost" icon="block" className="!text-danger" onClick={() => setConfirmOff(true)}>Desactivar</Button>
                  : <Button size="sm" variant="ghost" icon="restart_alt" loading={update.isPending} onClick={() => setActive(true)}>Reactivar</Button>}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <h3 className="m-0 text-[15px] font-semibold">Histórico de movimentos</h3>
            {moves.isFetching && <Spinner size={14} />}
          </div>
          {moves.error && <div className="px-5 pb-3 text-sm text-danger">{errorMessage(moves.error)}</div>}
          {moves.data && !moves.data.length && <Empty icon="history" title="Sem movimentos" sub="As entradas, saídas e contagens deste artigo aparecem aqui." />}
          {moves.data?.map((m) => <MovementRow key={m.id} m={m} item={item} />)}
        </div>
      </Sheet>
      <ConfirmSheet open={confirmOff} onClose={() => setConfirmOff(false)} danger title="Desactivar artigo" confirmLabel="Desactivar" loading={update.isPending}
        message={`${item.name} deixa de aparecer nos novos movimentos e alertas. O histórico mantém-se.`} onConfirm={() => setActive(false)} />
    </>
  )
}
