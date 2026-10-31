import { useState } from 'react'
import { useFarm } from '@/app/farm'
import type { StockItem } from '@/lib/database.types'
import { numP, validDate } from '@/lib/format'
import { useCategories, useStock, useTableMutations } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { useUrlState } from '@/lib/urlState'
import { Button, ConfirmSheet, ErrorState, Field, FormError, Input, Loading, Select, Sheet, Toggle, useToast } from '@/ui'
import { DataTable, type Col } from './DataTable'

type Draft = { id?: string; code: string; name: string; category: string; unit: string; qty: string; max_qty: string; low_qty: string; unit_price: string; expires_on: string; note: string; active: boolean }
const blank: Draft = { code: '', name: '', category: '', unit: '', qty: '0', max_qty: '10', low_qty: '1', unit_price: '', expires_on: '', note: '', active: true }

function StockSheet({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const cats = (useCategories().data ?? []).filter((c) => c.active && (c.grp === 'Investimento' || c.grp === 'Operacional'))
  const { insert, update } = useTableMutations('stock_items')
  const toast = useToast()
  const [d, setD] = useState<Draft>(draft ?? blank)
  const [seen, setSeen] = useState(draft)
  const [error, setError] = useState('')
  if (seen !== draft) { setSeen(draft); setD(draft ?? blank); setError('') }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }))
  const category = d.category || cats[0]?.name || ''
  const submit = async () => {
    if (!d.code.trim() || !d.name.trim() || !d.unit.trim()) return setError('Indique código, nome e unidade.')
    if (!category || !cats.some((c) => c.name === category)) return setError('Escolha uma categoria activa.')
    const qty = numP(d.qty), max_qty = numP(d.max_qty), low_qty = numP(d.low_qty), unit_price = d.unit_price.trim() ? numP(d.unit_price) : null
    if (![qty, max_qty, low_qty].every((v) => Number.isFinite(v) && v >= 0) || (unit_price != null && !(unit_price >= 0))) return setError('Indique valores numéricos não negativos.')
    if (low_qty > max_qty) return setError('O limite mínimo não pode exceder o máximo.')
    if (d.expires_on && !validDate(d.expires_on)) return setError('Indique uma data de validade válida.')
    const row = { code: d.code.trim(), name: d.name.trim(), category, unit: d.unit.trim(), qty, max_qty, low_qty,
      unit_price, expires_on: d.expires_on || null, note: d.note.trim(), active: d.active }
    try {
      if (d.id) await update.mutateAsync({ id: d.id, ...row })
      else await insert.mutateAsync(row)
      toast(d.id ? 'Artigo actualizado' : 'Artigo criado')
      onClose()
    } catch (e) { setError(errorMessage(e)) }
  }
  return <Sheet open={!!draft} onClose={onClose} title={d.id ? 'Editar artigo de stock' : 'Novo artigo de stock'} maxWidth={460}
    footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={insert.isPending || update.isPending} onClick={submit}>Guardar</Button></>}>
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3"><Field label="Código"><Input value={d.code} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label="Nome"><Input value={d.name} onChange={(e) => set('name', e.target.value)} /></Field></div>
      <Field label="Categoria"><Select value={category} onChange={(e) => set('category', e.target.value)}>
        {!cats.length && <option value="">Sem categorias disponíveis</option>}
        {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
      </Select></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Unidade"><Input value={d.unit} onChange={(e) => set('unit', e.target.value)} placeholder="sacos, doses, L..." /></Field>
        <Field label="Preço por unidade (MT)"><Input inputMode="decimal" value={d.unit_price} onChange={(e) => set('unit_price', e.target.value)} /></Field></div>
      <div className="grid grid-cols-3 gap-3"><Field label="Quantidade"><Input inputMode="decimal" value={d.qty} onChange={(e) => set('qty', e.target.value)} /></Field>
        <Field label="Máximo"><Input inputMode="decimal" value={d.max_qty} onChange={(e) => set('max_qty', e.target.value)} /></Field>
        <Field label="Mínimo"><Input inputMode="decimal" value={d.low_qty} onChange={(e) => set('low_qty', e.target.value)} /></Field></div>
      <Field label="Validade"><Input type="date" value={d.expires_on} onChange={(e) => set('expires_on', e.target.value)} /></Field>
      <Field label="Nota"><Input value={d.note} onChange={(e) => set('note', e.target.value)} /></Field>
      <div className="flex items-center justify-between"><span className="text-sm">Activo</span><Toggle checked={d.active} onChange={(v) => set('active', v)} label="Activo" /></div>
      <FormError>{error}</FormError>
    </div>
  </Sheet>
}

export default function StockTab() {
  const { isOwner } = useFarm()
  const stock = useStock()
  const { update } = useTableMutations('stock_items')
  const toast = useToast()
  const [q, setQ] = useUrlState('q', '')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [off, setOff] = useState<StockItem | null>(null)
  if (stock.isLoading) return <Loading />
  if (stock.error) return <ErrorState error={stock.error} retry={() => stock.refetch()} />
  const rows = (stock.data ?? []).filter((s) => `${s.code} ${s.name} ${s.category}`.toLowerCase().includes(q.toLowerCase()))
  const cols: Col<StockItem>[] = [
    { head: 'Artigo', width: 'minmax(180px,1fr)', cell: (s) => <span className="font-semibold">{s.name} · {s.code}</span> },
    { head: 'Categoria', width: '150px', cell: (s) => s.category },
    { head: 'Disponível', width: '110px', cell: (s) => `${s.qty} ${s.unit}` },
    { head: 'Mínimo / máximo', width: '130px', cell: (s) => `${s.low_qty} / ${s.max_qty}` },
  ]
  return <>
    <DataTable title="Artigos de stock" sub="Artigos disponíveis nos movimentos e nos alertas" addLabel="Novo artigo" onAdd={() => setDraft(blank)}
      search={q} onSearch={setQ} rows={rows} cols={cols} readOnly={!isOwner} dim={(s) => !s.active} emptyMsg="Nenhum artigo encontrado" minW={720}
      onEdit={(s) => setDraft({ id: s.id, code: s.code, name: s.name, category: s.category, unit: s.unit, qty: String(s.qty),
        max_qty: String(s.max_qty), low_qty: String(s.low_qty), unit_price: s.unit_price == null ? '' : String(s.unit_price),
        expires_on: s.expires_on ?? '', note: s.note, active: s.active })}
      onDelete={(s) => s.active ? setOff(s) : update.mutate({ id: s.id, active: true }, { onSuccess: () => toast('Artigo reactivado'), onError: (e) => toast(errorMessage(e), 'error') })} />
    <StockSheet draft={draft} onClose={() => setDraft(null)} />
    <ConfirmSheet open={!!off} onClose={() => setOff(null)} danger title="Desactivar artigo" confirmLabel="Desactivar" loading={update.isPending}
      message={`${off?.name} deixa de aparecer nos novos movimentos. O histórico mantém-se.`}
      onConfirm={() => off && update.mutate({ id: off.id, active: false }, {
        onSuccess: () => { toast('Artigo desactivado'); setOff(null) }, onError: (e) => toast(errorMessage(e), 'error'),
      })} />
  </>
}
