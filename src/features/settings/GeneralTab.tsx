import { useNavigate } from 'react-router'
import { useFarm } from '@/app/farm'
import { useAuth } from '@/app/auth'
import { errorMessage } from '@/lib/supabase'
import { Avatar, Button, Card, Chip, Field, IconTile, Input, Toggle, useToast } from '@/ui'
import { ROLE_LABEL } from '@/lib/constants'
import { TeamCard } from './Team'
import { useUpdateMyMembership } from './hooks'

const NOTIFS = [['tasks', 'Tarefas em atraso'], ['stock', 'Stock baixo e validades']] as const

function ProfileCard() {
  const { user, roleLabel } = useFarm()
  const { signOut } = useAuth()
  const toast = useToast()

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
      <div className="flex flex-wrap gap-2">
        <Button icon="logout" className="!text-danger hover:!bg-danger-soft"
          onClick={() => signOut().catch(() => toast('Sem ligação — não foi possível terminar a sessão.', 'error'))}>Terminar sessão</Button>
      </div>
    </Card>
  )
}

function FarmsCard() {
  const { memberships, farmId, isSuperAdmin, switchFarm } = useFarm()
  const navigate = useNavigate()
  return (
    <Card className="flex flex-col gap-2.5 p-5">
      <h2 className="m-0 text-[15px] font-semibold">Granjas</h2>
      {memberships.map((m) => (
        <button key={m.farm_id} type="button" onClick={() => m.farm_id !== farmId && switchFarm(m.farm_id)}
          className="flex items-center gap-3 rounded-[14px] border border-line bg-white p-3 text-left hover:bg-hover">
          <IconTile icon="agriculture" bg="#F3F3F9" fg="#55556A" size={38} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{m.farm.name}</div>
            <div className="text-xs text-muted">{m.via_admin ? 'Super admin' : ROLE_LABEL[m.role]}</div>
          </div>
          {m.farm_id === farmId && <Chip tone="success">Activa</Chip>}
        </button>
      ))}
      {isSuperAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button icon="add" onClick={() => navigate('/admin?nova=1')}>Nova granja</Button>
          <Button icon="admin_panel_settings" onClick={() => navigate('/admin')}>Administração</Button>
        </div>
      )}
    </Card>
  )
}

function PrefsCard() {
  const { member } = useFarm()
  const { save } = useUpdateMyMembership()
  const toast = useToast()

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
        {/* Only Portuguese and the metical are supported for now. */}
        <Field label="Idioma">
          <Input value="Português" readOnly aria-readonly className="cursor-default bg-hover text-muted" />
        </Field>
        <Field label="Moeda">
          <Input value="Metical (MZN)" readOnly aria-readonly className="cursor-default bg-hover text-muted" />
        </Field>
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
      </div>
      <div className="flex flex-col gap-4">
        <TeamCard />
        <PrefsCard />
      </div>
    </div>
  )
}
