import { useFarm } from '@/app/farm'
import { setUrlParams, useUrlState } from '@/lib/urlState'
import { useOverlays } from '@/app/overlays'
import { EV } from '@/lib/constants'
import { useCalendarEvents, useTasks } from '@/lib/queries'
import { DOW, MONTHS, addDays, dISO, dUTC, isoOf, localDate, pad, todayISO } from '@/lib/format'
import { Button, Card, Icon, IconButton, Segmented, cx } from '@/ui'

type Entry = { color: string; title: string; typeLabel: string; sub: string }
type Mode = 'month' | 'week'

const mondayOf = (iso: string) => addDays(iso, -((localDate(iso).getDay() + 6) % 7))

export default function CalendarSection() {
  const { canSeeMoney } = useFarm()
  const { openLog } = useOverlays()
  const today = todayISO()
  const [dayRaw] = useUrlState('day', '')
  const sel = /^\d{4}-\d{2}-\d{2}$/.test(dayRaw) ? dayRaw : today
  const [monthRaw] = useUrlState('month', '')
  const ym = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : sel.slice(0, 7)
  const [mode, setMode] = useUrlState<Mode>('cal', 'month', ['month', 'week'])
  const go = (d: string, month = d.slice(0, 7)) => setUrlParams({ day: d === today ? null : d, month: month === d.slice(0, 7) ? null : month })
  const setSel = (d: string) => go(d, ym)
  const setYm = (m: string) => go(sel, m)

  const y = +ym.slice(0, 4)
  const m = +ym.slice(5, 7) - 1
  const first = `${ym}-01`
  const gridStart = mondayOf(first)
  const lastDay = isoOf(new Date(y, m + 1, 0))
  const gridEnd = addDays(mondayOf(lastDay), 6)
  const weekStart = mondayOf(sel)
  const from = weekStart < gridStart ? weekStart : gridStart
  const to = addDays(weekStart, 6) > gridEnd ? addDays(weekStart, 6) : gridEnd

  const events = useCalendarEvents(from, to).data
  const tasks = useTasks(from, to).data

  const byDay = (() => {
    const map = new Map<string, Entry[]>()
    const push = (d: string, e: Entry) => map.set(d, [...(map.get(d) ?? []), e])
    for (const e of events ?? []) {
      if (e.kind === 'money' && !canSeeMoney) continue
      push(e.event_date, { color: EV[e.kind].c, title: e.title, typeLabel: EV[e.kind].l, sub: e.detail })
    }
    for (const t of tasks ?? []) {
      push(t.due_date, { color: EV.task.c, title: t.title, typeLabel: EV.task.l, sub: t.location || t.assignee })
    }
    for (let ms = dUTC(from); ms <= dUTC(to); ms += 86_400_000) {
      const d = dISO(ms)
      if (localDate(d).getDay() === 1) push(d, { color: EV.task.c, title: 'Limpar e desinfectar currais', typeLabel: EV.task.l, sub: 'Todos os currais' })
    }
    return map
  })()

  const entries = (d: string) => byDay.get(d) ?? []
  const cells = Array.from({ length: Math.round((dUTC(gridEnd) - dUTC(gridStart)) / 86_400_000) + 1 }, (_, i) => addDays(gridStart, i))
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const shift = (dir: number) => {
    if (mode === 'week') {
      go(addDays(sel, 7 * dir))
    } else {
      const d = new Date(y, m + dir, 1)
      setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
    }
  }
  const goToday = () => go(today)

  const weekEnd = addDays(weekStart, 6)
  const title = mode === 'month'
    ? `${MONTHS[m]} ${y}`
    : `${+weekStart.slice(8)} ${MONTHS[+weekStart.slice(5, 7) - 1].slice(0, 3)} – ${+weekEnd.slice(8)} ${MONTHS[+weekEnd.slice(5, 7) - 1].slice(0, 3)}`

  const legend = (Object.keys(EV) as (keyof typeof EV)[]).filter((k) => k !== 'money' || canSeeMoney)
  const selEntries = entries(sel)
  const selDate = localDate(sel)

  return (
    <section id="hoje-calendario" className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="m-0 text-lg font-semibold">Calendário</h2>
          <div className="flex flex-wrap gap-3.5">
            {legend.map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-[13px] text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: EV[k].c }} />{EV[k].l}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={goToday}>Hoje</Button>
          <Segmented options={[['month', 'Mês'], ['week', 'Semana']] as const} value={mode} onChange={setMode} />
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-[2_1_440px] p-3.5">
          <div className="flex items-center justify-between pb-3">
            <IconButton icon="chevron_left" label="Anterior" onClick={() => shift(-1)} />
            <div className="text-[15px] font-semibold">{title}</div>
            <IconButton icon="chevron_right" label="Seguinte" onClick={() => shift(1)} />
          </div>
          {mode === 'month' ? (
            <div className="grid grid-cols-7 gap-1">
              {DOW.map((w) => <div key={w} className="tabular pt-1 pb-2 text-center text-xs text-muted">{w}</div>)}
              {cells.map((d) => {
                const inM = +d.slice(5, 7) - 1 === m
                const isSel = d === sel
                const dots = [...new Set(entries(d).map((e) => e.color))].slice(0, 3)
                return (
                  <button key={d} type="button" onClick={() => setSel(d)}
                    className={cx('flex aspect-[1/0.9] min-h-11 flex-col items-center justify-center gap-[5px] rounded-[10px] border p-1 hover:border-[#D4D4E2]',
                      isSel ? 'border-accent bg-accent-soft' : d === today ? 'border-[#D4D4E2] bg-transparent' : 'border-transparent bg-transparent',
                      inM ? 'text-ink' : 'text-[#B5B5C6]')}>
                    <span className={cx('tabular text-sm', isSel || d === today ? 'font-semibold' : 'font-normal')}>{+d.slice(8)}</span>
                    <span className="flex h-1.5 gap-[3px]">
                      {dots.map((c) => <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />)}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col">
              {weekDays.map((d, i) => {
                const ev = entries(d)
                const isT = d === today
                return (
                  <button key={d} type="button" onClick={() => setSel(d)}
                    className={cx('flex gap-3.5 rounded-[10px] border-0 border-t border-divider px-2 py-3 text-left', d === sel ? 'bg-accent-wash' : 'bg-transparent')}>
                    <div className="w-[52px] shrink-0">
                      <div className="tabular text-xs text-muted">{DOW[i]}</div>
                      <div className={cx('tabular text-xl', isT ? 'font-bold text-accent' : 'font-medium text-ink')}>{+d.slice(8)}</div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                      {ev.length === 0 && <span className="text-sm text-faint">Nada planeado</span>}
                      {ev.map((e, j) => (
                        <span key={j} className="flex items-center gap-2 text-sm">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />{e.title}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="min-w-0 flex-[1_1_280px] overflow-hidden">
          <div className="px-[18px] pt-[18px] pb-2.5">
            <div className="tabular text-xs uppercase tracking-[0.06em] text-muted">{sel === today ? 'Hoje' : DOW[(selDate.getDay() + 6) % 7]}</div>
            <h2 className="m-0 mt-0.5 text-xl font-semibold">{+sel.slice(8)} {MONTHS[+sel.slice(5, 7) - 1]}</h2>
          </div>
          {selEntries.length === 0 && <div className="px-[18px] pt-2 pb-[22px] text-muted">Nada planeado para este dia.</div>}
          {selEntries.map((e, i) => (
            <div key={i} className="flex items-start gap-3 border-t border-divider px-[18px] py-3">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
              <div className="min-w-0">
                <div className="font-medium">{e.title}</div>
                <div className="text-[13px] text-muted">{e.typeLabel}{e.sub ? ` · ${e.sub}` : ''}</div>
              </div>
            </div>
          ))}
          <div className="border-t border-divider px-[18px] pt-3 pb-[18px]">
            <button type="button" onClick={() => openLog('menu', { day: sel })}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#C9C2FB] bg-transparent font-medium text-ink-2 hover:bg-[#F7F7FB]">
              <Icon name="add" size={18} />Adicionar actividade
            </button>
          </div>
        </Card>
      </div>
    </section>
  )
}
