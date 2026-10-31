import { useMemo, useRef, useState } from 'react'
import type { FinPreset } from '@/app/overlays'
import { useFarm } from '@/app/farm'
import { CATC, MUTED } from '@/lib/constants'
import { fmt, numP, todayISO } from '@/lib/format'
import { useAccountBalances, useAccounts, useBatches, useCategories, useCreateTransaction } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { TxKind } from '@/lib/database.types'
import { Button, Empty, Field, FormError, Icon, Input, Select, Sheet, cx, useToast } from '@/ui'
import SplitEditor from './SplitEditor'
import { splitCheck, toSplits, type SplitDraft } from './model'

type Kind = 'Despesa' | 'Receita'

export default function FinSheet({ preset, onClose }: { preset?: FinPreset; onClose: () => void }) {
  const { isOwner } = useFarm()
  if (!isOwner) {
    return (
      <Sheet open onClose={onClose} title="Novo movimento" maxWidth={560}>
        <Empty icon="lock" title="Apenas o proprietário regista movimentos" sub="O seu perfil tem acesso de leitura às finanças." />
      </Sheet>
    )
  }
  return <FinForm preset={preset} onClose={onClose} />
}

function FinForm({ preset, onClose }: { preset?: FinPreset; onClose: () => void }) {
  const toast = useToast()
  const accountsQ = useAccounts()
  const balancesQ = useAccountBalances()
  const categoriesQ = useCategories()
  const batchesQ = useBatches()
  const create = useCreateTransaction()
  const fileRef = useRef<HTMLInputElement>(null)

  const accounts = useMemo(() => (accountsQ.data ?? []).filter((a) => a.active), [accountsQ.data])
  const categories = useMemo(() => (categoriesQ.data ?? []).filter((c) => c.active), [categoriesQ.data])
  const batches = useMemo(() => (batchesQ.data ?? []).filter((b) => b.active), [batchesQ.data])

  const initialType: Kind = preset?.type === 'Receita' || preset?.type === 'Aporte' ? 'Receita' : 'Despesa'
  const [type, setType] = useState<Kind>(initialType)
  const [catPick, setCatPick] = useState<string | null>(preset?.category ?? (preset?.type === 'Aporte' ? 'Aporte' : preset?.type === 'Investimento' ? 'Infra-estrutura' : null))
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [desc, setDesc] = useState('')
  const [batch, setBatch] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [splitPick, setSplitPick] = useState<SplitDraft[] | null>(null)
  const [error, setError] = useState('')

  const catOptions = categories.filter((c) => (type === 'Despesa' ? c.grp === 'Investimento' || c.grp === 'Operacional' : c.grp === 'Receita'))
  const cat = catPick && catOptions.some((c) => c.name === catPick) ? catPick : catOptions[0]?.name ?? ''
  const splits: SplitDraft[] = splitPick ?? (accounts[0] ? [{ account_id: accounts[0].id, pct: '100' }] : [])
  const value = numP(amount) || 0

  const balanceOf = (id: string) => balancesQ.data?.find((b) => b.id === id)?.balance ?? 0
  const after = splits.reduce((a, s) => a + balanceOf(s.account_id), 0) + (type === 'Despesa' ? -value : value)
  const afterLabel = splits.length > 1 ? `das ${splits.length} contas` : `de ${accounts.find((a) => a.id === splits[0]?.account_id)?.name ?? '—'}`

  const kindFor = (): TxKind => {
    if (type === 'Receita') return cat === 'Aporte' ? 'Aporte' : cat === 'Venda de animais' ? 'Venda' : 'Receita'
    return cat === 'Infra-estrutura' || cat === 'Animais' || preset?.type === 'Investimento' ? 'Investimento' : 'Pontual'
  }

  const save = async () => {
    if (!(value > 0)) return setError('Indique o valor.')
    if (!cat) return setError('Escolha a categoria.')
    if (!date) return setError('Indique a data.')
    const se = splitCheck(splits)
    if (se) return setError(se)
    setError('')
    try {
      await create.mutateAsync({
        tx_date: date, title: desc.trim() || cat, kind: kindFor(), category: cat,
        amount: type === 'Despesa' ? -value : value, batch_id: batch || null, splits: toSplits(splits), files,
      })
      toast(`${type === 'Despesa' ? 'Despesa registada' : 'Receita registada'} · ${type === 'Despesa' ? '−' : '+'}${fmt(value)} MT · ${splits.length > 1 ? `${splits.length} contas` : accounts.find((a) => a.id === splits[0].account_id)?.name}`)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const loading = accountsQ.isLoading || categoriesQ.isLoading

  return (
    <Sheet open onClose={onClose} title="Novo movimento" maxWidth={560}
      footer={<Button variant="primary" size="lg" className="flex-1" loading={create.isPending} disabled={loading} onClick={save}>{type === 'Despesa' ? 'Registar despesa' : 'Registar receita'}</Button>}>
      <div className="flex flex-col gap-4">
        <div className="flex rounded-[14px] bg-hover p-1">
          {(['Despesa', 'Receita'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={cx('h-10 flex-1 rounded-[10px] border-0 font-semibold transition-colors', type === t ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'bg-transparent text-muted')}>
              {t}
            </button>
          ))}
        </div>

        <Field label="Valor (MT)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus
            className="tabular h-14 rounded-[14px] px-4 text-[22px] font-semibold" />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Categoria</span>
          <div className="flex flex-wrap gap-2">
            {catOptions.map((c) => (
              <button key={c.id} type="button" aria-pressed={cat === c.name} onClick={() => setCatPick(c.name)}
                className={cx('flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
                  cat === c.name ? 'border-[#C9C2FB] bg-accent-soft text-accent-strong' : 'border-line-strong bg-white text-ink-2')}>
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: c.color || CATC[c.name] || MUTED }} />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">{type === 'Despesa' ? 'Conta de pagamento' : 'Conta de recebimento'}</span>
          <SplitEditor value={splits} onChange={setSplitPick} accounts={accounts} amount={value} />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          <Field label="Data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Descrição"><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opcional" /></Field>
          <Field label="Lote">
            <Select value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="">Sem lote</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
            </Select>
          </Field>
        </div>

        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" hidden
          onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); e.target.value = '' }} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex h-[54px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[#C9C2FB] bg-[#FAFAFF] font-medium text-accent hover:bg-accent-wash">
          <Icon name="attach_file" />Anexar factura, recibo ou comprovativo
        </button>
        {files.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <Icon name={f.type.startsWith('image/') ? 'image' : 'picture_as_pdf'} size={18} className="text-muted" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <button type="button" aria-label="Remover anexo" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))}
                  className="grid h-8 w-8 place-items-center rounded-lg border-0 bg-transparent text-muted hover:bg-hover"><Icon name="close" size={18} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 overflow-hidden rounded-[14px] bg-[#F7F7FB]">
          <div className="px-4 py-3.5">
            <div className="text-[13px] text-muted">Total</div>
            <div className={cx('tabular text-xl font-semibold', type === 'Receita' && 'text-success')}>
              {type === 'Despesa' ? '−' : '+'}{fmt(value)} <span className="text-xs text-faint">MT</span>
            </div>
          </div>
          <div className="border-l border-line px-4 py-3.5">
            <div className="truncate text-[13px] text-muted">Saldo {afterLabel} após</div>
            <div className="tabular text-xl font-semibold">{after < 0 ? '−' : ''}{fmt(after)}</div>
          </div>
        </div>

        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}
