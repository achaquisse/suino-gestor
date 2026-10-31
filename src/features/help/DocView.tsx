import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useFarm } from '@/app/farm'
import { useOverlays } from '@/app/overlays'
import { Breadcrumbs, Button, Card, Icon, SectionLabel, cx, useToast } from '@/ui'
import type { HelpCtaTarget, HelpDoc, HelpImage } from '@/lib/database.types'
import { docHref, docKind, docLook } from './helpers'
import { useHelpLibrary } from './queries'

const sectionNo = (i: number) => String(i + 1).padStart(2, '0')
const scrollToId = (id: string) => {
  const el = document.getElementById(id)
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' })
}

function Photo({ src, alt, icon, tint, ink, className }: { src: string | null; alt: string; icon: string; tint: string; ink: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={cx('relative grid place-items-center overflow-hidden', className)} style={{ background: `linear-gradient(135deg, ${tint} 0%, #F3F3F9 100%)`, color: ink }}>
      <Icon name={icon} size={56} className="opacity-40" />
      {src && !failed && <img src={src} alt={alt} loading="lazy" decoding="async" crossOrigin="anonymous" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />}
    </div>
  )
}

const Credit = ({ img }: { img: Pick<HelpImage, 'credit' | 'source'> }) =>
  img.credit ? (
    <a href={img.source || undefined} target="_blank" rel="noreferrer noopener" className="text-[11px] text-faint hover:text-muted">Foto: {img.credit}</a>
  ) : null

function ImageBox({ img, icon, tint, ink }: { img: HelpImage; icon: string; tint: string; ink: string }) {
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <Photo src={img.src} alt={img.caption} icon={icon} tint={tint} ink={ink} className="aspect-video w-full rounded-2xl" />
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-[13px] text-muted">{img.caption}</span>
        <Credit img={img} />
      </figcaption>
    </figure>
  )
}

function Related({ doc }: { doc: HelpDoc }) {
  const { data: library = [] } = useHelpLibrary()
  const same = library.filter((x) => x.cat === doc.cat && x.id !== doc.id)
  const rel = [...same.filter((x) => x.kind === doc.kind), ...same.filter((x) => x.kind !== doc.kind)].slice(0, 4).map((r) => ({ ...r, ...docLook(r), href: docHref(r) }))
  if (!rel.length) return null
  return (
    <Card as="div" className="flex flex-col gap-1 p-4">
      <SectionLabel className="px-2 pb-1.5">Relacionado</SectionLabel>
      {rel.map((r) => (
        <Link key={r.href} to={r.href} className="flex items-center gap-2.5 rounded-[10px] p-2 text-ink hover:bg-sunken hover:no-underline">
          <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px]" style={{ background: r.tint, color: r.ink }}><Icon name={r.icon} size={16} /></span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{r.title}</span>
            <span className="text-xs text-muted">{docKind(r)}</span>
          </span>
        </Link>
      ))}
    </Card>
  )
}

