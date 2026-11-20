import { useEffect, useState } from 'react'
import { Credits, Icon, IconTile, Logo, Sheet, Spinner } from '@/ui'
import { errorMessage, supabase, supabaseConfigured } from '@/lib/supabase'
import { JUST_OUT_KEY, useAuth } from './auth'

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** Local test accounts created by supabase/seed.sql (dev builds only). */
const DEV_PASSWORD = 'suino123'
const DEV_USERS = [
  { email: 'dono@suinogestor.dev', name: 'Carlos Nhantumbo', role: 'Proprietário', farms: 'Granja Boane · Quinta da Matola', icon: 'shield_person', tint: '#EEECFE', ink: '#4B3CD6' },
  { email: 'tratador@suinogestor.dev', name: 'João Mabunda', role: 'Tratador', farms: 'Granja Boane', icon: 'agriculture', tint: '#E6F6EE', ink: '#0F7A44' },
  { email: 'vet@suinogestor.dev', name: 'Dra. Sitoe', role: 'Veterinária', farms: 'Quinta da Matola', icon: 'stethoscope', tint: '#E3F4FD', ink: '#1C6FA8' },
  { email: 'achaquisse1@gmail.com', name: 'Administrador', role: 'Super admin', farms: 'Todas as granjas', icon: 'admin_panel_settings', tint: '#FDF1E2', ink: '#A2601A' },
] as const

function DevAccountPicker({ open, onClose, onGoogle }: { open: boolean; onClose: () => void; onGoogle: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const signInAs = async (email: string) => {
    setError(null)
    setBusy(email)
    const { error } = await supabase.auth.signInWithPassword({ email, password: DEV_PASSWORD })
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Conta de teste não encontrada. Corra npm run db:reset para criar as contas.' : errorMessage(error))
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Escolher conta de teste" maxWidth={440}>
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-ink-2">Modo de desenvolvimento: entre com uma conta local, sem Google.</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {DEV_USERS.map((u, i) => (
            <li key={u.email} className="animate-pf-up" style={{ animationDelay: `${i * 60}ms` }}>
              <button type="button" onClick={() => signInAs(u.email)} disabled={busy !== null}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-3 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_8px_20px_rgba(22,22,40,0.08)] active:scale-[0.99] disabled:opacity-60 disabled:hover:translate-y-0">
                <IconTile icon={u.icon} bg={u.tint} fg={u.ink} size={42} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {u.name}
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: u.tint, color: u.ink }}>{u.role}</span>
                  </span>
                  <span className="truncate text-[13px] text-muted">{u.email}</span>
                  <span className="truncate text-[12px] text-faint">{u.farms}</span>
                </span>
                {busy === u.email ? <Spinner /> : <Icon name="chevron_right" className="text-faint" />}
              </button>
            </li>
          ))}
        </ul>
        {error && (
          <div className="flex animate-pf-pop items-start gap-2.5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-sm text-danger">
            <Icon name="error" />{error}
          </div>
        )}
        <button type="button" onClick={onGoogle} disabled={busy !== null}
          className="mt-1 flex items-center justify-center gap-2 self-center border-0 bg-transparent p-1 text-[13px] font-medium text-muted hover:text-ink disabled:opacity-60">
          <GoogleLogo />Usar uma conta Google real
        </button>
      </div>
    </Sheet>
  )
}

