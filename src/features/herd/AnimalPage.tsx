import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useUrlState } from '@/lib/urlState'
import { useQuery } from '@tanstack/react-query'
import { useFarm } from '@/app/farm'
import { useOverlays } from '@/app/overlays'
import { Breadcrumbs, Button, Card, Empty, ErrorState, Icon, IconButton, IconTile, Loading, Tabs, cx, usePopover } from '@/ui'
import { ACC, EV, GREEN, INK, SGL, TONE, type LogType } from '@/lib/constants'
import type { EventKind, FarmEvent, Json } from '@/lib/database.types'
import { useAnimal, useAnimalEvents, useParam, useWeights, signedUrl } from '@/lib/queries'
import { addDays, ageLabel, dLong, dShort, dTimeline, daysBetween, mon3, plural } from '@/lib/format'
import { CAT_HELP, art, isSow, nextEvent, parentTags, pb } from './lib'
import { HelpBtn, useHerd } from './parts'

const TLT: Record<'all' | 'health' | 'breeding' | 'task', string> = { all: 'Todos', health: 'Saúde', breeding: 'Reprodução', task: 'Maneio' }
type Tab = 'resumo' | 'repro' | 'hist'
const TABS: Tab[] = ['resumo', 'repro', 'hist']

const liveOf = (e: FarmEvent) => {
  const meta = e.meta as { [k: string]: Json | undefined } | null
  if (meta && typeof meta === 'object' && !Array.isArray(meta) && typeof meta.live === 'number') return meta.live
  const m = e.detail.match(/(\d+) vivos?/)
  return m ? +m[1] : null
}

function AnimalPhoto({ path }: { path: string | null }) {
  const q = useQuery({ queryKey: ['animal-photo', path], queryFn: () => signedUrl('animal-photos', path!), enabled: !!path, staleTime: 30 * 60_000 })
  if (q.data) return <img src={q.data} alt="" className="absolute inset-0 size-full object-cover" />
  return <span className="absolute inset-0 grid place-items-center text-ghost"><Icon name="photo_camera" size={28} /></span>
}

