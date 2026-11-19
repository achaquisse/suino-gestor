import { useFarm } from '@/app/farm'
import { useOverlays } from '@/app/overlays'
import { ACC, GREEN, INK, MUTED, RED, SGC, TONE, type StageGroup } from '@/lib/constants'
import type { Animal, Stage, Weight } from '@/lib/database.types'
import { daysBetween, dec, todayISO } from '@/lib/format'
import { useParam } from '@/lib/queries'
import { Button, Card, HelpLinks, Icon } from '@/ui'
import { ageShort, art, fmtKg, pb, type HelpDef } from './lib'

type Pt = readonly [days: number, kg: number]

const GROW: Pt[] = [
  [0, 1.4], [7, 2.8], [14, 4.4], [21, 6], [28, 7.5], [42, 11], [56, 17], [63, 20], [70, 24], [84, 32], [105, 46], [126, 62],
  [150, 82], [165, 95], [180, 107], [210, 125], [240, 138], [300, 155], [365, 168], [540, 190], [730, 210], [1100, 230],
]
const BOAR: Pt[] = [...GROW.filter(([d]) => d <= 180), [210, 130], [240, 145], [300, 170], [365, 195], [540, 240], [730, 275], [1100, 300]]

const LOW_FAR = 0.7
const LOW = 0.85
const HIGH = 1.2
const HIGH_FAR = 1.4

