import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Button, Icon, IconButton, Sheet } from '@/ui'
import { dismissInstall, installDismissed, promptInstall, useInstall } from './register'

let iosHelpOpen = false
const helpListeners = new Set<() => void>()
const setIosHelp = (open: boolean) => { iosHelpOpen = open; helpListeners.forEach((l) => l()) }
const useIosHelp = () => useSyncExternalStore(
  (cb) => { helpListeners.add(cb); return () => helpListeners.delete(cb) },
  () => iosHelpOpen,
)

// Install entry point shared by the banner and the user menu.
export function useInstallAction() {
  const { standalone, ios, canPrompt } = useInstall()
  const available = !standalone && (canPrompt || ios)
  const start = async () => {
    if (canPrompt) return promptInstall()
    if (ios) setIosHelp(true)
    return false
  }
  return { available, start }
}

function IosInstallSheet() {
  const open = useIosHelp()
  const step = 'flex items-start gap-3 rounded-[14px] bg-sunken p-3.5'
  const num = 'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[13px] font-semibold text-accent-strong'
  return (
    <Sheet open={open} onClose={() => setIosHelp(false)} title="Instalar no iPhone ou iPad" maxWidth={440}
      footer={<Button variant="primary" className="flex-1" onClick={() => setIosHelp(false)}>Percebi</Button>}>
      <p className="mt-0 mb-4 text-ink-2">Adicione o Suino Gestor ao ecrã principal para o abrir como uma app, em ecrã inteiro e com acesso sem ligação.</p>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        <li className={step}>
          <span className={num}>1</span>
          <span className="pt-0.5">No Safari, toque em <b>Partilhar</b> <Icon name="ios_share" size={18} className="-mb-0.5 text-accent-strong" /> na barra do navegador.</span>
        </li>
        <li className={step}>
          <span className={num}>2</span>
          <span className="pt-0.5">Deslize e escolha <b>Adicionar ao ecrã principal</b> <Icon name="add_box" size={18} className="-mb-0.5 text-accent-strong" />.</span>
        </li>
        <li className={step}>
          <span className={num}>3</span>
          <span className="pt-0.5">Toque em <b>Adicionar</b>. O ícone do Suino Gestor aparece no ecrã principal.</span>
        </li>
      </ol>
    </Sheet>
  )
}

// Dismissible banner inviting the user to install the PWA (Android/Chromium prompt or iOS steps).
export function InstallPrompt() {
  const { available, start } = useInstallAction()
  const [hidden, setHidden] = useState(installDismissed)
  const dismiss = () => { dismissInstall(); setHidden(true) }

  return (
    <>
      {available && !hidden && createPortal(
        <div role="dialog" aria-label="Instalar o Suino Gestor"
          className="fixed inset-x-3 bottom-[calc(150px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[420px] animate-pf-pop items-center gap-3 rounded-[18px] bg-ink py-3 pr-2 pl-3.5 text-white shadow-[0_12px_32px_rgba(0,0,0,0.22)] wide:inset-x-auto wide:right-6 wide:bottom-6">
          <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-[11px]" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Instalar o Suino Gestor</div>
            <div className="text-xs text-white/70">Acesso rápido, mesmo sem ligação.</div>
          </div>
          <button type="button" onClick={async () => { if (await start()) setHidden(true) }}
            className="shrink-0 rounded-[10px] border-0 bg-white/15 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-white/25">
            Instalar
          </button>
          <IconButton icon="close" label="Agora não" size={32} iconSize={18} onClick={dismiss} className="text-white/70 hover:bg-white/10 hover:text-white" />
        </div>,
        document.body,
      )}
      <IosInstallSheet />
    </>
  )
}
