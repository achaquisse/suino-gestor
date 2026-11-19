import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useFarm } from '@/app/farm'
import { useOverlays } from '@/app/overlays'
import { Breadcrumbs, Button, Card, Empty, ErrorState, Icon, IconTile, Loading } from '@/ui'
import { ACC, GREEN, RED, SGL, type StageGroup } from '@/lib/constants'
import { capacityLabel, penVisual } from '@/lib/pens'
import { ageShort, penHelp } from './lib'
import { AnimalTable, HelpBtn, Kpi, KpiGrid, avgLabel, avgOf, useHerd } from './parts'
import { PenLayout } from './PenLayout'

export default function PenPage() {
  const { penId } = useParams()
  const { canEditHerd } = useFarm()
  const { openLog, openBuyAnimals } = useOverlays()
  const { list, pens, loading, error, refetch } = useHerd()

  const pen = pens.data?.find((p) => p.id === penId)
  const rows = useMemo(() => list.filter((a) => a.pen_id === penId), [list, penId])
  const [counts, alerts] = useMemo(() => {
    const m = new Map<string, number>()
    const at = new Map<string, number>()
    for (const a of list) if (a.pen_id) {
      m.set(a.pen_id, (m.get(a.pen_id) ?? 0) + 1)
      if (a.attn) at.set(a.pen_id, (at.get(a.pen_id) ?? 0) + 1)
    }
    return [m, at] as const
  }, [list])
  const nav = useNavigate()

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} retry={refetch} />
  if (!pen) {
    return (
      <Card className="p-6">
        <Empty icon="fence" title="Curral não encontrado" sub="Este curral já não existe ou não pertence a esta exploração." />
      </Card>
    )
  }

  const [icon, tint, ink] = penVisual(pen)
  const cnt = new Map<StageGroup, number>()
  rows.forEach((a) => cnt.set(a.g, (cnt.get(a.g) ?? 0) + 1))
  const comp = [...cnt.entries()].map(([k, v]) => `${v} ${SGL[k].toLowerCase()}`).join(' · ') || 'Vazio'
  const pc = pen.capacity ? (rows.length / pen.capacity) * 100 : 0
  const attn = rows.filter((a) => a.attn).length
  const avgAge = rows.length ? rows.reduce((x, a) => x + a.ageD, 0) / rows.length : 0
  const help = penHelp(pen)

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs items={[{ label: 'Animais', to: '/herd' }, { label: pen.name }]} />
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon={icon} bg={tint} fg={ink} size={44} iconSize={24} className="shrink-0 rounded-[14px]" />
          <div className="flex min-w-0 flex-col">
            <h1 className="m-0 truncate text-2xl leading-tight font-semibold tracking-[-0.02em]">{pen.name}</h1>
            <span className="truncate text-[13px] leading-tight text-muted">{pen.kind}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditHerd && !pen.blocked && <Button icon="add" onClick={() => openBuyAnimals(pen.id)}>Adicionar animais</Button>}
          {canEditHerd && <Button icon="move_down" onClick={() => openLog('transfer', { penId: pen.id })}>Transferir</Button>}
          {canEditHerd && <Button variant="soft" icon="vaccines" onClick={() => openLog('treatment', { penId: pen.id })}>Tratar curral</Button>}
        </div>
      </header>

      {pen.blocked && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#F5C6C2] bg-danger-soft px-4 py-3 text-sm text-[#8E2620]">
          <Icon name="block" size={20} className="shrink-0" />
          <span><strong>Curral vedado</strong> · não recebe animais{pen.blocked_reason ? ` · ${pen.blocked_reason}` : ''}.</span>
        </div>
      )}
      <KpiGrid>
        <Kpi label="Ocupação" value={`${rows.length} / ${capacityLabel(pen)}`} sub={pen.capacity == null ? 'curral sem limite' : `${Math.round(pc)}% da capacidade`} icon="fence" bg="#EEECFE" fg={ACC} />
        <Kpi label="Composição" value={comp} sub="por fase" icon="category" bg="#F0F0F6" fg="#55556A" />
        <Kpi label="Peso médio" value={avgLabel(avgOf(rows))} sub={`idade média ${avgAge ? ageShort(avgAge) : '—'}`} icon="monitor_weight" bg="#E6F6EE" fg="#0F7A44" />
        <Kpi label="Precisam de atenção" value={attn} sub={attn ? 'ver estado na lista' : 'tudo em ordem'} icon="error" bg="#FDECEA" fg="#C0302A" valueColor={attn ? RED : GREEN} />
        <Card as="div" className="flex min-w-0 flex-col gap-1.5 px-[18px] py-3.5">
          <span className="text-[13px] text-muted">Localização na granja</span>
          <PenLayout mini pens={pens.data ?? []} counts={counts} alerts={alerts} highlight={pen.id} onOpen={(p) => p.id !== pen.id && nav(`/herd/pens/${p.id}`)} />
        </Card>
      </KpiGrid>

      {rows.length > 0 ? (
        <AnimalTable title="Animais no curral" rows={rows} thirdCol="parents" showSearch />
      ) : (
        <Card className="flex flex-col items-center gap-2.5 px-5 py-10 text-center">
          <Icon name="fence" size={32} className="text-faint" />
          <div className="font-semibold">Curral vazio</div>
          <div className="text-sm text-muted">{pen.blocked ? 'Este curral está vedado e não recebe animais.' : 'Transfira animais, registe uma compra ou registe animais que já estão na granja.'}</div>
          {canEditHerd && !pen.blocked && <Button variant="soft" icon="add" onClick={() => openBuyAnimals(pen.id)}>Adicionar animais</Button>}
        </Card>
      )}

      {help.length > 0 && (
        <Card className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2"><Icon name="menu_book" size={18} className="text-faint" />Ajuda para este curral</span>
          <div className="flex flex-wrap gap-0.5">{help.map((h) => <HelpBtn key={h.to} h={h} />)}</div>
        </Card>
      )}
    </div>
  )
}
