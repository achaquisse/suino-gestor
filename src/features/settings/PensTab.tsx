import { useState } from 'react'
import { useFarm } from '@/app/farm'
import type { Pen, PenRole } from '@/lib/database.types'
import { numP } from '@/lib/format'
import { PEN_ICONS, PEN_ROLES, capacityLabel, penVisual, roleOf } from '@/lib/pens'
import { useAnimals, usePens, useTableMutations } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { Button, Card, Chip, ConfirmSheet, ErrorState, Field, FormError, Icon, Input, Loading, Select, Sheet, Toggle, cx, useToast } from '@/ui'
import { COLS, PenLayout, overlaps, type Rect } from '@/features/herd/PenLayout'

/* ---------------------------------------------------------------- Pen form */

type Draft = {
  id?: string; name: string; kind: string; role: PenRole; capacity: string; color: string; icon: string
  w: string; h: string; blocked: boolean; blocked_reason: string
}
const blank: Draft = { name: '', kind: '', role: 'engorda', capacity: '', color: '', icon: '', w: '4', h: '3', blocked: false, blocked_reason: '' }
const draftOf = (p: Pen): Draft => ({
  id: p.id, name: p.name, kind: p.kind, role: p.role, capacity: p.capacity == null ? '' : String(p.capacity),
  color: p.color ?? '', icon: p.icon ?? '', w: String(p.w), h: String(p.h), blocked: p.blocked, blocked_reason: p.blocked_reason,
})
const COLORS = [...new Set(PEN_ROLES.map((r) => r.color))]

