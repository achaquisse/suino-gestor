import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFarm } from '@/app/farm'
import { supabase } from './supabase'
import type { Database, RpcArgs, RpcName, Split } from './database.types'

type Tables = Database['public']['Tables']
type Views = Database['public']['Views']
type TableName = keyof Tables
type ViewName = keyof Views

export const farmKey = (farmId: string, ...rest: unknown[]) => ['farm', farmId, ...rest] as const

function useFarmQuery<T>(key: unknown[], fn: (farmId: string) => Promise<T>, enabled = true) {
  const { farmId } = useFarm()
  return useQuery({ queryKey: farmKey(farmId, ...key), queryFn: () => fn(farmId), enabled })
}

async function selectAll<N extends TableName | ViewName>(
  name: N,
  farmId: string,
  order?: { column: string; ascending?: boolean },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from(name as 'pens') as any).select('*').eq('farm_id', farmId)
  if (order) q = q.order(order.column, { ascending: order.ascending ?? true })
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as (N extends TableName ? Tables[N]['Row'] : N extends ViewName ? Views[N]['Row'] : never)[]
}

const num = <T extends Record<string, unknown>>(rows: T[], keys: (keyof T)[]) =>
  rows.map((r) => {
    const o = { ...r }
    for (const k of keys) if (o[k] != null) (o as Record<keyof T, unknown>)[k] = Number(o[k])
    return o
  })

export const usePens = () => useFarmQuery(['pens'], (f) => selectAll('pens', f, { column: 'sort' }))
export const useAnimals = () =>
  useFarmQuery(['animals'], async (f) => {
    const { data, error } = await supabase.from('animals').select('*').eq('farm_id', f).is('removed_at', null).order('tag')
    if (error) throw error
    return num(data ?? [], ['weight_kg'])
  })
export const useAnimal = (tag: string | undefined) =>
  useFarmQuery(['animal', tag], async (f) => {
    const { data, error } = await supabase.from('animals').select('*').eq('farm_id', f).eq('tag', tag!).maybeSingle()
    if (error) throw error
    return data ? num([data], ['weight_kg'])[0] : null
  }, !!tag)
export const useAnimalEvents = (animalId: string | undefined) =>
  useFarmQuery(['events', 'animal', animalId], async () => {
    const { data, error } = await supabase.from('events').select('*').eq('animal_id', animalId!).order('event_date', { ascending: false }).order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }, !!animalId)
export const useWeights = (animalId: string | undefined) =>
  useFarmQuery(['weights', animalId], async () => {
    const { data, error } = await supabase.from('weights').select('*').eq('animal_id', animalId!).order('measured_on')
    if (error) throw error
    return num(data ?? [], ['kg'])
  }, !!animalId)
export const useCalendarEvents = (from: string, to: string) =>
  useFarmQuery(['events', 'calendar', from, to], async (f) => {
    const { data, error } = await supabase.from('events').select('*').eq('farm_id', f).eq('show_in_calendar', true)
      .gte('event_date', from).lte('event_date', to).order('event_date').order('created_at')
    if (error) throw error
    return data ?? []
  })
export const useTasks = (from?: string, to?: string) =>
  useFarmQuery(['tasks', from, to], async (f) => {
    let q = supabase.from('tasks').select('*').eq('farm_id', f)
    if (from) q = q.gte('due_date', from)
    if (to) q = q.lte('due_date', to)
    const { data, error } = await q.order('due_date').order('due_time', { nullsFirst: true })
    if (error) throw error
    return data ?? []
  })
export const useStock = () =>
  useFarmQuery(['stock'], async (f) => num(await selectAll('stock_items', f, { column: 'name' }), ['qty', 'max_qty', 'low_qty', 'unit_price']))
export const useAccounts = () =>
  useFarmQuery(['accounts'], async (f) => num(await selectAll('accounts', f, { column: 'created_at' }), ['initial_balance']))
export const useAccountBalances = (enabled = true) =>
  useFarmQuery(['account_balances'], async (f) => num(await selectAll('account_balances', f), ['initial_balance', 'balance']), enabled)
export const useCategories = () => useFarmQuery(['categories'], (f) => selectAll('categories', f, { column: 'created_at' }))
export const useBatches = (enabled = true) =>
  useFarmQuery(['batches'], async (f) => num(await selectAll('batches', f, { column: 'started_on', ascending: false }), ['opening_cost', 'opening_revenue']), enabled)
export const useBatchResults = (enabled = true) =>
  useFarmQuery(['batch_results'], async (f) => num(await selectAll('batch_results', f), ['cost', 'revenue']), enabled)
export const useTransactions = (enabled = true) =>
  useFarmQuery(['transactions'], async (f) => {
    const { data, error } = await supabase.from('transactions').select('*').eq('farm_id', f)
      .order('tx_date', { ascending: false }).order('created_at', { ascending: false })
    if (error) throw error
    return num(data ?? [], ['amount'])
  }, enabled)
export const useTransactionFiles = (txId: string | undefined) =>
  useFarmQuery(['transaction_files', txId], async () => {
    const { data, error } = await supabase.from('transaction_files').select('*').eq('transaction_id', txId!).order('created_at')
    if (error) throw error
    return data ?? []
  }, !!txId)
export const useRecurring = (enabled = true) =>
  useFarmQuery(['recurring'], async (f) => num(await selectAll('recurring_expenses', f, { column: 'next_due' }), ['amount']), enabled)
