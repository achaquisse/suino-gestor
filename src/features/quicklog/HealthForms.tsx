import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { PRODUCTS } from '@/lib/constants'
import { useRpc, useStock } from '@/lib/queries'
import { dShort, addDays, dec, numP, plural } from '@/lib/format'
import { Button, Field, Icon, Input, Segmented, Select, Textarea, Toggle, cx } from '@/ui'
import {
  AnimalSelect, CommonFields, FormSheet, LockedAnimal, firstId, scoped, useBase, useCommon, useSubmit, type FormProps,
} from './shared'

export function TreatmentForm({ ctx, onBack, onClose }: FormProps) {
  const { pens, animals, penName, count } = useBase()
  const stock = useStock().data ?? []
  const navigate = useNavigate()
  const c = useCommon(ctx)
  const rpc = useRpc('log_treatment')
  const { pending, error, run } = useSubmit(ctx, onClose)
  const ctxAnimal = ctx.animalId ? animals.find((a) => a.id === ctx.animalId) : undefined
  const initialPen = ctxAnimal?.pen_id ?? ctx.penId ?? pens.find((p) => count(p.id) > 0)?.id ?? pens[0]?.id ?? ''
  const [pen, setPen] = useState(initialPen)
  const [sel, setSel] = useState<string[]>(() =>
    ctxAnimal ? [ctxAnimal.id] : animals.filter((a) => a.pen_id === initialPen).map((a) => a.id))
  const [productId, setProductId] = useState(ctx.product && PRODUCTS.some((p) => p.id === ctx.product) ? ctx.product : 'ferro')
  const P = PRODUCTS.find((p) => p.id === productId) ?? PRODUCTS[0]
  const penAnimals = animals.filter((a) => a.pen_id === pen)
  const chosen = sel.filter((id) => penAnimals.some((a) => a.id === id))
  const allOn = penAnimals.length > 0 && chosen.length === penAnimals.length
  const stockItem = P.stock ? stock.find((s) => s.code === P.stock) : undefined
  const dose = P.dose ?? (P.ml ? (P.perKg ? `${P.ml} ml / ${P.perKg} kg` : `${P.ml} ml por animal`) : '—')
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const info: [string, string, boolean?][] = [
    ['Dose', dose], ['Via', P.via],
    ['Carência', P.car ? `${P.car} dias · até ${dShort(addDays(c.date, P.car))}` : 'Nenhuma', P.car > 0],
  ]

  const submit = () => run(async () => {
    if (!chosen.length) throw new Error('Seleccione pelo menos um animal.')
    await rpc.mutateAsync({
      p_animal_ids: chosen, p_product: P.id, p_product_name: P.name, p_withdrawal_days: P.car,
      p_stock_code: stockItem?.code, p_date: c.date, p_by: c.by,
    })
    return `Tratamento registado · ${P.name} · ${plural(chosen.length, 'animal', 'animais')}${P.car ? ` · carência ${P.car} dias` : ''}`
  })

  const help = () => {
    onClose()
    navigate(`/help/${P.help[0] === 'pb' ? 'playbooks' : 'articles'}/${P.help[1]}`)
  }

  return (
    <FormSheet title="Tratamento" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit}
      effect="Também actualiza o stock de medicamentos, conclui a tarefa correspondente e entra no histórico de saúde de cada animal.">
      {ctxAnimal ? <LockedAnimal animal={ctxAnimal} penName={penName(ctxAnimal.pen_id)} /> : (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink-2">Animais</span>
            <span className="text-[13px] font-semibold text-accent-strong">{plural(chosen.length, 'seleccionado', 'seleccionados')}</span>
          </div>
          <Select value={pen} onChange={(e) => { setPen(e.target.value); setSel(animals.filter((a) => a.pen_id === e.target.value).map((a) => a.id)) }}>
            {pens.map((p) => <option key={p.id} value={p.id}>{p.name} · {plural(count(p.id), 'animal', 'animais')}</option>)}
          </Select>
          <div className="no-scrollbar flex max-h-[172px] flex-wrap gap-1.5 overflow-auto p-0.5">
            <Chipper on={allOn} icon={allOn ? 'check' : 'add'} onClick={() => setSel(allOn ? [] : penAnimals.map((a) => a.id))}>Todos · {penAnimals.length}</Chipper>
            {penAnimals.map((a) => (
              <Chipper key={a.id} on={sel.includes(a.id)} icon={sel.includes(a.id) ? 'check' : undefined} onClick={() => toggle(a.id)} title={`${a.stage} · ${a.status}`} tab>{a.tag}</Chipper>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Produto</span>
          <Button variant="ghost" size="sm" icon="help" className="!h-7 px-2 font-medium text-accent-strong" onClick={help}>Como aplicar</Button>
        </div>
        <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
          {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,130px),1fr))] gap-px overflow-hidden rounded-[14px] bg-line">
          {info.map(([l, v, warn]) => (
            <div key={l} className="flex min-w-0 flex-col gap-0.5 bg-[#F7F7FB] px-3 py-2.5">
              <span className="text-xs text-muted">{l}</span>
              <span className="text-sm font-semibold" style={{ color: warn ? '#A2601A' : undefined }}>{v}</span>
            </div>
          ))}
          {stockItem && (
            <div className="flex min-w-0 flex-col gap-0.5 bg-[#F7F7FB] px-3 py-2.5">
              <span className="text-xs text-muted">Stock</span>
              <span className="tabular text-sm font-semibold">{stockItem.qty} → {Math.max(0, stockItem.qty - 1)} {stockItem.unit}</span>
            </div>
          )}
        </div>
      </div>
      <CommonFields c={c} byLabel="Aplicado por" />
    </FormSheet>
  )
}

function Chipper({ on, icon, onClick, children, title, tab }: { on: boolean; icon?: string; onClick: () => void; children: ReactNode; title?: string; tab?: boolean }) {
  return (
    <button type="button" title={title} aria-pressed={on} onClick={onClick}
      className={cx('flex h-9 items-center gap-1 rounded-full border-[1.5px] px-3 text-[13px] font-semibold', tab && 'tabular',
        on ? 'border-accent bg-accent-wash text-accent-strong' : 'border-line-strong bg-white text-ink-2')}>
      {icon && <Icon name={icon} size={14} />}{children}
    </button>
  )
}

const SYMPTOMS: [string, string][] = [
  ['Tosse', 'air'], ['Febre', 'thermostat'], ['Diarreia', 'water_drop'], ['Falta de apetite', 'no_meals'],
  ['Coxeira', 'accessible'], ['Ferida', 'healing'], ['Prostração', 'bedtime'],
]
const SEVERITIES = [['Ligeira', 'Ligeira'], ['Moderada', 'Moderada'], ['Grave', 'Grave']] as const

export function IllnessForm({ ctx, onBack, onClose }: FormProps) {
  const { animals, penName } = useBase()
  const list = scoped(animals, ctx)
  const c = useCommon(ctx)
  const rpc = useRpc('log_illness')
  const { pending, error, run } = useSubmit(ctx, onClose)
  const [animal, setAnimal] = useState(firstId(ctx, list))
  const [sym, setSym] = useState<string[]>([])
  const [sev, setSev] = useState<(typeof SEVERITIES)[number][0]>('Ligeira')
  const [iso, setIso] = useState(false)
  const [notes, setNotes] = useState('')
  const a = animals.find((x) => x.id === animal)

  const submit = () => run(async () => {
    if (!a) throw new Error('Seleccione um animal.')
    if (!sym.length) throw new Error('Seleccione pelo menos um sintoma.')
    await rpc.mutateAsync({ p_animal: a.id, p_symptoms: sym, p_severity: sev, p_isolate: iso, p_notes: notes.trim(), p_date: c.date, p_by: c.by })
    return `Doença registada · ${a.tag} · ${sym.join(', ').toLowerCase()} · ${sev.toLowerCase()}${iso ? ' · isolado' : ''}`
  })

  return (
    <FormSheet title="Doença" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit}
      effect="Marca o animal como doente, entra no histórico de saúde e avisa o veterinário se a gravidade for grave.">
      {ctx.animalId ? <LockedAnimal animal={a} penName={penName(a?.pen_id ?? null)} /> : <AnimalSelect animals={list} penName={penName} value={animal} onChange={setAnimal} />}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-2">Sintomas</span>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map(([l, i]) => {
            const on = sym.includes(l)
            return (
              <button key={l} type="button" aria-pressed={on} onClick={() => setSym(on ? sym.filter((x) => x !== l) : [...sym, l])}
                className={cx('flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium',
                  on ? 'border-[#F7C6C0] bg-danger-soft text-danger' : 'border-line-strong bg-white text-ink-2')}>
                <Icon name={on ? 'check' : i} size={16} />{l}
              </button>
            )
          })}
        </div>
      </div>
      <Field label="Gravidade"><Segmented options={SEVERITIES} value={sev} onChange={setSev} /></Field>
      <div className="flex items-center justify-between gap-3 rounded-[13px] border border-line px-3.5 py-3">
        <div>
          <div className="text-sm font-semibold">Isolar animal</div>
          <div className="text-xs text-muted">Separar dos restantes do curral</div>
        </div>
        <Toggle checked={iso} onChange={setIso} label="Isolar animal" />
      </div>
      <Field label="Notas"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" /></Field>
      <CommonFields c={c} byLabel="Registado por" />
    </FormSheet>
  )
}

