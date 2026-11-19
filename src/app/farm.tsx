import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Farm, FarmMember, Role } from '@/lib/database.types'
import { ROLE_LABEL } from '@/lib/constants'
import { initials } from '@/lib/format'
import { useAuth } from './auth'

/** `via_admin`: a farm the super admin opened from /admin without being a member of it. */
export type Membership = FarmMember & { farm: Farm; via_admin?: boolean }

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
  /** Platform super admin (SUPER_ADMIN_EMAIL): creates farms and can open any of them. */
  isSuperAdmin: boolean
  /** The current farm was opened through the admin area, not through a membership. */
  viaAdmin: boolean
  switchFarm: (id: string) => void
}

const FarmContext = createContext<FarmState | null>(null)
export const FARM_STORAGE_KEY = 'suino-gestor.farm'
const STORAGE_KEY = FARM_STORAGE_KEY

export function useIsSuperAdmin() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['super-admin', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_super_admin')
      if (error) throw error
      return data === true
    },
  })
}

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
      const list = (data ?? []) as unknown as Membership[]
      // The super admin can open any farm: add the selected one when they are not a member.
      const selected = localStorage.getItem(STORAGE_KEY)
      if (selected && !list.some((m) => m.farm_id === selected)) {
        const { data: isAdmin } = await supabase.rpc('is_super_admin')
        if (isAdmin) {
          const { data: farm } = await supabase.from('farms').select('*').eq('id', selected).maybeSingle()
          if (farm) {
            list.push({
              farm_id: farm.id, user_id: user!.id, role: 'owner', display_name: '', created_at: farm.created_at,
              prefs: { lang: 'pt', notif: { tasks: true, stock: true } }, farm, via_admin: true,
            })
          }
        }
      }
      return list
    },
  })
}

export function FarmProvider({ memberships, children }: { memberships: Membership[]; children: ReactNode }) {
  const { user } = useAuth()
  const isSuperAdmin = useIsSuperAdmin().data ?? false
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
      roleLabel: member.via_admin ? 'Super admin' : ROLE_LABEL[role],
      member,
      memberships,
      user: { id: user!.id, name, email: user?.email ?? '', initials: initials(name), avatar: meta.avatar_url ?? null },
      canSeeMoney: role === 'owner' || role === 'investor',
      canEditHerd: role !== 'investor',
      isOwner: role === 'owner',
      isSuperAdmin,
      viaAdmin: !!member.via_admin,
      switchFarm: (id) => {
        setFarmId(id)
        qc.removeQueries({ queryKey: ['farm'] })
      },
    }
  }, [member, memberships, user, qc, isSuperAdmin])
  return <FarmContext value={value}>{children}</FarmContext>
}

export function useFarm() {
  const ctx = use(FarmContext)
  if (!ctx) throw new Error('useFarm must be used inside FarmProvider')
  return ctx
}
