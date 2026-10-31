import { useActionState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Field, FormError, Icon, Input, useToast } from '@/ui'
import { supabase, errorMessage } from '@/lib/supabase'
import { useAuth } from './auth'

export function Onboarding({ canCancel = false }: { canCancel?: boolean }) {
  const { user, signOut } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const [error, submit, pending] = useActionState(async (_prev: string | null, form: FormData) => {
    const name = String(form.get('name') ?? '').trim()
    const demo = form.get('demo') === '1'
    if (!name) return 'Indique o nome da granja.'
    const { data, error } = await supabase.rpc('create_farm', { p_name: name, p_demo: demo })
    if (error) return errorMessage(error)
    localStorage.setItem('porkflow.farm', data)
    await qc.invalidateQueries({ queryKey: ['memberships'] })
    navigate('/', { replace: true })
    return null
  }, null)

  const first = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]

  return (
    <div className="app-bg grid min-h-screen place-items-center px-5 py-10">
      <form action={submit} className="flex w-full max-w-[440px] animate-pf-up flex-col gap-6 rounded-card border border-line bg-white p-7 shadow-card">
        <div className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-[linear-gradient(135deg,#8B5CF6,#5B4CF5_55%,#22B8F0)] text-xl font-bold text-white shadow-[0_10px_28px_rgba(91,76,240,0.35)]">P</div>
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[24px] font-semibold tracking-[-0.025em]">{first ? `Bem-vindo, ${first}` : 'Bem-vindo'}</h1>
          <p className="m-0 text-ink-2">Crie a sua granja para começar. Se foi convidado por um proprietário, peça-lhe que use o seu email: <strong>{user?.email}</strong>.</p>
        </div>
        <Field label="Nome da granja">
          <Input name="name" placeholder="ex.: Granja Boane" autoFocus required maxLength={80} />
        </Field>
        <FormError>{error}</FormError>
        <div className="flex flex-col gap-2.5">
          <Button type="submit" name="demo" value="0" variant="primary" size="lg" loading={pending} icon="add">Criar granja</Button>
          <Button type="submit" name="demo" value="1" size="lg" disabled={pending} icon="auto_awesome">Criar com dados de exemplo</Button>
        </div>
        <div className="flex items-center justify-between text-[13px] text-muted">
          {canCancel ? (
            <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1 border-0 bg-transparent p-0 text-muted hover:text-ink">
              <Icon name="arrow_back" size={16} />Voltar
            </button>
          ) : <span />}
          <button type="button" onClick={() => signOut().catch(() => toast('Sem ligação — não foi possível terminar a sessão.', 'error'))} className="border-0 bg-transparent p-0 text-muted hover:text-ink">Terminar sessão</button>
        </div>
      </form>
    </div>
  )
}