export default function DocView({ doc }: { doc: HelpDoc }) {
  const { canEditHerd } = useFarm()
  const { openLog } = useOverlays()
  const navigate = useNavigate()
  const toast = useToast()
  const isGuide = doc.kind === 'guide'
  const { icon, tint, ink } = docLook(doc)
  const base = isGuide ? 'guide' : 'art'
  const exId = `doc-${base}-${doc.id}-ex`
  const warnId = `doc-${base}-${doc.id}-warn`
  const allSteps = doc.sections.reduce((a, s) => a + (s.steps?.length ?? 0), 0)
  const warn = isGuide && doc.warn.length ? doc.warn : null

  const toc = [
    ...doc.sections.map((s, i) => ({ n: sectionNo(i), h: s.h, id: `doc-${base}-${doc.id}-${i}` })),
    ...(doc.example ? [{ n: '—', h: 'Caso real', id: exId }] : []),
    ...(warn ? [{ n: '!', h: 'Quando chamar o veterinário', id: warnId }] : []),
  ]

  const runCta = (t: HelpCtaTarget) => {
    if (t === 'settings' || t === 'reports') navigate(`/${t}`)
    else openLog(t)
  }
  const target = doc.cta_target
  const cta = doc.cta_label && target && (canEditHerd || target === 'settings' || target === 'reports') ? ([doc.cta_label, target] as const) : null
  const callVet = () => toast('A ligar a Dr. Sitoe · +258 84 123 4567')

  return (
    <div className="flex flex-col gap-4 animate-pf-up">
      <div>
        <Breadcrumbs items={[{ label: 'Ajuda', to: '/help' }, { label: isGuide ? 'Guias práticos' : 'Base de conhecimento', to: '/help' }, { label: doc.title }]} />
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 wide:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3.5 p-7" style={{ background: `linear-gradient(135deg, ${tint} 0%, #FFFFFF 78%)` }}>
            <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: ink }}>
              <span className="grid size-8 place-items-center rounded-[10px]" style={{ background: tint }}><Icon name={icon} size={18} /></span>
              {isGuide ? 'Guia prático' : 'Base de conhecimento'} · {doc.cat}
            </span>
            <h1 className="m-0 text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] text-pretty">{doc.title}</h1>
            <p className="m-0 text-base leading-[1.55] text-ink-2 text-pretty">{doc.lead}</p>
            <span className="text-[13px] text-muted">{doc.mins} min de leitura{allSteps ? ` · ${allSteps} passos` : ''}</span>
          </div>
          <figure className="relative m-0 flex flex-col">
            <Photo key={doc.id} src={doc.hero_url} alt={doc.hero_alt || doc.title} icon={icon} tint={tint} ink={ink} className="min-h-[200px] flex-1 wide:min-h-[320px]" />
            {doc.hero_credit && (
              <figcaption className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/55 to-transparent px-4 pt-6 pb-2 text-right [&_a]:text-white/85 [&_a:hover]:text-white">
                <Credit img={{ credit: doc.hero_credit, source: doc.hero_source ?? '' }} />
              </figcaption>
            )}
          </figure>
        </div>
      </Card>

      {doc.facts.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2.5">
          {doc.facts.map(([k, v]) => (
            <Card key={k} as="div" className="flex flex-col gap-0.5 px-4 py-3.5">
              <span className="text-xs text-muted">{k}</span>
              <span className="text-base font-semibold">{v}</span>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 [@media(min-width:980px)]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          {doc.sections.map((s, i) => (
            <Card key={i} className="flex animate-pf-fade flex-col gap-3.5 p-6" style={{ animationDelay: `${i * 70 + 120}ms` }}>
              <span id={`doc-${base}-${doc.id}-${i}`} className="contents" />
              <div className="flex items-baseline gap-3">
                <span className="tabular text-[13px] font-bold text-accent">{sectionNo(i)}</span>
                <h2 className="m-0 text-[19px] font-semibold">{s.h}</h2>
              </div>
              {s.p?.map((p, j) => <p key={j} className="m-0 text-[15px] leading-[1.6] text-[#2E2E3A] text-pretty">{p}</p>)}
              {s.list && (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {s.list.map((li, j) => (
                    <li key={j} className="flex gap-2.5 text-[15px] leading-normal text-[#2E2E3A]">
                      <Icon name="check_circle" size={18} className="mt-px text-accent" />{li}
                    </li>
                  ))}
                </ul>
              )}
              {s.steps && (
                <div className="flex flex-col">
                  {s.steps.map(([t, d], j) => (
                    <div key={j} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3">
                      <div className="flex flex-col items-center">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-strong">{j + 1}</span>
                        <span className={cx('w-0.5 flex-1 bg-line', j === s.steps!.length - 1 && 'opacity-0')} />
                      </div>
                      <div className="flex flex-col gap-0.5 pt-[3px] pb-4">
                        <span className="font-semibold">{t}</span>
                        <span className="text-sm leading-normal text-ink-2">{d}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {s.img && <ImageBox img={s.img} icon={icon} tint={tint} ink={ink} />}
              {s.tip && (
                <div className="flex gap-2.5 rounded-[14px] bg-[#F5F4FF] px-4 py-3.5 text-sm leading-normal text-[#2E2A6B]">
                  <Icon name="lightbulb" size={20} className="text-accent" />{s.tip}
                </div>
              )}
            </Card>
          ))}

          {doc.example && (
            <section id={exId} className="flex flex-col gap-3 rounded-card bg-ink p-6 text-white">
              <span className="text-xs font-semibold tracking-[0.06em] text-[#A8A4FF] uppercase">Caso real</span>
              <h2 className="m-0 text-[19px] font-semibold">{doc.example.title}</h2>
              <p className="m-0 text-[15px] text-[#CFCFE0]">{doc.example.intro}</p>
              {doc.example.steps.map(([t, d], i) => (
                <div key={i} className="flex justify-between gap-3 border-t border-white/12 py-2.5 text-sm">
                  <span className="text-[#CFCFE0]">{t}</span>
                  <span className="text-right font-semibold">{d}</span>
                </div>
              ))}
            </section>
          )}

          {warn && (
            <section id={warnId} className="flex flex-col gap-3 rounded-card bg-danger-soft p-6">
              <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[#8E1F19]"><Icon name="emergency" size={22} />Quando chamar o veterinário</h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {warn.map((w, i) => (
                  <li key={i} className="flex gap-2.5 text-[15px] text-[#5C1712]"><Icon name="error" size={18} className="text-danger" />{w}</li>
                ))}
              </ul>
              <button type="button" onClick={callVet} className="flex h-11 items-center gap-2 self-start rounded-[13px] border-0 bg-danger px-4 text-sm font-semibold whitespace-nowrap text-white active:scale-[0.97]">
                <Icon name="call" />Ligar ao veterinário
              </button>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-3.5 [@media(min-width:980px)]:sticky [@media(min-width:980px)]:top-[110px]">
          <Card as="div" className="flex flex-col gap-0.5 p-4">
            <SectionLabel className="px-2 pb-1.5">Neste guia</SectionLabel>
            {toc.map((t) => (
              <button key={t.id} type="button" onClick={() => scrollToId(t.id)} className="flex gap-2.5 rounded-[10px] border-0 bg-transparent p-2 text-left text-sm text-ink hover:bg-sunken">
                <span className="w-5 pt-0.5 text-xs font-bold text-accent">{t.n}</span>{t.h}
              </button>
            ))}
          </Card>
          {cta && <Button variant="primary" size="lg" icon="add" onClick={() => runCta(cta[1])}>{cta[0]}</Button>}
          <Related doc={doc} />
        </aside>
      </div>
    </div>
  )
}
