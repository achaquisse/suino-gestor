import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/auth'
import { ROLE_LABEL } from '@/lib/constants'
import type { AdminUser, AuditAction, AuditEntry, Json } from '@/lib/database.types'
import { dLong, initials, isoOf } from '@/lib/format'
import { errorMessage, supabase } from '@/lib/supabase'
import { setUrlParams, useUrlNumber, useUrlState } from '@/lib/urlState'
import { Avatar, Breadcrumbs, Button, Card, Chip, ConfirmSheet, Empty, ErrorState, IconTile, Loading, Logo, Pager, SearchInput, Select, Spinner, useToast } from '@/ui'
import { useAdminUsers } from './AdminPage'


const ENTITY: Record<string, string> = {
  farms: 'granja', farm_members: 'membro da equipa', farm_invites: 'convite', pens: 'curral', animals: 'animal',
  events: 'registo', weights: 'pesagem', tasks: 'tarefa', stock_items: 'artigo de stock', stock_movements: 'movimento de stock',
  accounts: 'conta', categories: 'tipo de custo', batches: 'lote', transactions: 'movimento financeiro', transaction_files: 'anexo',
  recurring_expenses: 'despesa recorrente', debts: 'dívida', parameters: 'parâmetro', treatment_products: 'produto de tratamento',
  breeds: 'raça', symptoms: 'sintoma', profiles: 'perfil',
}
const ACTION = {
  insert: { verb: 'Criou', icon: 'add', bg: '#E6F6EE', fg: '#0F7A44' },
  update: { verb: 'Alterou', icon: 'edit', bg: '#EEECFE', fg: '#4B3CD6' },
  delete: { verb: 'Eliminou', icon: 'delete', bg: '#FDECEA', fg: '#C0302A' },
} as const
// Bookkeeping columns that say nothing to a reader.
const HIDDEN = new Set(['id', 'farm_id', 'created_at', 'created_by', 'search_text', 'updated_at'])

const show = (v: Json | undefined): string => {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60)
  const s = String(v)
  return s.length > 60 ? `${s.slice(0, 57)}…` : s
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

function Changes({ e }: { e: AuditEntry }) {
  const entries = Object.entries(e.changes).filter(([k]) => !HIDDEN.has(k))
  if (!entries.length) return null
  return (
    <dl className="m-0 mt-1.5 grid grid-cols-[minmax(90px,auto)_1fr] gap-x-3 gap-y-0.5 rounded-xl bg-[#F7F7FB] px-3 py-2 text-xs">
      {entries.slice(0, 12).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="truncate text-muted">{k}</dt>
          <dd className="m-0 min-w-0 break-words text-ink-2">
            {e.action === 'update' && Array.isArray(v) ? <>{show(v[0])} <span className="text-muted">→</span> <span className="font-medium text-ink">{show(v[1])}</span></> : show(v)}
          </dd>
        </div>
      ))}
      {entries.length > 12 && <div className="col-span-2 text-muted">+ {entries.length - 12} campos</div>}
    </dl>
  )
}

type Sort = 'new' | 'old' | 'entity'
const SORTS: readonly (readonly [Sort, string])[] = [['new', 'Mais recentes'], ['old', 'Mais antigas'], ['entity', 'Por tipo de registo']]
const ACTIONS: readonly (readonly ['' | AuditAction, string])[] = [['', 'Todas as operações'], ['insert', 'Criações'], ['update', 'Alterações'], ['delete', 'Eliminações']]

