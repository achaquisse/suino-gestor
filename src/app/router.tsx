import { createBrowserRouter, Navigate, Outlet, ScrollRestoration } from 'react-router'
import { ErrorState, Loading } from '@/ui'
import { bindRouter } from '@/lib/urlState'
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
        children: [{ path: 'admin', lazy: page(() => import('@/features/admin/AdminPage')) }],
      },
      {
        element: <FarmGate />,
        children: [
          { index: true, element: <Navigate to="/herd" replace /> },
          { path: 'herd', lazy: page(() => import('@/features/herd/HerdPage')) },
          { path: 'herd/pens/:penId', lazy: page(() => import('@/features/herd/PenPage')) },
          { path: 'herd/animals/:tag', lazy: page(() => import('@/features/herd/AnimalPage')) },
          { path: 'money', lazy: page(() => import('@/features/money/MoneyPage')) },
          { path: 'reports', lazy: page(() => import('@/features/reports/ReportsPage')) },
          { path: 'stock', lazy: page(() => import('@/features/stock/StockPage')) },
          { path: 'help', lazy: page(() => import('@/features/help/HelpPage')) },
          { path: 'help/playbooks/:id', lazy: page(() => import('@/features/help/PlaybookPage')) },
          { path: 'help/articles/:id', lazy: page(() => import('@/features/help/ArticlePage')) },
          { path: 'settings', lazy: page(() => import('@/features/settings/SettingsPage')) },
          { path: '*', lazy: page(() => import('@/features/NotFound')) },
        ],
      },
    ],
  },
])

bindRouter(router)
