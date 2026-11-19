import { useState, type ReactNode } from 'react'
import { useAccounts, useBatches, useCategories, useCreateTransaction, useParam, useRpc } from '@/lib/queries'
import { dec, money, numP } from '@/lib/format'
import { Field, Input, Segmented, Select } from '@/ui'
import {
  AnimalSelect, CommonFields, FormSheet, LockedAnimal, firstId, scoped, useBase, useCommon, useSubmit, type FormProps,
} from './shared'

type SaleMode = 'animal' | 'other'

/** Income is recorded here: an animal sale, or "Outra venda" (manure, boar hire, other products and services). */
export function SaleForm(props: FormProps) {
  const [mode, setMode] = useState<SaleMode>('animal')
  // Opened from an animal: only the animal sale applies.
  const modeSwitch = props.ctx.animalId ? null : (
    <Segmented className="self-start" options={[['animal', 'Animal'], ['other', 'Outra venda']] as const} value={mode} onChange={setMode} />
  )
  return mode === 'animal' || props.ctx.animalId
    ? <AnimalSaleForm {...props} modeSwitch={modeSwitch} />
    : <OtherSaleForm {...props} modeSwitch={modeSwitch} />
}

function OtherSaleForm({ ctx, onBack, onClose, modeSwitch }: FormProps & { modeSwitch: ReactNode }) {
  const accounts = (useAccounts().data ?? []).filter((a) => a.active)
  const batches = (useBatches().data ?? []).filter((b) => b.active)
  // Income categories other than animal sales (recorded above) and capital injections (not a sale).
  const cats = (useCategories().data ?? []).filter((x) => x.active && x.grp === 'Receita' && x.name !== 'Venda de animais' && x.name !== 'Injeção de capital')
  const c = useCommon(ctx)
  const create = useCreateTransaction()
  const { pending, error, run } = useSubmit(ctx, onClose)
  const [what, setWhat] = useState('')
  const [category, setCategory] = useState('')
  const [amountText, setAmountText] = useState('')
  const [buyer, setBuyer] = useState('')
  const [account, setAccount] = useState('')
  const [batch, setBatch] = useState('')
  const cat = category || cats.find((x) => x.name === 'Outras receitas')?.name || cats[0]?.name || ''
  const acct = account || accounts[0]?.id || ''
  const amount = Math.round(numP(amountText) * 100) / 100

  const submit = () => run(async () => {
    if (!what.trim()) throw new Error('Indique o que foi vendido.')
    if (!cats.some((x) => x.name === cat)) throw new Error('Escolha uma categoria de receita activa.')
    if (!(amount > 0)) throw new Error('Indique o valor da venda.')
    if (!accounts.some((x) => x.id === acct)) throw new Error('Escolha uma conta de recebimento activa.')
    if (batch && !batches.some((b) => b.id === batch)) throw new Error('Escolha um lote activo.')
    await create.mutateAsync({
      tx_date: c.date, title: `${what.trim()}${buyer.trim() ? ` · ${buyer.trim()}` : ''}`, kind: 'Receita', category: cat,
      amount, batch_id: batch || null, notes: buyer.trim() ? `Comprador: ${buyer.trim()}` : '',
      splits: [{ account_id: acct, pct: 100 }],
    })
    return `Venda registada · ${what.trim()} · +${money(amount)} em ${accounts.find((x) => x.id === acct)?.name ?? 'conta'}`
  })

  return (
    <FormSheet title="Venda" onBack={onBack} onClose={onClose} pending={pending || create.isPending} error={error} onSubmit={submit}
      effect="Entra como receita na conta escolhida.">
      {modeSwitch}
      <Field label="O que foi vendido"><Input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Estrume, aluguer de varrasco..." /></Field>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <Field label="Categoria">
          <Select value={cat} onChange={(e) => setCategory(e.target.value)}>
            {!cats.length && <option value="">Sem categorias de receita</option>}
            {cats.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
          </Select>
        </Field>
        <Field label="Valor (MT)">
          <Input value={amountText} onChange={(e) => setAmountText(e.target.value)} type="number" min="0" step="any" inputMode="decimal" className="tabular" />
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
        <div className="tabular text-xl font-semibold text-success">{amount > 0 ? `+${money(amount)}` : '—'}</div>
      </div>
      <CommonFields c={c} byLabel="Vendido por" />
    </FormSheet>
  )
}

function AnimalSaleForm({ ctx, onBack, onClose, modeSwitch }: FormProps & { modeSwitch: ReactNode }) {
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
  const [kgText, setKgText] = useState(() => String(animals.find((a) => a.id === initial)?.weight_kg ?? ''))
  const [priceText, setPriceText] = useState<string | null>(null)
  const [buyer, setBuyer] = useState('')
  const [account, setAccount] = useState('')
  const [batch, setBatch] = useState('')
  const a = animals.find((x) => x.id === animal)
  const acct = account || accounts[0]?.id || ''
  const kgV = numP(kgText)
  const pr = numP(priceText ?? defaultPrice)
  const total = kgV > 0 && pr > 0 ? Math.round(kgV * pr) : 0
  const blocked = !!a?.withdrawal_until && a.withdrawal_until >= c.date

  const pick = (id: string) => {
    setAnimal(id)
    const w = animals.find((x) => x.id === id)?.weight_kg
    if (w != null) setKgText(String(w))
  }

  const submit = () => run(async () => {
    if (!a) throw new Error('Seleccione um animal.')
    if (!(kgV > 0)) throw new Error('Indique o peso vivo.')
    if (!(pr > 0)) throw new Error('Indique o preço por kg.')
    if (blocked) throw new Error('Animal em período de carência · venda bloqueada.')
    if (!accounts.some((x) => x.id === acct)) throw new Error('Escolha uma conta de recebimento activa.')
    if (batch && !batches.some((b) => b.id === batch)) throw new Error('Escolha um lote activo.')
    await rpc.mutateAsync({
      p_animal: a.id, p_kg: kgV, p_price_per_kg: pr, p_buyer: buyer.trim(), p_account: acct, p_batch: batch || undefined, p_date: c.date, p_by: c.by,
    })
    return `Venda registada · ${a.tag} · +${money(total)} em ${accounts.find((x) => x.id === acct)?.name ?? 'conta'}`
  })

  return (
    <FormSheet title="Venda" onBack={onBack} onClose={onClose} pending={pending} error={error} onSubmit={submit}
      effect="Entra como receita na conta escolhida e fecha o registo do animal.">
      {modeSwitch}
      {ctx.animalId ? <LockedAnimal animal={a} penName={penName(a?.pen_id ?? null)} /> : <AnimalSelect animals={list} penName={penName} value={animal} onChange={pick} />}
      {blocked && a?.withdrawal_until && <p className="m-0 text-[13px] text-danger">Em carência até {a.withdrawal_until.split('-').reverse().join('/')} · venda bloqueada.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Peso vivo (kg)" hint={a ? `Último peso: ${dec(a.weight_kg)} kg` : undefined}>
          <Input value={kgText} onChange={(e) => setKgText(e.target.value)} type="number" min="0" step="any" className="tabular" />
        </Field>
        <Field label="Preço por kg (MT)">
          <Input value={priceText ?? String(defaultPrice)} onChange={(e) => setPriceText(e.target.value)} type="number" min="0" step="any" className="tabular" />
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