function Activity({ userId }: { userId: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const [q, setQ] = useUrlState('q', '')
  const [action] = useUrlState<'' | AuditAction>('op', '', ['', 'insert', 'update', 'delete'])
  const [entity] = useUrlState('tipo', '')
  const [sort] = useUrlState<Sort>('ordem', 'new', ['new', 'old', 'entity'])
  const [page, setPage] = useUrlNumber('page', 1)
  const [per] = useUrlNumber('per', 25)
  const reset = (patch: Record<string, string | null>) => setUrlParams({ ...patch, page: null })

  const query = useQuery({
    queryKey: ['admin', 'activity', userId, q, action, entity, sort, page, per],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_user_activity', {
        p_user: userId, p_query: q.trim(), p_action: action || null, p_entity: entity || null, p_sort: sort,
        p_offset: (page - 1) * per, p_limit: per,
      })
      if (error) throw error
      return data ?? []
    },
  })
  const rows = query.data ?? []
  const total = Number(rows[0]?.total ?? 0)
  const pages = Math.max(1, Math.ceil(total / per))

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 px-5 pt-5 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-[15px] font-semibold">Actividade</h2>
          <span className="flex items-center gap-2 text-[13px] text-muted">{query.isFetching && <Spinner size={14} />}{total} {total === 1 ? 'operação' : 'operações'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <SearchInput className="w-[260px] max-w-full" value={q} onChange={(v) => { setQ(v); reset({}) }} placeholder="Pesquisar registo, granja ou valor" />
          <Select aria-label="Operação" className="!w-auto" value={action} onChange={(e) => reset({ op: e.target.value || null })}>
            {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select aria-label="Tipo de registo" className="!w-auto max-w-full" value={entity} onChange={(e) => reset({ tipo: e.target.value || null })}>
            <option value="">Todos os registos</option>
            {Object.entries(ENTITY).sort((x, y) => x[1].localeCompare(y[1])).map(([v, l]) => <option key={v} value={v}>{l[0].toUpperCase() + l.slice(1)}</option>)}
          </Select>
          <Select aria-label="Ordenar" className="!w-auto" value={sort} onChange={(e) => reset({ ordem: e.target.value === 'new' ? null : e.target.value })}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>
      {query.isPending && <div className="flex justify-center border-t border-divider py-8"><Spinner /></div>}
      {query.isError && <p className="border-t border-divider px-5 py-4 text-sm text-danger">{errorMessage(query.error)}</p>}
      {query.isSuccess && !rows.length && (
        <div className="border-t border-divider">
          <Empty icon="history" title={q || action || entity ? 'Nenhuma operação encontrada' : 'Sem actividade registada'}
            sub={q || action || entity ? 'Tente outra pesquisa ou filtro.' : 'As operações que este utilizador fizer passam a aparecer aqui.'} />
        </div>
      )}
      {rows.map((e, i) => {
        // Day headers in local time (by date only when sorted by date).
        const d = isoOf(new Date(e.at))
        const header = sort !== 'entity' && (i === 0 || isoOf(new Date(rows[i - 1].at)) !== d) ? d : null
        const a = ACTION[e.action]
        const detailed = open === e.id
        return (
          <div key={e.id}>
            {header && <div className="border-t border-divider bg-[#FAFAFD] px-5 py-1.5 text-xs font-semibold text-muted">{dLong(header)}</div>}
            <button type="button" onClick={() => setOpen(detailed ? null : e.id)} aria-expanded={detailed}
              className="flex w-full items-start gap-3 border-0 border-t border-divider bg-white px-5 py-2.5 text-left hover:bg-[#FAFAFD]">
              <IconTile icon={a.icon} bg={a.bg} fg={a.fg} size={30} iconSize={16} className="mt-0.5 rounded-[9px]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm">
                  {a.verb} {ENTITY[e.entity] ?? e.entity}{e.label && <> · <strong className="font-semibold">{e.label}</strong></>}
                </span>
                <span className="block truncate text-xs text-muted">{sort === 'entity' ? `${dLong(d)} · ` : ''}{time(e.at)}{e.farm_name && ` · ${e.farm_name}`}</span>
                {detailed && <Changes e={e} />}
              </span>
            </button>
          </div>
        )
      })}
      {total > 0 && <Pager page={Math.min(page, pages)} pages={pages} per={per} total={total} setPage={setPage}
        setPer={(n) => setUrlParams({ per: n === 25 ? null : n, page: null })} />}
    </Card>
  )
}

export default function UserPage() {
  const { userId = '' } = useParams()
  const users = useAdminUsers()
  const navigate = useNavigate()
  const back = () => navigate('/admin?tab=utilizadores')
  const user = users.data?.find((u) => u.id === userId)
  const userName = user ? user.name || user.email.split('@')[0] : users.isPending ? '…' : 'Utilizador'

  return (
    <div className="app-bg min-h-dvh">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-14 wide:px-10 wide:pt-7">
        <header className="flex flex-wrap items-center gap-3">
          <Logo size={40} className="rounded-[12px] shadow-[0_4px_12px_rgba(91,76,240,0.3)]" />
          <div className="min-w-0 flex-1">
            <Breadcrumbs items={[{ label: 'Administração', to: '/admin' }, { label: 'Utilizadores', to: '/admin?tab=utilizadores' }, { label: userName }]} />
          </div>
          <Button icon="arrow_back" onClick={back}>Utilizadores</Button>
        </header>
        {users.isPending ? <Loading />
          : users.isError ? <ErrorState error={users.error} retry={() => users.refetch()} />
          : user ? <UserDetail key={user.id} user={user} onRemoved={back} />
          : <Card className="p-2"><Empty icon="person_off" title="Utilizador não encontrado" sub="A conta pode ter sido removida." action={<Button size="sm" onClick={back}>Voltar aos utilizadores</Button>} /></Card>}
      </div>
    </div>
  )
}