export const useDebts = (enabled = true) =>
  useFarmQuery(['debts'], async (f) => num(await selectAll('debts', f, { column: 'created_at' }), ['total', 'paid', 'installment']), enabled)
export const useParameters = () =>
  useFarmQuery(['parameters'], async (f) => num(await selectAll('parameters', f, { column: 'created_at' }), ['value']))
export const useMembers = () =>
  useFarmQuery(['members'], async (f) => {
    const { data, error } = await supabase.from('farm_members').select('*').eq('farm_id', f).order('created_at')
    if (error) throw error
    return data ?? []
  })
export const useInvites = () => useFarmQuery(['invites'], (f) => selectAll('farm_invites', f, { column: 'created_at' }))

/** Team names usable as assignees (members + pending invites). */
export function useTeamNames() {
  const members = useMembers().data ?? []
  const invites = useInvites().data ?? []
  const names = [...members.map((m) => m.display_name), ...invites.filter((i) => !i.accepted_at).map((i) => i.name)].filter(Boolean)
  return [...new Set(names)]
}

export function useParam(key: string, fallback: number) {
  const p = useParameters().data?.find((x) => x.key === key)
  return p ? p.value : fallback
}

export function useInvalidateFarm() {
  const qc = useQueryClient()
  const { farmId } = useFarm()
  return () => qc.invalidateQueries({ queryKey: ['farm', farmId] })
}

/** Call a domain RPC; `p_farm` is injected automatically when the function takes it. */
export function useRpc<N extends RpcName>(name: N) {
  const { farmId } = useFarm()
  const invalidate = useInvalidateFarm()
  return useMutation({
    mutationFn: async (args: Omit<RpcArgs<N>, 'p_farm'>) => {
      const payload = { p_farm: farmId, ...args } as Record<string, unknown>
      if (name === 'pay_recurring' || name === 'pay_debt' || name === 'create_farm' || name === 'accept_invites') delete payload.p_farm
      const { data, error } = await supabase.rpc(name, payload as never)
      if (error) throw error
      return data as Database['public']['Functions'][N]['Returns']
    },
    onSuccess: invalidate,
  })
}

type Insert<N extends TableName> = Tables[N]['Insert']
type Update<N extends TableName> = Tables[N]['Update']

/** Generic CRUD mutations for owner-managed tables. `farm_id` is injected on insert. */
export function useTableMutations<N extends TableName>(name: N) {
  const { farmId } = useFarm()
  const invalidate = useInvalidateFarm()
  const insert = useMutation({
    mutationFn: async (row: Omit<Insert<N>, 'farm_id'>) => {
      const { data, error } = await supabase.from(name).insert({ ...row, farm_id: farmId } as never).select().single()
      if (error) throw error
      return data as unknown as Tables[N]['Row']
    },
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Update<N> & { id: string }) => {
      const { error } = await supabase.from(name).update(patch as never).eq('id' as never, id as never)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(name).delete().eq('id' as never, id as never)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  return { insert, update, remove }
}

/** Insert a manual transaction, split across accounts. Returns the created ids. */
export function useCreateTransaction() {
  const { farmId, user } = useFarm()
  const invalidate = useInvalidateFarm()
  return useMutation({
    mutationFn: async (t: {
      tx_date: string; title: string; kind: Database['public']['Tables']['transactions']['Row']['kind']; category: string
      amount: number; batch_id?: string | null; notes?: string; splits: Split[]; files?: File[]
    }) => {
      const parts = splitAmounts(t.splits, t.amount)
      const rows = parts.map((p) => ({
        farm_id: farmId, tx_date: t.tx_date, title: t.title, kind: t.kind, category: t.category, amount: p.amount,
        account_id: p.account_id, batch_id: t.batch_id ?? null, notes: t.notes ?? '', created_by_name: user.name,
      }))
      const { data, error } = await supabase.from('transactions').insert(rows).select('id')
      if (error) throw error
      const ids = (data ?? []).map((r) => r.id)
      for (const file of t.files ?? []) await uploadTransactionFile(farmId, ids[0], file)
      return ids
    },
    onSuccess: invalidate,
  })
}

export function splitAmounts(splits: Split[], amount: number) {
  if (splits.length <= 1) return [{ account_id: splits[0]?.account_id ?? '', pct: 100, amount }]
  let left = amount
  return splits.map((s, i) => {
    const a = i === splits.length - 1 ? Math.round(left * 100) / 100 : Math.round(amount * s.pct) / 100
    left -= a
    return { account_id: s.account_id, pct: s.pct, amount: a }
  })
}

/** Storage keys reject many characters (accents, spaces, "º"); the original name is kept in the row. */
export const storageSafeName = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_')

/** Uploads an attachment and records it; removes the orphaned object if the row insert fails. */
export async function uploadTransactionFile(farmId: string, txId: string, file: File) {
  const path = `${farmId}/${txId}/${Date.now()}-${storageSafeName(file.name)}`
  const up = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type })
  if (up.error) throw up.error
  const ins = await supabase.from('transaction_files').insert({
    farm_id: farmId, transaction_id: txId, path, name: file.name, size_bytes: file.size, mime: file.type || 'application/octet-stream',
  })
  if (ins.error) {
    await supabase.storage.from('attachments').remove([path])
    throw ins.error
  }
}

export async function signedUrl(bucket: 'attachments' | 'animal-photos', path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
