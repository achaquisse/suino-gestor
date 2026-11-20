import { Suspense, useId, useLayoutEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate, useParams } from 'react-router'
import { Avatar, Credits, Icon, Loading, Logo, cx, usePopover, useToast } from '@/ui'
import { ROLE_LABEL } from '@/lib/constants'
import { useAnimal, useInvalidateFarm, useNotificationResolutions } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import { useAlerts } from '@/features/today/useAlerts'
import { InstallPrompt, useInstallAction } from '@/pwa/InstallPrompt'
import { useAuth } from './auth'
import { useFarm } from './farm'
import { useOverlays } from './overlays'

type NavDef = { to: string; label: string; icon: string; end?: boolean }

function useNavDefs(): NavDef[] {
  const { canSeeMoney } = useFarm()
  const all: (NavDef & { money?: boolean })[] = [
    { to: '/herd', label: 'Animais', icon: 'fence' },
    { to: '/stock', label: 'Stock', icon: 'inventory_2' },
    { to: '/expenses', label: 'Despesas', icon: 'receipt_long', money: true },
    { to: '/reports', label: 'Relatórios', icon: 'monitoring', money: true },
    { to: '/help', label: 'Ajuda', icon: 'help' },
  ]
  return all.filter((n) => canSeeMoney || !n.money)
}

function useIndicator(path: string, count: number) {
  const ref = useRef<HTMLElement>(null)
  const [pos, setPos] = useState<{ l: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector<HTMLElement>('[aria-current="page"]')
      setPos(el ? { l: el.offsetLeft, w: el.offsetWidth } : null)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [path, count])
  return [ref, pos] as const
}

function useQuickContext() {
  const pen = useMatch('/herd/pens/:penId')
  const { tag } = useParams()
  const animalRoute = useMatch('/herd/animals/:tag')
  const animal = useAnimal(animalRoute ? tag : undefined).data
  if (animal) return { animalId: animal.id }
  if (pen?.params.penId) return { penId: pen.params.penId }
  return undefined
}

function UserMenu({ compact }: { compact?: boolean }) {
  const { farm, memberships, switchFarm, user, isSuperAdmin } = useFarm()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { open, setOpen, ref: popRef } = usePopover()
  const install = useInstallAction()
  const toggle = () => setOpen((o) => !o)
  const item = 'flex items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-3 py-2.5 text-left text-sm font-medium'
  return (
    <div ref={popRef} className="relative">
      {compact ? (
        <button type="button" onClick={toggle} aria-label="Menu do utilizador" aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-full border-0 bg-brand p-0 text-[13px] font-semibold text-white active:scale-[0.92]">
          {user.initials}
        </button>
      ) : (
        <button type="button" onClick={toggle} aria-expanded={open}
          className="ml-1.5 flex h-[46px] items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-white py-0 pr-1 pl-4 hover:border-[#D4D4E2]">
          <span className="max-w-[160px] truncate text-sm font-semibold">{farm.name}</span>
          <Avatar initials={user.initials} />
        </button>
      )}
      {open && (
        <div className={cx('absolute right-0 z-40 flex w-[280px] max-w-[calc(100vw-24px)] animate-pf-pop flex-col gap-0.5 rounded-[18px] border border-line bg-white p-1.5 shadow-pop', compact ? 'top-12' : 'top-[54px]')}>
          <div className="flex items-center gap-3 px-3 pt-3 pb-3.5">
            <Avatar initials={user.initials} size={40} gradient />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-muted">{user.email}</div>
            </div>
          </div>
          <div className="mx-1.5 h-px bg-divider" />
          <div className="px-3 pt-2.5 pb-1 text-[11px] uppercase tracking-[0.06em] text-faint">Granjas</div>
          {memberships.map((m) => (
            <button key={m.farm_id} type="button"
              onClick={() => {
                setOpen(false)
                if (m.farm_id !== farm.id) {
                  switchFarm(m.farm_id)
                  navigate('/')
                  toast(`Mudou para ${m.farm.name}`)
                }
              }}
              className={cx('flex items-center justify-between gap-2 rounded-[10px] border-0 px-3 py-2.5 text-left hover:bg-hover', m.farm_id === farm.id ? 'bg-hover' : 'bg-transparent')}>
              <span className="truncate text-sm font-medium">{m.farm.name}</span>
              <span className="shrink-0 text-xs text-muted">{m.via_admin ? 'Super admin' : ROLE_LABEL[m.role]}</span>
            </button>
          ))}
          <div className="mx-1.5 my-1 h-px bg-divider" />
          {isSuperAdmin && (
            <button type="button" onClick={() => { setOpen(false); navigate('/admin') }} className={cx(item, 'hover:bg-hover')}>
              <Icon name="admin_panel_settings" className="text-muted" />Administração
            </button>
          )}
          <button type="button" onClick={() => { setOpen(false); navigate('/settings') }} className={cx(item, 'hover:bg-hover')}>
            <Icon name="settings" className="text-muted" />Definições
          </button>
          {install.available && (
            <button type="button" onClick={() => { setOpen(false); install.start() }} className={cx(item, 'hover:bg-hover')}>
              <Icon name="install_mobile" className="text-muted" />Instalar app
            </button>
          )}
          <button type="button"
            onClick={async () => {
              setOpen(false)
              try {
                await signOut()
              } catch {
                toast('Sem ligação — não foi possível terminar a sessão.', 'error')
              }
            }}
            className={cx(item, 'text-danger hover:bg-danger-soft')}>
            <Icon name="logout" />Terminar sessão
          </button>
          <div className="mx-1.5 my-1 h-px bg-divider" />
          <Credits className="px-2 pt-1 pb-1.5" />
        </div>
      )}
    </div>
  )
}