function UserDetail({ user, onRemoved }: { user: AdminUser; onRemoved: () => void }) {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [confirm, setConfirm] = useState<'disable' | 'delete' | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] })

  const setActive = useMutation({
    mutationFn: async (active: boolean) => {
      const { error } = await supabase.rpc('admin_set_user_active', { p_user: user!.id, p_active: active })
      if (error) throw error
    },
    onSuccess: async (_d, active) => { await refresh(); toast(active ? 'Conta activada' : 'Conta desactivada'); setConfirm(null) },
    onError: (e) => { toast(errorMessage(e), 'error'); setConfirm(null) },
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_delete_user', { p_user: user!.id })
      if (error) throw error
    },
    onSuccess: async () => { await refresh(); toast('Conta removida'); setConfirm(null); onRemoved() },
    onError: (e) => { toast(errorMessage(e), 'error'); setConfirm(null) },
  })

  const disabled = !!user.disabled_at
  // The super admin's own account and other platform admins are managed through SUPER_ADMIN_EMAIL.
  const manageable = user.id !== me?.id && !user.is_super_admin

  return (
    <>
          <Card className="flex flex-col gap-3 p-5">
            <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{user.name || user.email.split('@')[0]}</h1>
            <div className="flex items-center gap-3">
              <Avatar initials={initials(user.name || user.email)} size={46} />
              <div className="min-w-0">
                <div className="truncate text-sm">{user.email}</div>
                <div className="text-xs text-muted">
                  Conta criada {dLong(user.created_at.slice(0, 10))} · {user.last_sign_in_at ? `último acesso ${dLong(user.last_sign_in_at.slice(0, 10))}` : 'nunca entrou'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {user.is_super_admin && <Chip tone="amber">Super admin</Chip>}
              {disabled && <Chip tone="red" icon="block">Desactivada desde {dLong(user.disabled_at!.slice(0, 10))}</Chip>}
              {user.farms.map((f) => <Chip key={f.farm_id} tone={f.role === 'owner' ? 'accent' : 'neutral'}>{f.name} · {ROLE_LABEL[f.role]}</Chip>)}
              {!user.farms.length && <span className="text-xs text-muted">Sem granja</span>}
            </div>
            {manageable && (
              <div className="flex flex-wrap gap-2">
                {disabled
                  ? <Button size="sm" icon="check_circle" loading={setActive.isPending} onClick={() => setActive.mutate(true)}>Activar conta</Button>
                  : <Button size="sm" icon="block" onClick={() => setConfirm('disable')}>Desactivar conta</Button>}
                <Button size="sm" variant="ghost" icon="person_remove" className="!text-danger" onClick={() => setConfirm('delete')}>Remover conta</Button>
              </div>
            )}
          </Card>
          <Activity userId={user.id} />
      <ConfirmSheet open={confirm === 'disable'} onClose={() => setConfirm(null)} danger loading={setActive.isPending}
        title="Desactivar conta" confirmLabel="Desactivar"
        message={<><strong>{user.name || user.email}</strong> deixa de conseguir entrar e perde o acesso às granjas de imediato. Os dados e o histórico mantêm-se e pode activar a conta mais tarde.</>}
        onConfirm={() => setActive.mutate(false)} />
      <ConfirmSheet open={confirm === 'delete'} onClose={() => setConfirm(null)} danger loading={remove.isPending}
        title="Remover conta" confirmLabel="Remover"
        message={<>Remover <strong>{user.name || user.email}</strong>? Sai de todas as granjas e a conta é apagada. Os registos que fez nas granjas e o histórico de actividade mantêm-se. Esta acção não pode ser desfeita.</>}
        onConfirm={() => remove.mutate()} />
    </>
  )
}
