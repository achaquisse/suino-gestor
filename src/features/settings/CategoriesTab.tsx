import { useState } from 'react'
import { useFarm } from '@/app/farm'
import { errorMessage } from '@/lib/supabase'
import { useCategories, useTableMutations } from '@/lib/queries'
import type { Category, CategoryGroup } from '@/lib/database.types'
import { SWATCH } from '@/lib/constants'
import { Button, Chip, ConfirmSheet, Dot, ErrorState, Field, FormError, Input, Loading, Select, Sheet, Toggle, useToast } from '@/ui'
import { DataTable, type Col } from './DataTable'
import { Swatches } from './Swatches'

const GROUPS: CategoryGroup[] = ['Investimento', 'Operacional', 'Receita', 'Dívida']
const groupTone = (g: CategoryGroup) => (g === 'Investimento' ? 'accent' : g === 'Receita' ? 'success' : g === 'Dívida' ? 'red' : 'neutral')
type Draft = { id?: string; name: string; grp: CategoryGroup; color: string; description: string; active: boolean }
const blank: Draft = { name: '', grp: 'Operacional', color: SWATCH[0], description: '', active: true }

function CategorySheet({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const { insert, update } = useTableMutations('categories')
  const toast = useToast()
  const [d, setD] = useState<Draft>(draft ?? blank)
  const [error, setError] = useState('')
  const [seen, setSeen] = useState(draft)
  if (seen !== draft) { setSeen(draft); setD(draft ?? blank); setError('') }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!d.name.trim()) return setError('Indique o nome do tipo de custo.')
    const row = { name: d.name.trim(), grp: d.grp, color: d.color, description: d.description.trim(), active: d.active }
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
    <Sheet open={!!draft} onClose={onClose} title={d.id ? 'Editar tipo de custo' : 'Novo tipo de custo'} maxWidth={460}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={insert.isPending || update.isPending} onClick={submit}>Guardar</Button></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Nome"><Input value={d.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Grupo"><Select value={d.grp} onChange={(e) => set('grp', e.target.value as CategoryGroup)}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Descrição"><Input value={d.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold text-ink-2">Cor</span><Swatches value={d.color} onChange={(c) => set('color', c)} /></div>
        <div className="flex items-center justify-between"><span className="text-sm">Activo</span><Toggle checked={d.active} onChange={(v) => set('active', v)} label="Activo" /></div>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

export default function CategoriesTab() {
  const { isOwner } = useFarm()
  const cats = useCategories()
  const { update } = useTableMutations('categories')
  const toast = useToast()
  const [q, setQ] = useState('')
  const [grp, setGrp] = useState('all')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [off, setOff] = useState<Category | null>(null)

  if (cats.isLoading) return <Loading />
  if (cats.error) return <ErrorState error={cats.error} retry={() => cats.refetch()} />

  const rows = (cats.data ?? []).filter((c) => (grp === 'all' || c.grp === grp) && `${c.name} ${c.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => GROUPS.indexOf(a.grp) - GROUPS.indexOf(b.grp))

  const cols: Col<Category>[] = [
    { head: 'Tipo', width: 'minmax(160px,1.2fr)', cell: (c) => <span className="flex min-w-0 items-center gap-2.5"><Dot color={c.color} size={10} /><span className="truncate font-semibold">{c.name}</span></span> },
    { head: 'Grupo', width: '130px', cell: (c) => <Chip tone={groupTone(c.grp)}>{c.grp}</Chip> },
    { head: 'Descrição', width: 'minmax(160px,1.6fr)', cell: (c) => <span className="truncate text-muted">{c.description || '—'}</span> },
  ]

  return (
    <>
      <DataTable title="Tipos de custo" sub="Categorias usadas nos registos financeiros" addLabel="Novo tipo" onAdd={() => setDraft(blank)}
        search={q} onSearch={setQ} filter={{ value: grp, onChange: setGrp, options: [['all', 'Todos os grupos'], ...GROUPS.map((g) => [g, g] as const)] }}
        rows={rows} cols={cols} readOnly={!isOwner} dim={(c) => !c.active} emptyMsg="Nenhum tipo encontrado" minW={640}
        onEdit={(c) => setDraft({ id: c.id, name: c.name, grp: c.grp, color: c.color, description: c.description, active: c.active })}
        onDelete={(c) => c.active ? setOff(c) : update.mutate({ id: c.id, active: true }, { onSuccess: () => toast('Tipo reactivado') })} />
      <CategorySheet draft={draft} onClose={() => setDraft(null)} />
      <ConfirmSheet open={!!off} onClose={() => setOff(null)} danger title="Desactivar tipo de custo" confirmLabel="Desactivar" loading={update.isPending}
        message={`${off?.name} deixa de aparecer nos novos registos. O histórico mantém-se.`}
        onConfirm={() => off && update.mutate({ id: off.id, active: false }, {
          onSuccess: () => { toast('Tipo desactivado'); setOff(null) },
          onError: (e) => toast(errorMessage(e), 'error'),
        })} />
    </>
  )
}