export function Login() {
  const { signInWithGoogle, error: redirectError } = useAuth()
  const [signing, setSigning] = useState(false)
  const [signInError, setError] = useState<string | null>(null)
  const error = signInError ?? redirectError
  const [justOut] = useState(() => {
    const v = sessionStorage.getItem(JUST_OUT_KEY) === '1'
    sessionStorage.removeItem(JUST_OUT_KEY)
    return v
  })

  // Ao voltar do Google com o botão "voltar", o browser restaura a página
  // a partir do bfcache com o estado React congelado (signing=true).
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setSigning(false) }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  const [picker, setPicker] = useState(false)
  const devLogin = import.meta.env.DEV && supabaseConfigured

  const signIn = async () => {
    setPicker(false)
    setError(null)
    setSigning(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(errorMessage(e))
      setSigning(false)
    }
  }

  const rise = (i: number) => ({ animationDelay: `${80 + i * 70}ms` })

  return (
    <div className="login-bg relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="login-blob -top-24 -left-20 h-[380px] w-[380px] bg-[#A78BFA]" />
        <div className="login-blob top-1/3 -right-28 h-[420px] w-[420px] bg-[#7DD3FC]" style={{ animationDelay: '-6s' }} />
        <div className="login-blob -bottom-32 left-1/4 h-[340px] w-[340px] bg-[#C4B5FD]" style={{ animationDelay: '-12s' }} />
        <div className="login-grid absolute inset-0" />
      </div>

      <main className="relative flex w-full max-w-[400px] flex-col items-center gap-6">
        <div className="animate-pf-up" style={rise(0)}>
          <Logo size={72} title="Suino Gestor" className="login-logo rounded-[22px] shadow-[0_18px_40px_rgba(91,76,240,0.35)]" />
        </div>

        <div className="flex animate-pf-up flex-col items-center gap-2 text-center" style={rise(1)}>
          <h1 className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-balance">Bem-vindo ao Suino Gestor</h1>
          <p className="m-0 max-w-[320px] text-[15px] text-ink-2 text-pretty">A sua granja, organizada. Animais, tarefas e finanças num só lugar.</p>
        </div>

        <div className="glass flex w-full animate-pf-up flex-col gap-4 rounded-[24px] border border-white/80 p-5 shadow-[0_1px_2px_rgba(22,22,40,0.04),0_20px_50px_rgba(22,22,40,0.08)]" style={rise(2)}>
          {justOut && (
            <div className="flex animate-pf-pop items-center gap-2.5 rounded-[14px] bg-success-soft px-3.5 py-3 text-sm text-success-strong">
              <Icon name="check_circle" />Sessão terminada com sucesso.
            </div>
          )}
          {!supabaseConfigured && (
            <div className="flex items-start gap-2.5 rounded-[14px] bg-warn-soft px-3.5 py-3 text-sm text-warn">
              <Icon name="warning" />
              <span>Configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no ficheiro <code>.env</code>.</span>
            </div>
          )}
          {error && (
            <div className="flex animate-pf-pop items-center gap-2.5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-sm text-danger">
              <Icon name="error" />{error}
            </div>
          )}
          <button type="button" onClick={devLogin ? () => setPicker(true) : signIn} disabled={signing || !supabaseConfigured}
            className="login-shine flex h-[54px] items-center justify-center gap-3 rounded-2xl border border-[#DADCE0] bg-white text-[15px] font-semibold text-[#1F1F1F] shadow-[0_1px_2px_rgba(22,22,40,0.06)] transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#C4C7CE] hover:shadow-[0_10px_24px_rgba(22,22,40,0.10)] active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none">
            {signing ? <Spinner /> : <GoogleLogo />}
            {signing ? 'A ligar ao Google…' : 'Continuar com Google'}
          </button>
          {devLogin && <p className="m-0 -mt-1 text-center text-[12px] text-faint">Modo de desenvolvimento · contas de teste disponíveis</p>}
        </div>

        <ul className="m-0 flex animate-pf-up list-none flex-wrap justify-center gap-2 p-0" style={rise(3)}>
          {([['pets', 'Animais'], ['task_alt', 'Tarefas'], ['payments', 'Finanças']] as const).map(([icon, label]) => (
            <li key={label} className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-[13px] font-medium text-ink-2 backdrop-blur">
              <Icon name={icon} size={16} className="text-accent" />{label}
            </li>
          ))}
        </ul>

        <p className="m-0 max-w-[340px] animate-pf-up text-center text-[12.5px] leading-relaxed text-muted text-pretty" style={rise(4)}>
          Ao continuar, aceita os <a href="#">Termos de utilização</a> e a <a href="#">Política de privacidade</a>. Só os membros convidados pelo proprietário têm acesso à granja.
        </p>
        <Credits />
      </main>
      {devLogin && <DevAccountPicker open={picker} onClose={() => setPicker(false)} onGoogle={signIn} />}
    </div>
  )
}
