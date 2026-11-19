import { useState } from 'react'
import { useRpc, useTableMutations } from '@/lib/queries'
import { useFarm } from '@/app/farm'
import { dShort, plural } from '@/lib/format'
import { Field, Icon, Input, Segmented, Select, Stepper } from '@/ui'
import { freePlaces } from '@/lib/pens'
import {
  AnimalSelect, Chipper, CommonFields, FormSheet, LockedAnimal, firstId, isSow, scoped, useBase, useCommon, useSubmit, type FormProps,
} from './shared'

export function TransferForm({ ctx, onBack, onClose }: FormProps) {
  const { pens, animals, penName, count } = useBase()
  const c = useCommon(ctx)
  const rpc = useRpc('log_transfer')
  const { pending, error, run } = useSubmit(ctx, onClose)
  const ctxAnimal = ctx.animalId ? animals.find((a) => a.id === ctx.animalId) : undefined
  const initialFrom = ctxAnimal?.pen_id ?? ctx.penId ?? pens.find((p) => count(p.id) > 0)?.id ?? pens[0]?.id ?? ''
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(pens.find((p) => p.id !== initialFrom && !p.blocked)?.id ?? '')
  // The animals moved must be chosen explicitly ("Seleccionar todos" takes the whole pen).
  const [sel, setSel] = useState<string[]>([])
  const fromAnimals = animals.filter((a) => a.pen_id === from)
  const chosen = ctxAnimal ? [ctxAnimal.id] : sel.filter((id) => fromAnimals.some((a) => a.id === id))
  const allOn = fromAnimals.length > 0 && chosen.length === fromAnimals.length
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const dest = pens.find((p) => p.id === to)
  const n = chosen.length
  const free = dest ? freePlaces(dest, count(dest.id)) : 0
  const ok = free >= n
  const label = ctxAnimal ? ctxAnimal.tag : n === 1 ? fromAnimals.find((a) => a.id === chosen[0])?.tag ?? '1 animal' : `${plural(n, 'animal', 'animais')} de ${penName(from)}`

  const submit = () => run(async () => {
    if (!dest) throw new Error('Escolha um curral de destino.')
    if (n < 1) throw new Error('Seleccione os animais a transferir.')
    if (!ok) throw new Error('O curral de destino não tem lugares suficientes.')
    await rpc.mutateAsync({ p_animal: ctxAnimal?.id ?? null, p_from: ctxAnimal ? null : from || null, p_animals: ctxAnimal ? null : chosen, p_to: dest.id, p_date: c.date, p_by: c.by })
    return `Transferência registada · ${label} → ${dest.name} · ${c.by}`
  })

  return (
    <FormSheet title="Transferência" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit}
      effect="Actualiza a ocupação dos dois currais e entra no histórico de cada animal.">
      {ctxAnimal && <LockedAnimal animal={ctxAnimal} penName={penName(ctxAnimal.pen_id)} />}
      {!ctxAnimal && (
        <Field label="Origem">
          <Select value={from} onChange={(e) => { setFrom(e.target.value); setSel([]); if (e.target.value === to) setTo(pens.find((p) => p.id !== e.target.value && !p.blocked)?.id ?? '') }}>
            {pens.map((p) => <option key={p.id} value={p.id}>{p.name} · {plural(count(p.id), 'animal', 'animais')}</option>)}
          </Select>
        </Field>
      )}
      {!ctxAnimal && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink-2">Animais a transferir</span>
            <span className="text-[13px] font-semibold text-accent-strong">{plural(n, 'seleccionado', 'seleccionados')}</span>
          </div>
          {fromAnimals.length ? (
            <div className="no-scrollbar flex max-h-[172px] flex-wrap gap-1.5 overflow-auto p-0.5">
              <Chipper on={allOn} icon={allOn ? 'check' : 'add'} onClick={() => setSel(allOn ? [] : fromAnimals.map((a) => a.id))}>Seleccionar todos · {fromAnimals.length}</Chipper>
              {fromAnimals.map((a) => (
                <Chipper key={a.id} on={chosen.includes(a.id)} icon={chosen.includes(a.id) ? 'check' : undefined} onClick={() => toggle(a.id)} title={`${a.stage} · ${a.status}`} tab>{a.tag}</Chipper>
              ))}
            </div>
          ) : <span className="text-[13px] text-muted">Este curral não tem animais.</span>}
        </div>
      )}
      <Field label="Destino" hint={<span style={{ color: ok ? undefined : '#D0342C' }}>{ok
        ? `Cabem ${plural(n, 'animal', 'animais')}${free === Infinity ? ' · curral sem limite' : ` · ${free - n === 1 ? 'fica 1 lugar livre' : `ficam ${free - n} lugares livres`}`}`
        : `Capacidade insuficiente · faltam ${n - free} lugares`}</span>}>
        <Select value={to} onChange={(e) => setTo(e.target.value)}>
          {/* Blocked ("vedado") pens take no animals. */}
          {pens.filter((p) => p.id !== from && !p.blocked).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.capacity == null ? 'sem limite' : `${p.capacity - count(p.id)} lugares livres`}</option>)}
        </Select>
      </Field>
      <CommonFields c={c} byLabel="Responsável" />
    </FormSheet>
  )
}

