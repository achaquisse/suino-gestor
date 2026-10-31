import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useFarm } from '@/app/farm'
import { useOverlays } from '@/app/overlays'
import { Button, Card, ErrorState, Icon, IconTile, Loading, Progress, SearchInput, Segmented, cx } from '@/ui'
import { ACC, GREEN, INK, RED, SGC, SGL, type StageGroup } from '@/lib/constants'
import { plural } from '@/lib/format'
import { ACAT, CAT_HELP, PEN_GROUPS, penFlag, penGroupId, type CatId, type HA } from './lib'
import { AnimalTable, HelpBtn, Kpi, KpiGrid, avgLabel, avgOf, useHerd } from './parts'

type StageFilter = StageGroup | 'all'
type StFilter = 'all' | 'attn' | CatId

const STAGE_KEYS: StageFilter[] = ['all', 'rep', 'lei', 'cre', 'rec', 'eng', 'var']

export default function HerdPage() {
  const nav = useNavigate()
  const { isOwner, canEditHerd } = useFarm()
  const { openLog, openBuyAnimals } = useOverlays()
  const { list, pens, loading, error, refetch } = useHerd()
  const [view, setView] = useState<'pens' | 'list'>('pens')
  const [stage, setStage] = useState<StageFilter>('all')
  const [st, setSt] = useState<StFilter>('all')
  const [query, setQuery] = useState('')
  const [ac, setAc] = useState<CatId | null>(null)

  const q = query.trim().toLowerCase()
  const shownView = q ? 'list' : view

  const attnCats = useMemo(() => ACAT.map((c) => ({ ...c, list: list.filter((a) => a.cat === c.id) })).filter((c) => c.list.length), [list])
  const selCat = attnCats.find((c) => c.id === ac) ?? attnCats[0]
  const attnN = list.filter((a) => a.attn).length

  const homeList = useMemo(
    () => list.filter((a) =>
      (stage === 'all' || a.g === stage) &&
      (st === 'all' || (st === 'attn' ? a.attn : a.cat === st)) &&
      (!q || `${a.tag} ${a.stage} ${a.penName} ${a.status}`.toLowerCase().includes(q))),
    [list, stage, st, q],
  )

  const penCards = useMemo(() => (pens.data ?? []).map((p) => {
    const as = list.filter((a) => a.pen_id === p.id)
    const cnt = new Map<StageGroup, number>()
    as.forEach((a) => cnt.set(a.g, (cnt.get(a.g) ?? 0) + 1))
    return { pen: p, as, cnt, pc: p.capacity ? (as.length / p.capacity) * 100 : 0, flag: penFlag(as), avg: avgOf(as), gid: penGroupId(p) }
  }), [pens.data, list])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} retry={refetch} />

  const filtered = stage !== 'all' || st !== 'all' || !!q
  const toList = (s: StFilter, g: StageFilter = 'all') => { setQuery(''); setSt(s); setStage(g); setView('list') }
  const listTitle = q ? `Resultados para “${query.trim()}”` : st === 'attn' ? 'Precisam de atenção' : st !== 'all' ? ACAT.find((c) => c.id === st)?.title ?? '' : stage === 'all' ? 'Todos os animais' : SGL[stage]
  const reps = list.filter((a) => a.g === 'rep').length
  const lei = list.filter((a) => a.g === 'lei').length

  const rowSub = (a: HA, c: NonNullable<typeof selCat>) => (a.status === c.list[0].status && c.list.length > 3 ? a.penName : a.status)

  return (
    <div className="flex flex-col gap-5">
      {pens.data!.length === 0 ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <IconTile icon="fence" bg="#F0F0F6" fg="#6B6B80" size={48} iconSize={24} />
            <div className="font-semibold">Ainda não há currais</div>
            <div className="max-w-sm text-[13px] text-muted">Crie currais nas definições para começar a registar animais.</div>
          </div>
        </Card>
      ) : (
        <>
          {isOwner && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button icon="add_shopping_cart" onClick={() => openBuyAnimals()}>Registar compra de animais</Button>
            </div>
          )}
          <KpiGrid>
            <Kpi label="Animais" value={list.length} sub={plural(pens.data!.length, 'curral', 'currais')} icon="pets" bg="#EEECFE" fg={ACC} />
            <Kpi label="Reprodutoras" value={reps} sub="porcas e leitoas" icon="favorite" bg="#FCE7F3" fg="#B0306E" onClick={() => { setStage('rep'); setView('list') }} />
            <Kpi label="Leitões" value={lei} sub="em maternidade" icon="child_care" bg="#FDF1E2" fg="#A2601A" onClick={() => { setStage('lei'); setView('list') }} />
            <Kpi label="Precisam de atenção" value={attnN} sub="saúde, tratamento ou carência" icon="error" bg="#FDECEA" fg="#C0302A"
              valueColor={attnN ? RED : GREEN} active={st !== 'all'} onClick={() => { setQuery(''); setSt(st === 'attn' ? 'all' : 'attn'); setView('list') }} />
          </KpiGrid>

          {selCat && (
            <Card className="flex flex-col gap-3.5 p-[18px]">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h2 className="m-0 text-base font-semibold">Precisam de atenção</h2>
                  <span className="text-[13px] text-muted">{plural(attnN, 'animal', 'animais')} em {plural(attnCats.length, 'categoria', 'categorias')}</span>
                </div>
                <button type="button" onClick={() => toList('attn')} className="h-8 whitespace-nowrap rounded-lg border-0 bg-transparent px-2 text-[13px] font-semibold text-accent-strong hover:bg-accent-tint">Ver todos</button>
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
                {attnCats.map((c) => {
                  const on = c.id === selCat.id
                  return (
                    <button key={c.id} type="button" onClick={() => setAc(c.id)}
                      className="flex shrink-0 grow basis-[150px] items-center gap-2.5 rounded-2xl border-[1.5px] px-3 py-2.5 text-left text-ink transition-colors"
                      style={{ background: on ? c.tint : '#FFFFFF', borderColor: on ? c.ink : '#ECECF3' }}>
                      <IconTile icon={c.icon} bg={c.tint} fg={c.ink} size={34} iconSize={18} className="rounded-[11px]" />
                      <span className="flex min-w-0 flex-col">
                        <span className="tabular text-xl font-semibold leading-[1.1]">{c.list.length}</span>
                        <span className="whitespace-nowrap text-xs text-ink-2">{c.short}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <div key={selCat.id} className="flex animate-pf-fade flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[180px] flex-1 text-sm text-ink-2">{selCat.hint}</span>
                  {CAT_HELP[selCat.id].map((h) => <HelpBtn key={h.to} h={h} />)}
                  {selCat.log === null ? (
                    <Button size="sm" variant="soft" onClick={() => toList(selCat.id)}>{selCat.action}</Button>
                  ) : canEditHerd && (
                    <Button size="sm" variant="soft" onClick={() => openLog(selCat.log!)}>{selCat.action}</Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selCat.list.slice(0, 8).map((a) => (
                    <button key={a.id} type="button" title={`${a.stage} · ${a.penName} · ${a.status}`} onClick={() => nav(`/herd/animals/${encodeURIComponent(a.tag)}`)}
                      className="flex h-10 items-center gap-2 rounded-xl border border-line bg-[#FAFAFD] pr-3 pl-2.5 text-[13px] text-ink hover:border-[#C9C2FB] hover:bg-white">
                      <span className="size-2 rounded-full" style={{ background: selCat.ink }} />
                      <span className="tabular font-semibold">{a.tag}</span>
                      <span className="whitespace-nowrap text-muted">{rowSub(a, selCat)}</span>
                    </button>
                  ))}
                  {selCat.list.length > 8 && (
                    <button type="button" onClick={() => toList(selCat.id)} className="h-10 rounded-xl border border-dashed border-[#D9D9E4] bg-transparent px-3 text-[13px] font-medium text-ink-2 hover:bg-[#F7F7FB]">+{selCat.list.length - 8} mais</button>
                  )}
                </div>
              </div>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <SearchInput className="max-w-[380px] min-w-[220px] flex-1" value={query} onChange={setQuery} placeholder="Procurar brinco, fase ou curral" />
            {filtered && (
              <button type="button" onClick={() => { setQuery(''); setStage('all'); setSt('all') }} className="h-11 rounded-xl border-0 bg-transparent px-2.5 text-sm font-semibold text-accent-strong hover:bg-accent-tint">Limpar filtros</button>
            )}
            <div className="ml-auto">
              <Segmented value={shownView} onChange={(v) => { if (q && v === 'pens') setQuery(''); setView(v) }} options={[['pens', 'Currais'], ['list', 'Lista']] as const} />
            </div>
          </div>

          <div className="no-scrollbar -mt-1.5 flex gap-2 overflow-x-auto">
            {STAGE_KEYS.map((g) => {
              const on = stage === g
              const n = g === 'all' ? list.length : list.filter((a) => a.g === g).length
              return (
                <button key={g} type="button" onClick={() => setStage(g)}
                  className={cx('flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium',
                    on ? 'border-[#C9C2FB] bg-accent-soft text-accent-strong' : 'border-line-strong bg-white text-ink-2')}>
                  {g !== 'all' && <span className="size-2 rounded-full" style={{ background: SGC[g] }} />}
                  {SGL[g]}<span className="tabular opacity-65">{n}</span>
                </button>
              )
            })}
          </div>

          {shownView === 'pens' ? (
            <div className="flex flex-col gap-4">
              {PEN_GROUPS.map((g) => {
                const cards = penCards.filter((c) => c.gid === g.id)
                if (!cards.length) return null
                const n = cards.reduce((x, c) => x + c.as.length, 0)
                const cap = cards.reduce((x, c) => x + c.pen.capacity, 0)
                const at = cards.reduce((x, c) => x + c.as.filter((a) => a.attn).length, 0)
                const groupOp = cards.some((c) => stage === 'all' || c.cnt.has(stage)) ? 1 : 0.5
                return (
                  <Card key={g.id} className="flex flex-col gap-3.5 p-[18px] transition-opacity" style={{ opacity: groupOp }}>
                    <div className="flex flex-wrap items-center gap-3">
                      <IconTile icon={g.icon} bg={g.tint} fg={g.ink} size={40} iconSize={22} />
                      <div className="min-w-[180px] flex-1">
                        <h2 className="m-0 text-base font-semibold">{g.title}</h2>
                        <div className="text-[13px] text-muted">{g.sub}</div>
                      </div>
                      <div className="flex flex-wrap gap-[18px] text-[13px]">
                        {([['Animais', String(n), INK], ['Ocupação', `${Math.round(cap ? (n / cap) * 100 : 0)}%`, INK], ['Atenção', String(at), at ? RED : GREEN]] as const).map(([l, v, c]) => (
                          <div key={l} className="flex flex-col items-end"><span className="text-muted">{l}</span><span className="tabular text-[15px] font-semibold" style={{ color: c }}>{v}</span></div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]">
                      {cards.map((c) => {
                        const comp = [...c.cnt.entries()].map(([k, v]) => `${v} ${SGL[k].toLowerCase()}`).join(' · ') || 'Vazio'
                        const dim = stage === 'all' || c.cnt.has(stage) ? 1 : 0.4
                        return (
                          <button key={c.pen.id} type="button" onClick={() => nav(`/herd/pens/${c.pen.id}`)} style={{ opacity: dim }}
                            className="flex flex-col gap-2.5 rounded-2xl border border-line bg-[#FAFAFD] p-3.5 text-left text-ink transition-[border-color,background,transform] duration-200 hover:-translate-y-0.5 hover:border-[#C9C2FB] hover:bg-white active:scale-[0.98]">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold">{c.pen.name}</div>
                                <div className="truncate text-xs text-muted">{comp}</div>
                              </div>
                              <span className="tabular whitespace-nowrap text-[13px]"><span className="text-base font-semibold">{c.as.length}</span><span className="text-muted"> / {c.pen.capacity}</span></span>
                            </div>
                            <Progress value={c.pc} height={5} color={c.pc >= 90 ? '#E8A23A' : ACC} />
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="flex min-w-0 items-center gap-1.5 truncate font-medium" style={{ color: c.flag.color }}><Icon name={c.flag.icon} size={14} />{c.flag.text}</span>
                              <span className="tabular whitespace-nowrap text-muted">{c.avg ? avgLabel(c.avg) : '—'}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {g.help.length > 0 && <div className="-mx-1 -mt-1 -mb-1.5 flex flex-wrap gap-1">{g.help.map((h) => <HelpBtn key={h.to} h={h} size="sm" />)}</div>}
                  </Card>
                )
              })}
            </div>
          ) : (
            <AnimalTable key={`${stage}|${st}|${q}`} title={listTitle} rows={homeList} thirdCol="pen" />
          )}
        </>
      )}
    </div>
  )
}
