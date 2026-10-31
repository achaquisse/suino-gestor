import { useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { useFarm } from '@/app/farm'
import { useAuth } from '@/app/auth'
import { errorMessage } from '@/lib/supabase'
import { Avatar, Button, Card, Chip, Field, Icon, IconTile, Input, Segmented, Select, Toggle, useToast } from '@/ui'
import { ROLE_LABEL } from '@/lib/constants'
import { TeamCard } from './Team'
import { useUpdateFarm, useUpdateMyMembership } from './hooks'

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true)

const NOTIFS = [['tasks', 'Tarefas em atraso'], ['stock', 'Stock baixo e validades'], ['weekly', 'Resumo semanal por email']] as const
const CURRENCIES = [['MZN', 'Metical (MZN)'], ['ZAR', 'Rand (ZAR)'], ['USD', 'Dólar (USD)']] as const

function ProfileCard() {
  const { user, roleLabel, member } = useFarm()
  const { signOut } = useAuth()
  const { save, isPending } = useUpdateMyMembership()
  const toast = useToast()
  const [name, setName] = useState(member.display_name)
  const [editing, setEditing] = useState(false)

  const submit = async () => {
    if (!name.trim() || name.trim() === member.display_name) return setEditing(false)
    try {
      await save({ name: name.trim() })
      toast('Nome actualizado')
      setEditing(false)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <h2 className="m-0 text-[15px] font-semibold">Perfil</h2>
      <div className="flex items-center gap-3.5">
        <Avatar initials={user.initials} size={56} gradient className="!text-lg" />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{user.name}</div>
          <div className="truncate text-sm text-muted">{user.email}</div>
          <div className="text-[13px] text-muted">{roleLabel} · conta Google</div>
        </div>
      </div>
      {editing && (
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" aria-label="Nome" />
          <Button variant="primary" loading={isPending} onClick={submit}>Guardar</Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!editing && <Button icon="edit" onClick={() => setEditing(true)}>Editar nome</Button>}
        <a href="https://myaccount.google.com" target="_blank" rel="noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-line-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-[#F7F7FB] hover:no-underline">
          <Icon name="open_in_new" size={18} />Gerir conta Google
        </a>
        <Button icon="logout" className="!text-danger hover:!bg-danger-soft"
          onClick={() => signOut().catch(() => toast('Sem ligação — não foi possível terminar a sessão.', 'error'))}>Terminar sessão</Button>
      </div>
    </Card>
  )
}

function FarmsCard() {
  const { farm, memberships, farmId, isOwner, switchFarm } = useFarm()
  const navigate = useNavigate()
  const update = useUpdateFarm()
  const toast = useToast()
  const [name, setName] = useState(farm.name)

  const rename = async () => {
    if (!name.trim() || name.trim() === farm.name) return
    try {
      await update.mutateAsync({ name: name.trim() })
      toast('Granja renomeada')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <Card className="flex flex-col gap-2.5 p-5">
      <h2 className="m-0 text-[15px] font-semibold">Granjas</h2>
      {isOwner && (
        <Field label="Nome da granja">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename()} />
            <Button loading={update.isPending} disabled={!name.trim() || name.trim() === farm.name} onClick={rename}>Guardar</Button>
          </div>
        </Field>
      )}
      {memberships.map((m) => (
        <button key={m.farm_id} type="button" onClick={() => m.farm_id !== farmId && switchFarm(m.farm_id)}
          className="flex items-center gap-3 rounded-[14px] border border-line bg-white p-3 text-left hover:bg-hover">
          <IconTile icon="agriculture" bg="#F3F3F9" fg="#55556A" size={38} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{m.farm.name}</div>
            <div className="text-xs text-muted">{ROLE_LABEL[m.role]}</div>
          </div>
          {m.farm_id === farmId && <Chip tone="success">Activa</Chip>}
        </button>
      ))}
      <Button icon="add" className="self-start" onClick={() => navigate('/welcome')}>Nova granja</Button>
    </Card>
  )
}

function SyncCard() {
  const online = useOnline()
  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <h2 className="m-0 text-[15px] font-semibold">Sincronização</h2>
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: online ? 'var(--color-success)' : 'var(--color-warn)' }} />
        <span className="text-sm">{online ? 'Ligado · dados sincronizados' : 'Sem ligação · as alterações não serão guardadas'}</span>
      </div>
    </Card>
  )
}

function PrefsCard() {
  const { farm, member, isOwner } = useFarm()
  const { save } = useUpdateMyMembership()
  const update = useUpdateFarm()
  const toast = useToast()
  const lang = member.prefs.lang ?? 'pt'

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      toast(msg)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <>
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="m-0 text-[15px] font-semibold">Preferências</h2>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Idioma</span>
          <Segmented options={[['pt', 'Português'], ['en', 'English']] as const} value={lang === 'en' ? 'en' : 'pt'}
            onChange={(v) => run(() => save({ prefs: { lang: v } }), v === 'pt' ? 'Idioma: Português' : 'Language: English')} />
        </div>
        <Field label="Moeda">
          <Select value={farm.currency} disabled={!isOwner} onChange={(e) => run(() => update.mutateAsync({ currency: e.target.value }), `Moeda: ${e.target.value}`)}>
            {CURRENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Unidades de peso</span>
          <Segmented options={[['kg', 'Quilogramas (kg)'], ['lb', 'Libras (lb)']] as const} value={farm.units === 'lb' ? 'lb' : 'kg'}
            onChange={(v) => isOwner && run(() => update.mutateAsync({ units: v }), `Unidades: ${v}`)} />
        </div>
      </Card>
      <Card className="flex flex-col gap-1 p-5">
        <h2 className="m-0 mb-2 text-[15px] font-semibold">Notificações</h2>
        {NOTIFS.map(([k, l]) => {
          const on = member.prefs.notif?.[k] ?? false
          return (
            <div key={k} className="flex items-center justify-between gap-3 border-t border-divider py-2.5">
              <span className="text-sm">{l}</span>
              <Toggle checked={on} label={l} onChange={(v) => run(() => save({ prefs: { notif: { ...member.prefs.notif, [k]: v } } }), `${l}: ${v ? 'activadas' : 'desactivadas'}`)} />
            </div>
          )
        })}
      </Card>
    </>
  )
}

export default function GeneralTab() {
  return (
    <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
      <div className="flex flex-col gap-4">
        <ProfileCard />
        <FarmsCard />
        <SyncCard />
      </div>
      <div className="flex flex-col gap-4">
        <TeamCard />
        <PrefsCard />
      </div>
    </div>
  )
}
