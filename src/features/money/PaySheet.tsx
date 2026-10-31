import { useState } from 'react'
import { dLong, fmt, numP, todayISO, validDate } from '@/lib/format'
import { useRpc } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { Debt, RecurringExpense } from '@/lib/database.types'
import { Button, Field, FormError, Input, Sheet, useToast } from '@/ui'
import { splitLabel, splitsOf, type Lookups } from './model'

function Intro({ rows }: { rows: { k: string; v: string }[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5 rounded-2xl bg-[#F7F7FB] p-3.5">
      {rows.map((x) => (
        <div key={x.k} className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">{x.k}</span>
          <span className="font-semibold">{x.v}</span>
        </div>
      ))}
    </div>
  )
}

export function PayRecurringSheet({ item, lookups, onClose }: { item: RecurringExpense; lookups: Lookups; onClose: () => void }) {
  const toast = useToast()
  const pay = useRpc('pay_recurring')
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')
  const fixed = item.cost_type === 'Fixo'

  const submit = async () => {
    if (!validDate(date)) return setError('Indique uma data válida.')
    try {
      await pay.mutateAsync({ p_id: item.id, p_date: date } as never)
      toast(`Pagamento confirmado · −${fmt(item.amount)} MT · ${splitLabel(splitsOf(item), lookups.accountName)}`)
      onClose()
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <Sheet open onClose={onClose} title="Confirmar pagamento" maxWidth={480}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={pay.isPending} onClick={submit}>Confirmar pagamento</Button></>}>
      <div className="flex flex-col gap-4">
        <Intro rows={[
          { k: 'Despesa', v: item.name },
          { k: 'Tipo de custo', v: `${item.cost_type} · ${item.frequency}` },
          { k: 'Vencimento', v: dLong(item.next_due) },
          { k: fixed ? 'Valor' : 'Estimativa', v: `${fmt(item.amount)} MT` },
        ]} />
        <Field label="Contas utilizadas" hint={fixed ? undefined : 'Custo variável: actualize o valor estimado na despesa antes de confirmar, se a factura for diferente.'}>
          <div className="rounded-[13px] border border-line-strong bg-[#F7F7FB] px-3 py-3 text-sm">{splitLabel(splitsOf(item), lookups.accountName)}</div>
        </Field>
        <Field label="Data do pagamento"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

export function PayDebtSheet({ item, lookups, onClose }: { item: Debt; lookups: Lookups; onClose: () => void }) {
  const toast = useToast()
  const pay = useRpc('pay_debt')
  const rem = item.total - item.paid
  const [amount, setAmount] = useState(String(Math.min(item.installment, rem)))
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')

  const submit = async () => {
    const v = numP(amount)
    if (!(v > 0)) return setError('Indique um valor pago numérico maior que zero.')
    if (v > rem) return setError('O valor pago não pode exceder o valor em dívida.')
    if (!validDate(date)) return setError('Indique uma data válida.')
    try {
      await pay.mutateAsync({ p_id: item.id, p_amount: v, p_date: date } as never)
      toast(`Pagamento confirmado · −${fmt(Math.min(v, rem))} MT · ${splitLabel(splitsOf(item), lookups.accountName)}`)
      onClose()
    } catch (e) { setError(errorMessage(e)) }
  }

  return (
    <Sheet open onClose={onClose} title="Registar pagamento" maxWidth={480}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={pay.isPending} onClick={submit}>Confirmar pagamento</Button></>}>
      <div className="flex flex-col gap-4">
        <Intro rows={[
          { k: 'Credor', v: item.creditor },
          { k: 'Em dívida', v: `${fmt(rem)} MT` },
          { k: 'Prestação', v: `${fmt(Math.min(item.installment, rem))} MT` },
          { k: 'Vencimento', v: item.next_due ? dLong(item.next_due) : '—' },
        ]} />
        <Field label="Valor pago (MT)" hint="Pode pagar mais que a prestação para amortizar."><Input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Contas utilizadas">
          <div className="rounded-[13px] border border-line-strong bg-[#F7F7FB] px-3 py-3 text-sm">{splitLabel(splitsOf(item), lookups.accountName)}</div>
        </Field>
        <Field label="Data do pagamento"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}
