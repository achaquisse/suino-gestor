import { useState, type ReactNode } from 'react'
import { STAGES } from '@/lib/constants'
import type { Sex, Stage } from '@/lib/database.types'
import { numP, plural, todayISO, validDate } from '@/lib/format'
import { freePlaces } from '@/lib/pens'
import { useAnimals, useBreeds, usePens, useRpc } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { Button, Field, FormError, IconButton, Input, Select, Sheet, useToast } from '@/ui'

type Row = { key: number; tag: string; sex: Sex; stage: Stage; breed: string; born_on: string; weight: string }
let seq = 0
const newRow = (prev?: Row): Row => ({
  key: ++seq, tag: nextTag(prev?.tag), sex: prev?.sex ?? 'Fêmea', stage: prev?.stage ?? 'Engorda',
  breed: prev?.breed ?? '', born_on: prev?.born_on ?? '', weight: '',
})
/** "E-07" → "E-08", so a series of ear tags is quick to type. */
function nextTag(tag?: string) {
  const m = tag?.trim().toUpperCase().match(/^(.*?)(\d+)$/)
  return m ? m[1] + String(+m[2] + 1).padStart(m[2].length, '0') : ''
}

/** Animals already on the farm, added to a pen without a purchase (no expense, no quarantine). */
export function RegisterAnimalsSheet({ penId, onClose, originSwitch }: { penId?: string; onClose: () => void; originSwitch?: ReactNode }) {
  const breeds = (useBreeds().data ?? []).filter((b) => b.active)
  // Blocked ("vedado") pens take no animals.
  const pens = (usePens().data ?? []).filter((p) => !p.blocked)
  const animals = useAnimals().data ?? []
  const [pick, setPick] = useState(penId ?? '')
  const rpc = useRpc('register_animals')
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>(() => [newRow()])
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')
  const pen = pens.find((p) => p.id === pick) ?? pens[0]
  const occupied = pen ? animals.filter((a) => a.pen_id === pen.id).length : 0
  const free = pen ? freePlaces(pen, occupied) : 0
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const submit = async () => {
    if (!pen) return setError('Escolha o curral.')
    const tags = rows.map((r) => r.tag.trim().toUpperCase())
    if (tags.some((t) => !/^[A-Z0-9][A-Z0-9-]*$/.test(t))) return setError('Indique o brinco de cada animal (letras, números e hífen).')
    const dup = tags.find((t, i) => tags.indexOf(t) !== i)
    if (dup) return setError(`O brinco ${dup} está repetido.`)
    if (rows.length > free) return setError(`${pen.name} só tem ${plural(free, 'lugar livre', 'lugares livres')}.`)
    if (rows.some((r) => r.born_on && (!validDate(r.born_on) || r.born_on > todayISO()))) return setError('Verifique as datas de nascimento.')
    if (rows.some((r) => r.weight.trim() && !(numP(r.weight) > 0))) return setError('O peso deve ser maior que zero, ou ficar vazio.')
    if (!validDate(date) || date > todayISO()) return setError('Indique uma data de registo válida, até hoje.')
    try {
      const created = await rpc.mutateAsync({
        p_pen: pen.id, p_date: date,
        p_animals: rows.map((r) => ({
          tag: r.tag.trim().toUpperCase(), sex: r.sex, stage: r.stage, breed: r.breed || breeds[0]?.name || '',
          born_on: r.born_on || null, weight_kg: r.weight.trim() ? numP(r.weight) : null,
        })),
      })
      toast(`${plural(created.length, 'animal registado', 'animais registados')} · ${pen.name}`)
      onClose()
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <Sheet open onClose={onClose} title="Adicionar animais" maxWidth={720}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button>
        <Button className="flex-1" variant="primary" loading={rpc.isPending} onClick={submit}>Registar {plural(rows.length, 'animal', 'animais')}</Button></>}>
      {originSwitch}
      <div className="flex flex-col gap-3.5">
        <Field label="Curral">
          <Select value={pen?.id ?? ''} onChange={(e) => setPick(e.target.value)}>
            {!pens.length && <option value="">Sem currais disponíveis</option>}
            {pens.map((p) => {
              const f = freePlaces(p, animals.filter((a) => a.pen_id === p.id).length)
              return <option key={p.id} value={p.id}>{p.name} · {f === Infinity ? 'sem limite' : plural(f, 'lugar livre', 'lugares livres')}</option>
            })}
          </Select>
        </Field>
        <p className="m-0 -mt-1.5 text-[13px] text-muted">Animais que já estão na granja: entram no curral sem despesa nem quarentena.</p>
        {rows.map((r, i) => (
          <div key={r.key} className="flex flex-col gap-2.5 rounded-2xl border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-2">Animal {i + 1}</span>
              {rows.length > 1 && <IconButton icon="close" label={`Remover animal ${i + 1}`} size={30} iconSize={16} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />}
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Field label="Brinco"><Input value={r.tag} onChange={(e) => set(r.key, { tag: e.target.value.toUpperCase() })} placeholder="E-01" /></Field>
              <Field label="Sexo">
                <Select value={r.sex} onChange={(e) => set(r.key, { sex: e.target.value as Sex })}><option>Fêmea</option><option>Macho</option></Select>
              </Field>
              <Field label="Fase">
                <Select value={r.stage} onChange={(e) => set(r.key, { stage: e.target.value as Stage })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</Select>
              </Field>
              <Field label="Raça">
                <Select value={r.breed || breeds[0]?.name || ''} onChange={(e) => set(r.key, { breed: e.target.value })}>
                  {breeds.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Nascimento"><Input type="date" max={todayISO()} value={r.born_on} onChange={(e) => set(r.key, { born_on: e.target.value })} /></Field>
              <Field label="Peso (kg)"><Input type="number" min="0" step="any" inputMode="decimal" value={r.weight} onChange={(e) => set(r.key, { weight: e.target.value })} placeholder="Opcional" /></Field>
            </div>
          </div>
        ))}
        <Button icon="add" onClick={() => setRows((rs) => [...rs, newRow(rs[rs.length - 1])])} disabled={rows.length >= free}>Adicionar outro animal</Button>
        <Field label="Data do registo" className="max-w-[220px]"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}