const at = (pts: Pt[], x: number) => {
  if (x <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    if (x <= x1) {
      const [x0, y0] = pts[i - 1]
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return pts[pts.length - 1][1]
}

const ageFor = (pts: Pt[], kg: number) => {
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    if (kg <= y1) {
      const [x0, y0] = pts[i - 1]
      return x0 + ((kg - y0) / (y1 - y0)) * (x1 - x0)
    }
  }
  return pts[pts.length - 1][0]
}

type PhaseId = 'mat' | 'cre' | 'rec' | 'eng' | 'rep'
type Phase = { id: PhaseId; label: string; g: StageGroup; from: number; to: number; stages: Stage[]; care: string; low: HelpDef[] }

function phasesFor(weaning: number, saleAge: number): Phase[] {
  const w = Math.min(56, Math.max(14, weaning))
  const creEnd = Math.max(63, w + 14)
  const recEnd = Math.max(105, creEnd + 21)
  const engEnd = Math.max(recEnd + 30, saleAge)
  return [
    { id: 'mat', label: 'Maternidade', g: 'lei', from: 0, to: w, stages: ['Leitão'], care: 'Mama com a porca; ferro nos primeiros dias, calor e colostro.',
      low: [art('leitoes', 'Cuidados com os leitões'), pb('diar', 'Diarreia'), art('vacinas', 'Vacinação e ferro')] },
    { id: 'cre', label: 'Creche', g: 'cre', from: w, to: creEnd, stages: ['Desmamado'], care: 'Ração de iniciação; maior risco de diarreia logo após o desmame.',
      low: [art('desmame', 'Desmame'), pb('diar', 'Diarreia'), art('racao', 'Ração por fase')] },
    { id: 'rec', label: 'Recria', g: 'rec', from: creEnd, to: recEnd, stages: ['Recria'], care: 'Ração de crescimento; desparasitar e vigiar tosse.',
      low: [art('racao', 'Ração por fase'), art('parasitas', 'Desparasitação'), pb('flu', 'Gripe e tosse'), art('densidade', 'Densidade por curral')] },
    { id: 'eng', label: 'Engorda', g: 'eng', from: recEnd, to: engEnd, stages: ['Engorda'], care: 'Ração de engorda até ao peso de venda; respeitar carências.',
      low: [art('racao', 'Ração por fase'), art('parasitas', 'Desparasitação'), art('agua', 'Água por dia'), art('densidade', 'Densidade por curral')] },
    { id: 'rep', label: 'Adulto · reprodução', g: 'rep', from: engEnd, to: Infinity, stages: ['Leitoa', 'Porca', 'Varrasco'], care: 'Manter a condição corporal; ração de gestação ou lactação.',
      low: [art('condicao', 'Condição corporal'), art('racao', 'Ração por fase'), art('parasitas', 'Desparasitação')] },
  ]
}

type Verdict = { label: string; tone: keyof typeof TONE; color: string; far: boolean }
function verdictOf(r: number): Verdict {
  if (r < LOW_FAR) return { label: 'Muito abaixo do esperado', tone: 'red', color: RED, far: true }
  if (r < LOW) return { label: 'Abaixo do esperado', tone: 'amber', color: TONE.amber[1], far: false }
  if (r <= HIGH) return { label: 'Dentro do esperado', tone: 'success', color: GREEN, far: false }
  if (r <= HIGH_FAR) return { label: 'Acima do esperado', tone: 'accent', color: ACC, far: false }
  return { label: 'Muito acima do esperado', tone: 'amber', color: TONE.amber[1], far: true }
}

const ageTick = (d: number) => {
  if (d === 0) return '0'
  if (d < 365) return `${Math.round(d / 30.4)} m`
  const y = Math.round((d / 365) * 2) / 2
  return `${dec(y).replace(',0', '')} ano${y > 1 ? 's' : ''}`
}
const pctL = (r: number) => `${r > 1 ? '+' : '−'}${Math.abs(Math.round((r - 1) * 100))}%`
const uniq = (l: HelpDef[]) => l.filter((h, i) => l.findIndex((x) => x.to === h.to) === i)

const W = 640
const H = 260
const M = { l: 40, r: 16, t: 28, b: 30 }
const IW = W - M.l - M.r
const IH = H - M.t - M.b

/** Standard growth curve of a pig, with the animal placed on it by age and weight. */
export function LifeCycle({ animal, weights }: { animal: Animal; weights: Weight[] }) {
  const { canEditHerd } = useFarm()
  const { openEditAnimal } = useOverlays()
  const weaning = useParam('weaning_age_days', 21)
  const saleKg = useParam('target_sale_kg', 100)
  const curve = animal.stage === 'Varrasco' ? BOAR : GROW
  const saleAge = Math.round(Math.min(300, Math.max(120, ageFor(GROW, saleKg))))
  const phases = phasesFor(weaning, saleAge)
  const born = animal.born_on && animal.born_on <= todayISO() ? animal.born_on : null
  const refDay = animal.removed_at ? animal.removed_at.slice(0, 10) : todayISO()

  const hist = born ? weights.map((w) => ({ x: daysBetween(born, w.measured_on), kg: w.kg })).filter((p) => p.x >= 0) : []
  const cur = hist.length ? hist[hist.length - 1] : born && animal.weight_kg > 0 ? { x: daysBetween(born, refDay), kg: animal.weight_kg } : null
  const pts = hist.length ? hist : cur ? [cur] : []
  const ageNow = born ? daysBetween(born, refDay) : null

  const adult = animal.stage === 'Leitoa' || animal.stage === 'Porca' || animal.stage === 'Varrasco'
  const span = Math.max(ageNow ?? 0, cur?.x ?? 0)
  const xMax = span > 200 || (adult && span > 150) ? Math.min(1100, Math.max(365, Math.ceil((span * 1.12) / 30) * 30)) : 200
  const rawY = Math.max(at(curve, xMax) * HIGH, saleKg, ...pts.map((p) => p.kg)) * 1.06
  const yStep = [5, 10, 20, 25, 50, 100].find((s) => rawY / s <= 5) ?? 100
  const yMax = Math.ceil(rawY / yStep) * yStep
  const xStep = xMax <= 200 ? 30 : xMax <= 500 ? 90 : 180
  const sx = (d: number) => M.l + (Math.min(Math.max(d, 0), xMax) / xMax) * IW
  const sy = (kg: number) => M.t + IH - (Math.min(kg, yMax) / yMax) * IH

  const samples = Array.from({ length: 121 }, (_, i) => (i / 120) * xMax)
  const line = (k: number) => samples.map((d) => `${sx(d).toFixed(1)},${sy(at(curve, d) * k).toFixed(1)}`)
  const band = `M${line(HIGH).join('L')}L${line(LOW).reverse().join('L')}Z`

  const phaseAt = (d: number) => phases.find((p) => d >= p.from && d < p.to) ?? phases[phases.length - 1]
  const agePhase = ageNow != null ? phaseAt(ageNow) : null
  const curPhase = cur ? phaseAt(cur.x) : agePhase
  const expected = cur ? at(curve, cur.x) : null
  const ratio = cur && expected ? cur.kg / expected : null
  const verdict = ratio != null ? verdictOf(ratio) : null

  const last = hist[hist.length - 1]
  const prev = last ? [...hist].reverse().find((p) => last.x - p.x >= 7) : undefined
  const gmd = last && prev ? (last.kg - prev.kg) / (last.x - prev.x) : null
  const gmdExp = last && prev ? (at(curve, last.x) - at(curve, prev.x)) / (last.x - prev.x) : null
  const gmdRatio = gmd != null && gmdExp != null && gmdExp >= 0.08 ? gmd / gmdExp : null
  const gmdFar = gmdRatio != null && gmdRatio < 0.6

  const growerStage = !adult && agePhase && agePhase.id !== 'rep'
  const stageGap = growerStage && agePhase && ageNow != null && !agePhase.stages.includes(animal.stage)
    ? Math.min(Math.abs(ageNow - agePhase.from), Math.abs(ageNow - agePhase.to)) : 0
  const stageOff = stageGap > 14
  const lateWean = animal.stage === 'Leitão' && ageNow != null && ageNow > phases[0].to + 14
  const following = curPhase && curPhase.to !== Infinity ? phases[phases.findIndex((p) => p.id === curPhase.id) + 1] : null
  const nextPhase = following && following.id === 'rep' && !adult ? { label: 'Venda', from: following.from } : following

  const far = !!verdict?.far || gmdFar || lateWean
  const help = far && curPhase
    ? uniq([
      ...(lateWean ? [art('desmame', 'Desmame')] : []),
      ...(ratio != null && ratio > HIGH_FAR ? (curPhase.id === 'rep' ? [art('condicao', 'Condição corporal')] : [art('racao', 'Ração por fase')]) : curPhase.low),
      art('pesar', 'Pesar sem balança'),
    ])
    : []

  const message = !born
    ? 'Indique a data de nascimento para posicionar o animal na curva de crescimento.'
    : !cur
      ? 'Registe uma pesagem para comparar o peso com o esperado para a idade.'
      : ratio != null && verdict
        ? `${verdict.label}: ${fmtKg(cur.kg)} com ${cur.x < 14 ? `${cur.x} dias` : ageShort(cur.x)}, para ${fmtKg(expected! * LOW)}–${fmtKg(expected! * HIGH)} esperados (${pctL(ratio)}).`
        : ''

  const tiles = [
    { l: 'Fase pela idade', v: agePhase?.label ?? '—', sub: agePhase ? (stageOff ? `registado como ${animal.stage}` : `${dayRange(agePhase)} · ${animal.stage}`) : 'sem data de nascimento', c: stageOff ? TONE.amber[1] : INK },
    { l: 'Peso vs. esperado', v: cur ? fmtKg(cur.kg) : '—', sub: expected ? `esperado ${fmtKg(expected * LOW)}–${fmtKg(expected * HIGH)}` : '—', c: verdict?.color ?? INK },
    { l: 'Ganho diário', v: gmd != null ? `${dec(gmd, 2)} kg` : '—', sub: gmdExp != null ? `esperado ~${dec(gmdExp, 2)} kg/dia` : 'precisa de 2 pesagens', c: gmdRatio == null ? INK : gmdFar ? RED : gmdRatio < LOW ? TONE.amber[1] : GREEN },
    { l: 'Próxima fase', v: nextPhase?.label ?? (curPhase ? 'Fase adulta' : '—'), sub: nextPhase && ageNow != null ? `${nextPhase.from - ageNow > 0 ? `daqui a ~${nextPhase.from - ageNow} dias` : 'já devia ter mudado'} · ~${fmtKg(at(curve, nextPhase.from))}` : curPhase ? 'crescimento estabiliza' : '—', c: INK },
  ]

  const labelLeft = cur ? sx(cur.x) > W - 110 : false
  const labelBelow = cur ? (ratio != null && ratio < 1 && sy(cur.kg) < M.t + IH - 20) || sy(cur.kg) < M.t + 20 : false
  const saleRight = saleAge / xMax < 0.5

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="m-0 text-[15px] font-semibold">Ciclo de vida</h2>
          <div className="text-[13px] text-muted">Curva de crescimento padrão de um suíno · peso (kg) por idade</div>
        </div>
        {verdict && <span className="rounded-full px-2.5 py-1 text-[13px] font-semibold" style={{ background: TONE[verdict.tone][0], color: TONE[verdict.tone][1] }}>{verdict.label}</span>}
      </div>

      <div className="no-scrollbar overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Curva de crescimento padrão${message ? `. ${message}` : ''}`} className="block w-full min-w-[480px]">
          {phases.filter((p) => p.from < xMax).map((p) => {
            const x1 = sx(p.from)
            const x2 = sx(Math.min(p.to, xMax))
            const on = curPhase?.id === p.id
            return (
              <g key={p.id}>
                <rect x={x1} y={M.t} width={x2 - x1} height={IH} fill={SGC[p.g]} opacity={on ? 0.14 : 0.06} />
                {p.from > 0 && <line x1={x1} x2={x1} y1={M.t} y2={M.t + IH} stroke={SGC[p.g]} strokeOpacity={0.35} strokeDasharray="3 3" />}
                {x2 - x1 > 54 && (
                  <text x={(x1 + x2) / 2} y={M.t - 9} textAnchor="middle" fontSize={11} fontWeight={on ? 700 : 600} fill={SGC[p.g]}>
                    {p.id === 'rep' && x2 - x1 < 130 ? 'Adulto' : p.label}
                  </text>
                )}
              </g>
            )
          })}
          {Array.from({ length: yMax / yStep + 1 }, (_, i) => i * yStep).map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} stroke="#ECECF3" />
              <text x={M.l - 6} y={sy(v) + 4} textAnchor="end" fontSize={10.5} fill={MUTED}>{v}</text>
            </g>
          ))}
          {Array.from({ length: Math.floor(xMax / xStep) + 1 }, (_, i) => i * xStep).map((d) => (
            <text key={d} x={sx(d)} y={H - 10} textAnchor="middle" fontSize={10.5} fill={MUTED}>{ageTick(d)}</text>
          ))}
          <path d={band} fill={ACC} opacity={0.1} />
          <path d={`M${line(1).join('L')}`} fill="none" stroke={ACC} strokeOpacity={0.55} strokeWidth={2} strokeDasharray="6 4" />
          {saleKg < yMax && (
            <g>
              <line x1={M.l} x2={W - M.r} y1={sy(saleKg)} y2={sy(saleKg)} stroke={MUTED} strokeOpacity={0.6} strokeDasharray="2 4" />
              <text x={saleRight ? W - M.r - 4 : M.l + 4} y={sy(saleKg) + (saleRight ? 14 : -5)} textAnchor={saleRight ? 'end' : 'start'} fontSize={10.5} fill={MUTED} stroke="#fff" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">Peso de venda · {fmtKg(saleKg)}</text>
            </g>
          )}
          {ageNow != null && ageNow <= xMax && (
            <line x1={sx(ageNow)} x2={sx(ageNow)} y1={M.t} y2={M.t + IH} stroke={INK} strokeOpacity={0.25} strokeDasharray="2 3" />
          )}
          {pts.length > 1 && <polyline points={pts.map((p) => `${sx(p.x)},${sy(p.kg)}`).join(' ')} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />}
          {pts.slice(0, -1).map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.kg)} r={3} fill="#fff" stroke={INK} strokeWidth={1.5} />)}
          {cur && verdict && (
            <g>
              <circle cx={sx(cur.x)} cy={sy(cur.kg)} r={11} fill={verdict.color} opacity={0.18} />
              <circle cx={sx(cur.x)} cy={sy(cur.kg)} r={6} fill={verdict.color} stroke="#fff" strokeWidth={2} />
              <text x={sx(cur.x) + (labelLeft ? -14 : 14)} y={sy(cur.kg) + (labelBelow ? 20 : -10)} textAnchor={labelLeft ? 'end' : 'start'} fontSize={12} fontWeight={700} fill={INK} stroke="#fff" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">
                {animal.tag} · {fmtKg(cur.kg)}
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: ACC }} />Referência</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm" style={{ background: ACC, opacity: 0.18 }} />Faixa normal</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: verdict?.color ?? INK }} />{animal.tag}{hist.length > 1 ? ' · pesagens' : ''}</span>
      </div>

      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
        {tiles.map((k) => (
          <div key={k.l} className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-[#F7F7FB] p-3.5">
            <span className="text-xs text-muted">{k.l}</span>
            <span className="tabular truncate text-base font-semibold" style={{ color: k.c }}>{k.v}</span>
            <span className="truncate text-xs text-muted">{k.sub}</span>
          </div>
        ))}
      </div>

      {curPhase && (
        <div className="flex items-start gap-2 text-[13px] text-ink-2">
          <Icon name="info" size={18} className="shrink-0 text-faint" />
          <span><b className="font-semibold">{curPhase.label}:</b> {curPhase.care}</span>
        </div>
      )}

      {(message || stageOff || lateWean || gmdFar) && (
        <div className="flex flex-col gap-2 rounded-[14px] px-3.5 py-3" style={{ background: far ? TONE[verdict?.tone === 'red' ? 'red' : 'amber'][0] : '#F7F7FB' }}>
          {message && <span className="text-sm">{message}</span>}
          {gmdFar && gmd != null && gmdExp != null && <span className="text-sm">O ganho diário ({dec(gmd, 2)} kg) está bem abaixo dos ~{dec(gmdExp, 2)} kg/dia esperados nesta idade.</span>}
          {lateWean && <span className="text-sm">Ainda registado como leitão, mas já passou da idade de desmame ({weaning} dias).</span>}
          {stageOff && !lateWean && agePhase && <span className="text-sm">Pela idade, seria de esperar a fase {agePhase.label} (registado como {animal.stage}).</span>}
          {!born && canEditHerd && !animal.removed_at && (
            <Button size="sm" icon="edit" className="self-start" onClick={() => openEditAnimal(animal.id)}>Indicar data de nascimento</Button>
          )}
          {help.length > 0 && <HelpLinks links={help} />}
        </div>
      )}

      <span className="text-xs text-faint">Referência indicativa para suínos de produção; varia com a raça, a alimentação e o clima.</span>
    </Card>
  )
}

const dayRange = (p: Phase) => (p.to === Infinity ? `a partir do dia ${p.from}` : `dia ${p.from}–${p.to}`)
