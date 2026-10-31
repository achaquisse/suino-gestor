import { useState } from 'react'
import { Icon, Spinner } from '@/ui'
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

function DevEmailSignIn() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
    if (error) {
      setError(errorMessage(error))
      setState('idle')
    } else setState('sent')
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-2.5 rounded-[14px] border border-dashed border-line-strong bg-white/60 p-3.5">
      <div className="text-[12px] font-semibold tracking-[0.06em] text-faint uppercase">Desenvolvimento · entrar por email</div>
      {state === 'sent' ? (
        <p className="m-0 text-sm text-ink-2">
          Link enviado. Abra o <a href="http://127.0.0.1:54324" target="_blank" rel="noreferrer">Mailpit</a> e clique em “Log In”.
        </p>
      ) : (
        <div className="flex gap-2">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-accent" />
          <button type="submit" disabled={state === 'sending'}
            className="flex h-11 items-center gap-2 rounded-xl border-0 bg-cta px-4 text-sm font-semibold text-white disabled:opacity-60">
            {state === 'sending' ? <Spinner light /> : <Icon name="mail" />}Enviar link
          </button>
        </div>
      )}
      {error && <p className="m-0 text-sm text-danger">{error}</p>}
    </form>
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

  const signIn = async () => {
    setError(null)
    setSigning(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(errorMessage(e))
      setSigning(false)
    }
  }

  return (
    <div className="app-bg flex min-h-screen w-full items-stretch">
      <div className="relative hidden flex-1 basis-1/2 flex-col justify-between overflow-hidden bg-[linear-gradient(150deg,#8B5CF6_0%,#5B4CF5_50%,#2A8FE0_100%)] p-12 text-white wide:flex">
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),rgba(255,255,255,0)_65%)]" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-[42px] w-[42px] place-items-center rounded-[13px] border border-white/35 bg-white/20 text-base font-bold">P</div>
          <span className="text-base font-semibold">Porkflow</span>
        </div>
        <div className="relative flex max-w-[460px] animate-pf-up flex-col gap-4">
          <h2 className="m-0 text-[38px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">A sua granja, organizada.</h2>
          <p className="m-0 text-[15px] leading-normal opacity-[0.92] text-pretty">Animais, tarefas e finanças num só lugar — para quem gere e para quem trata.</p>
        </div>
        <div className="relative text-[13px] opacity-85">Gestão de suinicultura</div>
      </div>
      <div className="grid flex-1 basis-1/2 place-items-center px-5 py-8">
        <div className="flex w-full max-w-[380px] animate-pf-up flex-col gap-6">
          <div className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-[linear-gradient(135deg,#8B5CF6,#5B4CF5_55%,#22B8F0)] text-xl font-bold text-white shadow-[0_10px_28px_rgba(91,76,240,0.35)]">P</div>
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Entrar no Porkflow</h1>
            <p className="m-0 text-ink-2">Use a sua conta Google para continuar.</p>
          </div>
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
            <div className="flex items-center gap-2.5 rounded-[14px] bg-danger-soft px-3.5 py-3 text-sm text-danger">
              <Icon name="error" />{error}
            </div>
          )}
          <button type="button" onClick={signIn} disabled={signing || !supabaseConfigured}
            className="flex h-[54px] items-center justify-center gap-3 rounded-[14px] border border-[#DADCE0] bg-white text-sm font-semibold text-[#1F1F1F] shadow-[0_1px_2px_rgba(22,22,40,0.06)] transition-[box-shadow,transform,border-color] hover:border-[#C4C7CE] hover:shadow-[0_6px_18px_rgba(22,22,40,0.10)] active:scale-[0.98] disabled:opacity-60">
            {signing ? <Spinner /> : <GoogleLogo />}
            {signing ? 'A ligar ao Google…' : 'Continuar com Google'}
          </button>
          {import.meta.env.DEV && supabaseConfigured && <DevEmailSignIn />}
          <p className="m-0 text-[13px] text-muted text-pretty">
            Ao continuar, aceita os <a href="#">Termos de utilização</a> e a <a href="#">Política de privacidade</a>. Só os membros convidados pelo proprietário têm acesso à granja.
          </p>
        </div>
      </div>
    </div>
  )
}
