import { useState } from 'react'
import { addMonths, numP, todayISO, validDate } from '@/lib/format'
import { useAccounts, useTableMutations } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { Debt } from '@/lib/database.types'
import { Button, ConfirmSheet, Field, FormError, Input, Sheet, useToast } from '@/ui'
import SplitEditor from './SplitEditor'
import { splitCheck, splitDraftOf, toSplits, type SplitDraft } from './model'

export default function DebtSheet({ item, onClose }: { item: Debt | null; onClose: () => void }) {
  const toast = useToast()
  const accounts = (useAccounts().data ?? []).filter((a) => a.active)
  const { insert, update, remove } = useTableMutations('debts')

  const [creditor, setCreditor] = useState(item?.creditor ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [total, setTotal] = useState(item ? String(item.total) : '')
  const [paid, setPaid] = useState(item ? String(item.paid) : '0')
  const [installment, setInstallment] = useState(item ? String(item.installment) : '')
  const [nextDue, setNextDue] = useState(item?.next_due ?? addMonths(`${todayISO().slice(0, 8)}01`, 1))
  const [splits, setSplits] = useState<SplitDraft[]>(item ? splitDraftOf(item) : [])
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)

  const sp: SplitDraft[] = splits.length ? splits : accounts[0] ? [{ account_id: accounts[0].id, pct: '100' }] : []
  const busy = insert.isPending || update.isPending

  const save = async () => {
    const t = numP(total)
    const p = paid.trim() ? numP(paid) : 0
    const i = numP(installment)
    if (!creditor.trim()) return setError('Indique o credor.')
    if (!(t > 0)) return setError('Indique o valor total.')
    if (!(p >= 0)) return setError('Indique um valor já pago válido.')
    if (p > t) return setError('O valor pago não pode ser maior que o total.')
    if (!(i > 0)) return setError('Indique o valor da prestação.')
    if (p < t && !validDate(nextDue)) return setError('Indique um próximo vencimento válido.')
    if (sp.some((s) => !accounts.some((a) => a.id === s.account_id))) return setError('Escolha uma conta de pagamento activa.')
    const se = splitCheck(sp)
    if (se) return setError(se)
    const parts = toSplits(sp)
    const row = {
      creditor: creditor.trim(), description: description.trim(), total: t, paid: p, installment: i,
      next_due: p >= t ? null : nextDue || null, account_id: parts[0].account_id, splits: parts,
    }
    try {
      if (item) await update.mutateAsync({ id: item.id, ...row })
      else await insert.mutateAsync(row)
      toast(`${item ? 'Dívida actualizada' : 'Dívida registada'} · ${row.creditor}`)
      onClose()
    } catch (e) { setError(errorMessage(e)) }
  }

  const del = async () => {
    if (!item) return
    try {
      await remove.mutateAsync(item.id)
      toast(`Dívida eliminada · ${item.creditor}`)
      setConfirm(false)
      onClose()
    } catch (e) { setError(errorMessage(e)); setConfirm(false) }
  }

  return (
    <>
      <Sheet open onClose={onClose} title={item ? 'Editar dívida' : 'Nova dívida'} maxWidth={480}
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
          <Field label="Credor"><Input value={creditor} onChange={(e) => setCreditor(e.target.value)} placeholder="ex. Banco, fornecedor, pessoa" /></Field>
          <Field label="Descrição"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex. Ração a crédito" /></Field>
          <Field label="Valor total (MT)"><Input type="number" min="0" step="any" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" /></Field>
          <Field label="Já pago (MT)"><Input type="number" min="0" step="any" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" /></Field>
          <Field label="Prestação (MT)" hint="Valor sugerido em cada pagamento."><Input type="number" min="0" step="any" value={installment} onChange={(e) => setInstallment(e.target.value)} placeholder="0" /></Field>
          <Field label="Próximo vencimento"><Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></Field>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-2">Contas de pagamento</span>
            <SplitEditor value={sp} onChange={setSplits} accounts={accounts} amount={numP(installment) || 0} />
            <span className="text-xs text-muted">Pode dividir entre várias contas · ao dividir, cada conta começa com 50%.</span>
          </div>
          <FormError>{error}</FormError>
        </div>
      </Sheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title="Eliminar dívida" danger confirmLabel="Eliminar" loading={remove.isPending}
        message={`${item?.creditor ?? ''} · Os pagamentos já confirmados continuam nos movimentos.`} onConfirm={del} />
    </>
  )
}
