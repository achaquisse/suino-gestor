import { HCAT } from '@/lib/constants'
import type { HelpCategory, HelpDoc } from '@/lib/database.types'

export type HelpSummary = Pick<HelpDoc, 'id' | 'kind' | 'cat' | 'title' | 'blurb' | 'icon' | 'mins' | 'lead' | 'hero_url' | 'hero_alt'> & { n_sections: number; rank: number }
export type HelpSearchResult = { total: number; counts: Partial<Record<HelpCategory, number>>; items: HelpSummary[] }

export const HELP_CATS = Object.keys(HCAT) as HelpCategory[]

export const docHref = (d: Pick<HelpDoc, 'id' | 'kind'>) => (d.kind === 'guide' ? `/help/playbooks/${d.id}` : `/help/articles/${d.id}`)
export const docKind = (d: Pick<HelpDoc, 'kind'>) => (d.kind === 'guide' ? 'Guia prático' : 'Artigo')
export const docLook = (d: Pick<HelpDoc, 'cat' | 'icon'>) => {
  const [icon, tint, ink] = HCAT[d.cat] ?? HCAT['Usar o Porkflow']
  return { icon: d.icon || icon, tint, ink }
}

export const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export const queryWords = (q: string) => fold(q.slice(0, 200)).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean).slice(0, 8)

const toSummary = (d: HelpDoc, rank: number): HelpSummary => ({
  id: d.id, kind: d.kind, cat: d.cat, title: d.title, blurb: d.blurb, icon: d.icon, mins: d.mins, lead: d.lead,
  hero_url: d.hero_url, hero_alt: d.hero_alt, n_sections: d.sections.length, rank,
})

export function searchLocal(docs: HelpDoc[], q: string, cat: HelpCategory | null): HelpSearchResult {
  const words = queryWords(q)
  const phrase = words.join(' ')
  const hits = docs.flatMap((d) => {
    const text = d.search_text || fold(d.title)
    if (!words.every((w) => new RegExp(`\\b${w}`).test(text))) return []
    const title = fold(d.title)
    const rank = words.length ? (title.includes(phrase) ? 1 : 0) + 0.3 * words.filter((w) => title.includes(w)).length : 0
    return [toSummary(d, rank)]
  })
  const counts: Partial<Record<HelpCategory, number>> = {}
  for (const h of hits) counts[h.cat] = (counts[h.cat] ?? 0) + 1
  const sortKey = (d: HelpSummary) => docs.find((x) => x.id === d.id)?.sort ?? 0
  const items = hits
    .filter((h) => !cat || h.cat === cat)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'guide' ? -1 : 1) || b.rank - a.rank || sortKey(a) - sortKey(b) || a.title.localeCompare(b.title))
  return { total: hits.length, counts, items }
}
