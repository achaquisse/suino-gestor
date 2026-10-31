import { useState } from 'react'
import { useFarm } from '@/app/farm'
import { ROLE_LABEL } from '@/lib/constants'
import { initials } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { useInvites, useMembers, useTableMutations } from '@/lib/queries'
import type { Role } from '@/lib/database.types'
import { Avatar, Button, Card, CardHeader, Chip, ConfirmSheet, Empty, Field, FormError, IconButton, Input, Loading, Select, Sheet, useToast } from '@/ui'
import { useMemberAdmin } from './hooks'

const ROLES = Object.keys(ROLE_LABEL) as Role[]
const roleTone = (r: Role) => (r === 'owner' ? 'accent' : r === 'investor' ? 'amber' : 'neutral')

function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { insert } = useTableMutations('farm_invites')
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('caretaker')
  const [error, setError] = useState('')
  const reset = () => { setName(''); setEmail(''); setRole('caretaker'); setError('') }
  const close = () => { reset(); onClose() }
  const submit = async () => {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Indique o nome e um email válido.')
    try {
      await insert.mutateAsync({ name: name.trim(), email: email.trim().toLowerCase(), role })
      toast(`Convite enviado a ${name.trim()}`)
      close()
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return (
    <Sheet open={open} onClose={close} title="Convidar membro" maxWidth={440}
      footer={<><Button className="flex-1" onClick={close}>Cancelar</Button><Button className="flex-1" variant="primary" loading={insert.isPending} onClick={submit}>Convidar</Button></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" /></Field>
        <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" /></Field>
        <Field label="Função">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.filter((r) => r !== 'owner').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </Field>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

export function TeamCard() {
  const { isOwner, user } = useFarm()
  const members = useMembers()
  const invites = useInvites()
  const { remove: removeInvite } = useTableMutations('farm_invites')
  const { setRole, removeMember } = useMemberAdmin()
  const toast = useToast()
  const [inviting, setInviting] = useState(false)
  const [del, setDel] = useState<{ kind: 'member' | 'invite'; id: string; name: string } | null>(null)

  const pending = (invites.data ?? []).filter((i) => !i.accepted_at)

  const changeRole = async (userId: string, role: Role) => {
    try {
      await setRole.mutateAsync({ userId, role })
      toast(`Função: ${ROLE_LABEL[role]}`)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const confirmDel = async () => {
    if (!del) return
    try {
      if (del.kind === 'member') await removeMember.mutateAsync(del.id)
      else await removeInvite.mutateAsync(del.id)
      toast(del.kind === 'member' ? `${del.name} removido da equipa` : 'Convite revogado')
      setDel(null)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Equipa" className="!py-4" right={isOwner && <Button size="sm" variant="soft" icon="person_add" onClick={() => setInviting(true)}>Convidar</Button>} />
      {members.isLoading && <Loading />}
      {!members.isLoading && !members.data?.length && <Empty icon="group" title="Sem membros" />}
      {members.data?.map((m) => (
        <div key={m.user_id} className="flex items-center gap-3 border-t border-divider px-5 py-3">
          <Avatar initials={initials(m.display_name)} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{m.display_name}{m.user_id === user.id && <span className="text-muted"> (você)</span>}</div>
          </div>
          {isOwner && m.user_id !== user.id ? (
            <>
              <Select value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value as Role)} className="!h-9 !w-auto !text-[13px]" aria-label="Função">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </Select>
              <IconButton icon="person_remove" label="Remover" size={34} iconSize={18} onClick={() => setDel({ kind: 'member', id: m.user_id, name: m.display_name })} />
            </>
          ) : <Chip tone={roleTone(m.role)}>{ROLE_LABEL[m.role]}</Chip>}
        </div>
      ))}
      {pending.map((i) => (
        <div key={i.id} className="flex items-center gap-3 border-t border-divider px-5 py-3">
          <Avatar initials={initials(i.name)} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{i.name}</div>
            <div className="truncate text-xs text-muted">{i.email} · convite pendente</div>
          </div>
          <Chip tone="neutral">{ROLE_LABEL[i.role]}</Chip>
          {isOwner && <IconButton icon="close" label="Revogar convite" size={34} iconSize={18} onClick={() => setDel({ kind: 'invite', id: i.id, name: i.name })} />}
        </div>
      ))}
      <InviteSheet open={inviting} onClose={() => setInviting(false)} />
      <ConfirmSheet open={!!del} onClose={() => setDel(null)} danger loading={removeMember.isPending || removeInvite.isPending}
        title={del?.kind === 'member' ? 'Remover membro' : 'Revogar convite'}
        message={del?.kind === 'member' ? `${del.name} perde o acesso a esta granja.` : `O convite a ${del?.name} será cancelado.`}
        confirmLabel={del?.kind === 'member' ? 'Remover' : 'Revogar'} onConfirm={confirmDel} />
    </Card>
  )
}
