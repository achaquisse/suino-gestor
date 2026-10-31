import { useMemo, useRef, useState } from 'react'
import type { FinPreset } from '@/app/overlays'
import { useFarm } from '@/app/farm'
import { fmt, numP, todayISO, validDate } from '@/lib/format'
import { useAccountBalances, useAccounts, useBatches, useCategories, useCreateTransaction, useStock } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { TxKind } from '@/lib/database.types'
import { Button, Empty, Field, FormError, Icon, Input, Select, Sheet, Textarea, cx, useToast } from '@/ui'
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
  const stockQ = useStock()
  const create = useCreateTransaction()
  const fileRef = useRef<HTMLInputElement>(null)

  const accounts = useMemo(() => (accountsQ.data ?? []).filter((a) => a.active), [accountsQ.data])
  const categories = useMemo(() => (categoriesQ.data ?? []).filter((c) => c.active), [categoriesQ.data])
  const batches = useMemo(() => (batchesQ.data ?? []).filter((b) => b.active), [batchesQ.data])
  const stock = useMemo(() => (stockQ.data ?? []).filter((s) => s.active), [stockQ.data])

  const initialType: Kind = preset?.type === 'Receita' || preset?.type === 'Aporte' ? 'Receita' : 'Despesa'
  const [type, setType] = useState<Kind>(initialType)
  const [catPick, setCatPick] = useState<string | null>(preset?.stockCode ? null : preset?.category ?? (preset?.type === 'Aporte' ? 'Aporte' : preset?.type === 'Investimento' ? 'Infra-estrutura' : null))
  const [stockPick, setStockPick] = useState<string | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const [catFilter, setCatFilter] = useState('')
  const [catActive, setCatActive] = useState(0)
  const [amount, setAmount] = useState('')
  const [quantityText, setQuantityText] = useState('')
  const [pricePick, setPricePick] = useState<{ category: string; stockId: string; text: string } | null>(null)
  const [date, setDate] = useState(todayISO())
  const [desc, setDesc] = useState('')
  const [batchMode, setBatchMode] = useState<'none' | 'all' | 'custom'>('none')
  const [batchPick, setBatchPick] = useState<string[]>([])
  const [allocationMode, setAllocationMode] = useState<'none' | 'percent' | 'amount'>('none')
  const [batchShares, setBatchShares] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<File[]>([])
  const [splitPick, setSplitPick] = useState<SplitDraft[] | null>(null)
  const [error, setError] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  const catOptions = categories.filter((c) => (type === 'Despesa' ? c.grp === 'Investimento' || c.grp === 'Operacional' : c.grp === 'Receita'))
  const visibleCategories = catOptions.filter((c) => c.name.toLocaleLowerCase().includes(catFilter.toLocaleLowerCase()))
  const stockId = stockPick ?? (preset?.purchase && preset.stockCode ? stock.find((s) => s.code === preset.stockCode)?.id ?? '' : '')
  const stockItem = type === 'Despesa' ? stock.find((s) => s.id === stockId) : undefined
  const cat = catPick ?? stockItem?.category ?? catOptions[0]?.name ?? ''
  const category = catOptions.find((c) => c.name === cat)
  const categoryStock = stock.filter((s) => s.category === cat)
  const product = category?.item_type === 'Produto' || !!stockItem
  const unit = stockItem?.unit ?? category?.quantity_unit ?? ''
  const baseline = stockItem?.unit_price ?? category?.baseline_price
  const priceText = pricePick?.category === cat && pricePick.stockId === stockId ? pricePick.text : baseline == null ? '' : String(baseline)
  const quantity = numP(quantityText)
  const unitPrice = numP(priceText)
  const enteredAmount = numP(amount)
  const roundedQty = Math.round(quantity * 1000) / 1000
  const roundedPrice = Math.round(unitPrice * 100) / 100
  const splits: SplitDraft[] = splitPick ?? (accounts[0] ? [{ account_id: accounts[0].id, pct: '100' }] : [])
  const value = product ? Math.round(roundedQty * roundedPrice * 100) / 100 : enteredAmount || 0
  const selectedBatches = batchMode === 'all' ? batches.map((b) => b.id) : batchMode === 'custom' ? batchPick.filter((id) => batches.some((b) => b.id === id)) : []
  const share = (id: string, i: number) => batchShares[id] ?? (allocationMode === 'percent'
    ? String(i === selectedBatches.length - 1 ? 100 - Math.round(100 / selectedBatches.length * 100) / 100 * i : Math.round(100 / selectedBatches.length * 100) / 100)
    : String(i === selectedBatches.length - 1 ? Math.round((value - Math.round(value / selectedBatches.length * 100) / 100 * i) * 100) / 100 : Math.round(value / selectedBatches.length * 100) / 100))

  const balanceOf = (id: string) => balancesQ.data?.find((b) => b.id === id)?.balance ?? 0
  const after = splits.reduce((a, s) => a + balanceOf(s.account_id), 0) + (type === 'Despesa' ? -value : value)
  const afterLabel = splits.length > 1 ? `das ${splits.length} contas` : `de ${accounts.find((a) => a.id === splits[0]?.account_id)?.name ?? '—'}`
  const detailsSummary = [
    desc.trim() && 'Descrição preenchida',
    batchMode !== 'none' && (selectedBatches.length > 0 ? `${selectedBatches.length} ${selectedBatches.length === 1 ? 'lote' : 'lotes'}${allocationMode !== 'none' ? ' · com distribuição' : ''}` : 'Lotes por seleccionar'),
    files.length > 0 && `${files.length} ${files.length === 1 ? 'anexo' : 'anexos'}`,
  ].filter(Boolean).join(' · ') || 'Descrição, lotes e anexos'

  const detailError = (message: string) => {
    setDetailsOpen(true)
    setError(message)
  }

  const kindFor = (): TxKind => {
    if (type === 'Receita') return cat === 'Aporte' ? 'Aporte' : cat === 'Venda de animais' ? 'Venda' : 'Receita'
    return cat === 'Infra-estrutura' || cat === 'Animais' || preset?.type === 'Investimento' ? 'Investimento' : 'Pontual'
  }

  const save = async () => {
    if (!category) return setError('Escolha uma categoria válida da lista.')
    if (stockItem && stockItem.category !== cat) return setError('A categoria deve corresponder ao artigo de stock.')
    if (product && !unit.trim()) return setError('Indique a unidade do produto.')
    if (product && !(Number.isFinite(quantity) && roundedQty > 0)) return setError('Indique uma quantidade válida.')
    if (product && !(Number.isFinite(unitPrice) && roundedPrice > 0)) return setError('Indique o preço por unidade.')
    if (!product && !(Number.isFinite(enteredAmount) && enteredAmount > 0 && Math.round(enteredAmount * 100) / 100 > 0)) return setError('Indique um valor numérico maior que zero.')
    if (!(Number.isFinite(value) && value > 0)) return setError('Indique o valor.')
    if (!validDate(date)) return setError('Indique uma data válida.')
    if (splits.some((s) => !accounts.some((a) => a.id === s.account_id))) return setError('Escolha uma conta de pagamento activa.')
    if (batchMode !== 'none' && !selectedBatches.length) return detailError('Seleccione pelo menos um lote.')
    const shares = selectedBatches.map((id, i) => numP(share(id, i)))
    if (allocationMode !== 'none' && selectedBatches.length && (shares.some((n) => !Number.isFinite(n) || n < 0)
      || Math.abs(shares.reduce((n, s) => n + s, 0) - (allocationMode === 'percent' ? 100 : value)) > 0.01))
      return detailError(allocationMode === 'percent' ? 'As percentagens dos lotes devem somar 100%.' : 'Os valores dos lotes devem somar o total do movimento.')
    const allocated = allocationMode === 'none' ? [] : selectedBatches.map((batch_id, i) => ({ batch_id,
      amount: (type === 'Despesa' ? -1 : 1) * (allocationMode === 'percent'
        ? i === selectedBatches.length - 1 ? Math.round((value - shares.slice(0, i).reduce((n, s) => n + Math.round(value * s) / 100, 0)) * 100) / 100 : Math.round(value * shares[i]) / 100
        : Math.round(shares[i] * 100) / 100),
    }))
    if (allocated.length && (allocated.some((a) => (type === 'Despesa' ? -a.amount : a.amount) < 0)
      || Math.abs(allocated.reduce((n, a) => n + a.amount, 0) - (type === 'Despesa' ? -value : value)) > 0.001))
      return detailError('A distribuição por lote deve corresponder exactamente ao total.')
    const se = splitCheck(splits)
    if (se) return setError(se)
    setError('')
    try {
      await create.mutateAsync({
        tx_date: date, title: desc.trim() || cat, kind: kindFor(), category: cat,
        amount: type === 'Despesa' ? -value : value, quantity: product ? roundedQty : null,
        quantity_unit: product ? unit : null, unit_price: product ? roundedPrice : null,
        batch_ids: selectedBatches, batch_allocations: allocated,
        stock_id: type === 'Despesa' ? stockItem?.id : null,
        splits: toSplits(splits), files,
      })
      toast(`${type === 'Despesa' ? 'Despesa registada' : 'Receita registada'} · ${type === 'Despesa' ? '−' : '+'}${fmt(value)} MT · ${splits.length > 1 ? `${splits.length} contas` : accounts.find((a) => a.id === splits[0].account_id)?.name}`)
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const loading = accountsQ.isLoading || categoriesQ.isLoading || stockQ.isLoading
  const fetchError = accountsQ.error || categoriesQ.error || stockQ.error

  return (
    <Sheet open onClose={onClose} title="Novo movimento" maxWidth={560}
      footer={<div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1 rounded-xl bg-hover px-3 py-2.5">
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="shrink-0 text-xs text-muted">Total do movimento</span>
            <span className={cx('tabular whitespace-nowrap text-base font-semibold', type === 'Receita' ? 'text-success-strong' : 'text-ink')}>
              {type === 'Despesa' ? '−' : '+'}{fmt(value)} MT
            </span>
          </div>
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-xs text-muted" title={`Saldo ${afterLabel} após`}>Saldo {afterLabel} após</span>
            <span className="tabular shrink-0 whitespace-nowrap text-sm font-semibold text-ink">{after < 0 ? '−' : ''}{fmt(after)} MT</span>
          </div>
        </div>
        <Button variant="primary" size="lg" className="w-full" loading={create.isPending} disabled={loading || !!fetchError} onClick={save}>{type === 'Despesa' ? 'Registar despesa' : 'Registar receita'}</Button>
      </div>}>
      <div className="flex flex-col gap-3.5">
        {fetchError && <FormError>{errorMessage(fetchError)}</FormError>}
        <FormError>{error}</FormError>
        <div className="flex rounded-[14px] bg-hover p-1" role="group" aria-label="Tipo de movimento">
          {(['Despesa', 'Receita'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => { setType(t); setCatPick(null); setStockPick(''); setCatOpen(false) }}
              className={cx('h-10 flex-1 rounded-[10px] border-0 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent', type === t ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'bg-transparent text-muted hover:text-ink')}>
              {t}
            </button>
          ))}
        </div>

        {!product && <Field label="Valor (MT)">
          <Input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus
            className="tabular h-14 rounded-[14px] px-4 text-[22px] font-semibold" />
        </Field>}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fin-category" className="text-[13px] font-semibold text-ink-2">Categoria</label>
          <div className="relative">
            <Input id="fin-category" role="combobox" aria-autocomplete="list" aria-expanded={catOpen} aria-controls="fin-categories"
              value={cat} onFocus={(e) => { setCatOpen(true); setCatFilter(''); setCatActive(0); e.target.select() }}
              onBlur={() => setCatOpen(false)}
              onChange={(e) => { setCatPick(e.target.value); setStockPick(''); setCatFilter(e.target.value); setCatActive(0); setCatOpen(true) }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && catOpen) { e.stopPropagation(); setCatOpen(false) }
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  setCatOpen(true)
                  setCatActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + visibleCategories.length) % (visibleCategories.length || 1))
                }
                if (e.key === 'Enter' && catOpen && visibleCategories[catActive]) {
                  e.preventDefault()
                  setCatPick(visibleCategories[catActive].name)
                  setStockPick('')
                  setCatOpen(false)
                }
              }} placeholder="Escolha ou pesquise uma categoria" />
            {catOpen && <div id="fin-categories" role="listbox" className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-line-strong bg-white p-1 shadow-lg">
              {visibleCategories.map((c, i) => <button key={c.id} type="button" role="option" aria-selected={cat === c.name}
                onMouseDown={(e) => e.preventDefault()} onClick={() => { setCatPick(c.name); setStockPick(''); setCatOpen(false) }}
                className={cx('block w-full rounded-lg border-0 px-3 py-2 text-left text-sm', i === catActive ? 'bg-accent-soft text-accent-strong' : 'bg-white text-ink hover:bg-hover')}>{c.name}</button>)}
              {!visibleCategories.length && <div className="px-3 py-2 text-sm text-muted">Nenhuma categoria encontrada.</div>}
            </div>}
          </div>
        </div>

        {type === 'Despesa' && categoryStock.length > 0 && <Field label="Artigo de stock (opcional)">
          <Select value={stockItem?.id ?? ''} onChange={(e) => setStockPick(e.target.value)}>
            <option value="">Não adicionar ao stock</option>
            {categoryStock.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}
          </Select>
        </Field>}

        {product && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={`Quantidade (${unit})`}><Input type="number" min="0" step="any" value={quantityText} onChange={(e) => setQuantityText(e.target.value)} placeholder="0" /></Field>
          <Field label={`Preço por ${unit} (MT)`}><Input type="number" min="0" step="any" value={priceText} onChange={(e) => setPricePick({ category: cat, stockId, text: e.target.value })} placeholder="0" /></Field>
        </div>}

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">{type === 'Despesa' ? 'Conta de pagamento' : 'Conta de recebimento'}</span>
          <SplitEditor value={splits} onChange={setSplitPick} accounts={accounts} amount={value} />
        </div>

        <Field label="Data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>

        <section className="border-t border-line pt-3">
          <button type="button" aria-expanded={detailsOpen} aria-controls="fin-details" onClick={() => setDetailsOpen((open) => !open)}
            className="flex w-full items-center gap-3 rounded-xl border-0 bg-hover px-3 py-2.5 text-left hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-accent">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">Mais detalhes <span className="font-normal text-muted">· opcional</span></span>
              <span className="block truncate text-xs text-muted">{detailsSummary}</span>
            </span>
            <Icon name={detailsOpen ? 'expand_less' : 'expand_more'} size={20} className="shrink-0 text-muted" />
          </button>
          <div id="fin-details" className={cx('flex flex-col gap-3.5 pt-3', !detailsOpen && 'hidden')}>
            <Field label="Descrição"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opcional" rows={3} /></Field>
            <Field label="Lote">
              <Select value={batchMode} onChange={(e) => { setBatchMode(e.target.value as typeof batchMode); setAllocationMode('none'); setBatchShares({}) }}>
                <option value="none">Sem lote</option>
                <option value="all">Todos os lotes activos</option>
                <option value="custom">Seleccionar lotes</option>
              </Select>
            </Field>
            {batchMode === 'custom' && <div className="flex flex-wrap gap-2">
              {batches.map((b) => <label key={b.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <input type="checkbox" checked={batchPick.includes(b.id)} onChange={(e) => {
                  setBatchPick((prev) => e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id))
                  setBatchShares({})
                }} />{b.code}
              </label>)}
              {!batches.length && <span className="text-sm text-muted">Não existem lotes activos.</span>}
            </div>}
            {selectedBatches.length > 0 && <Field label="Distribuição pelos lotes">
              <Select value={allocationMode} onChange={(e) => { setAllocationMode(e.target.value as typeof allocationMode); setBatchShares({}) }}>
                <option value="none">Apenas associar (sem distribuir o valor)</option>
                <option value="percent">Distribuir por percentagem</option>
                <option value="amount">Distribuir por valor (MT)</option>
              </Select>
            </Field>}
            {allocationMode !== 'none' && selectedBatches.map((id, i) => <Field key={id} label={`${batches.find((b) => b.id === id)?.code ?? 'Lote'} · ${allocationMode === 'percent' ? '%' : 'MT'}`}>
              <Input type="number" min="0" step="any" value={share(id, i)} onChange={(e) => setBatchShares((prev) => ({ ...prev, [id]: e.target.value }))} />
            </Field>)}

            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" hidden
              onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); e.target.value = '' }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[#C9C2FB] bg-[#FAFAFF] px-3 py-2 text-center font-medium text-accent hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-accent">
              <Icon name="attach_file" className="shrink-0" />Anexar factura, recibo ou comprovativo
            </button>
            {files.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                    <Icon name={f.type.startsWith('image/') ? 'image' : 'picture_as_pdf'} size={18} className="text-muted" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <button type="button" aria-label="Remover anexo" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))}
                      className="grid h-8 w-8 place-items-center rounded-lg border-0 bg-transparent text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"><Icon name="close" size={18} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </Sheet>
  )
}
