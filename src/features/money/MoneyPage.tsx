import { useMemo, useState } from 'react'
import { useFarm } from '@/app/farm'
import { firstDate } from '@/lib/periods'
import { useOverlays } from '@/app/overlays'
import type { Debt, RecurringExpense, Transaction } from '@/lib/database.types'
import { useAccountBalances, useAccounts, useCategories, useDebts, useRecurring, useTransactions } from '@/lib/queries'
import { Empty, ErrorState, Loading, usePaged } from '@/ui'
import CategorySheet from './CategorySheet'
import Commitments, { type CommitTab } from './Commitments'
import DebtSheet from './DebtSheet'
import MoneyHeader from './MoneyHeader'
import { AccountsCard, CategoriesCard, Kpis, type CatGroup } from './Overview'
import { PayDebtSheet, PayRecurringSheet } from './PaySheet'
import RecurringSheet from './RecurringSheet'
import TransactionsCard from './TransactionsCard'
import TxDetailSheet from './TxDetailSheet'
import { setUrlParams, useUrlParams, useUrlState } from '@/lib/urlState'
import { defaultFilters, filtersFromParams, filtersToParams, groupSiblings, isFiltered, makeLookups, splitsOf, type Filters } from './model'
import { useFilesIndex } from './useFilesIndex'

type Modal =
  | { k: 'tx'; tx: Transaction; back?: string }
  | { k: 'cat'; cat: string }
  | { k: 'rec'; item: RecurringExpense | null }
  | { k: 'debt'; item: Debt | null }
  | { k: 'payRec'; item: RecurringExpense }
  | { k: 'payDebt'; item: Debt }

export default function MoneyPage() {
  const { canSeeMoney, isOwner } = useFarm()
  if (!canSeeMoney) return <Empty icon="lock" title="Sem acesso às despesas" sub="O seu perfil não tem permissão para ver esta página." />
  return <MoneyContent canWrite={isOwner} />
}

