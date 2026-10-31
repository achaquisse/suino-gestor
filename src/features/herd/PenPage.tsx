import { useMemo } from 'react'
import { useParams } from 'react-router'
import { useFarm } from '@/app/farm'
import { useOverlays } from '@/app/overlays'
import { Breadcrumbs, Button, Card, Empty, ErrorState, Icon, IconTile, Loading } from '@/ui'
import { ACC, GREEN, PEN_ICON, RED, SGL, type StageGroup } from '@/lib/constants'
import { ageShort, penHelp } from './lib'
import { AnimalTable, HelpBtn, Kpi, KpiGrid, avgLabel, avgOf, useHerd } from './parts'

export default function PenPage() {
  const { penId } = useParams()
  const { isOwner, canEditHerd } = useFarm()
  const { openLog, openBuyAnimals } = useOverlays()
  const { list, pens, loading, error, refetch } = useHerd()

  const pen = pens.data?.find((p) => p.id === penId)
  const rows = useMemo(() => list.filter((a) => a.pen_id === penId), [list, penId])

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} retry={refetch} />
  if (!pen) {
    return (
      <Card className="p-6">
        <Empty icon="fence" title="Curral não encontrado" sub="Este curral já não existe ou não pertence a esta exploração." />
      </Card>
    )
  }

  const [icon, tint, ink] = PEN_ICON(pen.name, pen.kind)
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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <IconTile icon={icon} bg={tint} fg={ink} size={52} iconSize={26} className="rounded-2xl" />
          <div>
            <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">{pen.name}</h1>
            <div className="flex flex-wrap items-center gap-1 text-ink-2">
              {pen.kind}
              {help.length > 0 && <span className="text-[#C9C9D6]">·</span>}
              {help.map((h) => <HelpBtn key={h.to} h={h} size="sm" />)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner && <Button icon="add_shopping_cart" onClick={() => openBuyAnimals(pen.id)}>Comprar</Button>}
          {canEditHerd && <Button icon="move_down" onClick={() => openLog('transfer', { penId: pen.id })}>Transferir</Button>}
          {canEditHerd && <Button variant="soft" icon="vaccines" onClick={() => openLog('treatment', { penId: pen.id })}>Tratar curral</Button>}
        </div>
      </header>

      <KpiGrid>
        <Kpi label="Ocupação" value={`${rows.length} / ${pen.capacity}`} sub={`${Math.round(pc)}% da capacidade`} icon="fence" bg="#EEECFE" fg={ACC} />
        <Kpi label="Composição" value={comp} sub="por fase" icon="category" bg="#F0F0F6" fg="#55556A" />
        <Kpi label="Peso médio" value={avgLabel(avgOf(rows))} sub={`idade média ${avgAge ? ageShort(avgAge) : '—'}`} icon="monitor_weight" bg="#E6F6EE" fg="#0F7A44" />
        <Kpi label="Precisam de atenção" value={attn} sub={attn ? 'ver estado na lista' : 'tudo em ordem'} icon="error" bg="#FDECEA" fg="#C0302A" valueColor={attn ? RED : GREEN} />
      </KpiGrid>

      {rows.length > 0 ? (
        <AnimalTable title="Animais no curral" rows={rows} thirdCol="parents" showSearch />
      ) : (
        <Card className="flex flex-col items-center gap-2.5 px-5 py-10 text-center">
          <Icon name="fence" size={32} className="text-faint" />
          <div className="font-semibold">Curral vazio</div>
          <div className="text-sm text-muted">Transfira animais ou registe uma compra para este curral.</div>
          {isOwner && <Button variant="soft" icon="add_shopping_cart" onClick={() => openBuyAnimals(pen.id)}>Registar compra</Button>}
        </Card>
      )}
    </div>
  )
}
