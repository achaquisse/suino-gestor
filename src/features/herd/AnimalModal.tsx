import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useFarm } from '@/app/farm'
import { Button, Field, FormError, Icon, Input, Loading, Segmented, Select, Sheet, Textarea, useToast } from '@/ui'
import { STAGES } from '@/lib/constants'
import type { Sex, Stage } from '@/lib/database.types'
import { errorMessage, supabase } from '@/lib/supabase'
import { signedUrl, storageSafeName, useAccounts, useAnimals, useBreeds, usePens, useRpc, useTableMutations, useTeamNames } from '@/lib/queries'
import { dShort, numP, plural, todayISO, validDate } from '@/lib/format'
import { freePlaces } from '@/lib/pens'
import { RegisterAnimalsSheet } from './RegisterAnimalsSheet'

type Props = { mode: 'buy' | 'edit'; animalId?: string; penId?: string; onClose: () => void }

const TAG_RE = /^[A-Z0-9][A-Z0-9-]*$/

export default function AnimalModal({ mode, animalId, penId, onClose }: Props) {
  return mode === 'buy' ? <AddAnimals penId={penId} onClose={onClose} /> : <EditForm animalId={animalId} onClose={onClose} />
}

type Origin = 'compra' | 'existente'

/** "Adicionar animais": the user picks where the animals come from. A purchase also records the expense. */
function AddAnimals({ penId, onClose }: { penId?: string; onClose: () => void }) {
  const { isOwner } = useFarm()
  // Only the owner records purchases (they are an expense).
  const [origin, setOrigin] = useState<Origin>(isOwner ? 'compra' : 'existente')
  const originSwitch = (
    <Field label="Origem dos animais" className="mb-3.5">
      <Segmented className="self-start" options={(isOwner ? [['compra', 'Compra'], ['existente', 'Já na granja']] : [['existente', 'Já na granja']]) as readonly (readonly [Origin, string])[]}
        value={origin} onChange={setOrigin} />
    </Field>
  )
  return origin === 'compra'
    ? <BuyForm penId={penId} onClose={onClose} originSwitch={originSwitch} />
    : <RegisterAnimalsSheet penId={penId} onClose={onClose} originSwitch={originSwitch} />
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">{children}</div>
}