function MoneyContent({ canWrite }: { canWrite: boolean }) {
  const { openFin } = useOverlays()
  const txQ = useTransactions()
  const accQ = useAccounts()
  const balQ = useAccountBalances()
  const catQ = useCategories()
  const recQ = useRecurring()
  const debtQ = useDebts()
  const withFiles = useFilesIndex()

  const params = useUrlParams()
  const { farm } = useFarm()
  // "Desde o início" starts at the first movement (or the farm's creation).
  const start = useMemo(() => firstDate([farm.created_at, ...(txQ.data ?? []).map((t) => t.tx_date)]), [farm.created_at, txQ.data])
  const filters = useMemo(() => filtersFromParams(params, start), [params, start])
  const [group, setGroup] = useUrlState<CatGroup>('group', 'all', ['all', 'Investimento', 'Operacional'])
  const [tab, setTab] = useUrlState<CommitTab>('commit', 'rec', ['rec', 'debt'])
  const [modal, setModal] = useState<Modal | null>(null)

  const txs = useMemo(() => txQ.data ?? [], [txQ.data])
  const accounts = useMemo(() => accQ.data ?? [], [accQ.data])
  const balances = useMemo(() => balQ.data ?? [], [balQ.data])
  const lookups = useMemo(() => makeLookups(accounts, catQ.data ?? []), [accounts, catQ.data])
  const groups = useMemo(() => groupSiblings(txs), [txs])

  const base = useMemo(() => (filters.acct === 'all' ? txs : txs.filter((t) => t.account_id === filters.acct)), [txs, filters.acct])
  const inPeriod = useMemo(() => base.filter((t) => t.tx_date >= filters.period.from && t.tx_date <= filters.period.to), [base, filters.period])
  // This page is about expenses; income and results live in Relatórios.
  const per = useMemo(() => inPeriod.filter((t) => t.amount < 0), [inPeriod])

  const list = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    const l = per.filter((t) =>
      (!filters.cat || t.category === filters.cat) &&
      (!q || `${t.title} ${t.category} ${lookups.accountName(t.account_id)}`.toLowerCase().includes(q)))
    const s = [...l]
    if (filters.sort === 'old') s.sort((a, b) => a.tx_date.localeCompare(b.tx_date))
    else if (filters.sort === 'high') s.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    else if (filters.sort === 'low') s.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))
    return s
  }, [per, filters, lookups])

  const { rows, pager } = usePaged(list, 10)
  const cats = useMemo(() => [...new Set(per.map((t) => t.category))], [per])

  const recs = useMemo(() => (recQ.data ?? []).filter((r) => r.active && (filters.acct === 'all' || splitsOf(r).some((s) => s.account_id === filters.acct))), [recQ.data, filters.acct])
  const debts = useMemo(() => (debtQ.data ?? []).filter((d) => filters.acct === 'all' || splitsOf(d).some((s) => s.account_id === filters.acct)), [debtQ.data, filters.acct])

  if (txQ.isLoading || accQ.isLoading || balQ.isLoading || catQ.isLoading) return <Loading />
  const err = txQ.error ?? accQ.error ?? balQ.error ?? catQ.error ?? recQ.error ?? debtQ.error
  if (err) return <ErrorState error={err} />

  const patch = (p: Partial<Filters>) => setUrlParams({ ...filtersToParams(p), page: null })
  const clear = () => setUrlParams({ ...filtersToParams(defaultFilters()), page: null })
  const close = () => setModal(null)
  const balance = (filters.acct === 'all' ? balances : balances.filter((b) => b.id === filters.acct)).reduce((a, b) => a + b.balance, 0)
  const totalExpenses = -per.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0)
  const openTx = (tx: Transaction, back?: string) => setModal({ k: 'tx', tx, back })

  return (
    <div className="flex flex-col gap-4 wide:gap-5">
      <MoneyHeader start={start} filters={filters} accounts={accounts.filter((a) => a.active)} filtered={isFiltered(filters)} canWrite={canWrite} onChange={patch} onClear={clear} onNew={() => openFin()} />
      <Kpis per={per} balance={balance} accountCount={filters.acct === 'all' ? accounts.length : 1} />
      <AccountsCard accounts={filters.acct === 'all' ? accounts : accounts.filter((a) => a.id === filters.acct)} balances={balances} txs={inPeriod} />
      <CategoriesCard per={per} lookups={lookups} group={group} onGroup={setGroup} onPick={(cat) => setModal({ k: 'cat', cat })} />
      <Commitments tab={tab} onTab={setTab} recs={recs} debts={debts} lookups={lookups} canWrite={canWrite}
        onAdd={() => setModal(tab === 'rec' ? { k: 'rec', item: null } : { k: 'debt', item: null })}
        onEditRec={(item) => setModal({ k: 'rec', item })} onEditDebt={(item) => setModal({ k: 'debt', item })}
        onPayRec={(item) => setModal({ k: 'payRec', item })} onPayDebt={(item) => setModal({ k: 'payDebt', item })} />
      <TransactionsCard rows={rows} pager={pager} total={list.length} categories={cats} filters={filters} onFilters={patch}
        lookups={lookups} groups={groups} withFiles={withFiles} onOpen={(t) => openTx(t)} />

      {modal?.k === 'tx' && <TxDetailSheet tx={modal.tx} all={txs} lookups={lookups} onClose={close} onBack={modal.back ? () => setModal({ k: 'cat', cat: modal.back! }) : undefined} />}
      {modal?.k === 'cat' && (
        <CategorySheet category={modal.cat} rows={per.filter((t) => t.category === modal.cat && t.amount < 0)} totalExpenses={totalExpenses} lookups={lookups} onClose={close}
          onOpenTx={(t) => openTx(t, modal.cat)} onFilter={() => { patch({ cat: modal.cat }); close() }} />
      )}
      {modal?.k === 'rec' && <RecurringSheet item={modal.item} onClose={close} />}
      {modal?.k === 'debt' && <DebtSheet item={modal.item} onClose={close} />}
      {modal?.k === 'payRec' && <PayRecurringSheet item={modal.item} lookups={lookups} onClose={close} />}
      {modal?.k === 'payDebt' && <PayDebtSheet item={modal.item} lookups={lookups} onClose={close} />}
    </div>
  )
}
