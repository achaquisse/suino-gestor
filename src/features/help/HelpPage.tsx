import { Link } from 'react-router'
import { useUrlState } from '@/lib/urlState'
import { HCAT } from '@/lib/constants'
import type { HelpCategory } from '@/lib/database.types'
import { Button, Card, ErrorState, Icon, IconTile, Loading, Spinner, cx, useToast } from '@/ui'
import { HELP_CATS, docHref, docLook } from './helpers'
import { useHelpLibrary, useHelpSearch } from './queries'

type Filter = 'all' | HelpCategory

export default function HelpPage() {
  const toast = useToast()
  const [q, setQ] = useUrlState('q', '')
  const [cat, setCat] = useUrlState<Filter>('cat', 'all', ['all', ...HELP_CATS])
  useHelpLibrary()
  const search = useHelpSearch(q, cat === 'all' ? null : cat)
  const res = search.data

  const count = (c: Filter) => (c === 'all' ? res?.total : res?.counts[c] ?? 0) ?? 0
  const shownGuides = (res?.items ?? []).filter((d) => d.kind === 'guide').map((d) => ({ ...d, ...docLook(d), href: docHref(d) }))
  const shownArts = (res?.items ?? []).filter((d) => d.kind === 'article').map((d) => ({ ...d, ...docLook(d), href: docHref(d) }))
  const cats: [Filter, string, string][] = [['all', 'Tudo', 'apps'], ...HELP_CATS.map((c) => [c, c, HCAT[c][0]] as [Filter, string, string])]

  return (
    <div className="flex flex-col gap-5.5">
      <section className="flex animate-pf-up flex-col gap-4 rounded-[26px] bg-[linear-gradient(135deg,#EEECFE_0%,#F6F3FF_45%,#E6F4F8_100%)] p-7">
        <div>
          <h1 className="m-0 text-[28px] font-semibold tracking-[-0.025em]">Como podemos ajudar?</h1>
          <div className="mt-1 text-ink-2">Guias práticos e artigos para o dia-a-dia da granja.</div>
        </div>
        <label className="flex h-[52px] w-full items-center gap-2 rounded-2xl border border-white bg-white px-3">
          <Icon name="search" size={18} className="text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar: cio, ferro, carência, peste suína…" className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none" />
          {search.isFetching && <Spinner size={16} />}
        </label>
        <div className="flex flex-wrap gap-2">
          {cats.map(([v, l, ic]) => (
            <button key={v} type="button" onClick={() => setCat(v)}
              className={cx('flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold', cat === v ? 'border-ink bg-ink text-white' : 'border-white bg-white/85 text-ink-2')}>
              <Icon name={ic} size={16} />{l}{res && <span className="font-medium opacity-70">{count(v)}</span>}
            </button>
          ))}
        </div>
      </section>

      {!res && search.isPending && <Loading />}
      {!res && search.isError && <ErrorState error={search.error} retry={() => search.refetch()} />}

      {res && !shownGuides.length && !shownArts.length && (
        <Card as="div" className="px-5 py-8 text-center text-muted">Nada encontrado. Tente outra palavra.</Card>
      )}

      {shownGuides.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-[17px] font-semibold">Guias práticos</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3">
            {shownGuides.map((g, i) => (
              <Link key={g.id} to={g.href} style={{ animationDelay: `${i * 50}ms` }}
                className="flex animate-pf-fade flex-col gap-2.5 rounded-card border border-line bg-white p-[18px] text-left text-ink shadow-card transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[#C9C2FB] hover:no-underline">
                <IconTile icon={g.icon} bg={g.tint} fg={g.ink} iconSize={22} />
                <span className="text-base font-semibold">{g.title}</span>
                <span className="text-[13px] text-ink-2">{g.blurb}</span>
                <span className="text-xs text-muted">{g.mins} min · {g.n_sections} secções</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {shownArts.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-baseline gap-2.5 px-5 py-4">
            <h2 className="m-0 text-[17px] font-semibold">Base de conhecimento</h2>
            <span className="text-[13px] text-muted">{shownArts.length} artigos</span>
          </div>
          {shownArts.map((a) => (
            <Link key={a.id} to={a.href} className="flex w-full items-center gap-3 border-t border-divider bg-white px-5 py-3 text-ink hover:bg-[#FAFAFD] hover:no-underline">
              <IconTile icon={a.icon} bg={a.tint} fg={a.ink} size={34} iconSize={18} className="rounded-[10px]" />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="font-medium">{a.title}</span>
                <span className="text-xs text-muted">{a.cat} · {a.mins} min</span>
              </span>
              <Icon name="chevron_right" size={18} className="text-[#B5B5C6]" />
            </Link>
          ))}
        </Card>
      )}

      <Card className="flex flex-wrap items-center gap-3.5 p-5">
        <IconTile icon="support_agent" bg="#E6F6EE" fg="#0F7A44" size={44} iconSize={24} className="rounded-[14px]" />
        <div className="min-w-[200px] flex-1">
          <div className="font-semibold">Precisa de ajuda urgente?</div>
          <div className="text-sm text-muted">Fale com o veterinário ou com o suporte do Porkflow.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon="mail" onClick={() => toast('Email aberto · suporte@porkflow.co.mz')}>Suporte</Button>
        </div>
      </Card>
    </div>
  )
}
