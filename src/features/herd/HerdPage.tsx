import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useFarm } from '@/app/farm'
import { setUrlParams, useUrlState, type UrlPatch } from '@/lib/urlState'
import { useOverlays } from '@/app/overlays'
import { Button, Card, ErrorState, IconTile, Loading, SearchInput, cx } from '@/ui'
import { ACC, GREEN, RED, SGC, SGL, type StageGroup } from '@/lib/constants'
import { plural } from '@/lib/format'
import { ACAT, CAT_HELP, penFlag, penHelp, type CatId, type HA } from './lib'
import { AnimalTable, HelpBtn, Kpi, KpiGrid, avgLabel, avgOf, useHerd } from './parts'
import { PenLayout, type PenInfo } from './PenLayout'

type StageFilter = StageGroup | 'all'
type StFilter = 'all' | 'attn' | CatId

const STAGE_KEYS: StageFilter[] = ['all', 'rep', 'lei', 'cre', 'rec', 'eng', 'var']
const ST_KEYS: StFilter[] = ['all', 'attn', ...ACAT.map((c) => c.id)]

export default function HerdPage() {
  const nav = useNavigate()
  const { canEditHerd } = useFarm()
  const { openLog } = useOverlays()
  const { list, pens, loading, error, refetch } = useHerd()
  const [stage] = useUrlState<StageFilter>('stage', 'all', STAGE_KEYS)
  const [st] = useUrlState<StFilter>('status', 'all', ST_KEYS)
  const [query] = useUrlState('q', '')
  const [ac, setAc] = useUrlState<CatId | ''>('attn', '')
  const set = (p: UrlPatch) => setUrlParams({ ...p, page: null })
  const setStage = (g: StageFilter) => set({ stage: g === 'all' ? null : g })
  const setQuery = (v: string) => set({ q: v })

  const q = query.trim().toLowerCase()

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

  // Per pen: occupancy, alerts and the details shown inside the farm layout.
  const [counts, alerts, info] = useMemo(() => {
    const c = new Map<string, number>()
    const at = new Map<string, number>()
    const inf = new Map<string, PenInfo>()
    for (const p of pens.data ?? []) {
      const as = list.filter((a) => a.pen_id === p.id)
      const cnt = new Map<StageGroup, number>()
      as.forEach((a) => cnt.set(a.g, (cnt.get(a.g) ?? 0) + 1))
      c.set(p.id, as.length)
      at.set(p.id, as.filter((a) => a.attn).length)
      const avg = avgOf(as)
      inf.set(p.id, {
        comp: [...cnt.entries()].map(([k, v]) => `${v} ${SGL[k].toLowerCase()}`).join(' · ') || 'Vazio',
        flag: penFlag(as), avg: avg ? avgLabel(avg) : '', help: penHelp(p),
      })
    }
    return [c, at, inf] as const
  }, [pens.data, list])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} retry={refetch} />

  const filtered = stage !== 'all' || st !== 'all' || !!q
  // The animal list sits under the layout: filtering scrolls to it.
  const toListView = () => requestAnimationFrame(() => document.getElementById('lista-animais')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  const toList = (s: StFilter, g: StageFilter = 'all') => { set({ q: null, status: s === 'all' ? null : s, stage: g === 'all' ? null : g }); toListView() }
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
          <KpiGrid>
            <Kpi label="Animais" value={list.length} sub={plural(pens.data!.length, 'curral', 'currais')} icon="pets" bg="#EEECFE" fg={ACC} />
            <Kpi label="Reprodutoras" value={reps} sub="porcas e leitoas" icon="favorite" bg="#FCE7F3" fg="#B0306E" onClick={() => { set({ stage: 'rep' }); toListView() }} />
            <Kpi label="Leitões" value={lei} sub="em maternidade" icon="child_care" bg="#FDF1E2" fg="#A2601A" onClick={() => { set({ stage: 'lei' }); toListView() }} />
            <Kpi label="Precisam de atenção" value={attnN} sub="saúde, tratamento ou carência" icon="error" bg="#FDECEA" fg="#C0302A"
              valueColor={attnN ? RED : GREEN} active={st !== 'all'} onClick={() => { set({ q: null, status: st === 'attn' ? null : 'attn' }); toListView() }} />
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

          <Card className="flex flex-col gap-3 p-[18px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-base font-semibold">Esquema da granja</h2>
              <span className="text-[13px] text-muted">Toque num curral para o abrir</span>
            </div>
            <PenLayout pens={pens.data ?? []} counts={counts} alerts={alerts} info={info} onOpen={(p) => nav(`/herd/pens/${p.id}`)} />
          </Card>

          <AnimalTable id="lista-animais" key={`${stage}|${st}|${q}`} title={listTitle} rows={homeList} thirdCol="pen" toolbar={<>
            <div className="flex flex-wrap items-center gap-2.5">
              <SearchInput className="max-w-[380px] min-w-[220px] flex-1" value={query} onChange={setQuery} placeholder="Procurar brinco, fase ou curral" />
              {filtered && (
                <button type="button" onClick={() => set({ q: null, stage: null, status: null })} className="h-11 rounded-xl border-0 bg-transparent px-2.5 text-sm font-semibold text-accent-strong hover:bg-accent-tint">Limpar filtros</button>
              )}
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
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
          </>} />
        </>
      )}
    </div>
  )
}
