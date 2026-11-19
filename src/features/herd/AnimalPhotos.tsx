import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFarm } from '@/app/farm'
import type { Animal, AnimalPhoto } from '@/lib/database.types'
import { dLong, todayISO, validDate } from '@/lib/format'
import { signedUrl, storageSafeName, useAnimalPhotos, useTableMutations } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { Button, Card, ConfirmSheet, Empty, Field, FormError, Icon, Input, Sheet, Spinner, useToast } from '@/ui'

const MAX_MB = 10

function Thumb({ path, className }: { path: string; className?: string }) {
  const q = useQuery({ queryKey: ['animal-photo', path], queryFn: () => signedUrl('animal-photos', path), staleTime: 30 * 60_000 })
  if (q.data) return <img src={q.data} alt="" className={className ?? 'size-full object-cover'} loading="lazy" />
  return <span className="grid size-full place-items-center text-ghost">{q.isError ? <Icon name="broken_image" /> : <Spinner size={16} />}</span>
}

/** Upload: pick a file, then confirm the date it was taken (defaults to the file's date, else today). */
function UploadSheet({ animal, file, onClose }: { animal: Animal; file: File; onClose: () => void }) {
  const { farmId } = useFarm()
  const { insert } = useTableMutations('animal_photos')
  const toast = useToast()
  const fileDay = file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : ''
  const [date, setDate] = useState(fileDay && fileDay <= todayISO() ? fileDay : todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview] = useState(() => URL.createObjectURL(file))

  const save = async () => {
    if (!validDate(date) || date > todayISO()) return setError('Indique a data da foto, até hoje.')
    setBusy(true)
    setError('')
    try {
      const path = `${farmId}/${animal.id}/${Date.now()}-${storageSafeName(file.name)}`
      const up = await supabase.storage.from('animal-photos').upload(path, file, { contentType: file.type })
      if (up.error) throw up.error
      await insert.mutateAsync({ animal_id: animal.id, path, taken_on: date, note: note.trim() })
      toast('Foto adicionada')
      onClose()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title="Adicionar foto" maxWidth={460}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={busy} onClick={save}>Guardar foto</Button></>}>
      <div className="flex flex-col gap-3.5">
        <img src={preview} alt="" className="max-h-[300px] w-full rounded-2xl bg-[#F3F3F9] object-contain" />
        <Field label="Data da foto"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Nota"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional · ex.: após o desmame" /></Field>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

function PhotoSheet({ photo, latest, onClose }: { photo: AnimalPhoto; latest: boolean; onClose: () => void }) {
  const { canEditHerd } = useFarm()
  const { update, remove } = useTableMutations('animal_photos')
  const toast = useToast()
  const [date, setDate] = useState(photo.taken_on)
  const [note, setNote] = useState(photo.note)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const changed = date !== photo.taken_on || note.trim() !== photo.note

  const save = async () => {
    if (!validDate(date) || date > todayISO()) return setError('Indique a data da foto, até hoje.')
    try {
      await update.mutateAsync({ id: photo.id, taken_on: date, note: note.trim() })
      toast('Foto actualizada')
      onClose()
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <>
      <Sheet open onClose={onClose} title={`Foto de ${dLong(photo.taken_on)}`} maxWidth={720}
        footer={canEditHerd ? <>
          <Button variant="ghost" icon="delete" className="!text-danger" onClick={() => setConfirm(true)}>Eliminar</Button>
          <Button className="flex-1" onClick={onClose}>Fechar</Button>
          <Button className="flex-1" variant="primary" disabled={!changed} loading={update.isPending} onClick={save}>Guardar</Button>
        </> : undefined}>
        <div className="flex flex-col gap-3.5">
          <div className="overflow-hidden rounded-2xl bg-[#F3F3F9]"><Thumb path={photo.path} className="max-h-[60dvh] w-full object-contain" /></div>
          {latest && <span className="text-xs text-muted">É a foto mais recente: aparece como foto principal do animal.</span>}
          {canEditHerd ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr]">
              <Field label="Data da foto"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Nota"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></Field>
            </div>
          ) : photo.note && <p className="m-0 text-sm text-ink-2">{photo.note}</p>}
          <FormError>{error}</FormError>
        </div>
      </Sheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} danger title="Eliminar foto" confirmLabel="Eliminar" loading={remove.isPending}
        message="A foto é apagada do histórico do animal. Esta acção não pode ser desfeita."
        onConfirm={() => remove.mutate(photo.id, {
          onSuccess: async () => {
            await supabase.storage.from('animal-photos').remove([photo.path])
            toast('Foto eliminada'); setConfirm(false); onClose()
          },
          onError: (e) => toast(errorMessage(e), 'error'),
        })} />
    </>
  )
}

/** Photo history of an animal, newest first, grouped by the date each photo was taken. */
export function AnimalPhotos({ animal }: { animal: Animal }) {
  const { canEditHerd } = useFarm()
  const photos = useAnimalPhotos(animal.id)
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [open, setOpen] = useState<AnimalPhoto | null>(null)
  const rows = photos.data ?? []

  const pick = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return toast('Escolha uma imagem.', 'error')
    if (f.size > MAX_MB * 1024 * 1024) return toast(`A foto não pode ter mais de ${MAX_MB} MB.`, 'error')
    setFile(f)
  }

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 text-[15px] font-semibold">Fotos</h2>
          <div className="text-[13px] text-muted">{rows.length ? `${rows.length} ${rows.length === 1 ? 'foto' : 'fotos'} · a mais recente é a foto principal` : 'Registe a evolução do animal com fotos datadas'}</div>
        </div>
        {canEditHerd && !animal.removed_at && (
          <>
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
            <Button variant="primary" icon="add_a_photo" onClick={() => input.current?.click()}>Adicionar foto</Button>
          </>
        )}
      </div>
      {photos.isPending && <div className="flex justify-center py-6"><Spinner /></div>}
      {photos.isError && <p className="m-0 text-sm text-danger">{errorMessage(photos.error)}</p>}
      {photos.isSuccess && !rows.length && <Empty icon="photo_camera" title="Sem fotos" sub="As fotos ficam guardadas com a data em que foram tiradas." />}
      {rows.length > 0 && (
        <ul aria-label="Fotos" className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
          {rows.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setOpen(p)} aria-label={`Foto de ${dLong(p.taken_on)}`}
                className="group flex w-full flex-col gap-1.5 border-0 bg-transparent p-0 text-left">
                <span className="block aspect-square overflow-hidden rounded-2xl border border-line bg-[#F3F3F9] transition-transform group-hover:-translate-y-0.5">
                  <Thumb path={p.path} />
                </span>
                <span className="text-[13px] font-semibold">{dLong(p.taken_on)}</span>
                {p.note && <span className="-mt-1 truncate text-xs text-muted">{p.note}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {file && <UploadSheet animal={animal} file={file} onClose={() => setFile(null)} />}
      {open && <PhotoSheet photo={open} latest={rows[0]?.id === open.id} onClose={() => setOpen(null)} />}
    </Card>
  )
}
