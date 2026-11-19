import { useId, useState, type ReactNode } from 'react'
import { useFarm } from '@/app/farm'
import type { LogContext } from '@/app/overlays'
import { errorMessage } from '@/lib/supabase'
import { useAnimals, usePens, useTableMutations, useTeamNames } from '@/lib/queries'
import { todayISO } from '@/lib/format'
import type { Animal } from '@/lib/database.types'
import { Button, Field, FormError, Icon, Input, Select, Sheet, cx, useToast } from '@/ui'

export type FormProps = { ctx: LogContext; onBack?: () => void; onClose: () => void }

export function useSubmit(ctx: LogContext, onClose: () => void) {
  const toast = useToast()
  const { user } = useFarm()
  const tasks = useTableMutations('tasks')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<string>) => {
    setPending(true)
    setError(null)
    try {
      const msg = await fn()
      if (ctx.taskId) await tasks.update.mutateAsync({ id: ctx.taskId, done_at: new Date().toISOString(), done_by: user.name })
      toast(msg)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }
  return { pending, error, run }
}

export function useBase() {
  const pens = usePens().data ?? []
  const animals = useAnimals().data ?? []
  const penName = (id: string | null) => pens.find((p) => p.id === id)?.name ?? '—'
  const count = (penId: string) => animals.filter((a) => a.pen_id === penId).length
  return { pens, animals, penName, count }
}

export function useCommon(ctx: LogContext) {
  const { user } = useFarm()
  const team = useTeam()
  const [date, setDate] = useState(ctx.day ?? todayISO())
  const [by, setBy] = useState(user.name)
  return { date, setDate, by, setBy, team }
}
export type Common = ReturnType<typeof useCommon>

function useTeam() {
  const { user } = useFarm()
  const names = useTeamNames()
  return [...new Set([user.name, ...names])]
}

export function CommonFields({ c, byLabel }: { c: Common; byLabel: string }) {
  const { user } = useFarm()
  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
      <Field label="Data"><Input type="date" required value={c.date} onChange={(e) => c.setDate(e.target.value)} /></Field>
      <Field label={byLabel}>
        <Select required value={c.by} onChange={(e) => c.setBy(e.target.value)}>
          {c.team.map((n) => <option key={n} value={n}>{n}{n === user.name ? ' (eu)' : ''}</option>)}
        </Select>
      </Field>
    </div>
  )
}

export function FormSheet({ title, onBack, onClose, pending, error, effect, submitLabel = 'Guardar', danger, onSubmit, children }: {
  title: string; onBack?: () => void; onClose: () => void; pending: boolean; error: string | null; effect?: ReactNode
  submitLabel?: string; danger?: boolean; onSubmit: () => void; children: ReactNode
}) {
  const formId = useId()
  return (
    <Sheet open onClose={onClose} title={title} onBack={onBack}
      footer={<Button type="submit" form={formId} size="lg" className="flex-1" variant={danger ? 'danger' : 'primary'} loading={pending}>{submitLabel}</Button>}>
      <form id={formId} onSubmit={(e) => { e.preventDefault(); if (!pending) onSubmit() }} className="flex flex-col gap-4">
        {children}
        <FormError>{error}</FormError>
        {effect && (
          <div className="flex items-start gap-2 rounded-xl bg-accent-wash px-3.5 py-3 text-[13px] text-ink-2">
            <Icon name="bolt" size={18} className="mt-px text-accent" />
            <span>{effect}</span>
          </div>
        )}
      </form>
    </Sheet>
  )
}

export function LockedAnimal({ animal, penName }: { animal: Animal | undefined; penName: string }) {
  return (
    <Field label="Animal">
      <div className="flex h-[46px] items-center gap-2.5 rounded-[13px] border border-line bg-[#F7F7FB] px-3">
        <Icon name="lock" size={18} className="text-ghost" />
        <span className="tabular font-semibold">{animal?.tag ?? '—'}</span>
        {animal && <span className="truncate text-[13px] text-muted">{animal.stage} · {penName}</span>}
      </div>
    </Field>
  )
}

export function AnimalSelect({ animals, penName, value, onChange, label = 'Animal' }: {
  animals: Animal[]; penName: (id: string | null) => string; value: string; onChange: (id: string) => void; label?: string
}) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {animals.length === 0 && <option value="">Sem animais</option>}
        {animals.map((a) => <option key={a.id} value={a.id}>{a.tag} · {a.stage} · {penName(a.pen_id)}</option>)}
      </Select>
    </Field>
  )
}

export const scoped = (animals: Animal[], ctx: LogContext) =>
  ctx.penId && !ctx.animalId ? animals.filter((a) => a.pen_id === ctx.penId) : animals

export const firstId = (ctx: LogContext, list: Animal[]) =>
  ctx.animalId && list.some((a) => a.id === ctx.animalId) ? ctx.animalId : (list[0]?.id ?? '')

export const isSow = (a: Animal) => a.stage === 'Porca' || a.stage === 'Leitoa'

/** A toggle chip, for picking animals. */
export function Chipper({ on, icon, onClick, children, title, tab }: { on: boolean; icon?: string; onClick: () => void; children: ReactNode; title?: string; tab?: boolean }) {
  return (
    <button type="button" title={title} aria-pressed={on} onClick={onClick}
      className={cx('flex h-9 items-center gap-1 rounded-full border-[1.5px] px-3 text-[13px] font-semibold', tab && 'tabular',
        on ? 'border-accent bg-accent-wash text-accent-strong' : 'border-line-strong bg-white text-ink-2')}>
      {icon && <Icon name={icon} size={14} />}{children}
    </button>
  )
}