export function BirthForm({ ctx, onBack, onClose }: FormProps) {
  const { animals, penName } = useBase()
  const sows = scoped(animals, ctx).filter(isSow)
  const c = useCommon(ctx)
  const rpc = useRpc('log_birth')
  const { pending, error, run } = useSubmit(ctx, onClose)
  const [sow, setSow] = useState(firstId(ctx, sows))
  const [live, setLive] = useState(11)
  const [dead, setDead] = useState(0)
  const a = sows.find((x) => x.id === sow)

  const submit = () => run(async () => {
    if (!a) throw new Error('Escolha uma porca.')
    if (!Number.isSafeInteger(live) || !Number.isSafeInteger(dead) || live < 0 || dead < 0 || live + dead === 0) throw new Error('Indique um número inteiro válido de leitões nascidos.')
    await rpc.mutateAsync({ p_sow: a.id, p_live: live, p_dead: dead, p_date: c.date, p_by: c.by })
    return `Parto registado · ${a.tag} · ${live} vivos${dead ? ` · ${dead} nados-mortos` : ''}`
  })

  return (
    <FormSheet title="Parto" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit}
      effect="Cria os leitões na maternidade e agenda a injecção de ferro para o 3.º dia.">
      <AnimalSelect label="Porca" animals={sows} penName={penName} value={sow} onChange={setSow} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nascidos vivos"><Stepper value={live} onChange={setLive} max={30} /></Field>
        <Field label="Nados-mortos"><Stepper value={dead} onChange={setDead} max={30} /></Field>
      </div>
      <CommonFields c={c} byLabel="Assistido por" />
    </FormSheet>
  )
}

const METHODS = [['Monta natural', 'Monta natural'], ['Inseminação', 'Inseminação']] as const

