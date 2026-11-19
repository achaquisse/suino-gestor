import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router'
import type { Pen } from '@/lib/database.types'
import type { HelpDef } from './lib'
import { capacityLabel, penVisual, roleOf } from '@/lib/pens'
import { Icon, cx } from '@/ui'

/** The layout is a grid COLS cells wide; pens are rectangles on it, in cell units. */
export const COLS = 24

/** Extra per-pen details shown when the rectangle has room (herd page). */
export type PenInfo = { comp: string; flag: { text: string; color: string; icon: string }; avg: string; help: HelpDef[] }
export type Rect = { x: number; y: number; w: number; h: number }
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/* ---------------------------------------------------------------- Layout editor */

type Drag = { id: string; mode: 'move' | 'resize'; startX: number; startY: number; orig: Rect; moved: boolean }

/**
 * The farm's pens as rectangles on a grid. Editable: drag to move, drag the corner to resize,
 * arrows/Shift+arrows from the keyboard. `highlight` marks one pen (the others are dimmed).
 */
export function PenLayout({ pens, counts, alerts, info, editable = false, highlight, mini = false, onOpen, onPlace }: {
  pens: Pen[]; counts: Map<string, number>
  /** Pens with animals that need attention: shown with an alert icon. */
  alerts?: Map<string, number>
  info?: Map<string, PenInfo>
  editable?: boolean; highlight?: string
  /** A small overview (no labels), e.g. next to the pen page's KPI cards. */
  mini?: boolean
  onOpen: (p: Pen) => void; onPlace?: (p: Pen, r: Rect) => Promise<boolean>
}) {
  const box = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(32)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [ghost, setGhost] = useState<Rect | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setCell(el.clientWidth / COLS))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Editing leaves room below to drag pens into; read-only views fit the pens.
  const pad = editable ? 3 : 0
  const rows = Math.max(editable ? 12 : 1, ...pens.map((p) => p.y + p.h + pad), ghost ? ghost.y + ghost.h + pad : 0)
  const fits = (id: string, r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= COLS && !pens.some((o) => o.id !== id && overlaps(r, o))

  const start = (e: PointerEvent, p: Pen, mode: Drag['mode']) => {
    if (!editable) return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ id: p.id, mode, startX: e.clientX, startY: e.clientY, orig: { x: p.x, y: p.y, w: p.w, h: p.h }, moved: false })
    setSelected(p.id)
  }
  const move = (e: PointerEvent) => {
    if (!drag) return
    const dx = Math.round((e.clientX - drag.startX) / cell)
    const dy = Math.round((e.clientY - drag.startY) / cell)
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 4) return
    const o = drag.orig
    const r = drag.mode === 'move'
      ? { ...o, x: clamp(o.x + dx, 0, COLS - o.w), y: Math.max(0, o.y + dy) }
      : { ...o, w: clamp(o.w + dx, 1, COLS - o.x), h: clamp(o.h + dy, 1, 24) }
    setDrag({ ...drag, moved: true })
    setGhost(r)
  }
  const end = async () => {
    if (!drag) return
    const p = pens.find((x) => x.id === drag.id)
    const r = ghost
    setDrag(null)
    if (!p) return setGhost(null)
    if (!drag.moved || !r) { setGhost(null); onOpen(p); return }
    if (fits(p.id, r)) await onPlace?.(p, r)
    setGhost(null)
  }
  // Keyboard: arrows move the selected pen, Shift+arrows resize it, Enter opens it.
  const key = async (e: KeyboardEvent, p: Pen) => {
    if (e.key === 'Enter') return onOpen(p)
    if (!editable) return
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!d) return
    e.preventDefault()
    const r = e.shiftKey ? { x: p.x, y: p.y, w: p.w + d[0], h: p.h + d[1] } : { x: p.x + d[0], y: p.y + d[1], w: p.w, h: p.h }
    if (r.w >= 1 && r.h >= 1 && fits(p.id, r)) await onPlace?.(p, r)
  }

  return (
    <div ref={box} className={cx('relative w-full select-none overflow-hidden border border-line', mini ? 'rounded-lg' : 'rounded-2xl')}
      style={{
        height: rows * cell,
        backgroundColor: '#FBFBFD',
        backgroundImage: 'linear-gradient(#EEEEF4 1px, transparent 1px), linear-gradient(90deg, #EEEEF4 1px, transparent 1px)',
        backgroundSize: `${cell}px ${cell}px`,
      }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={() => { setDrag(null); setGhost(null) }}>
      {pens.map((p) => {
        const live = drag?.id === p.id && ghost ? ghost : p
        const bad = drag?.id === p.id && ghost ? !fits(p.id, ghost) : false
        const [icon, bg, fg] = penVisual(p)
        const n = counts.get(p.id) ?? 0
        const tiny = mini || live.w * cell < 90 || live.h * cell < 56
        const height = live.h * cell
        const roomy = !tiny && height >= 76
        const attn = alerts?.get(p.id) ?? 0
        const more = info?.get(p.id)
        const pct = p.capacity ? Math.min(100, (n / p.capacity) * 100) : 0
        return (
          <div key={p.id} role="button" tabIndex={0} aria-label={`${p.name} · ${roleOf(p.role).label}${p.blocked ? ', vedado' : ''}, ${n} animais${attn ? `, ${attn} a precisar de atenção` : ''}`}
            title={mini ? `${p.name} · ${roleOf(p.role).label}` : undefined} aria-current={highlight === p.id ? 'true' : undefined}
            onPointerDown={(e) => start(e, p, 'move')} onClick={() => !editable && onOpen(p)} onKeyDown={(e) => key(e, p)}
            onFocus={() => setSelected(p.id)}
            className={cx('absolute flex flex-col overflow-hidden border-2 text-left outline-none transition-shadow', mini ? 'rounded-[5px] border p-0.5' : 'rounded-xl p-1.5',
              editable ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer',
              selected === p.id && editable && 'shadow-[0_0_0_3px_rgba(91,76,240,0.25)]', drag?.id === p.id && 'z-10 shadow-lg',
              highlight === p.id && (mini ? 'z-[5] shadow-[0_0_0_2px_rgba(91,76,240,0.55)]' : 'z-[5] shadow-[0_0_0_4px_rgba(91,76,240,0.35)]'))}
            style={{
              left: live.x * cell + (mini ? 1 : 2), top: live.y * cell + (mini ? 1 : 2),
              width: live.w * cell - (mini ? 2 : 4), height: live.h * cell - (mini ? 2 : 4),
              borderColor: bad ? 'var(--color-danger)' : fg,
              opacity: highlight && highlight !== p.id ? 0.45 : 1,
              background: p.blocked
                ? `repeating-linear-gradient(135deg, ${bg}, ${bg} 6px, rgba(255,255,255,0.85) 6px, rgba(255,255,255,0.85) 12px)`
                : bg,
            }}>
            <div className="flex min-w-0 items-center gap-1" style={{ color: fg }}>
              <Icon name={p.blocked ? 'block' : icon} size={mini ? 10 : tiny ? 14 : 18} className="shrink-0" />
              {!tiny && <span className="truncate text-[13px] font-semibold text-ink">{p.name}</span>}
            </div>
            {roomy && <span className="truncate text-[11px] font-medium" style={{ color: fg }}>{roleOf(p.role).label}</span>}
            {more && !tiny && height >= 104 && <span className="truncate text-[11px] text-ink-2">{more.comp}</span>}
            {more && !tiny && height >= 124 && !p.blocked && (
              <span className="flex min-w-0 items-center gap-1 truncate text-[11px] font-medium" style={{ color: more.flag.color }}>
                <Icon name={more.flag.icon} size={12} className="shrink-0" />{more.flag.text}
              </span>
            )}
            {attn > 0 && (
              <span className={cx('absolute grid place-items-center rounded-full bg-danger text-white', mini ? 'top-0 right-0 size-2' : 'top-1 right-1 size-5')}
                title={`${attn} a precisar de atenção`}>
                {!mini && <Icon name="priority_high" size={13} />}
              </span>
            )}
            {!tiny && (
              <div className="mt-auto flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1 text-[11px] text-ink-2">
                  <span className="truncate">{p.blocked ? 'Vedado' : `${n} / ${capacityLabel(p)}`}{more?.avg && !p.blocked ? ` · ${more.avg}` : ''}</span>
                  {more && more.help.length > 0 && (
                    <span className="flex shrink-0 gap-0.5">
                      {more.help.map((h) => (
                        <Link key={h.to} to={h.to} title={h.label} aria-label={`Ajuda: ${h.label}`}
                          onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
                          className="grid size-5 place-items-center rounded-full bg-white/80 text-accent-strong hover:bg-white hover:no-underline">
                          <Icon name="help" size={13} />
                        </Link>
                      ))}
                    </span>
                  )}
                </div>
                {more && p.capacity != null && !p.blocked && (
                  <span className="block h-1 overflow-hidden rounded-full bg-white/70">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? '#E8A23A' : fg }} />
                  </span>
                )}
              </div>
            )}
            {editable && (
              <span aria-hidden onPointerDown={(e) => start(e, p, 'resize')}
                className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize touch-none rounded-tl-md"
                style={{ background: `linear-gradient(135deg, transparent 50%, ${fg} 50%)` }} />
            )}
          </div>
        )
      })}
      {!pens.length && <div className="absolute inset-0 grid place-items-center text-sm text-muted">Ainda não há currais. Adicione o primeiro.</div>}
    </div>
  )
}

