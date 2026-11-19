import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/auth'
import { FARM_STORAGE_KEY, useMemberships } from '@/app/farm'
import { ROLE_LABEL } from '@/lib/constants'
import type { AdminFarm, AdminUser } from '@/lib/database.types'
import { dLong, fmt, initials, plural } from '@/lib/format'
import { errorMessage, supabase } from '@/lib/supabase'
import CatalogsTab from './CatalogsTab'
import CostTypesTab from './CostTypesTab'
import {
  Avatar, Button, Card, Chip, ConfirmSheet, Empty, ErrorState, Field, FormError, Icon, IconButton, Input, Loading,
  Logo, SearchInput, Select, Sheet, Stat, Toggle, cx, useToast,
} from '@/ui'

type Tab = 'granjas' | 'tipos' | 'catalogos' | 'utilizadores'

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function useAdminFarms() {
  return useQuery({
    queryKey: ['admin', 'farms'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_farms')
      if (error) throw error
      return (data ?? []) as AdminFarm[]
    },
  })
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_users')
      if (error) throw error
      return (data ?? []) as AdminUser[]
    },
  })
}

function useRefreshAdmin() {
  const qc = useQueryClient()
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ['admin'] }),
    qc.invalidateQueries({ queryKey: ['memberships'] }),
  ])
}

function CreateFarmSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const refresh = useRefreshAdmin()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [demo, setDemo] = useState(false)
  const [error, setError] = useState('')
  const close = () => { setName(''); setOwner(''); setDemo(false); setError(''); onClose() }
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('admin_create_farm', { p_name: name.trim(), p_owner_email: owner.trim() || null, p_demo: demo })
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await refresh()
      toast(`Granja criada · ${name.trim()}`)
      close()
    },
    onError: (e) => setError(errorMessage(e)),
  })
  const submit = () => {
    setError('')
    if (!name.trim()) return setError('Indique o nome da granja.')
    if (owner.trim() && !/^\S+@\S+\.\S+$/.test(owner.trim())) return setError('Indique um email válido para o proprietário.')
    create.mutate()
  }
  return (
    <Sheet open={open} onClose={close} title="Nova granja" maxWidth={460}
      footer={<><Button className="flex-1" onClick={close}>Cancelar</Button><Button className="flex-1" variant="primary" loading={create.isPending} onClick={submit}>Criar granja</Button></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Nome da granja">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Granja Boane" maxLength={80} autoFocus />
        </Field>
        <Field label="Email do proprietário" hint="Opcional. Sem conta ainda? Recebe um convite e entra como proprietário no primeiro acesso. Em branco, fica você como proprietário.">
          <Input type="email" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="nome@exemplo.com" />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-[14px] border border-line px-3.5 py-3">
          <div>
            <div className="text-sm font-semibold">Dados de exemplo</div>
            <div className="text-xs text-muted">64 animais, 8 currais e movimentos de demonstração</div>
          </div>
          <Toggle checked={demo} onChange={setDemo} label="Dados de exemplo" />
        </div>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

function RenameFarmSheet({ farm, onClose }: { farm: AdminFarm | null; onClose: () => void }) {
  const toast = useToast()
  const refresh = useRefreshAdmin()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  if (farm && editing !== farm.id) { setEditing(farm.id); setName(farm.name); setError('') }
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('farms').update({ name: name.trim() }).eq('id', farm!.id)
      if (error) throw error
    },
    onSuccess: async () => { await refresh(); toast('Granja renomeada'); onClose() },
    onError: (e) => setError(errorMessage(e)),
  })
  return (
    <Sheet open={!!farm} onClose={onClose} title="Renomear granja" maxWidth={420}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={save.isPending} disabled={!name.trim()} onClick={() => save.mutate()}>Guardar</Button></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Nome da granja"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

function FarmsTab({ creating, setCreating, onOpen }: { creating: boolean; setCreating: (v: boolean) => void; onOpen: (tab: 'tipos' | 'catalogos', farmId: string) => void }) {
  const farms = useAdminFarms()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const refresh = useRefreshAdmin()
  const [q, setQ] = useState('')
  const [renaming, setRenaming] = useState<AdminFarm | null>(null)
  const [deleting, setDeleting] = useState<AdminFarm | null>(null)

  const remove = useMutation({
    mutationFn: async (f: AdminFarm) => {
      const { error } = await supabase.from('farms').delete().eq('id', f.id)
      if (error) throw error
      if (localStorage.getItem(FARM_STORAGE_KEY) === f.id) localStorage.removeItem(FARM_STORAGE_KEY)
    },
    onSuccess: async (_d, f) => { await refresh(); toast(`Granja eliminada · ${f.name}`); setDeleting(null) },
    onError: (e) => toast(errorMessage(e), 'error'),
  })

  const enter = async (f: AdminFarm) => {
    localStorage.setItem(FARM_STORAGE_KEY, f.id)
    qc.removeQueries({ queryKey: ['farm'] })
    await qc.invalidateQueries({ queryKey: ['memberships'] })
    navigate('/herd')
    toast(`Entrou em ${f.name}`)
  }

  const rows = useMemo(() => {
    const needle = fold(q.trim())
    return (farms.data ?? []).filter((f) => !needle || fold(`${f.name} ${f.owners}`).includes(needle))
  }, [farms.data, q])

  if (farms.isPending) return <Loading />
  if (farms.isError) return <ErrorState error={farms.error} retry={() => farms.refetch()} />
  const all = farms.data

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 wide:grid-cols-3">
        <Stat label="Granjas" value={fmt(all.length)} icon="agriculture" tint="#EEECFE" ink="#4B3CD6" />
        <Stat label="Animais" value={fmt(all.reduce((s, f) => s + f.animals, 0))} icon="fence" tint="#E6F6EE" ink="#0F7A44" />
        <Stat label="Membros" value={fmt(all.reduce((s, f) => s + f.members, 0))} sub={plural(all.reduce((s, f) => s + f.pending_invites, 0), 'convite pendente', 'convites pendentes')} icon="group" tint="#FDF1E2" ink="#A2601A" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Pesquisar granja ou proprietário" className="min-w-[220px] flex-1" />
        <Button variant="primary" icon="add" onClick={() => setCreating(true)}>Nova granja</Button>
      </div>
      {rows.length === 0 ? (
        <Card className="p-2"><Empty icon="agriculture" title={all.length ? 'Nenhuma granja encontrada' : 'Ainda não há granjas'} sub={all.length ? 'Tente outra pesquisa.' : 'Crie a primeira granja.'} /></Card>
      ) : (
        <ul aria-label="Granjas" className="m-0 flex list-none flex-col gap-2.5 p-0">
          {rows.map((f) => (
            <li key={f.id}>
              <Card as="article" className="flex flex-wrap items-center gap-3.5 p-4">
                <div className="flex min-w-0 flex-1 basis-[260px] items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#F3F3F9] text-[#55556A]"><Icon name="agriculture" /></span>
                  <div className="min-w-0">
                    <h3 className="m-0 truncate text-[15px] font-semibold">{f.name}</h3>
                    <div className="truncate text-[13px] text-muted">{f.owners || 'Sem proprietário'}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-faint">
                      <span>{plural(f.animals, 'animal', 'animais')}</span>
                      <span>{plural(f.pens, 'curral', 'currais')}</span>
                      <span>{plural(f.members, 'membro', 'membros')}</span>
                      <span>Criada {dLong(f.created_at.slice(0, 10))}</span>
                    </div>
                  </div>
                </div>
                {f.pending_invites > 0 && <Chip tone="amber" icon="mail">{plural(f.pending_invites, 'convite', 'convites')}</Chip>}
                <div className="flex items-center gap-1">
                  <IconButton icon="edit" label={`Renomear ${f.name}`} onClick={() => setRenaming(f)} />
                  <IconButton icon="category" label={`Tipos de custo de ${f.name}`} onClick={() => onOpen('tipos', f.id)} />
                  <IconButton icon="vaccines" label={`Catálogos de ${f.name}`} onClick={() => onOpen('catalogos', f.id)} />
                  <IconButton icon="delete" label={`Eliminar ${f.name}`} className="text-danger" onClick={() => setDeleting(f)} />
                  <Button icon="login" onClick={() => enter(f)} className="ml-1">Entrar</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <CreateFarmSheet open={creating} onClose={() => setCreating(false)} />
      <RenameFarmSheet farm={renaming} onClose={() => setRenaming(null)} />
      <ConfirmSheet open={!!deleting} onClose={() => setDeleting(null)} danger loading={remove.isPending}
        title="Eliminar granja" confirmLabel="Eliminar"
        message={<>Eliminar <strong>{deleting?.name}</strong> e todos os seus dados (animais, finanças, equipa)? Esta acção não pode ser desfeita.</>}
        onConfirm={() => deleting && remove.mutate(deleting)} />
    </div>
  )
}

/** A farm picker above a per-farm admin panel (cost types, catalogs). */
function FarmScoped({ farmId, setFarmId, sub, children }: { farmId: string | null; setFarmId: (id: string) => void; sub: string; children: (farmId: string) => ReactNode }) {
  const farms = useAdminFarms()
  if (farms.isPending) return <Loading />
  if (farms.isError) return <ErrorState error={farms.error} retry={() => farms.refetch()} />
  if (!farms.data.length) return <Card className="p-2"><Empty icon="agriculture" title="Ainda não há granjas" sub={sub} /></Card>
  const current = farms.data.find((f) => f.id === farmId) ?? farms.data[0]
  return (
    <div className="flex flex-col gap-4">
      <Field label="Granja" className="max-w-[360px]">
        <Select value={current.id} onChange={(e) => setFarmId(e.target.value)}>
          {farms.data.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Select>
      </Field>
      <div key={current.id}>{children(current.id)}</div>
    </div>
  )
}

function UsersTab() {
  const users = useAdminUsers()
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const rows = useMemo(() => {
    const needle = fold(q.trim())
    return (users.data ?? []).filter((u) => !needle || fold(`${u.name} ${u.email}`).includes(needle))
  }, [users.data, q])

  if (users.isPending) return <Loading />
  if (users.isError) return <ErrorState error={users.error} retry={() => users.refetch()} />

  return (
    <div className="flex flex-col gap-4">
      <SearchInput value={q} onChange={setQ} placeholder="Pesquisar nome ou email" />
      <div className="text-[13px] text-muted">{users.data.length} utilizadores · {users.data.filter((u) => !u.farms.length).length} sem granja · {users.data.filter((u) => u.disabled_at).length} desactivados · abra um utilizador para ver a actividade</div>
      {rows.length === 0 ? (
        <Card className="p-2"><Empty icon="person_search" title="Nenhum utilizador encontrado" /></Card>
      ) : (
        <ul aria-label="Utilizadores" className="m-0 flex list-none flex-col gap-2.5 p-0">
          {rows.map((u) => (
            <li key={u.id}>
              <Card as="article" className={cx('relative flex flex-wrap items-center gap-3.5 p-4 hover:border-[#D4D4E2]', u.disabled_at && 'opacity-60')}>
                <button type="button" onClick={() => navigate(`/admin/utilizadores/${u.id}`)} aria-label={`Abrir ${u.name || u.email}`}
                  className="absolute inset-0 rounded-card border-0 bg-transparent p-0" />
                <div className="flex min-w-0 flex-1 basis-[240px] items-center gap-3">
                  <Avatar initials={initials(u.name || u.email)} size={42} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="m-0 truncate text-[15px] font-semibold">{u.name || u.email.split('@')[0]}</h3>
                      {u.is_super_admin && <Chip tone="amber">Super admin</Chip>}
                      {u.disabled_at && <Chip tone="red">Desactivada</Chip>}
                    </div>
                    <div className="truncate text-[13px] text-muted">{u.email}</div>
                    <div className="mt-0.5 text-xs text-faint">{u.last_sign_in_at ? `Último acesso ${dLong(u.last_sign_in_at.slice(0, 10))}` : 'Nunca entrou'}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.farms.length
                    ? u.farms.map((f) => <Chip key={f.farm_id} tone={f.role === 'owner' ? 'accent' : 'neutral'}>{f.name} · {ROLE_LABEL[f.role]}</Chip>)
                    : <span className="text-xs text-muted">Sem granja</span>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AdminPage() {
  const { user, signOut } = useAuth()
  const memberships = useMemberships()
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: Tab = tabParam === 'utilizadores' || tabParam === 'tipos' || tabParam === 'catalogos' ? tabParam : 'granjas'
  const creating = params.get('nova') === '1'
  const set = (patch: Record<string, string | null>) => setParams((p) => {
    for (const [k, v] of Object.entries(patch)) { if (v === null) p.delete(k); else p.set(k, v) }
    return p
  }, { replace: true })
  const hasFarm = !!memberships.data?.length

  const tabs: [Tab, string, string][] = [['granjas', 'Granjas', 'agriculture'], ['tipos', 'Tipos de custo', 'category'], ['catalogos', 'Catálogos', 'vaccines'], ['utilizadores', 'Utilizadores', 'group']]

  return (
    <div className="app-bg min-h-dvh">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-14 wide:px-10 wide:pt-7">
        <header className="flex flex-wrap items-center gap-3">
          <Logo size={40} className="rounded-[12px] shadow-[0_4px_12px_rgba(91,76,240,0.3)]" />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">Administração</h1>
            <div className="truncate text-[13px] text-muted">Super admin · {user?.email}</div>
          </div>
          {hasFarm && <Button icon="arrow_back" onClick={() => navigate('/herd')}>Voltar à app</Button>}
          <IconButton icon="logout" label="Terminar sessão" className="text-danger"
            onClick={() => signOut().catch(() => toast('Sem ligação — não foi possível terminar a sessão.', 'error'))} />
        </header>
        <div role="tablist" className="flex max-w-full flex-wrap gap-1 self-start rounded-[14px] bg-[#EEEEF5] p-1">
          {tabs.map(([v, l, icon]) => (
            <button key={v} type="button" role="tab" aria-selected={v === tab} onClick={() => set({ tab: v === 'granjas' ? null : v, q: null, group: null, page: null, per: null })}
              className={cx('flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[11px] border-0 px-3.5 text-sm font-semibold transition-colors',
                v === tab ? 'bg-white text-ink shadow-[0_1px_2px_rgba(22,22,40,0.08),0_0_0_1px_#ECECF3]' : 'bg-transparent text-muted')}>
              <Icon name={icon} size={18} />{l}
            </button>
          ))}
        </div>
        {tab === 'granjas' && <FarmsTab creating={creating} setCreating={(v) => set({ nova: v ? '1' : null })} onOpen={(t, id) => set({ tab: t, granja: id })} />}
        {(tab === 'tipos' || tab === 'catalogos') && (
          <FarmScoped farmId={params.get('granja')} setFarmId={(id) => set({ granja: id, q: null, group: null, page: null })}
            sub={tab === 'tipos' ? 'Crie uma granja para gerir os seus tipos de custo.' : 'Crie uma granja para gerir os seus catálogos.'}>
            {(id) => tab === 'tipos' ? <CostTypesTab farmId={id} /> : <CatalogsTab farmId={id} />}
          </FarmScoped>
        )}
        {tab === 'utilizadores' && <UsersTab />}
      </div>
    </div>
  )
}
