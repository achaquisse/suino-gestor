import { useState } from 'react'
import { FREQS } from '@/lib/constants'
import { addMonths, numP, todayISO } from '@/lib/format'
import { useAccounts, useCategories, useTableMutations } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { RecurringExpense } from '@/lib/database.types'
import { Button, ConfirmSheet, Field, FormError, Input, Segmented, Select, Sheet, useToast } from '@/ui'
import SplitEditor from './SplitEditor'
import { splitCheck, splitDraftOf, toSplits, type SplitDraft } from './model'

export default function RecurringSheet({ item, onClose }: { item: RecurringExpense | null; onClose: () => void }) {
  const toast = useToast()
  const accounts = (useAccounts().data ?? []).filter((a) => a.active)
  const categories = (useCategories().data ?? []).filter((c) => c.active && c.grp !== 'Receita')
  const { insert, update, remove } = useTableMutations('recurring_expenses')

  const [name, setName] = useState(item?.name ?? '')
  const [costType, setCostType] = useState<'Fixo' | 'Variável'>(item?.cost_type ?? 'Fixo')
  const [amount, setAmount] = useState(item ? String(item.amount) : '')
  const [category, setCategory] = useState(item?.category ?? '')
  const [splits, setSplits] = useState<SplitDraft[]>(item ? splitDraftOf(item) : [])
  const [frequency, setFrequency] = useState<RecurringExpense['frequency']>(item?.frequency ?? 'Mensal')
  const [nextDue, setNextDue] = useState(item?.next_due ?? addMonths(`${todayISO().slice(0, 8)}01`, 1))
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)

  const cat = category || categories[0]?.name || ''
  const sp: SplitDraft[] = splits.length ? splits : accounts[0] ? [{ account_id: accounts[0].id, pct: '100' }] : []
  const busy = insert.isPending || update.isPending

  const save = async () => {
    const v = numP(amount)
    if (!name.trim()) return setError('Indique a descrição.')
    if (!(v > 0)) return setError('Indique um valor maior que zero.')
    if (!nextDue) return setError('Indique o próximo vencimento.')
    const se = splitCheck(sp)
    if (se) return setError(se)
    const parts = toSplits(sp)
    const row = { name: name.trim(), cost_type: costType, category: cat, amount: v, frequency, next_due: nextDue, account_id: parts[0].account_id, splits: parts }
    try {
      if (item) await update.mutateAsync({ id: item.id, ...row })
      else await insert.mutateAsync(row)
      toast(`${item ? 'Despesa recorrente actualizada' : 'Despesa recorrente criada'} · ${row.name}`)
      onClose()
    } catch (e) { setError(errorMessage(e)) }
  }

  const del = async () => {
    if (!item) return
    try {
      await remove.mutateAsync(item.id)
      toast(`Despesa recorrente eliminada · ${item.name}`)
      setConfirm(false)
      onClose()
    } catch (e) { setError(errorMessage(e)); setConfirm(false) }
  }

  return (
    <>
      <Sheet open onClose={onClose} title={item ? 'Editar despesa recorrente' : 'Nova despesa recorrente'} maxWidth={480}
        footer={
          <>
            {item && <Button variant="danger" icon="delete" onClick={() => setConfirm(true)}>Eliminar</Button>}
            <div className="ml-auto flex gap-2">
              <Button onClick={onClose}>Cancelar</Button>
              <Button variant="primary" loading={busy} onClick={save}>{item ? 'Guardar alterações' : 'Criar'}</Button>
            </div>
          </>
        }>
        <div className="flex flex-col gap-4">
          <Field label="Descrição"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Salários, Electricidade" /></Field>
          <Field label="Tipo de custo" hint={costType === 'Variável' ? 'Custo variável: o valor real é confirmado em cada pagamento.' : 'Custo fixo: o mesmo valor em cada pagamento.'}>
            <Segmented className="w-full [&>button]:flex-1" options={[['Fixo', 'Fixo'], ['Variável', 'Variável']] as const} value={costType} onChange={setCostType} />
          </Field>
          <Field label={costType === 'Variável' ? 'Valor estimado (MT)' : 'Valor (MT)'}>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Categoria">
            <Select value={cat} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-2">Contas de pagamento</span>
            <SplitEditor value={sp} onChange={setSplits} accounts={accounts} amount={numP(amount) || 0} />
            <span className="text-xs text-muted">Pode dividir entre várias contas · ao dividir, cada conta começa com 50%.</span>
          </div>
          <Field label="Frequência">
            <Segmented className="w-full [&>button]:flex-1" options={FREQS.map((f) => [f, f] as const)} value={frequency} onChange={setFrequency} />
          </Field>
          <Field label="Próximo vencimento"><Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></Field>
          <FormError>{error}</FormError>
        </div>
      </Sheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title="Eliminar despesa recorrente" danger confirmLabel="Eliminar" loading={remove.isPending}
        message={`${item?.name ?? ''} · Os pagamentos já confirmados continuam nos movimentos.`} onConfirm={del} />
    </>
  )
}
