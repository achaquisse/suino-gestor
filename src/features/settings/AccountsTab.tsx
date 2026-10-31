import { useState } from 'react'
import { useUrlState } from '@/lib/urlState'
import { useFarm } from '@/app/farm'
import { money, numP } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { useAccountBalances, useAccounts, useTableMutations } from '@/lib/queries'
import type { Account, AccountKind } from '@/lib/database.types'
import { Button, Chip, ConfirmSheet, Dot, ErrorState, Field, FormError, Input, Loading, Select, Sheet, Toggle, useToast } from '@/ui'
import { SWATCH } from '@/lib/constants'
import { DataTable, type Col } from './DataTable'
import { Swatches } from './Swatches'

const KINDS: AccountKind[] = ['Operacional', 'Investimento', 'Caixa']
type Draft = { id?: string; name: string; kind: AccountKind; holder: string; initial: string; color: string; active: boolean }
const blank: Draft = { name: '', kind: 'Operacional', holder: '', initial: '0', color: SWATCH[0], active: true }

function AccountSheet({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const { insert, update } = useTableMutations('accounts')
  const toast = useToast()
  const [d, setD] = useState<Draft>(draft ?? blank)
  const [error, setError] = useState('')
  const [seen, setSeen] = useState(draft)
  if (seen !== draft) { setSeen(draft); setD(draft ?? blank); setError('') }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))
  const pending = insert.isPending || update.isPending

  const submit = async () => {
    const initial = numP(d.initial || '0')
    if (!d.name.trim()) return setError('Indique o nome da conta.')
    if (!Number.isFinite(initial)) return setError('Saldo inicial inválido.')
    const row = { name: d.name.trim(), kind: d.kind, holder: d.holder.trim(), initial_balance: initial, color: d.color, active: d.active }
    try {
      if (d.id) await update.mutateAsync({ id: d.id, ...row })
      else await insert.mutateAsync(row)
      toast(d.id ? 'Conta actualizada' : 'Conta criada')
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Sheet open={!!draft} onClose={onClose} title={d.id ? 'Editar conta' : 'Nova conta'} maxWidth={460}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={pending} onClick={submit}>Guardar</Button></>}>
      <div className="flex flex-col gap-3.5">
        <Field label="Nome"><Input value={d.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Tipo">
          <Select value={d.kind} onChange={(e) => set('kind', e.target.value as AccountKind)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</Select>
        </Field>
        <Field label="Titular"><Input value={d.holder} onChange={(e) => set('holder', e.target.value)} /></Field>
        <Field label="Saldo inicial (MT)"><Input type="number" step="any" value={d.initial} onChange={(e) => set('initial', e.target.value)} /></Field>
        <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold text-ink-2">Cor</span><Swatches value={d.color} onChange={(c) => set('color', c)} /></div>
        <div className="flex items-center justify-between"><span className="text-sm">Conta activa</span><Toggle checked={d.active} onChange={(v) => set('active', v)} label="Conta activa" /></div>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

export default function AccountsTab() {
  const { isOwner } = useFarm()
  const accounts = useAccounts()
  const balances = useAccountBalances()
  const { update } = useTableMutations('accounts')
  const toast = useToast()
  const [q, setQ] = useUrlState('q', '')
  const [kind, setKind] = useUrlState('kind', 'all')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [off, setOff] = useState<Account | null>(null)

  if (accounts.isLoading) return <Loading />
  if (accounts.error) return <ErrorState error={accounts.error} retry={() => accounts.refetch()} />

  const bal = new Map((balances.data ?? []).map((b) => [b.id, b.balance]))
  const rows = (accounts.data ?? []).filter((a) =>
    (kind === 'all' || a.kind === kind) && `${a.name} ${a.holder}`.toLowerCase().includes(q.toLowerCase()))

  const cols: Col<Account>[] = [
    { head: 'Conta', width: 'minmax(160px,1.4fr)', cell: (a) => <span className="flex min-w-0 items-center gap-2.5"><Dot color={a.color} size={10} /><span className="truncate font-semibold">{a.name}</span></span> },
    { head: 'Tipo', width: '120px', cell: (a) => <Chip tone={a.kind === 'Investimento' ? 'accent' : a.kind === 'Caixa' ? 'amber' : 'neutral'}>{a.kind}</Chip> },
    { head: 'Titular', width: 'minmax(120px,1fr)', cell: (a) => <span className="truncate">{a.holder || '—'}</span> },
    { head: 'Saldo inicial', width: '120px', align: 'right', cell: (a) => <span className="tabular">{money(a.initial_balance)}</span> },
    { head: 'Saldo actual', width: '120px', align: 'right', cell: (a) => <span className="tabular font-semibold">{money(bal.get(a.id) ?? a.initial_balance)}</span> },
  ]

  return (
    <>
      <DataTable title="Contas" sub="Onde entra e sai o dinheiro da granja" addLabel="Nova conta" onAdd={() => setDraft(blank)}
        search={q} onSearch={setQ} filter={{ value: kind, onChange: setKind, options: [['all', 'Todos os tipos'], ...KINDS.map((k) => [k, k] as const)] }}
        rows={rows} cols={cols} readOnly={!isOwner} dim={(a) => !a.active} emptyMsg="Nenhuma conta encontrada" minW={760}
        onEdit={(a) => setDraft({ id: a.id, name: a.name, kind: a.kind, holder: a.holder, initial: String(a.initial_balance), color: a.color, active: a.active })}
        onDelete={(a) => a.active ? setOff(a) : update.mutate({ id: a.id, active: true }, { onSuccess: () => toast('Conta reactivada') })} />
      <AccountSheet draft={draft} onClose={() => setDraft(null)} />
      <ConfirmSheet open={!!off} onClose={() => setOff(null)} danger title="Desactivar conta" confirmLabel="Desactivar" loading={update.isPending}
        message={`${off?.name} deixa de aparecer nos novos registos. O histórico mantém-se.`}
        onConfirm={() => off && update.mutate({ id: off.id, active: false }, {
          onSuccess: () => { toast('Conta desactivada'); setOff(null) },
          onError: (e) => toast(errorMessage(e), 'error'),
        })} />
    </>
  )
}
