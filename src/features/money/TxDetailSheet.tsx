import { useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useFarm } from '@/app/farm'
import { fmt, dLong, initials, sgn } from '@/lib/format'
import { farmKey, signedUrl, uploadTransactionFile, useBatches, useInvalidateFarm, useTableMutations } from '@/lib/queries'
import { errorMessage, supabase } from '@/lib/supabase'
import type { Transaction, TransactionFile } from '@/lib/database.types'
import { Button, ConfirmSheet, Icon, IconTile, Sheet, cx, useToast } from '@/ui'
import { fileSize, siblingsOf, stampLabel, type Lookups } from './model'

function useSiblingFiles(ids: string[]) {
  const { farmId } = useFarm()
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: farmKey(farmId, 'transaction_files', id),
      queryFn: async () => {
        const { data, error } = await supabase.from('transaction_files').select('*').eq('transaction_id', id).order('created_at')
        if (error) throw error
        return data as TransactionFile[]
      },
    })),
  })
  const files = results.flatMap((r) => r.data ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at))
  return { files, loading: results.some((r) => r.isLoading) }
}

export default function TxDetailSheet({ tx, all, lookups, onClose, onBack }: { tx: Transaction; all: Transaction[]; lookups: Lookups; onClose: () => void; onBack?: () => void }) {
  const { isOwner, farmId } = useFarm()
  const batches = useBatches().data ?? []
  const toast = useToast()
  const invalidate = useInvalidateFarm()
  const { remove } = useTableMutations('transactions')
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState(false)
  const [uploading, setUploading] = useState(false)

  const sibs = siblingsOf(tx, all)
  const sum = sibs.reduce((a, x) => a + Math.abs(x.amount), 0)
  const { files } = useSiblingFiles(sibs.map((s) => s.id))
  const inc = tx.amount > 0
  const split = sibs.length > 1
  const pct = split ? Math.round((Math.abs(tx.amount) / sum) * 100) : null
  const batchIds = [...new Set(sibs.flatMap((s) => [...(s.batch_id ? [s.batch_id] : []), ...(s.batch_ids ?? [])]))]
  const allocations = sibs.flatMap((s) => Array.isArray(s.batch_allocations) ? s.batch_allocations : [])
  const batchName = (id: string) => batches.find((b) => b.id === id)?.code ?? id

  const info: { k: string; v: string; dot?: string }[] = [
    { k: 'Data', v: dLong(tx.tx_date) },
    { k: 'Categoria', v: tx.category, dot: lookups.categoryColor(tx.category) },
    { k: 'Conta', v: lookups.accountName(tx.account_id) + (pct ? ` · ${pct}%` : ''), dot: lookups.accountColor(tx.account_id) },
    { k: 'Tipo', v: tx.kind },
    ...(batchIds.length ? [{ k: 'Lotes', v: batchIds.map(batchName).join(', ') }] : []),
    ...(tx.quantity != null ? [{ k: 'Quantidade', v: `${fmt(sibs.reduce((n, s) => n + (s.quantity ?? 0), 0))} ${tx.quantity_unit ?? ''}` },
      { k: 'Preço por unidade', v: `${fmt(tx.unit_price ?? 0)} MT` }] : []),
  ]

  const open = async (f: TransactionFile) => {
    try { window.open(await signedUrl('attachments', f.path), '_blank', 'noopener') } catch (e) { toast(errorMessage(e), 'error') }
  }
  const download = async (f: TransactionFile) => {
    try {
      const res = await fetch(await signedUrl('attachments', f.path))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = f.name
      a.click()
      URL.revokeObjectURL(url)
      toast(`Descarregado · ${f.name}`)
    } catch (e) { toast(errorMessage(e), 'error') }
  }
  const upload = async (list: FileList | null) => {
    if (!list?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(list)) await uploadTransactionFile(farmId, tx.id, file)
      await invalidate()
      toast('Anexo adicionado')
    } catch (e) { toast(errorMessage(e), 'error') } finally { setUploading(false) }
  }
  const del = async () => {
    try {
      for (const s of sibs) await remove.mutateAsync(s.id)
      toast('Movimento eliminado')
      setConfirm(false)
      onClose()
    } catch (e) { toast(errorMessage(e), 'error') }
  }

  const lastFile = files.at(-1)
  const log = [
    { who: tx.created_by_name || '—', what: 'registou o movimento', when: stampLabel(tx.created_at) },
    ...(lastFile ? [{ who: tx.created_by_name || '—', what: `anexou ${files.length === 1 ? '1 ficheiro' : `${files.length} ficheiros`}`, when: stampLabel(lastFile.created_at) }] : []),
  ]

  return (
    <>
      <Sheet open onClose={onClose} onBack={onBack} title="Detalhe do movimento" maxWidth={560}
        footer={isOwner ? <Button variant="danger" icon="delete" onClick={() => setConfirm(true)}>Eliminar</Button> : undefined}>
        <div className="flex flex-col gap-4">
          <div className={cx('flex flex-col gap-1 rounded-2xl p-[18px]', inc ? 'bg-[#EAF7F0]' : 'bg-[#F7F7FB]')}>
            <span className="text-xs text-muted">{inc ? 'Receita' : 'Despesa'} · {tx.kind}</span>
            <span className={cx('tabular text-[28px] font-semibold tracking-[-0.02em]', inc && 'text-success')}>
              {sgn(tx.amount)} <span className="text-sm text-faint">MT</span>
            </span>
            <span className="font-medium">{tx.title}</span>
          </div>

          <div className="flex flex-col">
            {info.map((x) => (
              <div key={x.k} className="flex justify-between gap-3 border-t border-divider py-[9px] text-sm">
                <span className="text-muted">{x.k}</span>
                <span className="flex items-center gap-1.5 font-medium">
                  {x.dot && <span className="h-2 w-2 rounded-full" style={{ background: x.dot }} />}
                  {x.v}
                </span>
              </div>
            ))}
            {tx.notes && (
              <div className="flex justify-between gap-3 border-t border-divider py-[9px] text-sm">
                <span className="text-muted">Notas</span><span className="text-right font-medium">{tx.notes}</span>
              </div>
            )}
          </div>

          {allocations.length > 0 && <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-2">Distribuição por lote</span>
            {batchIds.map((id) => <div key={id} className="flex justify-between text-sm">
              <span>{batchName(id)}</span>
              <span className="tabular font-medium">{fmt(allocations.reduce<number>((n, a) => n + (a && typeof a === 'object' && !Array.isArray(a) && a.batch_id === id ? Number(a.amount) : 0), 0))} MT</span>
            </div>)}
          </div>}

          {split && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink-2">Divisão por conta</span>
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-md">
                {sibs.map((s) => <div key={s.id} style={{ width: `${(Math.abs(s.amount) / sum) * 100}%`, background: lookups.accountColor(s.account_id) }} />)}
              </div>
              {sibs.map((s) => (
                <div key={s.id} className={cx('flex items-center gap-2 text-[13px]', s.id === tx.id ? 'font-semibold' : 'font-normal')}>
                  <span className="h-2 w-2 rounded-full" style={{ background: lookups.accountColor(s.account_id) }} />
                  <span className="flex-1">{lookups.accountName(s.account_id)} · {Math.round((Math.abs(s.amount) / sum) * 100)}%</span>
                  <span className="tabular">{fmt(s.amount)} MT</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-2">Anexos · {files.length}</span>
              {isOwner && (
                <>
                  <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
                  <Button size="sm" variant="ghost" icon="attach_file" loading={uploading} className="text-accent-strong" onClick={() => fileRef.current?.click()}>Anexar</Button>
                </>
              )}
            </div>
            {!files.length && <div className="rounded-[14px] border-[1.5px] border-dashed border-line-strong p-3.5 text-center text-[13px] text-muted">Sem anexos</div>}
            {files.map((f) => {
              const img = f.mime.startsWith('image/')
              return (
                <div key={f.id} className="flex items-center gap-2.5 rounded-[13px] border border-line px-3 py-2.5">
                  <IconTile icon={img ? 'image' : 'picture_as_pdf'} bg={img ? '#E6F4F8' : '#FDECEA'} fg={img ? '#1F7894' : '#C0302A'} size={34} iconSize={18} className="rounded-[10px]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-muted">{fileSize(f.size_bytes)} · {tx.created_by_name || '—'}</div>
                  </div>
                  <button type="button" aria-label="Ver" onClick={() => open(f)} className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border-0 bg-transparent text-muted hover:bg-hover"><Icon name="visibility" size={18} /></button>
                  <button type="button" aria-label="Descarregar" onClick={() => download(f)} className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border-0 bg-transparent text-muted hover:bg-hover"><Icon name="download" size={18} /></button>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-2">Registo</span>
            {log.map((l, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong">{initials(l.who)}</span>
                <span className="flex-1 text-sm"><strong className="font-semibold">{l.who}</strong> {l.what}</span>
                <span className="whitespace-nowrap text-xs text-muted">{l.when}</span>
              </div>
            ))}
          </div>
        </div>
      </Sheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title="Eliminar movimento" danger confirmLabel="Eliminar" loading={remove.isPending}
        message={split ? `Este movimento está dividido em ${sibs.length} contas. Todas as partes serão eliminadas.` : 'O saldo da conta será ajustado. Esta acção não pode ser desfeita.'}
        onConfirm={del} />
    </>
  )
}
