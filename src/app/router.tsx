import { createBrowserRouter, Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { ErrorState, Loading } from '@/ui'
import { bindRouter } from '@/lib/urlState'
import { useDocumentTitle, type RouteHandle } from '@/lib/title'
import { useAuth } from './auth'
import { FarmProvider, useIsSuperAdmin, useMemberships } from './farm'
import { OverlayProvider } from './overlays'
import { Login } from './Login'
import { Onboarding } from './Onboarding'
import { Shell } from './Shell'

/** /admin is for the platform super admin only; everyone else goes back to the app. */
function AdminGate() {
  const admin = useIsSuperAdmin()
  if (admin.isPending) return <FullLoading />
  if (admin.isError) return <div className="app-bg grid min-h-screen place-items-center p-6"><ErrorState error={admin.error} retry={() => admin.refetch()} /></div>
  return admin.data ? <Outlet /> : <Navigate to="/" replace />
}

function FullLoading() {
  return <div className="app-bg grid min-h-dvh place-items-center"><Loading /></div>
}

function Root() {
  const { user, loading } = useAuth()
  useDocumentTitle(!loading && !user ? 'Entrar' : undefined)
  if (loading) return <FullLoading />
  if (!user) return <Login />
  return <><Outlet /><ScrollRestoration /></>
}

function FarmGate() {
  const q = useMemberships()
  const admin = useIsSuperAdmin()
  if (q.isPending) return <FullLoading />
  if (q.isError) return <div className="app-bg grid min-h-screen place-items-center p-6"><ErrorState error={q.error} retry={() => q.refetch()} /></div>
  if (!q.data.length) {
    if (admin.isPending) return <FullLoading />
    return admin.data ? <Navigate to="/admin" replace /> : <Onboarding />
  }
  return (
    <FarmProvider memberships={q.data}>
      <OverlayProvider>
        <Shell />
      </OverlayProvider>
    </FarmProvider>
  )
}

const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default })
const t = (title: string): RouteHandle => ({ title })

/** Old URL kept working: swaps the path prefix and keeps the rest, the query and the hash. */
function Moved({ from, to }: { from: string; to: string }) {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={`${to}${pathname.slice(from.length)}${search}${hash}`} replace />
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <div className="app-bg grid min-h-screen place-items-center p-6"><ErrorState error={new Error('Ocorreu um erro inesperado.')} retry={() => location.reload()} /></div>,
    children: [
      // Root renders <Login /> at any URL while signed out; once signed in, /login has nothing to show.
      { path: 'login', element: <Navigate to="/" replace /> },
      { path: 'welcome', element: <Navigate to="/admin" replace /> },
      {
        element: <AdminGate />,
        children: [
          { path: 'admin', handle: t('Administração'), lazy: page(() => import('@/features/admin/AdminPage')) },
          { path: 'admin/users/:userId', handle: t('Utilizador'), lazy: page(() => import('@/features/admin/UserPage')) },
          { path: 'admin/utilizadores/*', element: <Moved from="/admin/utilizadores" to="/admin/users" /> },
        ],
      },
      {
        element: <FarmGate />,
        children: [
          { index: true, element: <Navigate to="/herd" replace /> },
          { path: 'herd', handle: t('Animais'), lazy: page(() => import('@/features/herd/HerdPage')) },
          { path: 'herd/pens/:penId', handle: t('Curral'), lazy: page(() => import('@/features/herd/PenPage')) },
          { path: 'herd/animals/:tag', handle: t('Animal'), lazy: page(() => import('@/features/herd/AnimalPage')) },
          { path: 'expenses', handle: t('Despesas'), lazy: page(() => import('@/features/money/MoneyPage')) },
          { path: 'money/*', element: <Moved from="/money" to="/expenses" /> },
          { path: 'reports', handle: t('Relatórios'), lazy: page(() => import('@/features/reports/ReportsPage')) },
          { path: 'stock', handle: t('Stock'), lazy: page(() => import('@/features/stock/StockPage')) },
          { path: 'help', handle: t('Ajuda'), lazy: page(() => import('@/features/help/HelpPage')) },
          { path: 'help/playbooks/:id', handle: t('Guia'), lazy: page(() => import('@/features/help/PlaybookPage')) },
          { path: 'help/articles/:id', handle: t('Artigo'), lazy: page(() => import('@/features/help/ArticlePage')) },
          { path: 'settings', handle: t('Definições'), lazy: page(() => import('@/features/settings/SettingsPage')) },
          { path: '*', handle: t('Página não encontrada'), lazy: page(() => import('@/features/NotFound')) },
        ],
      },
    ],
  },
])

bindRouter(router)
