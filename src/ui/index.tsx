import {
  createContext, use, useCallback, useEffect, useEffectEvent, useId, useRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { TONE } from '@/lib/constants'
import type { Tone } from '@/lib/database.types'
import { setUrlParams, useUrlNumber } from '@/lib/urlState'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------------------------------------------------------------- Icon */
export function Icon({ name, size = 20, fill = false, className, style }: { name: string; size?: number; fill?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      className={cx('font-icon inline-block shrink-0 select-none font-normal leading-none [font-synthesis:none]', className)}
      style={{ fontSize: size, width: size, height: size, fontVariationSettings: `'FILL' ${fill ? 1 : 0}`, ...style }}
    >
      {name}
    </span>
  )
}

/* ---------------------------------------------------------------- Layout */
export function Card({ className, children, as: As = 'section', style }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article'; style?: CSSProperties }) {
  return <As style={style} className={cx('rounded-card border border-line bg-white shadow-card', className)}>{children}</As>
}

export function CardHeader({ title, sub, right, className }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-start justify-between gap-3 px-5 pt-5 pb-3', className)}>
      <div className="min-w-0">
        <h2 className="m-0 text-base font-semibold tracking-tight">{title}</h2>
        {sub && <p className="m-0 mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function PageHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 animate-pf-up">
      <div className="min-w-0">
        <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em] wide:text-[30px]">{title}</h1>
        {sub && <p className="m-0 mt-1 text-ink-2">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-[11px] font-semibold uppercase tracking-[0.06em] text-faint', className)}>{children}</div>
}

/* ---------------------------------------------------------------- Chips */
export function Chip({ tone = 'neutral', children, className, icon }: { tone?: Tone | 'success'; children: ReactNode; className?: string; icon?: string }) {
  const [bg, fg] = TONE[tone]
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-[3px] text-xs font-medium', className)} style={{ background: bg, color: fg }}>
      {icon && <Icon name={icon} size={14} />}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
}

export function IconTile({ icon, bg, fg, size = 40, iconSize = 20, className }: { icon: string; bg: string; fg: string; size?: number; iconSize?: number; className?: string }) {
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-xl', className)} style={{ width: size, height: size, background: bg, color: fg }}>
      <Icon name={icon} size={iconSize} />
    </span>
  )
}

export function Avatar({ initials, size = 36, gradient = false, className }: { initials: string; size?: number; gradient?: boolean; className?: string }) {
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full font-semibold', gradient ? 'bg-brand text-white' : 'bg-[#E7E5FD] text-accent-strong', className)}
      style={{ width: size, height: size, fontSize: size < 32 ? 11 : 13 }}
    >
      {initials}
    </span>
  )
}

export function Progress({ value, color = 'var(--color-accent)', className, height = 6 }: { value: number; color?: string; className?: string; height?: number }) {
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-sunken', className)} style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-pf" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  )
}

/* ---------------------------------------------------------------- Buttons */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: string; loading?: boolean }

const btnBase = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] border font-semibold transition-[background,box-shadow,transform,border-color,color] duration-200 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100'
const btnVariant: Record<BtnVariant, string> = {
  primary: 'border-transparent bg-cta text-white shadow-cta hover:bg-cta-hover hover:shadow-cta-hover',
  secondary: 'border-line-strong bg-white text-ink hover:border-[#D4D4E2] hover:bg-[#F7F7FB]',
  ghost: 'border-transparent bg-transparent text-ink-2 hover:bg-hover',
  danger: 'border-transparent bg-danger-soft text-danger hover:bg-[#FBDCD8]',
  soft: 'border-transparent bg-accent-soft text-accent-strong hover:bg-[#E3E0FD]',
}
const btnSize = { sm: 'h-9 px-3 text-[13px]', md: 'h-11 px-4 text-sm', lg: 'h-[52px] px-5 text-[15px]' }

export function Button({ variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button type="button" {...rest} disabled={disabled || loading} className={cx(btnBase, btnVariant[variant], btnSize[size], className)}>
      {loading ? <Spinner size={16} light={variant === 'primary'} /> : icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant = 'secondary', size = 'md', icon, className, children }: { to: string; variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: string; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cx(btnBase, btnVariant[variant], btnSize[size], 'hover:no-underline', variant === 'primary' ? 'hover:text-white' : 'hover:text-ink', className)}>
      {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      {children}
    </Link>
  )
}

export function IconButton({ icon, label, className, size = 40, iconSize = 20, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; size?: number; iconSize?: number }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={cx('grid shrink-0 place-items-center rounded-[10px] border-0 bg-transparent text-ink-2 transition-colors hover:bg-hover active:scale-[0.97]', className)}
      style={{ width: size, height: size }}>
      <Icon name={icon} size={iconSize} />
    </button>
  )
}

