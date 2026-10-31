import { useMemo, useState } from 'react'
import { useFarm } from '@/app/farm'
import { useAccountBalances, useAccounts, useBatchResults, useBatches, useTransactions } from '@/lib/queries'
import { Empty, ErrorState, Loading, PageHeader } from '@/ui'
import { AccountDetail } from './AccountDetail'
import { Batches } from './Batches'
import { CashFlow } from './CashFlow'
import { Spend } from './Spend'
import { KpiStrip, Waterfall } from './Summary'
import { Toolbar } from './Toolbar'
import { buildBuckets, cashRows, csvOf, downloadFile, periodRange, rangeLabel, statement, type Period } from './model'

export default function ReportsPage() {
  const { canSeeMoney } = useFarm()
  if (!canSeeMoney) return <Empty icon="lock" title="Sem acesso" sub="Os relatórios financeiros estão disponíveis apenas para proprietários e investidores." />
  return <Reports />
}

function Reports() {
  const tx = useTransactions()
  const accounts = useAccounts()
  const balances = useAccountBalances()
  const batches = useBatches()
  const results = useBatchResults()

  const [period, setPeriod] = useState<Period>('3m')
  const [custom, setCustom] = useState<[string, string]>(() => periodRange('3m'))
  const [acct, setAcct] = useState('all')

  const [F, T] = period === 'custom' ? custom : periodRange(period)

  const all = useMemo(() => tx.data ?? [], [tx.data])
  const accts = useMemo(() => accounts.data ?? [], [accounts.data])
  const scope = useMemo(() => (acct === 'all' ? accts : accts.filter((a) => a.id === acct)), [accts, acct])

  const per = useMemo(() => all.filter((t) => t.tx_date >= F && t.tx_date <= T && (acct === 'all' || t.account_id === acct)), [all, F, T, acct])
  const stmt = useMemo(() => statement(per, batches.data ?? []), [per, batches.data])
  const cash = useMemo(() => cashRows(scope, all, balances.data ?? [], F, T, accts), [scope, all, balances.data, F, T, accts])
  const { buckets, weekly } = useMemo(() => buildBuckets(F, T), [F, T])
  const totalSpend = useMemo(() => -per.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0), [per])

  if (tx.isPending || accounts.isPending || balances.isPending || batches.isPending || results.isPending) return <Loading />
  const err = tx.error ?? accounts.error ?? balances.error ?? batches.error ?? results.error
  if (err) return <ErrorState error={err} retry={() => { void tx.refetch(); void accounts.refetch(); void balances.refetch(); void batches.refetch(); void results.refetch() }} />

  const rangeText = rangeLabel(F, T)
  const filtered = period !== '3m' || acct !== 'all'

  const exportCsv = () => {
    const rows = [['Data', 'Descrição', 'Conta', 'Tipo', 'Categoria', 'Lote', 'Valor (MT)'],
      ...per.map((t) => [t.tx_date, t.title, accts.find((a) => a.id === t.account_id)?.name ?? '', t.kind, t.category,
        batches.data?.find((b) => b.id === t.batch_id)?.code ?? '', t.amount.toFixed(2).replace('.', ',')])]
    downloadFile(`relatorio-${F}_${T}.csv`, csvOf(rows), 'text/csv;charset=utf-8')
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Relatórios" sub={rangeText} right={
        <Toolbar period={period} from={F} to={T} onPeriod={setPeriod} onCustom={(f, t) => { setCustom([f, t]); setPeriod('custom') }}
          acct={acct} onAcct={setAcct} accounts={accts} filtered={filtered} rangeText={rangeText}
          onClear={() => { setPeriod('3m'); setAcct('all') }} onCsv={exportCsv} onPrint={() => window.print()} />
      } />
      <KpiStrip s={stmt} />
      <Waterfall s={stmt} />
      <CashFlow rows={cash} />
      <Spend key={`${acct}-${F}-${T}`} scope={scope} accts={accts} all={all} buckets={buckets} weekly={weekly} F={F} T={T} />
      <AccountDetail key={acct} scope={scope} accts={accts} balances={balances.data ?? []} all={all} F={F} T={T} totalSpend={totalSpend} />
      <Batches rows={results.data ?? []} />
    </div>
  )
}