function PenSheet({ draft, pens, animals, onClose }: { draft: Draft | null; pens: Pen[]; animals: number; onClose: () => void }) {
  const { insert, update, remove } = useTableMutations('pens')
  const toast = useToast()
  const [d, setD] = useState<Draft>(draft ?? blank)
  const [seen, setSeen] = useState(draft)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (seen !== draft) { setSeen(draft); setD(draft ?? blank); setError('') }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))
  const role = roleOf(d.role)
  const [icon, bg, fg] = penVisual({ role: d.role, color: d.color || null, icon: d.icon || null })
  const editing = !!d.id
  const current = pens.find((p) => p.id === d.id)

  const submit = async () => {
    if (!d.name.trim()) return setError('Indique o nome do curral.')
    if (pens.some((p) => p.id !== d.id && p.name.trim().toLowerCase() === d.name.trim().toLowerCase())) return setError('Já existe um curral com esse nome.')
    const capacity = d.capacity.trim() ? numP(d.capacity) : null
    if (capacity != null && !(Number.isInteger(capacity) && capacity > 0)) return setError('A capacidade deve ser um número inteiro maior que zero, ou ficar vazia.')
    if (capacity != null && editing && capacity < animals) return setError(`O curral tem ${animals} animais; a capacidade não pode ser menor.`)
    const w = numP(d.w), h = numP(d.h)
    if (![w, h].every((v) => Number.isInteger(v) && v >= 1 && v <= COLS)) return setError(`Largura e comprimento entre 1 e ${COLS}.`)
    const row = {
      name: d.name.trim(), kind: d.kind.trim(), role: d.role, capacity, color: d.color || null, icon: d.icon || null,
      w, h, blocked: d.blocked, blocked_reason: d.blocked ? d.blocked_reason.trim() : '',
    }
    // A larger pen must still fit where it is.
    if (current && pens.some((o) => o.id !== current.id && overlaps({ x: current.x, y: current.y, w, h }, o)))
      return setError('Com esse tamanho o curral sobrepõe-se a outro. Mova-o primeiro no esquema.')
    if (current && current.x + w > COLS) return setError('Com essa largura o curral sai do esquema. Mova-o primeiro para a esquerda.')
    try {
      if (editing) await update.mutateAsync({ id: d.id!, ...row })
      else await insert.mutateAsync({ ...row, sort: pens.length + 1 })
      toast(editing ? 'Curral actualizado' : 'Curral criado')
      onClose()
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <>
      <Sheet open={!!draft} onClose={onClose} title={editing ? 'Editar curral' : 'Novo curral'} maxWidth={520}
        footer={<>
          {editing && <Button variant="ghost" icon="delete" className="!text-danger" onClick={() => setConfirmDelete(true)}>Eliminar</Button>}
          <Button className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" variant="primary" loading={insert.isPending || update.isPending} onClick={submit}>Guardar</Button>
        </>}>
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3 rounded-2xl border-2 p-3" style={{ borderColor: fg, background: d.blocked ? undefined : bg }}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white" style={{ color: fg }}><Icon name={d.blocked ? 'block' : icon} /></span>
            <div className="min-w-0">
              <div className="truncate font-semibold">{d.name || 'Novo curral'}</div>
              <div className="text-xs text-muted">{role.label}{d.blocked ? ' · vedado' : ''} · {d.capacity.trim() ? `${d.capacity} lugares` : 'sem limite'}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome"><Input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Engorda C" autoFocus={!editing} /></Field>
            <Field label="Função">
              <Select value={d.role} onChange={(e) => set('role', e.target.value as PenRole)}>
                {PEN_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Descrição"><Input value={d.kind} onChange={(e) => set('kind', e.target.value)} placeholder="Opcional · ex.: porcas em lactação" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Capacidade máxima" hint="Vazio = sem limite">
              <Input type="number" min="1" step="1" inputMode="numeric" value={d.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="Sem limite" />
            </Field>
            <Field label="Largura" hint="no esquema"><Input type="number" min="1" max={COLS} step="1" value={d.w} onChange={(e) => set('w', e.target.value)} /></Field>
            <Field label="Comprimento" hint="no esquema"><Input type="number" min="1" max={COLS} step="1" value={d.h} onChange={(e) => set('h', e.target.value)} /></Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Cor</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => set('color', '')} aria-pressed={!d.color}
                className={cx('h-8 rounded-full border-2 px-3 text-xs font-semibold', !d.color ? 'border-ink' : 'border-line-strong')}>Da função</button>
              {COLORS.map((c) => (
                <button key={c} type="button" aria-label={c} aria-pressed={d.color === c} onClick={() => set('color', c)}
                  className={cx('h-8 w-8 rounded-full border-2 transition-transform', d.color === c ? 'scale-110 border-ink' : 'border-transparent')}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Ícone</span>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => set('icon', '')} aria-pressed={!d.icon}
                className={cx('h-9 rounded-xl border-2 px-3 text-xs font-semibold', !d.icon ? 'border-ink' : 'border-line-strong')}>Da função</button>
              {PEN_ICONS.map((i) => (
                <button key={i} type="button" aria-label={i} aria-pressed={d.icon === i} onClick={() => set('icon', i)}
                  className={cx('grid h-9 w-9 place-items-center rounded-xl border-2 bg-white', d.icon === i ? 'border-ink' : 'border-line')}
                  style={{ color: fg }}><Icon name={i} size={18} /></button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-line p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-sm font-semibold">Vedado</span>
                <span className="text-xs text-muted">Indisponível para uso: não recebe animais (compras e transferências).</span>
              </span>
              <Toggle checked={d.blocked} onChange={(v) => set('blocked', v)} label="Vedado" />
            </div>
            {d.blocked && <Field label="Motivo"><Input value={d.blocked_reason} onChange={(e) => set('blocked_reason', e.target.value)} placeholder="Opcional · ex.: obras, limpeza, vazio sanitário" /></Field>}
          </div>
          <FormError>{error}</FormError>
        </div>
      </Sheet>
      <ConfirmSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} danger loading={remove.isPending}
        title="Eliminar curral" confirmLabel="Eliminar"
        message={animals ? `${d.name} tem ${animals} animais. Transfira-os antes de eliminar o curral.` : `Eliminar ${d.name}? O histórico dos animais mantém-se.`}
        onConfirm={() => {
          if (animals) return setConfirmDelete(false)
          remove.mutate(d.id!, {
            onSuccess: () => { toast('Curral eliminado'); setConfirmDelete(false); onClose() },
            onError: (e) => toast(errorMessage(e), 'error'),
          })
        }} />
    </>
  )
}

/* ---------------------------------------------------------------- Tab */

export default function PensTab() {
  const { isOwner } = useFarm()
  const pensQ = usePens()
  const animalsQ = useAnimals()
  const { update } = useTableMutations('pens')
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  if (pensQ.isPending || animalsQ.isPending) return <Loading />
  if (pensQ.error) return <ErrorState error={pensQ.error} retry={() => pensQ.refetch()} />
  const pens = pensQ.data ?? []
  const counts = new Map<string, number>()
  for (const a of animalsQ.data ?? []) if (a.pen_id) counts.set(a.pen_id, (counts.get(a.pen_id) ?? 0) + 1)
  const used = new Set(pens.map((p) => p.role))

  const place = async (p: Pen, r: Rect) => {
    try { await update.mutateAsync({ id: p.id, ...r }); return true } catch (e) { toast(errorMessage(e), 'error'); return false }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold">Esquema dos currais</h2>
            <p className="m-0 mt-0.5 text-[13px] text-muted">
              {isOwner
                ? 'Arraste os currais para os dispor como na granja e puxe o canto para mudar o tamanho. Toque num curral para o editar.'
                : 'Disposição dos currais da granja. Toque num curral para ver os detalhes.'}
            </p>
          </div>
          {isOwner && <Button variant="primary" icon="add" onClick={() => setDraft({ ...blank })}>Novo curral</Button>}
        </div>
        <PenLayout pens={pens} counts={counts} editable={isOwner} onOpen={(p) => setDraft(draftOf(p))} onPlace={place} />
        <div className="flex flex-wrap gap-1.5" aria-label="Legenda">
          {PEN_ROLES.filter((r) => used.has(r.id)).map((r) => (
            <span key={r.id} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs">
              <Icon name={r.icon} size={14} style={{ color: r.color }} />{r.label}
            </span>
          ))}
          {pens.some((p) => p.blocked) && <Chip tone="red" icon="block">Vedado</Chip>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3"><h2 className="m-0 text-base font-semibold">Currais</h2></div>
        {pens.map((p) => {
          const [icon, bg, fg] = penVisual(p)
          const n = counts.get(p.id) ?? 0
          return (
            <button key={p.id} type="button" onClick={() => setDraft(draftOf(p))}
              className="flex w-full items-center gap-3 border-0 border-t border-divider bg-white px-5 py-3 text-left hover:bg-[#FAFAFD]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: bg, color: fg }}><Icon name={icon} size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">{p.name}{p.blocked && <Chip tone="red" icon="block">Vedado</Chip>}</span>
                <span className="block truncate text-xs text-muted">{roleOf(p.role).label}{p.kind ? ` · ${p.kind}` : ''}{p.blocked && p.blocked_reason ? ` · ${p.blocked_reason}` : ''}</span>
              </span>
              <span className="tabular shrink-0 text-sm">{n} / {capacityLabel(p)}</span>
            </button>
          )
        })}
      </Card>

      {isOwner
        ? <PenSheet draft={draft} pens={pens} animals={draft?.id ? counts.get(draft.id) ?? 0 : 0} onClose={() => setDraft(null)} />
        : draft && <ReadOnlyPen pen={pens.find((p) => p.id === draft.id)} n={draft.id ? counts.get(draft.id) ?? 0 : 0} onClose={() => setDraft(null)} />}
    </div>
  )
}

function ReadOnlyPen({ pen, n, onClose }: { pen?: Pen; n: number; onClose: () => void }) {
  if (!pen) return null
  const [icon, bg, fg] = penVisual(pen)
  return (
    <Sheet open onClose={onClose} title={pen.name} maxWidth={420}>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: bg, color: fg }}><Icon name={icon} /></span>
          <span>{roleOf(pen.role).label}{pen.kind ? ` · ${pen.kind}` : ''}</span>
        </div>
        <div>Ocupação: <strong>{n} / {capacityLabel(pen)}</strong></div>
        {pen.blocked && <div className="text-danger">Vedado{pen.blocked_reason ? ` · ${pen.blocked_reason}` : ''}</div>}
      </div>
    </Sheet>
  )
}

