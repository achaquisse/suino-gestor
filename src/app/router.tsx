import { createBrowserRouter, Outlet } from 'react-router'
import { ErrorState, Loading } from '@/ui'
import { useAuth } from './auth'
import { FarmProvider, useMemberships } from './farm'
import { OverlayProvider } from './overlays'
import { Login } from './Login'
import { Onboarding } from './Onboarding'
import { Shell } from './Shell'

function FullLoading() {
  return <div className="app-bg grid min-h-screen place-items-center"><Loading /></div>
}

function Root() {
  const { user, loading } = useAuth()
  if (loading) return <FullLoading />
  if (!user) return <Login />
  return <Outlet />
}

function FarmGate() {
  const q = useMemberships()
  if (q.isPending) return <FullLoading />
  if (q.isError) return <div className="app-bg grid min-h-screen place-items-center p-6"><ErrorState error={q.error} retry={() => q.refetch()} /></div>
  if (!q.data.length) return <Onboarding />
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
      { path: '/welcome', element: <Onboarding canCancel /> },
      {
        element: <FarmGate />,
        children: [
          { index: true, lazy: page(() => import('@/features/today/TodayPage')) },
          { path: 'herd', lazy: page(() => import('@/features/herd/HerdPage')) },
          { path: 'herd/pens/:penId', lazy: page(() => import('@/features/herd/PenPage')) },
          { path: 'herd/animals/:tag', lazy: page(() => import('@/features/herd/AnimalPage')) },
          { path: 'money', lazy: page(() => import('@/features/money/MoneyPage')) },
          { path: 'reports', lazy: page(() => import('@/features/reports/ReportsPage')) },
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
