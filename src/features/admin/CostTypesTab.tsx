import { useState } from 'react'
import { useUrlState } from '@/lib/urlState'
import { errorMessage } from '@/lib/supabase'
import type { Category, CategoryGroup } from '@/lib/database.types'
import { SWATCH } from '@/lib/constants'
import { numP } from '@/lib/format'
import { Button, Chip, ConfirmSheet, Dot, ErrorState, Field, FormError, Input, Loading, Select, Sheet, Toggle, useToast } from '@/ui'
import { DataTable, type Col } from '@/features/settings/DataTable'
import { Swatches } from '@/features/settings/Swatches'
import { useFarmRows, useFarmTableMutations } from './farmData'

const GROUPS: CategoryGroup[] = ['Investimento', 'Operacional', 'Receita', 'Dívida']
const groupTone = (g: CategoryGroup) => (g === 'Investimento' ? 'accent' : g === 'Receita' ? 'success' : g === 'Dívida' ? 'red' : 'neutral')
type Draft = { id?: string; name: string; grp: CategoryGroup; color: string; description: string; item_type: Category['item_type']; quantity_unit: string; quantity_unit_singular: string; baseline_price: string; active: boolean }
const blank: Draft = { name: '', grp: 'Operacional', color: SWATCH[0], description: '', item_type: 'Serviço', quantity_unit: '', quantity_unit_singular: '', baseline_price: '', active: true }