function BuyForm({ penId, onClose, originSwitch }: { penId?: string; onClose: () => void; originSwitch?: ReactNode }) {
  const nav = useNavigate()
  const toast = useToast()
  const { user, isOwner } = useFarm()
  const pens = usePens()
  const animals = useAnimals()
  const accounts = useAccounts()
  const breedsQ = useBreeds()
  const breeds = (breedsQ.data ?? []).filter((b) => b.active)
  const team = useTeamNames()
  const buy = useRpc('buy_animals')
  const [qty, setQty] = useState('10')
  const [stage, setStage] = useState<Stage>('Desmamado')
  const [sex, setSex] = useState<'Fêmea' | 'Macho' | 'Misto'>('Misto')
  const [breed, setBreed] = useState('')
  const [kg, setKg] = useState('')
  const [pen, setPen] = useState(penId ?? '')
  const [born, setBorn] = useState('')
  const [supplier, setSupplier] = useState('')
  const [price, setPrice] = useState('')
  const [account, setAccount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [by, setBy] = useState(user.name)
  const [error, setError] = useState<string | null>(null)

  const loading = pens.isPending || animals.isPending || accounts.isPending || breedsQ.isPending
  // Blocked ("vedado") pens take no animals.
  const penList = (pens.data ?? []).filter((p) => !p.blocked)
  const free = (id: string) => {
    const p = penList.find((x) => x.id === id)
    return p ? freePlaces(p, (animals.data ?? []).filter((a) => a.pen_id === id).length) : 0
  }
  const freeLabel = (id: string) => (free(id) === Infinity ? 'sem limite' : plural(free(id), 'lugar livre', 'lugares livres'))
  const accs = accounts.data ?? []
  const accountId = account || accs[0]?.id || ''
  const penId2 = pen || penList[0]?.id || ''
  const n = numP(qty)
  const total = numP(price)
  const names = [user.name, ...team.filter((t) => t !== user.name)]

  const save = async () => {
    const penRow = penList.find((p) => p.id === penId2)
    if (!Number.isSafeInteger(n) || n < 1) return setError('Indique uma quantidade inteira de animais maior que zero.')
    if (!penRow) return setError('Escolha o curral.')
    if (!breeds.some((b) => b.name === (breed || breeds[0]?.name))) return setError('Escolha uma raça activa nas definições.')
    if (n > free(penId2)) return setError(`${penRow.name} só tem ${freeLabel(penId2)}.`)
    if (!(numP(kg) > 0)) return setError('Indique o peso médio.')
    if (!(total > 0)) return setError('Indique o valor total da compra.')
    if (!accs.some((a) => a.id === accountId && a.active)) return setError('Escolha uma conta de pagamento activa.')
    if (!validDate(date)) return setError('Indique uma data de compra válida.')
    if (born && (!validDate(born) || born > date)) return setError('Indique uma data de nascimento válida, anterior à compra.')
    if (!by.trim()) return setError('Indique o responsável pela compra.')
    setError(null)
    try {
      await buy.mutateAsync({
        p_qty: n, p_stage: stage, p_sex: sex, p_breed: breed || breeds[0].name, p_kg: numP(kg), p_pen: penId2,
        p_born: (born || null) as unknown as string, p_supplier: supplier.trim(), p_price: total, p_account: accountId, p_date: date, p_by: by,
      })
      toast(`${plural(n, 'animal registado', 'animais registados')} · ${penRow.name}`)
      onClose()
      nav(`/herd/pens/${penId2}`)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Sheet open onClose={onClose} title="Adicionar animais" maxWidth={560}
      footer={isOwner && !loading ? <><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-[2]" variant="primary" loading={buy.isPending} onClick={save}>Registar compra</Button></> : undefined}>
      {originSwitch}
      <p className="m-0 mb-4 -mt-2 text-[13px] text-muted">Cria os animais no curral e lança a despesa de compra</p>
      {loading ? <Loading /> : !isOwner ? (
        <FormError>Apenas o proprietário pode registar compras de animais.</FormError>
      ) : !penList.length ? (
        <FormError>Crie primeiro um curral nas definições.</FormError>
      ) : !accs.length ? (
        <FormError>Crie primeiro uma conta de pagamento nas definições.</FormError>
      ) : breedsQ.error ? (
        <FormError>Não foi possível carregar as raças.</FormError>
      ) : !breeds.length ? (
        <FormError>Configure raças nas definições antes de registar animais.</FormError>
      ) : (
        <div className="flex flex-col gap-3.5">
          <Row>
            <Field label="Quantidade"><Input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Fase">
              <Select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>{STAGES.map((s) => <option key={s}>{s}</option>)}</Select>
            </Field>
          </Row>
          <Field label="Sexo">
            <Segmented options={[['Fêmea', 'Fêmea'], ['Macho', 'Macho'], ['Misto', 'Misto']] as const} value={sex} onChange={setSex} className="w-full [&>button]:flex-1" />
          </Field>
          <Row>
            <Field label="Raça">
              <Select value={breed || breeds[0]?.name || ''} onChange={(e) => setBreed(e.target.value)}>{breeds.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}</Select>
            </Field>
            <Field label="Peso médio (kg)"><Input type="number" min="0" step="any" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="ex. 12" /></Field>
          </Row>
          <Field label="Curral">
            <Select value={penId2} onChange={(e) => setPen(e.target.value)}>
              {penList.map((p) => <option key={p.id} value={p.id}>{p.name} · {freeLabel(p.id)}</option>)}
            </Select>
          </Field>
          <Row>
            <Field label="Data de nascimento" hint="Opcional"><Input type="date" max={todayISO()} value={born} onChange={(e) => setBorn(e.target.value)} /></Field>
            <Field label="Fornecedor"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="ex. Granja Beira" /></Field>
          </Row>
          <Row>
            <Field label="Valor total (MT)"><Input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /></Field>
            <Field label="Conta de pagamento">
              <Select value={accountId} onChange={(e) => setAccount(e.target.value)}>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
            </Field>
          </Row>
          <Row>
            <Field label="Data da compra"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Responsável">
              <Select value={by} onChange={(e) => setBy(e.target.value)}>{names.map((t) => <option key={t} value={t}>{t === user.name ? `${t} (eu)` : t}</option>)}</Select>
            </Field>
          </Row>
          <div className="grid grid-cols-3 gap-2.5">
            {[['Brincos a criar', n ? String(n) : '—'], ['Preço por animal', n && total ? `${Math.round(total / n)} MT` : '—'], ['Lugares livres', free(penId2) === Infinity ? 'Sem limite' : String(free(penId2))]].map(([l, v]) => (
              <div key={l} className="flex flex-col gap-0.5 rounded-[14px] bg-[#F7F7FB] p-3"><span className="text-xs text-muted">{l}</span><span className="tabular font-semibold">{v}</span></div>
            ))}
          </div>
          <p className="m-0 text-[13px] text-muted">Os animais entram em quarentena de 21 dias e a despesa é lançada em Despesas · Animais{date ? ` (${dShort(date)})` : ''}.</p>
          <FormError>{error}</FormError>
        </div>
      )}
    </Sheet>
  )
}

function EditForm({ animalId, onClose }: { animalId?: string; onClose: () => void }) {
  const toast = useToast()
  const nav = useNavigate()
  const { farmId } = useFarm()
  const animals = useAnimals()
  const pens = usePens()
  const breedsQ = useBreeds()
  const { update } = useTableMutations('animals')
  const animal = animals.data?.find((a) => a.id === animalId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<{ tag: string; sex: Sex; stage: Stage; breed: string; born: string; notes: string } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const photo = useQuery({ queryKey: ['animal-photo', animal?.photo_path], queryFn: () => signedUrl('animal-photos', animal!.photo_path!), enabled: !!animal?.photo_path, staleTime: 30 * 60_000 })

  const f = draft ?? (animal ? { tag: animal.tag, sex: animal.sex, stage: animal.stage, breed: animal.breed, born: animal.born_on ?? '', notes: animal.notes } : null)
  const patch = (p: Partial<NonNullable<typeof f>>) => f && setDraft({ ...f, ...p })
  const penName = pens.data?.find((p) => p.id === animal?.pen_id)?.name ?? '—'
  const breeds = [...new Set([...(breedsQ.data ?? []).filter((b) => b.active).map((b) => b.name), animal?.breed].filter((b): b is string => !!b))]

  const pick = (fl: File | undefined) => {
    if (!fl) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(fl)
    setPreview(URL.createObjectURL(fl))
  }

  const save = async () => {
    if (!animal || !f) return
    const tag = f.tag.trim().toUpperCase()
    if (!tag) return setError('Indique o brinco do animal.')
    if (!TAG_RE.test(tag)) return setError('O brinco só pode ter letras, números e hífens.')
    if ((animals.data ?? []).some((a) => a.id !== animal.id && a.tag === tag)) return setError(`O brinco ${tag} já existe.`)
    if (!f.born) return setError('Indique a data de nascimento.')
    if (f.born > todayISO()) return setError('A data de nascimento não pode ser no futuro.')
    setError(null)
    setBusy(true)
    try {
      let photo_path = animal.photo_path
      if (file) {
        const path = `${farmId}/${animal.id}/${Date.now()}-${storageSafeName(file.name)}`
        const up = await supabase.storage.from('animal-photos').upload(path, file, { contentType: file.type })
        if (up.error) throw up.error
        // Kept in the photo history (dated today); the most recent photo is the main one.
        const { error: phErr } = await supabase.from('animal_photos').insert({ farm_id: farmId, animal_id: animal.id, path, taken_on: todayISO() })
        if (phErr) throw phErr
        photo_path = path
      }
      await update.mutateAsync({ id: animal.id, tag, sex: f.sex, stage: f.stage, breed: f.breed, born_on: f.born, notes: f.notes.trim(), photo_path })
      if (tag !== animal.tag) {
        const refs = (animals.data ?? []).filter((a) => a.id !== animal.id && a.parents.split('×').map((x) => x.trim()).includes(animal.tag))
        for (const r of refs) {
          const parents = r.parents.split('×').map((x) => (x.trim() === animal.tag ? tag : x.trim())).join(' × ')
          await update.mutateAsync({ id: r.id, parents })
        }
        nav(`/herd/animals/${encodeURIComponent(tag)}`, { replace: true })
      }
      toast('Animal actualizado')
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const img = preview ?? photo.data

  return (
    <Sheet open onClose={onClose} title="Editar animal" maxWidth={520}
      footer={animal ? <><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-[2]" variant="primary" loading={busy} onClick={save}>Guardar alterações</Button></> : undefined}>
      {animals.isPending || pens.isPending || breedsQ.isPending ? <Loading /> : !animal || !f ? (
        <FormError>Animal não encontrado.</FormError>
      ) : (
        <div className="flex flex-col gap-3.5">
          <p className="m-0 -mt-2 text-[13px] text-muted">{animal.tag} · {penName}</p>
          <div className="flex items-center gap-3.5">
            <div className="relative grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-[#F3F3F9] text-ghost">
              {img ? <img src={img} alt="" className="size-full object-cover" /> : <Icon name="photo_camera" size={26} />}
            </div>
            <div className="flex flex-col items-start gap-1">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
              <Button size="sm" icon="upload" onClick={() => fileRef.current?.click()}>{img ? 'Mudar foto' : 'Adicionar foto'}</Button>
              <span className="text-xs text-muted">{file ? file.name : 'JPG ou PNG'}</span>
            </div>
          </div>
          <Row>
            <Field label="Brinco"><Input value={f.tag} onChange={(e) => patch({ tag: e.target.value.toUpperCase() })} className="tabular" /></Field>
            <Field label="Curral"><Input value={penName} disabled /></Field>
          </Row>
          <Field label="Sexo">
            <Segmented options={[['Fêmea', 'Fêmea'], ['Macho', 'Macho']] as const} value={f.sex} onChange={(v) => patch({ sex: v })} className="w-full [&>button]:flex-1" />
          </Field>
          <Row>
            <Field label="Fase"><Select value={f.stage} onChange={(e) => patch({ stage: e.target.value as Stage })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Raça"><Select value={f.breed} onChange={(e) => patch({ breed: e.target.value })}>{breeds.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          </Row>
          <Field label="Data de nascimento"><Input type="date" max={todayISO()} value={f.born} onChange={(e) => patch({ born: e.target.value })} /></Field>
          <Field label="Notas"><Textarea value={f.notes} onChange={(e) => patch({ notes: e.target.value })} /></Field>
          <p className="m-0 text-[13px] text-muted">Para mudar de curral use Transferir; o peso actualiza-se com uma nova pesagem.</p>
          <FormError>{error}</FormError>
        </div>
      )}
    </Sheet>
  )
}
