import { useState } from 'react'
import { useFarm } from '@/app/farm'
import type { Breed, Symptom, TreatmentProduct } from '@/lib/database.types'
import { numP } from '@/lib/format'
import { useBreeds, useStock, useSymptoms, useTableMutations, useTreatmentProducts } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { Button, Card, ConfirmSheet, ErrorState, Field, FormError, Input, Loading, Select, Sheet, Toggle, useToast } from '@/ui'
import { DataTable, type Col } from './DataTable'

type Draft = { id?: string; code: string; name: string; dose_ml: string; per_kg: string; dose_text: string; route: string; withdrawal_days: string; stock_code: string; help_kind: 'art' | 'pb'; help_slug: string; active: boolean }
const blank: Draft = { code: '', name: '', dose_ml: '', per_kg: '', dose_text: '', route: '', withdrawal_days: '0', stock_code: '', help_kind: 'art', help_slug: '', active: true }

function ProductSheet({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const stock = (useStock().data ?? []).filter((s) => s.active)
  const { insert, update } = useTableMutations('treatment_products')
  const toast = useToast()
  const [d, setD] = useState<Draft>(draft ?? blank)
  const [seen, setSeen] = useState(draft)
  const [error, setError] = useState('')
  if (seen !== draft) { setSeen(draft); setD(draft ?? blank); setError('') }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }))
  const submit = async () => {
    const dose_ml = d.dose_ml.trim() ? numP(d.dose_ml) : null
    const per_kg = d.per_kg.trim() ? numP(d.per_kg) : null
    const withdrawal_days = numP(d.withdrawal_days)
    if (!d.code.trim() || !d.name.trim()) return setError('Indique código e nome.')
    if ((dose_ml != null && !(dose_ml > 0)) || (per_kg != null && !(per_kg > 0)) || (per_kg != null && dose_ml == null)) return setError('Indique uma dose válida.')
    if (!Number.isInteger(withdrawal_days) || withdrawal_days < 0) return setError('Indique um período de carência válido.')
    if (d.stock_code && !stock.some((s) => s.code === d.stock_code)) return setError('Escolha um artigo de stock activo.')
    const row = { code: d.code.trim(), name: d.name.trim(), dose_ml, per_kg, dose_text: d.dose_text.trim(), route: d.route.trim(),
      withdrawal_days, stock_code: d.stock_code || null, help_kind: d.help_kind, help_slug: d.help_slug.trim() || 'vacinas', active: d.active }
    try {
      if (d.id) await update.mutateAsync({ id: d.id, ...row })
      else await insert.mutateAsync(row)
      toast(d.id ? 'Produto actualizado' : 'Produto criado')
      onClose()
    } catch (e) { setError(errorMessage(e)) }
  }
  return <Sheet open={!!draft} onClose={onClose} title={d.id ? 'Editar produto de tratamento' : 'Novo produto de tratamento'} maxWidth={460}
    footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={insert.isPending || update.isPending} onClick={submit}>Guardar</Button></>}>
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3"><Field label="Código"><Input value={d.code} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label="Nome"><Input value={d.name} onChange={(e) => set('name', e.target.value)} /></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Dose (ml)"><Input inputMode="decimal" value={d.dose_ml} onChange={(e) => set('dose_ml', e.target.value)} /></Field>
        <Field label="Por kg de peso"><Input inputMode="decimal" value={d.per_kg} onChange={(e) => set('per_kg', e.target.value)} /></Field></div>
      <Field label="Dose alternativa"><Input value={d.dose_text} onChange={(e) => set('dose_text', e.target.value)} /></Field>
      <Field label="Via"><Input value={d.route} onChange={(e) => set('route', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Carência (dias)"><Input inputMode="numeric" value={d.withdrawal_days} onChange={(e) => set('withdrawal_days', e.target.value)} /></Field>
        <Field label="Artigo de stock"><Select value={d.stock_code} onChange={(e) => set('stock_code', e.target.value)}>
          <option value="">Sem associação</option>{stock.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
        </Select></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Tipo de ajuda"><Select value={d.help_kind} onChange={(e) => set('help_kind', e.target.value as Draft['help_kind'])}><option value="art">Artigo</option><option value="pb">Guia</option></Select></Field>
        <Field label="Identificador da ajuda"><Input value={d.help_slug} onChange={(e) => set('help_slug', e.target.value)} /></Field></div>
      <div className="flex items-center justify-between"><span className="text-sm">Activo</span><Toggle checked={d.active} onChange={(v) => set('active', v)} label="Activo" /></div>
      <FormError>{error}</FormError>
    </div>
  </Sheet>
}

export default function CatalogsTab() {
  const { isOwner } = useFarm()
  const products = useTreatmentProducts()
  const breeds = useBreeds()
  const symptoms = useSymptoms()
  const productMutations = useTableMutations('treatment_products')
  const breedMutations = useTableMutations('breeds')
  const symptomMutations = useTableMutations('symptoms')
  const toast = useToast()
  const [productSearch, setProductSearch] = useState('')
  const [breedSearch, setBreedSearch] = useState('')
  const [symptomSearch, setSymptomSearch] = useState('')
  const [symptom, setSymptom] = useState<Symptom | 'new' | null>(null)
  const [symptomName, setSymptomName] = useState('')
  const [symptomIcon, setSymptomIcon] = useState('healing')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [breed, setBreed] = useState<Breed | 'new' | null>(null)
  const [breedName, setBreedName] = useState('')
  const [error, setError] = useState('')
  const [offProduct, setOffProduct] = useState<TreatmentProduct | null>(null)
  const [offBreed, setOffBreed] = useState<Breed | null>(null)
  const [offSymptom, setOffSymptom] = useState<Symptom | null>(null)
  if (products.isLoading || breeds.isLoading || symptoms.isLoading) return <Loading />
  if (products.error) return <ErrorState error={products.error} retry={() => products.refetch()} />
  if (breeds.error) return <ErrorState error={breeds.error} retry={() => breeds.refetch()} />
  if (symptoms.error) return <ErrorState error={symptoms.error} retry={() => symptoms.refetch()} />
  const productCols: Col<TreatmentProduct>[] = [
    { head: 'Produto', width: 'minmax(180px,1fr)', cell: (p) => <span className="font-semibold">{p.name} · {p.code}</span> },
    { head: 'Via', width: '160px', cell: (p) => p.route || '—' },
    { head: 'Carência', width: '100px', cell: (p) => `${p.withdrawal_days} dias` },
    { head: 'Stock', width: '100px', cell: (p) => p.stock_code || '—' },
  ]
  const breedCols: Col<Breed>[] = [{ head: 'Raça', width: 'minmax(180px,1fr)', cell: (b) => <span className="font-semibold">{b.name}</span> }]
  const symptomCols: Col<Symptom>[] = [
    { head: 'Sintoma', width: 'minmax(180px,1fr)', cell: (s) => <span className="font-semibold">{s.name}</span> },
    { head: 'Ícone', width: '100px', cell: (s) => s.icon },
  ]
  const saveBreed = async () => {
    if (!breedName.trim()) return setError('Indique o nome da raça.')
    try {
      if (breed && breed !== 'new') await breedMutations.update.mutateAsync({ id: breed.id, name: breedName.trim() })
      else await breedMutations.insert.mutateAsync({ name: breedName.trim() })
      toast('Raça guardada')
      setBreed(null)
    } catch (e) { setError(errorMessage(e)) }
  }
  const saveSymptom = async () => {
    if (!symptomName.trim() || !symptomIcon.trim()) return setError('Indique o nome e o ícone do sintoma.')
    try {
      if (symptom && symptom !== 'new') await symptomMutations.update.mutateAsync({ id: symptom.id, name: symptomName.trim(), icon: symptomIcon.trim() })
      else await symptomMutations.insert.mutateAsync({ name: symptomName.trim(), icon: symptomIcon.trim() })
      toast('Sintoma guardado')
      setSymptom(null)
    } catch (e) { setError(errorMessage(e)) }
  }
  return <div className="flex flex-col gap-5">
    <DataTable title="Produtos de tratamento" sub="Opções usadas no registo de tratamentos" addLabel="Novo produto" onAdd={() => setDraft(blank)}
      search={productSearch} onSearch={setProductSearch} rows={(products.data ?? []).filter((p) => `${p.name} ${p.code}`.toLowerCase().includes(productSearch.toLowerCase()))}
      cols={productCols} readOnly={!isOwner} dim={(p) => !p.active} emptyMsg="Nenhum produto encontrado" minW={700}
      onEdit={(p) => setDraft({ id: p.id, code: p.code, name: p.name, dose_ml: p.dose_ml == null ? '' : String(p.dose_ml), per_kg: p.per_kg == null ? '' : String(p.per_kg), dose_text: p.dose_text, route: p.route, withdrawal_days: String(p.withdrawal_days), stock_code: p.stock_code ?? '', help_kind: p.help_kind, help_slug: p.help_slug, active: p.active })}
      onDelete={(p) => p.active ? setOffProduct(p) : productMutations.update.mutate({ id: p.id, active: true }, { onSuccess: () => toast('Produto reactivado'), onError: (e) => toast(errorMessage(e), 'error') })} />
    <DataTable title="Raças" sub="Opções disponíveis nos registos de animais" addLabel="Nova raça" onAdd={() => { setBreed('new'); setBreedName(''); setError('') }}
      search={breedSearch} onSearch={setBreedSearch} rows={(breeds.data ?? []).filter((b) => b.name.toLowerCase().includes(breedSearch.toLowerCase()))}
      cols={breedCols} readOnly={!isOwner} dim={(b) => !b.active} emptyMsg="Nenhuma raça encontrada" minW={350}
      onEdit={(b) => { setBreed(b); setBreedName(b.name); setError('') }}
      onDelete={(b) => b.active ? setOffBreed(b) : breedMutations.update.mutate({ id: b.id, active: true }, { onSuccess: () => toast('Raça reactivada'), onError: (e) => toast(errorMessage(e), 'error') })} />
    <DataTable title="Sintomas" sub="Opções disponíveis no registo de doenças" addLabel="Novo sintoma" onAdd={() => { setSymptom('new'); setSymptomName(''); setSymptomIcon('healing'); setError('') }}
      search={symptomSearch} onSearch={setSymptomSearch} rows={(symptoms.data ?? []).filter((s) => s.name.toLowerCase().includes(symptomSearch.toLowerCase()))}
      cols={symptomCols} readOnly={!isOwner} dim={(s) => !s.active} emptyMsg="Nenhum sintoma encontrado" minW={400}
      onEdit={(s) => { setSymptom(s); setSymptomName(s.name); setSymptomIcon(s.icon); setError('') }}
      onDelete={(s) => s.active ? setOffSymptom(s) : symptomMutations.update.mutate({ id: s.id, active: true }, { onSuccess: () => toast('Sintoma reactivado'), onError: (e) => toast(errorMessage(e), 'error') })} />
    <ProductSheet draft={draft} onClose={() => setDraft(null)} />
    <Sheet open={!!breed} onClose={() => setBreed(null)} title={breed === 'new' ? 'Nova raça' : 'Editar raça'} maxWidth={400}
      footer={<><Button className="flex-1" onClick={() => setBreed(null)}>Cancelar</Button><Button className="flex-1" variant="primary" loading={breedMutations.insert.isPending || breedMutations.update.isPending} onClick={saveBreed}>Guardar</Button></>}>
      <Field label="Nome"><Input value={breedName} onChange={(e) => setBreedName(e.target.value)} /></Field><FormError>{error}</FormError>
    </Sheet>
    <Sheet open={!!symptom} onClose={() => setSymptom(null)} title={symptom === 'new' ? 'Novo sintoma' : 'Editar sintoma'} maxWidth={400}
      footer={<><Button className="flex-1" onClick={() => setSymptom(null)}>Cancelar</Button><Button className="flex-1" variant="primary" loading={symptomMutations.insert.isPending || symptomMutations.update.isPending} onClick={saveSymptom}>Guardar</Button></>}>
      <div className="flex flex-col gap-3"><Field label="Nome"><Input value={symptomName} onChange={(e) => setSymptomName(e.target.value)} /></Field>
        <Field label="Ícone"><Input value={symptomIcon} onChange={(e) => setSymptomIcon(e.target.value)} /></Field><FormError>{error}</FormError></div>
    </Sheet>
    <ConfirmSheet open={!!offProduct} onClose={() => setOffProduct(null)} danger title="Desactivar produto" confirmLabel="Desactivar" loading={productMutations.update.isPending}
      message={`${offProduct?.name} deixa de aparecer nos novos tratamentos. O histórico mantém-se.`}
      onConfirm={() => offProduct && productMutations.update.mutate({ id: offProduct.id, active: false }, { onSuccess: () => { toast('Produto desactivado'); setOffProduct(null) }, onError: (e) => toast(errorMessage(e), 'error') })} />
    <ConfirmSheet open={!!offBreed} onClose={() => setOffBreed(null)} danger title="Desactivar raça" confirmLabel="Desactivar" loading={breedMutations.update.isPending}
      message={`${offBreed?.name} deixa de aparecer nas novas compras. O histórico mantém-se.`}
      onConfirm={() => offBreed && breedMutations.update.mutate({ id: offBreed.id, active: false }, { onSuccess: () => { toast('Raça desactivada'); setOffBreed(null) }, onError: (e) => toast(errorMessage(e), 'error') })} />
    <ConfirmSheet open={!!offSymptom} onClose={() => setOffSymptom(null)} danger title="Desactivar sintoma" confirmLabel="Desactivar" loading={symptomMutations.update.isPending}
      message={`${offSymptom?.name} deixa de aparecer nos novos registos. O histórico mantém-se.`}
      onConfirm={() => offSymptom && symptomMutations.update.mutate({ id: offSymptom.id, active: false }, { onSuccess: () => { toast('Sintoma desactivado'); setOffSymptom(null) }, onError: (e) => toast(errorMessage(e), 'error') })} />
    {!isOwner && <Card className="p-4 text-sm text-muted">Apenas o proprietário pode alterar os catálogos.</Card>}
  </div>
}