function NotificationMenu({ compact }: { compact?: boolean }) {
  const { farmId, user } = useFarm()
  const alerts = useAlerts()
  const resolutions = useNotificationResolutions()
  const invalidate = useInvalidateFarm()
  const toast = useToast()
  const { open, setOpen, ref } = usePopover()
  const panelId = useId()
  const visible = resolutions.data ? alerts.filter((a) => !resolutions.data.some((r) => r.alert_key === a.key)) : []
  const resolve = useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase.from('notification_resolutions').insert({ farm_id: farmId, user_id: user.id, alert_key: key })
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error) => toast(errorMessage(error), 'error'),
  })

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" aria-label={`Notificações${visible.length ? `: ${visible.length} por tratar` : ''}`} aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cx('relative grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-ink-2 hover:border-[#D4D4E2] hover:text-accent-strong', compact && 'h-10 w-10')}>
        <Icon name="notifications" size={23} />
        {visible.length > 0 && <span className="tabular absolute -top-1 -right-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{visible.length > 99 ? '99+' : visible.length}</span>}
      </button>
      {open && (
        <div id={panelId} role="region" aria-label="Notificações" className={cx('absolute top-[52px] z-40 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-[18px] border border-line bg-white shadow-pop', compact ? '-right-[52px]' : 'right-0')}>
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <h2 className="m-0 text-[15px] font-semibold">Notificações</h2>
            <span className="tabular text-xs text-muted">{visible.length} por tratar</span>
          </div>
          <div className="max-h-[min(480px,calc(100dvh-240px))] overflow-y-auto overscroll-contain wide:max-h-[min(480px,65dvh)]">
            {resolutions.isPending && <div className="p-5"><Loading /></div>}
            {resolutions.isError && <div className="p-4 text-sm text-danger">Não foi possível carregar as notificações. <button type="button" onClick={() => resolutions.refetch()} className="border-0 bg-transparent font-semibold text-accent-strong">Tentar novamente</button></div>}
            {resolutions.isSuccess && visible.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted">Sem notificações por tratar.</div>}
            {visible.map((alert) => (
              <div key={alert.key} className="flex gap-3 border-b border-divider px-4 py-3 last:border-0">
                <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-[10px]', alert.red ? 'bg-danger-soft text-danger' : 'bg-sunken text-ink-2')}><Icon name={alert.icon} size={19} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{alert.title}</div>
                  <div className="mt-0.5 text-xs text-muted">{alert.sub}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => { setOpen(false); alert.act() }} className="border-0 bg-transparent p-0 text-xs font-semibold text-accent-strong hover:underline">{alert.action}</button>
                    {alert.dismissible && <button type="button" disabled={resolve.isPending} onClick={() => resolve.mutate(alert.key)} className="border-0 bg-transparent p-0 text-xs font-medium text-muted hover:text-ink disabled:opacity-50">Marcar como resolvido</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function Shell() {
  const navDefs = useNavDefs()
  const location = useLocation()
  const { farm, memberships, switchFarm, viaAdmin } = useFarm()
  const navigate = useNavigate()
  const { openLog } = useOverlays()
  const quickCtx = useQuickContext()
  const toast = useToast()
  const [topRef, topPos] = useIndicator(location.pathname, navDefs.length)
  const [bottomRef, bottomPos] = useIndicator(location.pathname, navDefs.length)

  const cycleFarm = () => {
    if (memberships.length < 2) return
    const i = memberships.findIndex((m) => m.farm_id === farm.id)
    const next = memberships[(i + 1) % memberships.length]
    switchFarm(next.farm_id)
    toast(`Mudou para ${next.farm.name}`)
  }
  const openQuick = () => openLog('menu', quickCtx)

  return (
    <div className="app-bg flex min-h-dvh justify-center">
      <div className="relative flex min-h-dvh w-full flex-col">
        {/* Wide header */}
        <div className="sticky top-0 z-30 mx-auto hidden w-full max-w-[1120px] px-10 pt-4 wide:block">
          <header className="glass flex items-center gap-1 rounded-[22px] border border-white/95 p-2 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(16,24,40,0.05),0_14px_40px_rgba(91,76,245,0.14)]">
            <Link to="/herd" aria-label="Ir para Animais" title="Animais" className="mr-2 flex shrink-0 rounded-[13px] transition-transform active:scale-[0.94]">
              <Logo size={42} className="rounded-[13px] shadow-[0_4px_12px_rgba(91,76,240,0.3)]" />
            </Link>
            <nav ref={topRef} className="relative flex min-w-0 flex-1 gap-0.5" aria-label="Principal">
              <div className="absolute -bottom-0.5 h-[3px] rounded-t-[3px] bg-accent transition-[left,width,opacity] duration-[450ms] ease-spring"
                style={{ left: (topPos?.l ?? 0) + 12, width: Math.max(0, (topPos?.w ?? 0) - 24), opacity: topPos ? 1 : 0 }} />
              {navDefs.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} title={n.label}
                  className={({ isActive }) => cx('group relative z-[1] flex h-11 items-center gap-2 whitespace-nowrap rounded-[14px] px-3.5 text-sm transition-colors hover:bg-[rgba(91,76,240,0.06)] hover:no-underline active:scale-[0.96]',
                    isActive ? 'font-semibold text-ink hover:text-ink' : 'font-medium text-[#5A5A6E] hover:text-[#5A5A6E]')}>
                  {({ isActive }) => (<><Icon name={n.icon} fill={isActive} /><span className={cx(!isActive && 'hidden xwide:inline')}>{n.label}</span></>)}
                </NavLink>
              ))}
            </nav>
            <button type="button" onClick={openQuick}
              className="ml-1.5 flex h-11 items-center gap-1.5 whitespace-nowrap rounded-[14px] border-0 bg-cta px-[18px] font-semibold text-white shadow-cta hover:bg-cta-hover hover:shadow-cta-hover active:scale-[0.97]">
              <Icon name="add" />Novo
            </button>
            <NotificationMenu />
            <UserMenu />
          </header>
        </div>

        {/* Narrow top bar */}
        <div className="glass sticky top-0 z-30 flex items-center gap-2.5 border-b border-white/90 pr-[max(16px,env(safe-area-inset-right))] pl-[max(16px,env(safe-area-inset-left))] pt-[max(12px,env(safe-area-inset-top))] pb-3 wide:hidden">
          <Link to="/herd" aria-label="Ir para Animais" title="Animais" className="flex shrink-0 rounded-lg transition-transform active:scale-[0.94]">
            <Logo size={28} className="rounded-lg shadow-[0_4px_14px_rgba(91,76,240,0.26)]" />
          </Link>
          <button type="button" onClick={cycleFarm} className="flex min-w-0 flex-1 items-center gap-1 border-0 bg-transparent p-0 text-left">
            <span className="truncate text-sm font-semibold">{farm.name}</span>
            {memberships.length > 1 && <Icon name="expand_more" size={16} className="text-muted" />}
          </button>
          <NotificationMenu compact />
          <UserMenu compact />
        </div>

        {viaAdmin && (
          <div role="note" className="mx-auto mt-3 flex w-[calc(100%-32px)] max-w-[1040px] items-center gap-2.5 rounded-[14px] border border-[#F3DDBF] bg-[#FDF1E2] px-3.5 py-2.5 text-sm text-[#7A4712]">
            <Icon name="admin_panel_settings" size={19} className="shrink-0" />
            <span className="min-w-0 flex-1">Modo administrador: está a ver <strong>{farm.name}</strong> sem ser membro. As alterações ficam registadas em seu nome.</span>
            <button type="button" onClick={() => navigate('/admin')} className="shrink-0 border-0 bg-transparent p-0 font-semibold text-[#7A4712] hover:underline">Voltar à administração</button>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1120px] flex-1 pr-[max(16px,env(safe-area-inset-right))] pl-[max(16px,env(safe-area-inset-left))] pt-5 pb-[120px] wide:px-10 wide:pt-7 wide:pb-14">
          <Suspense fallback={<Loading />}>
            <div key={location.pathname} className="animate-pf-fade">
              <Outlet />
            </div>
          </Suspense>
        </main>

        {/* Bottom nav */}
        <nav ref={bottomRef} aria-label="Principal"
          className="glass sticky bottom-[calc(10px+env(safe-area-inset-bottom))] z-20 mr-[max(10px,env(safe-area-inset-right))] ml-[max(10px,env(safe-area-inset-left))] flex rounded-[24px] border border-white/95 p-1.5 shadow-[inset_0_1px_0_#fff,0_14px_40px_rgba(91,76,245,0.18)] wide:hidden">
          <div className="absolute top-1.5 bottom-1.5 rounded-[18px] bg-accent-soft transition-[left,width,opacity] duration-[450ms] ease-spring"
            style={{ left: bottomPos?.l ?? 0, width: bottomPos?.w ?? 0, opacity: bottomPos ? 1 : 0 }} />
          <button type="button" onClick={openQuick} aria-label="Registo rápido"
            className="absolute -top-[78px] right-4 grid h-[58px] w-[58px] place-items-center rounded-[18px] border-0 bg-cta text-white shadow-[0_6px_18px_rgba(91,76,240,0.34)] transition-transform active:scale-90 active:rotate-90">
            <Icon name="add" size={30} />
          </button>
          {navDefs.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cx('relative z-[1] flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-[color,transform] hover:no-underline active:scale-[0.92]',
                isActive ? 'font-semibold text-accent hover:text-accent' : 'font-medium text-[#5A5A6E] hover:text-[#5A5A6E]')}>
              {({ isActive }) => (<><Icon name={n.icon} size={24} fill={isActive} />{n.label}</>)}
            </NavLink>
          ))}
        </nav>
        <InstallPrompt />
      </div>
    </div>
  )
}