export default function AnimalPage() {
  const { tag } = useParams()
  const nav = useNavigate()
  const { canEditHerd, canSeeMoney } = useFarm()
  const { openLog, openEditAnimal } = useOverlays()
  const { open: menuOpen, setOpen: setMenuOpen, ref: menuRef } = usePopover()
  const animalQ = useAnimal(tag)
  const animal = animalQ.data
  const herd = useHerd()
  const eventsQ = useAnimalEvents(animal?.id)
  const weightsQ = useWeights(animal?.id)
  const gestation = useParam('gestation_days', 114)
  const weaning = useParam('weaning_age_days', 21)
  const [tab, setTab] = useUrlState<Tab>('tab', 'resumo', TABS)
  const [tl, setTl] = useUrlState<keyof typeof TLT>('kind', 'all', Object.keys(TLT) as (keyof typeof TLT)[])

  const events = useMemo(() => eventsQ.data ?? [], [eventsQ.data])
  const weights = useMemo(() => weightsQ.data ?? [], [weightsQ.data])
  const ha = herd.list.find((a) => a.id === animal?.id)

  if (animalQ.isPending || herd.loading) return <Loading />
  if (animalQ.error || herd.error) return <ErrorState error={animalQ.error ?? herd.error} retry={() => { animalQ.refetch(); herd.refetch() }} />
  if (!animal) {
    return (
      <Card className="p-6">
        <Empty icon="pets" title="Animal não encontrado" sub={`Não existe nenhum animal com o brinco ${tag}.`} action={<Button size="sm" onClick={() => nav('/herd')}>Voltar aos animais</Button>} />
      </Card>
    )
  }

  const sow = isSow(animal)
  const removed = !!animal.removed_at
  const siblings = animal.pen_id ? herd.list.filter((a) => a.pen_id === animal.pen_id) : []
  const idx = siblings.findIndex((a) => a.id === animal.id)
  const penName = ha?.penName ?? herd.pens.data?.find((p) => p.id === animal.pen_id)?.name ?? '—'
  const go = (i: number) => nav({ pathname: `/herd/animals/${encodeURIComponent(siblings[(i + siblings.length) % siblings.length].tag)}`, search: window.location.search })
  const tabs: (readonly [Tab, string, string])[] = [['resumo', 'Resumo', 'badge'], ...(sow ? [['repro', 'Reprodução', 'favorite'] as const] : []), ['hist', 'Histórico', 'history']]
  const curTab = tabs.some((t) => t[0] === tab) ? tab : 'resumo'
  const histTabs = tabs.map(([v, l, i]) => [v, v === 'hist' && events.length ? `${l} · ${events.length}` : l, i] as const)

  const first = weights[0]
  const last = weights[weights.length - 1]
  const spanDays = first && last ? daysBetween(first.measured_on, last.measured_on) : 0
  const gmd = spanDays > 0 ? (last.kg - first.kg) / spanDays : 0
  const gmdL = `${gmd > 0 ? '+' : ''}${gmd.toFixed(2).replace('.', ',')} kg`
  const shown = weights.slice(-6)
  const wmax = Math.max(1, ...shown.map((w) => w.kg))
  const tags = parentTags(animal.parents)
  const kids = herd.list.filter((a) => parentTags(a.parents).includes(animal.tag))
  const births = events.filter((e) => e.kind === 'breeding' && /pariu/i.test(e.title))
  const lives = births.map(liveOf).filter((n): n is number => n != null)
  const avgLive = lives.length ? lives.reduce((x, n) => x + n, 0) / lives.length : null
  const weaningDate = births[0] ? addDays(births[0].event_date, weaning) : null
  const [chipBg, chipFg] = TONE[animal.tone]
  const filteredEvents = events.filter((e) => tl === 'all' || e.kind === tl)

  const stats = [
    { l: 'Peso actual', v: `${animal.weight_kg < 10 ? animal.weight_kg.toFixed(1).replace('.', ',') : Math.round(animal.weight_kg)} kg`, sub: 'última pesagem', c: INK },
    { l: 'Ganho médio diário', v: weights.length > 1 ? gmdL : '—', sub: weights.length > 1 ? `${dShort(first.measured_on)} – ${dShort(last.measured_on)}` : 'sem pesagens suficientes', c: gmd > 0 ? GREEN : INK },
    { l: 'Idade', v: ageLabel(animal.born_on), sub: animal.born_on ? `nasceu ${dLong(animal.born_on)}` : '—', c: INK },
    { l: 'Curral', v: penName, sub: SGL[ha?.g ?? 'var'], c: INK },
  ]
  const facts = [
    ['Sexo', animal.sex],
    ['Nascimento', animal.born_on ? `${dLong(animal.born_on)} · ${ageLabel(animal.born_on)}` : '—'],
    ['Peso', stats[0].v],
    ['Curral', penName],
    ['Pais', animal.parents || '—'],
    ['Raça', animal.breed || '—'],
    ...(animal.notes ? [['Notas', animal.notes]] : []),
  ]
  const repro = [
    ['Estado', animal.status],
    ['Próximo evento', nextEvent(animal, gestation, weaningDate)],
    ['Partos', String(births.length)],
    ['Média nascidos vivos', avgLive != null ? avgLive.toFixed(1).replace('.', ',') : '—'],
  ]
  const menuItems: { type: LogType; label: string; sub: string; icon: string; tint: string; ink: string; sep?: boolean }[] = [
    { type: 'treatment', label: 'Tratamento', sub: 'Medicação, vacina ou vitamina', icon: 'vaccines', tint: '#EEECFE', ink: '#4B3CD6' },
    { type: 'illness', label: 'Doença', sub: 'Sintomas, gravidade e isolamento', icon: 'sick', tint: TONE.red[0], ink: TONE.red[1] },
    { type: 'weight', label: 'Peso', sub: 'Nova pesagem', icon: 'monitor_weight', tint: '#E6F6EE', ink: '#0F7A44' },
    ...(sow ? [
      { type: 'mating' as const, label: 'Cobertura', sub: 'Monta natural ou inseminação', icon: 'favorite', tint: '#FCE7F3', ink: '#B0306E' },
      { type: 'birth' as const, label: 'Parto', sub: 'Ninhada e nascidos vivos', icon: 'child_care', tint: '#FCE7F3', ink: '#B0306E' },
    ] : []),
    { type: 'transfer', label: 'Transferir', sub: 'Mudar de curral', icon: 'move_down', tint: '#F0F0F6', ink: '#55556A', sep: true },
    ...(canSeeMoney ? [{ type: 'sale' as const, label: 'Vender', sub: 'Registar venda e receita', icon: 'sell', tint: '#FDF1E2', ink: '#A2601A' }] : []),
  ]
  const alertHelp = ha?.cat ? CAT_HELP[ha.cat] : []
  const alertRed = animal.tone === 'red'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Breadcrumbs items={[{ label: 'Animais', to: '/herd' }, ...(animal.pen_id ? [{ label: penName, to: `/herd/pens/${animal.pen_id}` }] : []), { label: animal.tag }]} />
        {siblings.length > 1 && (
          <div className="flex items-center gap-1.5">
            <IconButton icon="chevron_left" label="Animal anterior" size={36} iconSize={18} className="border border-line-strong bg-white" onClick={() => go(idx - 1)} />
            <span className="tabular text-[13px] text-muted">{idx + 1} de {siblings.length} · {penName}</span>
            <IconButton icon="chevron_right" label="Animal seguinte" size={36} iconSize={18} className="border border-line-strong bg-white" onClick={() => go(idx + 1)} />
          </div>
        )}
      </div>

      <Card className="flex flex-col gap-[18px] p-5">
        <div className="flex flex-wrap items-center gap-[18px]">
          <div className="relative size-[88px] shrink-0">
            <div className="absolute inset-0 overflow-hidden rounded-[20px] border border-line bg-[#F3F3F9]"><AnimalPhoto path={animal.photo_path} /></div>
            {canEditHerd && (
              <button type="button" aria-label="Editar foto" title="Editar foto" onClick={() => openEditAnimal(animal.id)}
                className="absolute -right-1.5 -bottom-1.5 grid size-8 place-items-center rounded-full border-2 border-white bg-ink p-0 text-white shadow-[0_2px_8px_rgba(22,22,40,0.2)] hover:bg-accent-strong">
                <Icon name="photo_camera" size={16} />
              </button>
            )}
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="tabular m-0 text-[26px] font-semibold tracking-[-0.02em]">{animal.tag}</h1>
              <span className="rounded-full px-2.5 py-1 text-[13px] font-medium" style={{ background: chipBg, color: chipFg }}>
                {removed ? (animal.removed_reason === 'sale' ? 'Vendido' : 'Morto') : animal.status}
              </span>
            </div>
            <div className="text-ink-2">{animal.stage} · {animal.sex}{animal.breed ? ` · ${animal.breed}` : ''}</div>
          </div>
          {canEditHerd && !removed && (
            <div className="flex flex-wrap items-center gap-2">
              <Button icon="edit" onClick={() => openEditAnimal(animal.id)}>Editar</Button>
              <div ref={menuRef} className="relative">
                <Button variant="primary" icon="add" onClick={() => setMenuOpen(!menuOpen)} className="pr-3 pl-4">
                  Registar<Icon name="expand_more" />
                </Button>
                {menuOpen && (
                  <div className="absolute top-[calc(100%+6px)] right-0 z-40 flex w-[min(290px,calc(100vw-32px))] animate-pf-pop flex-col gap-0.5 rounded-[18px] border border-line bg-white p-1.5 shadow-pop">
                    {menuItems.map((o) => (
                      <button key={o.type} type="button" onClick={() => { setMenuOpen(false); openLog(o.type, { animalId: animal.id }) }}
                        className={cx('flex min-h-[52px] items-center gap-3 rounded-xl border-0 bg-transparent px-2.5 text-left text-ink hover:bg-hover', o.sep && 'border-t border-divider')}>
                        <IconTile icon={o.icon} bg={o.tint} fg={o.ink} size={34} iconSize={18} className="rounded-[10px]" />
                        <span className="flex flex-col gap-px"><span className="text-sm font-semibold">{o.label}</span><span className="text-xs text-muted">{o.sub}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {ha?.attn && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] px-3.5 py-3" style={{ background: chipBg, color: chipFg }}>
            <Icon name={alertRed ? 'error' : 'schedule'} size={20} />
            <span className="min-w-[160px] flex-1 text-sm font-semibold">{animal.status}</span>
            {alertHelp.map((h) => (
              <Link key={h.to} to={h.to} className="inline-flex h-8 items-center gap-1 rounded-[9px] bg-white/70 px-2.5 text-[13px] font-semibold text-inherit hover:bg-white hover:no-underline">
                <Icon name="help" size={16} />{h.label}
              </Link>
            ))}
          </div>
        )}

        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
          {stats.map((k) => (
            <div key={k.l} className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-[#F7F7FB] p-3.5">
              <span className="text-xs text-muted">{k.l}</span>
              <span className="tabular truncate text-lg font-semibold" style={{ color: k.c }}>{k.v}</span>
              <span className="truncate text-xs text-muted">{k.sub}</span>
            </div>
          ))}
        </div>
      </Card>

      <Tabs options={histTabs} value={curTab} onChange={setTab} className="max-w-full self-start rounded-[14px] bg-sunken p-1" />

      {curTab === 'resumo' && (
        <>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="m-0 text-[15px] font-semibold">Dados do animal</h2>
              <div className="flex flex-col">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-t border-divider py-2.5 text-sm"><span className="text-muted">{k}</span><span className="text-right font-medium">{v}</span></div>
                ))}
              </div>
            </Card>
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="m-0 text-[15px] font-semibold">Evolução do peso</h2>
                <span className="text-[13px] text-muted">kg{weights.length > 1 ? ` · ${gmdL}/dia` : ''}</span>
              </div>
              {shown.length ? (
                <div className="flex h-[130px] items-end gap-2.5 pt-2.5">
                  {shown.map((w, i) => (
                    <div key={w.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                      <span className="tabular text-xs font-semibold">{w.kg < 10 ? w.kg.toFixed(1).replace('.', ',') : Math.round(w.kg)}</span>
                      <div className="w-full max-w-[44px] rounded-t-lg rounded-b-[3px] transition-[height] duration-700 ease-pf" style={{ height: `${(w.kg / wmax) * 80}px`, background: i === shown.length - 1 ? ACC : '#DAD5FD' }} />
                      <span className="text-xs text-muted">{mon3(w.measured_on)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-[13px] text-muted">Ainda sem pesagens registadas.</div>
              )}
              {canEditHerd && !removed && (
                <button type="button" onClick={() => openLog('weight', { animalId: animal.id })}
                  className="flex h-9 items-center gap-1.5 self-start rounded-[10px] border-0 bg-transparent px-2.5 text-[13px] font-semibold whitespace-nowrap text-accent-strong hover:bg-accent-tint">
                  <Icon name="monitor_weight" size={18} />Registar pesagem
                </button>
              )}
            </Card>
          </div>
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="m-0 text-[15px] font-semibold">Família</h2>
            <div className="flex flex-wrap gap-2.5">
              {tags.map((p, i) => {
                const ex = herd.list.find((a) => a.tag === p)
                const rel = tags.length > 1 ? (i === 0 ? 'Mãe' : 'Pai') : 'Progenitor'
                const cls = 'flex flex-col items-start gap-0.5 rounded-[14px] border border-line bg-white px-3.5 py-2.5 text-ink'
                const body = <><span className="text-xs text-muted">{rel}</span><span className="tabular font-semibold">{p}</span></>
                return ex ? <Link key={p} to={`/herd/animals/${encodeURIComponent(p)}`} className={cx(cls, 'hover:border-[#C9C2FB] hover:no-underline')}>{body}</Link> : <div key={p} className={cls}>{body}</div>
              })}
              {kids.length > 0 && (
                <button type="button" onClick={() => setTab(sow ? 'repro' : 'resumo')} className="flex flex-col items-start gap-0.5 rounded-[14px] border border-line bg-white px-3.5 py-2.5 text-ink hover:border-[#C9C2FB]">
                  <span className="text-xs text-muted">Descendentes</span><span className="tabular font-semibold">{kids.length}</span>
                </button>
              )}
              {!tags.length && !kids.length && <span className="text-[13px] text-muted">Sem família registada.</span>}
            </div>
          </Card>
          {!sow && kids.length > 0 && <Litter kids={kids.map((k) => k.tag)} />}
        </>
      )}

      {curTab === 'repro' && (
        <>
          <Card className="flex flex-col gap-3.5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 text-[15px] font-semibold">Reprodução</h2>
              <div className="flex flex-wrap gap-0.5">{[pb('heat', 'Cio'), pb('farrow', 'Parto'), art('desmame', 'Desmame')].map((h) => <HelpBtn key={h.to} h={h} size="lg" />)}</div>
            </div>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
              {repro.map(([l, v]) => (
                <div key={l} className="flex flex-col gap-0.5 rounded-[14px] bg-[#F7F7FB] p-3.5"><span className="text-xs text-muted">{l}</span><span className="text-base font-semibold">{v}</span></div>
              ))}
            </div>
          </Card>
          {kids.length > 0 && <Litter kids={kids.map((k) => k.tag)} />}
        </>
      )}

      {curTab === 'hist' && (
        <Card className="flex flex-col gap-3.5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <h2 className="m-0 text-[15px] font-semibold">Histórico · {plural(events.length, 'registo', 'registos')}</h2>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TLT) as (keyof typeof TLT)[]).map((v) => {
                const on = tl === v
                return (
                  <button key={v} type="button" onClick={() => setTl(v)}
                    className={cx('flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold', on ? 'border-[#C9C2FB] bg-accent-soft text-accent-strong' : 'border-line-strong bg-white text-ink-2')}>
                    {v !== 'all' && <span className="size-2 rounded-full" style={{ background: EV[v as EventKind].c }} />}{TLT[v]}
                  </button>
                )
              })}
            </div>
          </div>
          {eventsQ.isPending && <Loading />}
          {eventsQ.error && <ErrorState error={eventsQ.error} retry={() => eventsQ.refetch()} />}
          {!eventsQ.isPending && !filteredEvents.length && <div className="py-5 text-center text-muted">Sem registos deste tipo.</div>}
          <div className="flex flex-col">
            {filteredEvents.map((e, i) => (
              <div key={e.id} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: EV[e.kind].c }} />
                  <span className={cx('w-0.5 flex-1 bg-line', i === filteredEvents.length - 1 && 'opacity-0')} />
                </div>
                <div className="flex flex-col gap-0.5 pb-[18px]">
                  <span className="text-xs text-muted">{dTimeline(e.event_date)} · {e.kind in TLT ? TLT[e.kind as keyof typeof TLT] : EV[e.kind].l}</span>
                  <span className="font-semibold">{e.title}</span>
                  {e.detail && <span className="text-sm text-ink-2">{e.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function Litter({ kids }: { kids: string[] }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="m-0 text-[15px] font-semibold">Descendentes · {kids.length}</h2>
      <div className="flex flex-wrap gap-1.5">
        {kids.slice(0, 40).map((t) => (
          <Link key={t} to={`/herd/animals/${encodeURIComponent(t)}`} className="tabular inline-flex h-[34px] items-center rounded-full border border-line-strong bg-white px-3 text-[13px] font-semibold text-ink hover:border-[#C9C2FB] hover:bg-accent-wash hover:no-underline">{t}</Link>
        ))}
        {kids.length > 40 && <span className="inline-flex h-[34px] items-center px-2 text-[13px] text-muted">+{kids.length - 40}</span>}
      </div>
    </Card>
  )
}
