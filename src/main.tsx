import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { RouterProvider } from 'react-router'
import { ToastProvider } from '@/ui'
import { AuthProvider } from '@/app/auth'
import { router } from '@/app/router'
import { persistOptions, queryClient } from '@/lib/queryClient'
import { PwaStatus } from '@/pwa/PwaStatus'
import { listenForInstallPrompt, registerServiceWorker } from '@/pwa/register'
import './index.css'

listenForInstallPrompt()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
      <PwaStatus />
    </PersistQueryClientProvider>
  </StrictMode>,
)