export function Spinner({ size = 18, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className={cx('inline-block shrink-0 animate-pf-spin rounded-full border-2', light ? 'border-white/40 border-t-white' : 'border-line-strong border-t-accent')} style={{ width: size, height: size }} />
  )
}

/* ---------------------------------------------------------------- Segmented */
export function Segmented<T extends string>({ options, value, onChange, className, size = 'md' }: { options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" className={cx('inline-flex gap-0.5 rounded-xl bg-sunken p-[3px]', className)}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="tab" aria-selected={v === value} onClick={() => onChange(v)}
          className={cx('rounded-[9px] border-0 font-semibold transition-all', size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
            v === value ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'bg-transparent text-muted hover:text-ink')}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({ options, value, onChange, className }: { options: readonly (readonly [T, string, string?])[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('no-scrollbar flex gap-1 overflow-x-auto', className)}>
      {options.map(([v, l, icon]) => (
        <button key={v} type="button" role="tab" aria-selected={v === value} onClick={() => onChange(v)}
          className={cx('flex h-10 shrink-0 items-center gap-2 rounded-xl border-0 px-3.5 text-sm transition-colors',
            v === value ? 'bg-accent-soft font-semibold text-accent-strong' : 'bg-transparent font-medium text-ink-2 hover:bg-hover')}>
          {icon && <Icon name={icon} size={18} fill={v === value} />}
          {l}
        </button>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- Form fields */
const inputCls = 'h-[46px] w-full min-w-0 rounded-[13px] border border-line-strong bg-white px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ghost focus:border-accent focus:shadow-[0_0_0_3px_rgba(91,76,240,0.14)] disabled:bg-[#F7F7FB] disabled:text-muted'

export function Field({ label, hint, error, children, className, right }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      {(label || right) && (
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink-2">{label}</span>
          {right}
        </span>
      )}
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputCls, className)} />
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={cx(inputCls, 'cursor-pointer', className)}>{children}</select>
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputCls, 'h-auto min-h-[84px] py-2.5', className)} />
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx('relative', className)}>
      <Icon name="search" size={20} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type="search" className={cx(inputCls, 'pl-10')} />
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx('relative h-[26px] w-[44px] shrink-0 rounded-full border-0 transition-colors', checked ? 'bg-accent' : 'bg-[#D4D4E2]')}>
      <span className={cx('absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200', checked ? 'left-[21px]' : 'left-[3px]')} />
    </button>
  )
}

export function Stepper({ value, onChange, min = 0, max = 999 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex h-[46px] items-center overflow-hidden rounded-[13px] border border-line-strong bg-white">
      <button type="button" aria-label="Menos" onClick={() => onChange(Math.max(min, value - 1))} className="grid h-full w-11 place-items-center border-0 bg-transparent hover:bg-hover"><Icon name="remove" /></button>
      <input type="number" min={min} max={max} step={1} value={value}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && e.target.value !== '') onChange(Math.max(min, Math.min(max, n))) }}
        className="tabular h-full w-full min-w-0 border-0 text-center font-semibold outline-none" />
      <button type="button" aria-label="Mais" onClick={() => onChange(Math.min(max, value + 1))} className="grid h-full w-11 place-items-center border-0 bg-transparent hover:bg-hover"><Icon name="add" /></button>
    </div>
  )
}

export function ChoiceChips<T extends string>({ options, value, onChange, multi }: { options: readonly T[]; value: T | T[]; onChange: (v: T) => void; multi?: boolean }) {
  const isOn = (o: T) => (multi ? (value as T[]).includes(o) : value === o)
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={isOn(o)} onClick={() => onChange(o)}
          className={cx('h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
            isOn(o) ? 'border-accent bg-accent-wash text-accent-strong' : 'border-line-strong bg-white text-ink-2 hover:border-[#D4D4E2]')}>
          {o}
        </button>
      ))}
    </div>
  )
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] text-danger animate-pf-pop">
      <Icon name="error" size={18} />
      <span>{children}</span>
    </div>
  )
}

/* ---------------------------------------------------------------- Sheet / Modal */
// Open sheets, innermost last: only the top one reacts to Escape (a ConfirmSheet over a form).
const sheetStack: symbol[] = []

