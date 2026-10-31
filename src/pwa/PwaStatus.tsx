import { createPortal } from 'react-dom'
import { Icon } from '@/ui'
import { useOnline, useSwUpdate } from './register'

// Persistent pills for "offline" and "new version available"; styled like the toast.
export function PwaStatus() {
  const online = useOnline()
  const applyUpdate = useSwUpdate()
  if (online && !applyUpdate) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4">
      {!online && (
        <div role="status" className="pointer-events-auto flex animate-pf-pop items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <Icon name="cloud_off" size={18} className="text-[#FFC86B]" />
          Sem ligação — a mostrar dados guardados
        </div>
      )}
      {applyUpdate && (
        <div role="status" className="pointer-events-auto flex animate-pf-pop items-center gap-3 rounded-[14px] bg-ink py-2 pr-2 pl-4 text-sm text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <Icon name="system_update" size={20} className="text-[#5FD49A]" />
          Nova versão disponível
          <button type="button" onClick={applyUpdate}
            className="rounded-[10px] border-0 bg-white/15 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-white/25">
            Atualizar
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