export function WeightForm({ ctx, onBack, onClose }: FormProps) {
  const { animals, penName } = useBase()
  const list = scoped(animals, ctx)
  const c = useCommon(ctx)
  const rpc = useRpc('log_weight')
  const { pending, error, run } = useSubmit(ctx, onClose)
  const [animal, setAnimal] = useState(firstId(ctx, list))
  const [kgText, setKgText] = useState('')
  const a = animals.find((x) => x.id === animal)
  const v = numP(kgText)
  const diff = a && Number.isFinite(v) ? v - a.weight_kg : null
  const hint = !a ? undefined : diff == null
    ? `Último peso: ${dec(a.weight_kg)} kg`
    : `${diff >= 0 ? '+' : '−'}${dec(Math.abs(Math.round(diff * 10) / 10))} kg desde a última pesagem (${dec(a.weight_kg)} kg)`

  const submit = () => run(async () => {
    if (!a) throw new Error('Seleccione um animal.')
    if (!(v > 0)) throw new Error('Indique um peso válido, ex. 42,5.')
    await rpc.mutateAsync({ p_animal: a.id, p_kg: v, p_date: c.date, p_by: c.by })
    return `Peso registado · ${a.tag} · ${dec(Math.round(v * 10) / 10)} kg`
  })

  return (
    <FormSheet title="Peso" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit} effect="Entra no gráfico de peso do animal.">
      {ctx.animalId ? <LockedAnimal animal={a} penName={penName(a?.pen_id ?? null)} /> : <AnimalSelect animals={list} penName={penName} value={animal} onChange={setAnimal} />}
      <Field label="Peso (kg)" hint={hint}>
        <div className="relative">
          <Input value={kgText} onChange={(e) => setKgText(e.target.value)} inputMode="decimal" placeholder="0,0" autoFocus className="tabular pr-10 text-lg font-semibold" />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">kg</span>
        </div>
      </Field>
      <CommonFields c={c} byLabel="Pesado por" />
    </FormSheet>
  )
}