export function Sheet({ open, onClose, title, onBack, children, footer, maxWidth = 520 }: {
  open: boolean; onClose: () => void; title: ReactNode; onBack?: () => void; children: ReactNode; footer?: ReactNode; maxWidth?: number
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onEscape = useEffectEvent(onClose)
  useEffect(() => {
    if (!open) return
    const me = Symbol()
    sheetStack.push(me)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sheetStack.at(-1) === me) onEscape()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog, and give it back to the opener on close.
    const opener = document.activeElement as HTMLElement | null
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus({ preventScroll: true })
    return () => {
      sheetStack.splice(sheetStack.indexOf(me), 1)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-50 flex animate-pf-fade items-end justify-center bg-[rgba(22,22,40,0.32)] backdrop-blur-[6px] wide:items-center wide:p-6">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full animate-pf-sheet flex-col overflow-hidden rounded-t-[22px] bg-white shadow-sheet outline-none wide:rounded-[20px]"
        style={{ maxWidth }}>
        <div className={cx('overflow-y-auto overscroll-contain px-5 pt-2.5', footer ? 'pb-5' : 'pb-[max(20px,env(safe-area-inset-bottom))] wide:pb-5')}>
          <div className="mx-auto mt-0.5 mb-3 h-1 w-10 rounded bg-line-strong wide:hidden" />
          <div className="mb-3.5 flex items-center gap-2">
            {onBack && <IconButton icon="chevron_left" label="Voltar" onClick={onBack} className="-ml-2" />}
            <h2 id={titleId} className="m-0 flex-1 text-xl font-semibold">{title}</h2>
            <IconButton icon="close" label="Fechar" onClick={onClose} />
          </div>
          {children}
        </div>
        {footer && <div className="flex gap-2 border-t border-divider bg-white px-5 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))] wide:pb-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmSheet({ open, onClose, title, message, confirmLabel = 'Confirmar', danger, onConfirm, loading }: {
  open: boolean; onClose: () => void; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; loading?: boolean
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} maxWidth={420}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="m-0 text-ink-2">{message}</p>
    </Sheet>
  )
}

/* ---------------------------------------------------------------- Popover menu */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return { open, setOpen, ref, toggle: () => setOpen((o) => !o) }
}

/* ---------------------------------------------------------------- Toast */
type ToastCtx = (msg: string, kind?: 'success' | 'error') => void
const ToastContext = createContext<ToastCtx>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error'; id: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = useCallback<ToastCtx>((msg, kind = 'success') => {
    clearTimeout(timer.current)
    setToast({ msg, kind, id: Date.now() })
    timer.current = setTimeout(() => setToast(null), 2600)
  }, [])
  return (
    <ToastContext value={show}>
      {children}
      {toast && createPortal(
        <div role="status" aria-live="polite" className="fixed bottom-[calc(170px+env(safe-area-inset-bottom))] left-1/2 z-[60] w-max max-w-[calc(100vw-32px)] -translate-x-1/2 wide:bottom-7">
          <div key={toast.id} className="flex animate-pf-toast items-center gap-2.5 rounded-[14px] bg-ink px-4 py-3 text-sm text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <Icon name={toast.kind === 'error' ? 'error' : 'check_circle'} size={20} className={toast.kind === 'error' ? 'text-[#FF8A80]' : 'text-[#5FD49A]'} />
            {toast.msg}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext>
  )
}
export const useToast = () => use(ToastContext)

/* ---------------------------------------------------------------- Pager */
export const pageKeys = (ns = '') => (ns ? { page: `${ns}Page`, per: `${ns}Per` } : { page: 'page', per: 'per' })

export function usePaged<T>(rows: T[], initialPer = 25, ns = '') {
  const keys = pageKeys(ns)
  const [page, setPage] = useUrlNumber(keys.page, 1)
  const [per] = useUrlNumber(keys.per, initialPer)
  const pages = Math.max(1, Math.ceil(rows.length / per))
  const cur = Math.min(page, pages)
  return {
    rows: rows.slice((cur - 1) * per, cur * per),
    pager: { page: cur, pages, per, total: rows.length, setPage, setPer: (n: number) => setUrlParams({ [keys.per]: n === initialPer ? null : n, [keys.page]: null }) },
    reset: () => setPage(1),
  }
}

export function Pager({ page, pages, per, total, setPage, setPer, options = [25, 50, 100] }: {
  page: number; pages: number; per: number; total: number; setPage: (n: number) => void; setPer: (n: number) => void; options?: number[]
}) {
  const range = total ? `${(page - 1) * per + 1}–${Math.min(total, page * per)} de ${total}` : '0 de 0'
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => pages <= 7 || n === 1 || n === pages || Math.abs(n - page) <= 1)
  const pgBtn = 'grid h-[34px] min-w-[34px] place-items-center rounded-[10px] border px-2 text-[13px] font-semibold tabular'
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-divider px-5 py-3">
      <span className="tabular text-[13px] text-muted">{range}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" aria-label="Anterior" onClick={() => setPage(Math.max(1, page - 1))} className={cx(pgBtn, 'border-line-strong bg-white text-ink-2 hover:bg-[#F7F7FB]')}><Icon name="chevron_left" size={18} /></button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            {i > 0 && n - nums[i - 1] > 1 && <span className="text-faint">…</span>}
            <button type="button" onClick={() => setPage(n)} aria-current={n === page ? 'page' : undefined}
              className={cx(pgBtn, n === page ? 'border-[#C9C2FB] bg-accent-soft text-accent-strong' : 'border-line-strong bg-white text-ink-2')}>{n}</button>
          </span>
        ))}
        <button type="button" aria-label="Seguinte" onClick={() => setPage(Math.min(pages, page + 1))} className={cx(pgBtn, 'border-line-strong bg-white text-ink-2 hover:bg-[#F7F7FB]')}><Icon name="chevron_right" size={18} /></button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-muted">Por página</span>
        <Segmented size="sm" options={options.map((o) => [String(o), String(o)] as const)} value={String(per)} onChange={(v) => setPer(Number(v))} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- Misc */
