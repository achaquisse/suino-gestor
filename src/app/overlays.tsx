import { createContext, lazy, Suspense, use, useMemo, useState, type ReactNode } from 'react'
import type { LogType } from '@/lib/constants'

export type LogContext = {
  animalId?: string
  penId?: string
  /** ISO date preselected (e.g. from the calendar) */
  day?: string
  /** Preselected treatment product id (see PRODUCTS) */
  product?: string
  /** Task to mark done once the log is saved */
  taskId?: string
  /** Stock item code preselected for purchases */
  stockCode?: string
}

export type FinPreset = {
  type?: 'Despesa' | 'Receita' | 'Aporte' | 'Investimento'
  category?: string
}

export type Overlay =
  | { kind: 'log'; type: LogType | 'menu'; ctx?: LogContext }
  | { kind: 'fin'; preset?: FinPreset }
  | { kind: 'animal'; mode: 'buy' | 'edit'; animalId?: string; penId?: string }

type OverlayApi = {
  overlay: Overlay | null
  openLog: (type?: LogType | 'menu', ctx?: LogContext) => void
  openFin: (preset?: FinPreset) => void
  openBuyAnimals: (penId?: string) => void
  openEditAnimal: (animalId: string) => void
  setOverlay: (o: Overlay | null) => void
  close: () => void
}

const OverlayContext = createContext<OverlayApi | null>(null)

const QuickLogSheet = lazy(() => import('@/features/quicklog/QuickLogSheet'))
const FinSheet = lazy(() => import('@/features/money/FinSheet'))
const AnimalModal = lazy(() => import('@/features/herd/AnimalModal'))

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const api = useMemo<OverlayApi>(() => ({
    overlay,
    setOverlay,
    openLog: (type = 'menu', ctx) => {
      if (type === 'buyAnimals') return setOverlay({ kind: 'animal', mode: 'buy', penId: ctx?.penId })
      if (type === 'expense') return setOverlay({ kind: 'fin', preset: { type: 'Despesa', category: 'Ração' } })
      setOverlay({ kind: 'log', type, ctx })
    },
    openFin: (preset) => setOverlay({ kind: 'fin', preset }),
    openBuyAnimals: (penId) => setOverlay({ kind: 'animal', mode: 'buy', penId }),
    openEditAnimal: (animalId) => setOverlay({ kind: 'animal', mode: 'edit', animalId }),
    close: () => setOverlay(null),
  }), [overlay])
  return (
    <OverlayContext value={api}>
      {children}
      <Suspense fallback={null}>
        {overlay?.kind === 'log' && <QuickLogSheet type={overlay.type} ctx={overlay.ctx ?? {}} />}
        {overlay?.kind === 'fin' && <FinSheet preset={overlay.preset} onClose={api.close} />}
        {overlay?.kind === 'animal' && <AnimalModal mode={overlay.mode} animalId={overlay.animalId} penId={overlay.penId} onClose={api.close} />}
      </Suspense>
    </OverlayContext>
  )
}

export function useOverlays() {
  const ctx = use(OverlayContext)
  if (!ctx) throw new Error('useOverlays must be used inside OverlayProvider')
  return ctx
}
