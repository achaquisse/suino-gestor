import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import type { HelpCategory, HelpDoc } from '@/lib/database.types'
import { queryWords, searchLocal, type HelpSearchResult } from './helpers'

const HOUR = 60 * 60 * 1000
const LIBRARY_KEY = ['help', 'docs'] as const
const COLUMNS = 'id, kind, cat, title, blurb, icon, mins, lead, facts, sections, example, warn, cta_label, cta_target, hero_url, hero_alt, hero_credit, hero_source, sort, published, search_text, updated_at'

const cachedLibrary = () => queryClient.getQueryData<HelpDoc[]>(LIBRARY_KEY)

async function fetchLibrary() {
  const { data, error } = await supabase.from('help_docs').select(COLUMNS).order('kind', { ascending: false }).order('sort')
  if (error) throw error
  return (data ?? []) as unknown as HelpDoc[]
}

export const useHelpLibrary = () => useQuery({ queryKey: LIBRARY_KEY, queryFn: fetchLibrary, staleTime: HOUR })

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function useHelpSearch(q: string, cat: HelpCategory | null) {
  const term = queryWords(useDebounced(q, 250)).join(' ')
  return useQuery({
    queryKey: ['help', 'search', term, cat],
    queryFn: async (): Promise<HelpSearchResult> => {
      const { data, error } = await supabase.rpc('search_help', { p_query: term, p_cat: cat })
      if (!error) return data as unknown as HelpSearchResult
      const lib = cachedLibrary()
      if (lib?.length) return searchLocal(lib, term, cat)
      throw error
    },
    staleTime: HOUR,
    placeholderData: keepPreviousData,
  })
}

export function useHelpDoc(id: string | undefined) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['help', 'doc', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('help_docs').select(COLUMNS).eq('id', id!).maybeSingle()
      if (error) {
        const local = cachedLibrary()?.find((d) => d.id === id)
        if (local) return local
        throw error
      }
      return data as unknown as HelpDoc | null
    },
    enabled: !!id,
    staleTime: HOUR,
    initialData: () => qc.getQueryData<HelpDoc[]>(LIBRARY_KEY)?.find((d) => d.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(LIBRARY_KEY)?.dataUpdatedAt,
  })
}
