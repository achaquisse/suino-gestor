import { useState } from 'react'
import { useUrlState } from '@/lib/urlState'
import { useFarm } from '@/app/farm'
import { numP } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { useParameters, useTableMutations } from '@/lib/queries'
import type { Parameter } from '@/lib/database.types'
import { PGROUPS } from '@/lib/constants'
import { Button, Chip, ErrorState, Field, FormError, Input, Loading, Sheet, useToast } from '@/ui'
import { DataTable, type Col } from './DataTable'

function ParamSheet({ param, onClose }: { param: Parameter | null; onClose: () => void }) {
  const { update } = useTableMutations('parameters')
  const toast = useToast()
  const [value, setValue] = useState(String(param?.value ?? ''))
  const [error, setError] = useState('')
  const [seen, setSeen] = useState(param)
  if (seen !== param) { setSeen(param); setValue(String(param?.value ?? '')); setError('') }

  const submit = async () => {
    const n = numP(value)
    if (!param || !Number.isFinite(n)) return setError('Indique um valor numérico.')
    try {
      await update.mutateAsync({ id: param.id, value: n })
      toast('Parâmetro actualizado')
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Sheet open={!!param} onClose={onClose} title={param?.name ?? ''} maxWidth={420}
      footer={<><Button className="flex-1" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="primary" loading={update.isPending} onClick={submit}>Guardar</Button></>}>
      <div className="flex flex-col gap-3.5">
        {param?.description && <p className="m-0 text-[13px] text-muted">{param.description}</p>}
        <Field label={`Valor${param?.unit ? ` (${param.unit})` : ''}`}>
          <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
        </Field>
        <FormError>{error}</FormError>
      </div>
    </Sheet>
  )
}

export default function ParamsTab() {
  const { isOwner } = useFarm()
  const params = useParameters()
  const [q, setQ] = useUrlState('q', '')
  const [grp, setGrp] = useUrlState('group', 'all')
  const [edit, setEdit] = useState<Parameter | null>(null)

  if (params.isLoading) return <Loading />
  if (params.error) return <ErrorState error={params.error} retry={() => params.refetch()} />

  const rows = (params.data ?? []).filter((p) => (grp === 'all' || p.grp === grp) && `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => PGROUPS.indexOf(a.grp) - PGROUPS.indexOf(b.grp))

  const cols: Col<Parameter>[] = [
    { head: 'Parâmetro', width: 'minmax(180px,1.2fr)', cell: (p) => <span className="flex min-w-0 flex-col"><span className="truncate font-semibold">{p.name}</span><span className="truncate text-xs text-muted">{p.description}</span></span> },
    { head: 'Grupo', width: '120px', cell: (p) => <Chip tone="neutral">{p.grp}</Chip> },
    { head: 'Valor', width: '120px', align: 'right', cell: (p) => <span className="tabular font-semibold">{String(p.value).replace('.', ',')} {p.unit}</span> },
  ]

  return (
    <>
      <DataTable title="Parâmetros" sub="Valores usados em previsões, alertas e cálculos"
        search={q} onSearch={setQ} filter={{ value: grp, onChange: setGrp, options: [['all', 'Todos os grupos'], ...PGROUPS.map((g) => [g, g] as const)] }}
        rows={rows} cols={cols} readOnly={!isOwner} emptyMsg="Nenhum parâmetro encontrado" minW={560} onEdit={setEdit} />
      <ParamSheet param={edit} onClose={() => setEdit(null)} />
    </>
  )
}
