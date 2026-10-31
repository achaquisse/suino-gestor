import { useQuery } from '@tanstack/react-query'
import { useFarm } from '@/app/farm'
import { farmKey } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

const EMPTY = new Set<string>()
const toSet = (ids: unknown) => (Array.isArray(ids) ? new Set<string>(ids) : EMPTY)

export function useFilesIndex() {
  const { farmId } = useFarm()
  const q = useQuery({
    queryKey: farmKey(farmId, 'transaction_files', 'index'),
    queryFn: async () => {
      const { data, error } = await supabase.from('transaction_files').select('transaction_id').eq('farm_id', farmId)
      if (error) throw error
      return (data ?? []).map((r) => r.transaction_id)
    },
    select: toSet,
  })
  return q.data ?? EMPTY
}
