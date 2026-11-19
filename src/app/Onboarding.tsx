import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button, Icon, Logo, useToast } from '@/ui'
import { useAuth } from './auth'
import { useMemberships } from './farm'

/** Signed in, but not a member of any farm. Only the super admin creates farms, so the user waits for an invite. */
export function Onboarding() {
  const { user, signOut } = useAuth()
  const memberships = useMemberships()
  const qc = useQueryClient()
  const toast = useToast()
  const first = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]
  // A deactivated account keeps its session until the token expires, but has no access.
  const profile = useQuery({
    queryKey: ['profile-status', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('disabled_at').eq('id', user!.id).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const disabled = !!profile.data?.disabled_at

  const recheck = async () => {
    await qc.invalidateQueries({ queryKey: ['memberships'] })
    await qc.invalidateQueries({ queryKey: ['super-admin'] })
    if (!qc.getQueryData<unknown[]>(['memberships', user?.id])?.length) toast('Ainda não tem acesso a nenhuma granja.')
  }

  return (
    <div className="app-bg grid min-h-screen place-items-center px-5 py-10">
      <div className="flex w-full max-w-[440px] animate-pf-up flex-col gap-6 rounded-card border border-line bg-white p-7 shadow-card">
        <Logo size={52} className="rounded-2xl shadow-[0_10px_28px_rgba(91,76,240,0.35)]" />
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[24px] font-semibold tracking-[-0.025em]">{first ? `Bem-vindo, ${first}` : 'Bem-vindo'}</h1>
          <p className="m-0 text-ink-2">{disabled ? 'A sua conta foi desactivada pelo administrador da plataforma.' : 'Ainda não tem acesso a nenhuma granja.'}</p>
        </div>
        {!disabled && <div className="flex items-start gap-3 rounded-[14px] bg-sunken px-4 py-3.5 text-sm text-ink-2">
          <Icon name="mail" className="mt-0.5 shrink-0 text-muted" />
          <span>Peça ao proprietário da granja, ou ao administrador da plataforma, que o convide com o email <strong className="break-all text-ink">{user?.email}</strong>. Depois carregue em «Verificar de novo».</span>
        </div>}
        <div className="flex flex-col gap-2.5">
          {!disabled && <Button variant="primary" size="lg" icon="refresh" loading={memberships.isFetching} onClick={recheck}>Verificar de novo</Button>}
          <Button size="lg" icon="logout" onClick={() => signOut().catch(() => toast('Sem ligação — não foi possível terminar a sessão.', 'error'))}>Terminar sessão</Button>
        </div>
      </div>
    </div>
  )
}
