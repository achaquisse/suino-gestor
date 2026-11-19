import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useFarm } from '@/app/farm'
import { supabase } from '@/lib/supabase'
import { useInvalidateFarm, useRpc } from '@/lib/queries'
import type { MemberPrefs, Role } from '@/lib/database.types'

export function useUpdateMyMembership() {
  const rpc = useRpc('update_my_membership')
  const qc = useQueryClient()
  const { member } = useFarm()
  return {
    isPending: rpc.isPending,
    save: async (patch: { prefs?: MemberPrefs; name?: string }) => {
      const prefs = patch.prefs ? { ...member.prefs, ...patch.prefs } : undefined
      await rpc.mutateAsync({ p_prefs: prefs, p_display_name: patch.name })
      await qc.invalidateQueries({ queryKey: ['memberships'] })
    },
  }
}

export function useMemberAdmin() {
  const { farmId } = useFarm()
  const invalidate = useInvalidateFarm()
  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error } = await supabase.from('farm_members').update({ role }).eq('farm_id', farmId).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('farm_members').delete().eq('farm_id', farmId).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  return { setRole, removeMember }
}