function CategorySheet({ farmId, draft, onClose }: { farmId: string; draft: Draft | null; onClose: () => void }) {
  const { insert, update } = useFarmTableMutations(farmId, 'categories')
  const toast = useToast()
  const [d, setD] = useState<Draft>(draft ?? blank)
  const [error, setError] = useState('')
  const [seen, setSeen] = useState(draft)
  if (seen !== draft) { setSeen(draft); setD(draft ?? blank); setError('') }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!d.name.trim()) return setError('Indique o nome do tipo.')
    if (d.item_type === 'Produto' && !d.quantity_unit.trim()) return setError('Indique a unidade de quantidade.')
    if (!!d.quantity_unit.trim() !== !!d.quantity_unit_singular.trim()) return setError('Indique a unidade no singular e no plural.')
    if (d.item_type === 'Produto' && !(numP(d.baseline_price) > 0 && Math.round(numP(d.baseline_price) * 100) / 100 > 0)) return setError('Indique um preço base válido por unidade.')
    const row = { name: d.name.trim(), grp: d.grp, color: d.color, description: d.description.trim(), active: d.active,
      // The unit is kept for services too: stock items of this category use it.
      item_type: d.item_type, quantity_unit: d.quantity_unit.trim(), quantity_unit_singular: d.quantity_unit_singular.trim(),
      baseline_price: d.item_type === 'Produto' ? Math.round(numP(d.baseline_price) * 100) / 100 : null }
    try {
      if (d.id) await update.mutateAsync({ id: d.id, ...row })
      else await insert.mutateAsync(row)
      toast(d.id ? 'Tipo actualizado' : 'Tipo criado')
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Sheet open={!!draft} onClose={onClose} title={d.id ? 'Editar tipo financeiro' : 'Novo tipo financeiro'} maxWidth={460}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={insert.isPending || update.isPending} onClick={submit}>Guardar</Button></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Nome"><Input value={d.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Grupo"><Select value={d.grp} onChange={(e) => set('grp', e.target.value as CategoryGroup)}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Natureza"><Select value={d.item_type} onChange={(e) => set('item_type', e.target.value as Category['item_type'])}><option>Serviço</option><option>Produto</option></Select></Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Unidade de quantidade</span>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Singular"><Input value={d.quantity_unit_singular} onChange={(e) => set('quantity_unit_singular', e.target.value)} placeholder="saco" /></Field>
            <Field label="Plural"><Input value={d.quantity_unit} onChange={(e) => set('quantity_unit', e.target.value)} placeholder="sacos" /></Field>
          </div>
          <span className="text-xs text-muted">{d.item_type === 'Produto' ? 'Obrigatória para produtos.' : 'Opcional.'} Os artigos de stock desta categoria usam esta unidade.</span>
        </div>
        {d.item_type === 'Produto' && <Field label={`Preço base por ${d.quantity_unit_singular.trim() || 'unidade'} (MT)`}>
          <Input type="number" min="0" step="any" value={d.baseline_price} onChange={(e) => set('baseline_price', e.target.value)} placeholder="0" />
        </Field>}
        <Field label="Descrição"><Input value={d.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold text-ink-2">Cor</span><Swatches value={d.color} onChange={(c) => set('color', c)} /></div>
        <div className="flex items-center justify-between"><span className="text-sm">Activo</span><Toggle checked={d.active} onChange={(v) => set('active', v)} label="Activo" /></div>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

export default function CostTypesTab({ farmId }: { farmId: string }) {
  const cats = useFarmRows(farmId, 'categories', 'created_at', ['baseline_price'])
  const { update } = useFarmTableMutations(farmId, 'categories')
  const toast = useToast()
  const [q, setQ] = useUrlState('q', '')
  const [grp, setGrp] = useUrlState('group', 'all')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [off, setOff] = useState<Category | null>(null)

  if (cats.isLoading) return <Loading />
  if (cats.error) return <ErrorState error={cats.error} retry={() => cats.refetch()} />

  const rows = (cats.data ?? []).filter((c) => (grp === 'all' || c.grp === grp) && `${c.name} ${c.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => GROUPS.indexOf(a.grp) - GROUPS.indexOf(b.grp))

  const cols: Col<Category>[] = [
    { head: 'Tipo', width: 'minmax(160px,1.2fr)', cell: (c) => <span className="flex min-w-0 items-center gap-2.5"><Dot color={c.color} size={10} /><span className="truncate font-semibold">{c.name}</span></span> },
    { head: 'Grupo', width: '130px', cell: (c) => <Chip tone={groupTone(c.grp)}>{c.grp}</Chip> },
    { head: 'Natureza', width: '120px', cell: (c) => c.item_type },
    { head: 'Unidade', width: '130px', cell: (c) => c.quantity_unit ? `${c.quantity_unit_singular || c.quantity_unit} / ${c.quantity_unit}` : <span className="text-muted">—</span> },
    { head: 'Descrição', width: 'minmax(160px,1.6fr)', cell: (c) => <span className="truncate text-muted">{c.description || '—'}</span> },
  ]

  return (
    <>
      <DataTable title="Tipos financeiros" sub="Categorias usadas nas despesas e receitas" addLabel="Novo tipo" onAdd={() => setDraft(blank)}
        search={q} onSearch={setQ} filter={{ value: grp, onChange: setGrp, options: [['all', 'Todos os grupos'], ...GROUPS.map((g) => [g, g] as const)] }}
        rows={rows} cols={cols} readOnly={false} dim={(c) => !c.active} emptyMsg="Nenhum tipo encontrado" minW={760}
        onEdit={(c) => setDraft({ id: c.id, name: c.name, grp: c.grp, color: c.color, description: c.description, item_type: c.item_type, quantity_unit: c.quantity_unit, quantity_unit_singular: c.quantity_unit_singular, baseline_price: c.baseline_price == null ? '' : String(c.baseline_price), active: c.active })}
        onDelete={(c) => c.active ? setOff(c) : update.mutate({ id: c.id, active: true }, { onSuccess: () => toast('Tipo reactivado'), onError: (e) => toast(errorMessage(e), 'error') })} />
      <CategorySheet farmId={farmId} draft={draft} onClose={() => setDraft(null)} />
      <ConfirmSheet open={!!off} onClose={() => setOff(null)} danger title="Desactivar tipo financeiro" confirmLabel="Desactivar" loading={update.isPending}
        message={`${off?.name} deixa de aparecer nos novos registos. O histórico mantém-se.`}
        onConfirm={() => off && update.mutate({ id: off.id, active: false }, {
          onSuccess: () => { toast('Tipo desactivado'); setOff(null) },
          onError: (e) => toast(errorMessage(e), 'error'),
        })} />
    </>
  )
}
