import { useMemo } from 'react'
import { useFarm } from '@/app/farm'
import { setUrlParams, useUrlParams } from '@/lib/urlState'
import { useAccountBalances, useAccounts, useBatchResults, useBatches, useCategories, useTransactions } from '@/lib/queries'
import { Empty, ErrorState, Loading } from '@/ui'
import { AccountDetail } from './AccountDetail'
import { Batches } from './Batches'
import { Spend } from './Spend'
import { KpiStrip, ResultDetails, Waterfall } from './Summary'
import { Toolbar } from './Toolbar'
import { PERIODS, buildBuckets, csvOf, downloadFile, periodRange, rangeLabel, statement, type Period } from './model'

const ISO = /^\d{4}-\d{2}-\d{2}$/

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
  const categories = useCategories()
  const results = useBatchResults()

  const params = useUrlParams()
  const pRaw = params.get('period')
  const cFrom = params.get('from') ?? ''
  const cTo = params.get('to') ?? ''
  const customOk = ISO.test(cFrom) && ISO.test(cTo) && cFrom <= cTo
  const period: Period = pRaw === 'custom' ? (customOk ? 'custom' : '3m') : PERIODS.find(([k]) => k === pRaw)?.[0] ?? '3m'
  const acct = params.get('acct') || 'all'
  const chartReset = { hide: null, bucket: null, resultCat: null }
  const setPeriod = (p: Exclude<Period, 'custom'>) => setUrlParams({ period: p === '3m' ? null : p, from: null, to: null, ...chartReset })
  const setCustom = (f: string, t: string) => setUrlParams({ period: 'custom', from: f, to: t, ...chartReset })
  const setAcct = (a: string) => setUrlParams({ acct: a === 'all' ? null : a, acc: null, accPage: null, ...chartReset })

  const [F, T] = period === 'custom' ? [cFrom, cTo] : periodRange(period)

  const all = useMemo(() => tx.data ?? [], [tx.data])
  const accts = useMemo(() => accounts.data ?? [], [accounts.data])
  const scope = useMemo(() => (acct === 'all' ? accts : accts.filter((a) => a.id === acct)), [accts, acct])

  const per = useMemo(() => all.filter((t) => t.tx_date >= F && t.tx_date <= T && (acct === 'all' || t.account_id === acct)), [all, F, T, acct])
  const stmt = useMemo(() => statement(per, categories.data ?? []), [per, categories.data])
  const { buckets, weekly } = useMemo(() => buildBuckets(F, T), [F, T])
  const totalSpend = useMemo(() => -per.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0), [per])

  if (tx.isPending || accounts.isPending || balances.isPending || batches.isPending || categories.isPending || results.isPending) return <Loading />
  const err = tx.error ?? accounts.error ?? balances.error ?? batches.error ?? categories.error ?? results.error
  if (err) return <ErrorState error={err} retry={() => { void tx.refetch(); void accounts.refetch(); void balances.refetch(); void batches.refetch(); void categories.refetch(); void results.refetch() }} />

  const rangeText = rangeLabel(F, T)
  const filtered = period !== '3m' || acct !== 'all'

  const exportCsv = () => {
    const rows = [['Data', 'Descrição', 'Conta', 'Tipo', 'Categoria', 'Lote', 'Valor (MT)'],
      ...per.map((t) => [t.tx_date, t.title, accts.find((a) => a.id === t.account_id)?.name ?? '', t.kind, t.category,
        [...(t.batch_id ? [t.batch_id] : []), ...(t.batch_ids ?? [])].map((id) => batches.data?.find((b) => b.id === id)?.code ?? id).join('; '), t.amount.toFixed(2).replace('.', ',')])]
    downloadFile(`relatorio-${F}_${T}.csv`, csvOf(rows), 'text/csv;charset=utf-8')
  }

  return (
    <div className="flex flex-col gap-5">
      <Toolbar period={period} from={F} to={T} onPeriod={setPeriod} onCustom={setCustom}
        acct={acct} onAcct={setAcct} accounts={accts} filtered={filtered} rangeText={rangeText}
        onClear={() => setUrlParams({ period: null, from: null, to: null, acct: null, acc: null, accPage: null, ...chartReset })} onCsv={exportCsv} onPrint={() => window.print()} />
      <KpiStrip s={stmt} />
      <Waterfall s={stmt} />
      <ResultDetails s={stmt} per={per} categories={categories.data ?? []} accounts={accts} buckets={buckets} />
      <Spend key={`${acct}-${F}-${T}`} scope={scope} accts={accts} all={all} buckets={buckets} weekly={weekly} F={F} T={T} />
      <AccountDetail key={acct} scope={scope} accts={accts} balances={balances.data ?? []} all={all} F={F} T={T} totalSpend={totalSpend} />
      <Batches rows={results.data ?? []} />
    </div>
  )
}