export function MatingForm({ ctx, onBack, onClose }: FormProps) {
  const { animals, penName } = useBase()
  const sows = scoped(animals, ctx).filter(isSow)
  const boars = animals.filter((x) => x.stage === 'Varrasco')
  const c = useCommon(ctx)
  const rpc = useRpc('log_mating')
  const { pending, error, run } = useSubmit(ctx, onClose)
  const [sow, setSow] = useState(firstId(ctx, sows))
  const [method, setMethod] = useState<(typeof METHODS)[number][0]>('Monta natural')
  const [boar, setBoar] = useState(boars[0]?.tag ?? '')
  const a = sows.find((x) => x.id === sow)

  const submit = () => run(async () => {
    if (!a) throw new Error('Escolha uma porca.')
    const due = await rpc.mutateAsync({ p_sow: a.id, p_method: method, p_boar: method === 'Monta natural' ? boar || undefined : undefined, p_date: c.date, p_by: c.by })
    const dueTxt = typeof due === 'string' ? ` · parto previsto ${dShort(due)}` : ''
    return `Cobertura registada · ${a.tag}${method === 'Monta natural' ? (boar ? ` × ${boar}` : '') : ' · inseminação'}${dueTxt}`
  })

  return (
    <FormSheet title="Cobertura" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit}
      effect="Calcula o parto previsto e agenda a verificação de repetição de cio aos 21 dias.">
      <AnimalSelect label="Porca" animals={sows} penName={penName} value={sow} onChange={setSow} />
      <Field label="Método"><Segmented options={METHODS} value={method} onChange={setMethod} /></Field>
      {method === 'Monta natural' && (
        <Field label="Varrasco">
          {boars.length ? (
            <Select value={boar} onChange={(e) => setBoar(e.target.value)}>
              {boars.map((b) => <option key={b.id} value={b.tag}>{b.tag} · {penName(b.pen_id)}</option>)}
            </Select>
          ) : <Input value={boar} onChange={(e) => setBoar(e.target.value)} placeholder="Identificação do varrasco" />}
        </Field>
      )}
      <CommonFields c={c} byLabel="Registado por" />
    </FormSheet>
  )
}

export function DeathForm({ ctx, onBack, onClose }: FormProps) {
  const { animals, penName } = useBase()
  const list = scoped(animals, ctx)
  const c = useCommon(ctx)
  const rpc = useRpc('log_death')
  const { pending, error, run } = useSubmit(ctx, onClose)
  const [animal, setAnimal] = useState(firstId(ctx, list))
  const [cause, setCause] = useState('Desconhecida')
  const a = animals.find((x) => x.id === animal)

  const submit = () => run(async () => {
    if (!a) throw new Error('Seleccione um animal.')
    await rpc.mutateAsync({ p_animal: a.id, p_cause: cause.trim() || 'Desconhecida', p_date: c.date, p_by: c.by })
    return `Morte registada · ${a.tag}`
  })

  return (
    <FormSheet title="Morte" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit} danger submitLabel="Registar morte"
      effect="Actualiza a ocupação do curral e o registo de mortalidade.">
      <div className="flex items-start gap-2 rounded-xl bg-warn-soft px-3.5 py-3 text-[13px] text-warn-strong">
        <Icon name="warning" size={18} />
        <span>O animal sai do efectivo e deixa de aparecer nos currais. Esta acção não pode ser desfeita.</span>
      </div>
      {ctx.animalId ? <LockedAnimal animal={a} penName={penName(a?.pen_id ?? null)} /> : <AnimalSelect animals={list} penName={penName} value={animal} onChange={setAnimal} />}
      <Field label="Causa"><Input value={cause} onChange={(e) => setCause(e.target.value)} placeholder="Desconhecida" /></Field>
      <CommonFields c={c} byLabel="Registado por" />
    </FormSheet>
  )
}

export function ActivityForm({ ctx, onBack, onClose }: FormProps) {
  const { pens, penName } = useBase()
  const { user } = useFarm()
  const c = useCommon(ctx)
  const events = useTableMutations('events')
  const { pending, error, run } = useSubmit(ctx, onClose)
  const [title, setTitle] = useState('')
  const [pen, setPen] = useState(ctx.penId ?? '')

  const submit = () => run(async () => {
    if (!title.trim()) throw new Error('Indique o título da actividade.')
    await events.insert.mutateAsync({
      event_date: c.date, kind: 'task', title: title.trim(), detail: pen ? penName(pen) : '', pen_id: pen || null,
      show_in_calendar: true, created_by_name: c.by || user.name,
    })
    return `Actividade adicionada · ${c.by} notificado`
  })

  return (
    <FormSheet title="Actividade" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit}
      effect="Aparece no calendário e notifica o responsável.">
      <Field label="Título"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Transferir animais" autoFocus /></Field>
      <Field label="Curral">
        <Select value={pen} onChange={(e) => setPen(e.target.value)}>
          <option value="">Sem curral</option>
          {pens.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <CommonFields c={c} byLabel="Responsável" />
    </FormSheet>
  )
}
