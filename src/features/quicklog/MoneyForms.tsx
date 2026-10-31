import { useState } from 'react'
import { useAccounts, useBatches, useParam, useRpc, useStock } from '@/lib/queries'
import { dec, money, numP } from '@/lib/format'
import { Field, Input, Loading, Select } from '@/ui'
import {
  AnimalSelect, CommonFields, FormSheet, LockedAnimal, firstId, scoped, useBase, useCommon, useSubmit, type FormProps,
} from './shared'

export function SaleForm({ ctx, onBack, onClose }: FormProps) {
  const { animals, penName } = useBase()
  const list = scoped(animals, ctx)
  const accounts = (useAccounts().data ?? []).filter((a) => a.active)
  const batches = (useBatches().data ?? []).filter((b) => b.active)
  const defaultPrice = useParam('price_per_kg', 70)
  const c = useCommon(ctx)
  const rpc = useRpc('log_sale')
  const { pending, error, run } = useSubmit(ctx, onClose)
  const initial = firstId(ctx, list)
  const [animal, setAnimal] = useState(initial)
  const [kgText, setKgText] = useState(() => String(animals.find((a) => a.id === initial)?.weight_kg ?? '').replace('.', ','))
  const [priceText, setPriceText] = useState(String(defaultPrice).replace('.', ','))
  const [buyer, setBuyer] = useState('')
  const [account, setAccount] = useState('')
  const [batch, setBatch] = useState('')
  const a = animals.find((x) => x.id === animal)
  const acct = account || accounts[0]?.id || ''
  const kgV = numP(kgText)
  const pr = numP(priceText)
  const total = kgV > 0 && pr > 0 ? Math.round(kgV * pr) : 0
  const blocked = !!a?.withdrawal_until && a.withdrawal_until >= c.date

  const pick = (id: string) => {
    setAnimal(id)
    const w = animals.find((x) => x.id === id)?.weight_kg
    if (w != null) setKgText(String(w).replace('.', ','))
  }

  const submit = () => run(async () => {
    if (!a) throw new Error('Seleccione um animal.')
    if (!(kgV > 0)) throw new Error('Indique o peso vivo.')
    if (!(pr > 0)) throw new Error('Indique o preço por kg.')
    if (blocked) throw new Error('Animal em período de carência · venda bloqueada.')
    if (!acct) throw new Error('Escolha a conta de recebimento.')
    await rpc.mutateAsync({
      p_animal: a.id, p_kg: kgV, p_price_per_kg: pr, p_buyer: buyer.trim(), p_account: acct, p_batch: batch || undefined, p_date: c.date, p_by: c.by,
    })
    return `Venda registada · ${a.tag} · +${money(total)} em ${accounts.find((x) => x.id === acct)?.name ?? 'conta'}`
  })

  return (
    <FormSheet title="Venda" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit}
      effect="Entra como receita na conta escolhida e fecha o registo do animal.">
      {ctx.animalId ? <LockedAnimal animal={a} penName={penName(a?.pen_id ?? null)} /> : <AnimalSelect animals={list} penName={penName} value={animal} onChange={pick} />}
      {blocked && a?.withdrawal_until && <p className="m-0 text-[13px] text-danger">Em carência até {a.withdrawal_until.split('-').reverse().join('/')} · venda bloqueada.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Peso vivo (kg)" hint={a ? `Último peso: ${dec(a.weight_kg)} kg` : undefined}>
          <Input value={kgText} onChange={(e) => setKgText(e.target.value)} inputMode="decimal" className="tabular" />
        </Field>
        <Field label="Preço por kg (MT)">
          <Input value={priceText} onChange={(e) => setPriceText(e.target.value)} inputMode="decimal" className="tabular" />
        </Field>
      </div>
      <Field label="Comprador"><Input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Opcional" /></Field>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <Field label="Conta">
          <Select value={acct} onChange={(e) => setAccount(e.target.value)}>
            {accounts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Field>
        <Field label="Lote">
          <Select value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">Sem lote</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
          </Select>
        </Field>
      </div>
      <div className="rounded-[14px] bg-[#F7F7FB] px-4 py-3.5">
        <div className="text-[13px] text-muted">Total da venda</div>
        <div className="tabular text-xl font-semibold text-success">{total ? `+${money(total)}` : '—'}</div>
      </div>
      <CommonFields c={c} byLabel="Vendido por" />
    </FormSheet>
  )
}

export function PurchaseForm({ ctx, onBack, onClose }: FormProps) {
  const stockQ = useStock()
  const accountsQ = useAccounts()
  const c = useCommon(ctx)
  const rpc = useRpc('log_stock_purchase')
  const { pending, error, run } = useSubmit(ctx, onClose)
  const stock = stockQ.data ?? []
  const accounts = (accountsQ.data ?? []).filter((a) => a.active)
  const [item, setItem] = useState('')
  const [qtyText, setQtyText] = useState('')
  const [priceText, setPriceText] = useState('')
  const [supplier, setSupplier] = useState('')
  const [account, setAccount] = useState('')
  if (stockQ.isPending || accountsQ.isPending) return <FormSheet title="Compra" onBack={onBack} onClose={onClose} pending={false} error={null} onSubmit={() => {}}><Loading /></FormSheet>

  const itemId = item || stock.find((s) => s.code === ctx.stockCode)?.id || stock[0]?.id || ''
  const it = stock.find((s) => s.id === itemId)
  const acct = account || accounts[0]?.id || ''
  const qty = numP(qtyText)
  const price = priceText ? numP(priceText) : 0

  const submit = () => run(async () => {
    if (!it) throw new Error('Escolha um artigo.')
    if (!(qty > 0)) throw new Error('Indique a quantidade.')
    if (priceText && !(price >= 0)) throw new Error('Preço inválido.')
    if (price > 0 && !acct) throw new Error('Escolha a conta de pagamento.')
    await rpc.mutateAsync({ p_item: it.id, p_qty: qty, p_price: price, p_supplier: supplier.trim(), p_account: acct, p_date: c.date, p_by: c.by })
    return `Compra registada · ${it.name} ${it.qty} → ${it.qty + qty} ${it.unit}`
  })

  return (
    <FormSheet title="Compra" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit}
      effect="Aumenta o stock e regista a despesa na conta de pagamento.">
      <Field label="Artigo" hint={it ? `Em stock: ${it.qty} ${it.unit}` : undefined}>
        <Select value={itemId} onChange={(e) => setItem(e.target.value)}>
          {stock.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Quantidade${it ? ` (${it.unit})` : ''}`}>
          <Input value={qtyText} onChange={(e) => setQtyText(e.target.value)} inputMode="decimal" placeholder="0" className="tabular" />
        </Field>
        <Field label="Preço total (MT)">
          <Input value={priceText} onChange={(e) => setPriceText(e.target.value)} inputMode="decimal" placeholder="0" className="tabular" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <Field label="Fornecedor"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Opcional" /></Field>
        <Field label="Conta">
          <Select value={acct} onChange={(e) => setAccount(e.target.value)}>
            {accounts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Field>
      </div>
      <CommonFields c={c} byLabel="Registado por" />
    </FormSheet>
  )
}