export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Navegação" className="flex flex-wrap items-center gap-0.5 text-sm">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {c.to ? <Link to={c.to} className="rounded-lg px-1.5 py-1 font-medium text-accent-strong">{c.label}</Link> : <span className="px-1.5 py-1 font-semibold text-ink">{c.label}</span>}
          {i < items.length - 1 && <Icon name="chevron_right" size={16} className="text-ghost" />}
        </span>
      ))}
    </nav>
  )
}

export function Empty({ icon = 'inbox', title, sub, action }: { icon?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <IconTile icon={icon} bg="#F0F0F6" fg="#6B6B80" size={48} iconSize={24} />
      <div className="font-semibold">{title}</div>
      {sub && <div className="max-w-sm text-[13px] text-muted">{sub}</div>}
      {action}
    </div>
  )
}

export function Loading({ label = 'A carregar…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <Spinner /> {label}
    </div>
  )
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'Erro desconhecido'
  return (
    <Card className="p-6">
      <Empty icon="cloud_off" title="Não foi possível carregar" sub={msg} action={retry && <Button size="sm" onClick={retry} icon="refresh">Tentar de novo</Button>} />
    </Card>
  )
}

export function Stat({ label, value, sub, icon, tint, ink, valueColor, onClick, active, delay }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: string; tint?: string; ink?: string; valueColor?: string; onClick?: () => void; active?: boolean; delay?: number
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp type={onClick ? 'button' : undefined} onClick={onClick} style={{ animationDelay: delay ? `${delay}ms` : undefined }}
      className={cx('flex min-w-0 animate-pf-up flex-col gap-2 rounded-[18px] border bg-white p-4 text-left shadow-card transition-[border-color,transform]',
        active ? 'border-accent' : 'border-line', onClick && 'hover:-translate-y-0.5 hover:border-[#D4D4E2]')}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-muted">{label}</span>
        {icon && tint && ink && <IconTile icon={icon} bg={tint} fg={ink} size={30} iconSize={18} className="rounded-[10px]" />}
      </div>
      <div className="tabular truncate text-[22px] font-semibold tracking-tight" style={{ color: valueColor }}>{value}</div>
      {sub && <div className="truncate text-xs text-muted">{sub}</div>}
    </Comp>
  )
}

export function HelpLinks({ links, className }: { links: { label: string; to: string }[]; className?: string }) {
  if (!links.length) return null
  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)}>
      {links.map((l) => (
        <Link key={l.to + l.label} to={l.to} className="inline-flex h-7 items-center gap-1 rounded-full bg-accent-tint px-2.5 text-xs font-semibold text-accent-strong hover:no-underline">
          <Icon name="menu_book" size={15} />{l.label}
        </Link>
      ))}
    </div>
  )
}
export { Logo, PigFace } from './Logo'
export { Credits, DEVELOPER } from './Credits'
