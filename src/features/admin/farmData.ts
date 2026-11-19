import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { farmKey } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

// Data access for one farm chosen in the admin area, which sits outside the FarmProvider.
// Keys live under ['farm', farmId, 'admin', ...] so the farm's own invalidation refreshes them.

type Tables = Database['public']['Tables']
type TableName = keyof Tables

export function useFarmRows<N extends TableName>(farmId: string, name: N, order: string, numeric: (keyof Tables[N]['Row'])[] = []) {
  return useQuery({
    queryKey: farmKey(farmId, 'admin', name),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(name as 'breeds') as any).select('*').eq('farm_id', farmId).order(order)
      if (error) throw error
      return ((data ?? []) as Tables[N]['Row'][]).map((r) => {
        const o = { ...r } as Record<string, unknown>
        for (const k of numeric) if (o[k as string] != null) o[k as string] = Number(o[k as string])
        return o as Tables[N]['Row']
      })
    },
  })
}

export function useFarmTableMutations<N extends TableName>(farmId: string, name: N) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['farm', farmId] })
  const insert = useMutation({
    mutationFn: async (row: Omit<Tables[N]['Insert'], 'farm_id'>) => {
      const { error } = await supabase.from(name).insert({ ...row, farm_id: farmId } as never)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Tables[N]['Update'] & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(name as 'breeds') as any).update(patch).eq('id', id).eq('farm_id', farmId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  return { insert, update }
}
