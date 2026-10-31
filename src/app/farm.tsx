import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Farm, FarmMember, Role } from '@/lib/database.types'
import { ROLE_LABEL } from '@/lib/constants'
import { initials } from '@/lib/format'
import { useAuth } from './auth'

export type Membership = FarmMember & { farm: Farm }

type FarmState = {
  farm: Farm
  farmId: string
  role: Role
  roleLabel: string
  member: Membership
  memberships: Membership[]
  user: { id: string; name: string; email: string; initials: string; avatar: string | null }
  canSeeMoney: boolean
  canEditHerd: boolean
  isOwner: boolean
  switchFarm: (id: string) => void
}

const FarmContext = createContext<FarmState | null>(null)
const STORAGE_KEY = 'porkflow.farm'

export function useMemberships() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['memberships', user?.id],
    enabled: !!user,
    queryFn: async () => {
      await supabase.rpc('accept_invites')
      const { data, error } = await supabase
        .from('farm_members')
        .select('*, farm:farms(*)')
        .eq('user_id', user!.id)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as Membership[]
    },
  })
}

export function FarmProvider({ memberships, children }: { memberships: Membership[]; children: ReactNode }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [farmId, setFarmId] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '')
  const member = memberships.find((m) => m.farm_id === farmId) ?? memberships[0]

  useEffect(() => {
    if (member) localStorage.setItem(STORAGE_KEY, member.farm_id)
  }, [member])

  const value = useMemo<FarmState>(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>
    const name = member.display_name || meta.full_name || meta.name || user?.email?.split('@')[0] || ''
    const role = member.role
    return {
      farm: member.farm,
      farmId: member.farm_id,
      role,
      roleLabel: ROLE_LABEL[role],
      member,
      memberships,
      user: { id: user!.id, name, email: user?.email ?? '', initials: initials(name), avatar: meta.avatar_url ?? null },
      canSeeMoney: role === 'owner' || role === 'investor',
      canEditHerd: role !== 'investor',
      isOwner: role === 'owner',
      switchFarm: (id) => {
        setFarmId(id)
        qc.removeQueries({ queryKey: ['farm'] })
      },
    }
  }, [member, memberships, user, qc])
  return <FarmContext value={value}>{children}</FarmContext>
}

export function useFarm() {
  const ctx = use(FarmContext)
  if (!ctx) throw new Error('useFarm must be used inside FarmProvider')
  return ctx
}
