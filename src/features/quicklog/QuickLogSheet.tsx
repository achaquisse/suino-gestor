import { useState, type ComponentType } from 'react'
import { useFarm } from '@/app/farm'
import { useOverlays, type LogContext } from '@/app/overlays'
import { LOG_TYPES, type LogType } from '@/lib/constants'
import { useAnimals, usePens } from '@/lib/queries'
import { Empty, ErrorState, Icon, Loading, Sheet } from '@/ui'
import { IllnessForm, TreatmentForm, WeightForm } from './HealthForms'
import { ActivityForm, BirthForm, DeathForm, MatingForm, TransferForm } from './HerdForms'
import { PurchaseForm, SaleForm } from './MoneyForms'
import type { FormProps } from './shared'

const FORMS: Partial<Record<LogType, ComponentType<FormProps>>> = {
  treatment: TreatmentForm, illness: IllnessForm, weight: WeightForm, transfer: TransferForm, birth: BirthForm,
  mating: MatingForm, death: DeathForm, sale: SaleForm, purchase: PurchaseForm, activity: ActivityForm,
}
const MONEY: LogType[] = ['sale', 'purchase', 'expense']

export default function QuickLogSheet({ type, ctx }: { type: LogType | 'menu'; ctx: LogContext }) {
  const { close, openLog } = useOverlays()
  const { canSeeMoney, canEditHerd } = useFarm()
  const [current, setCurrent] = useState<LogType | 'menu'>(type)
  const pens = usePens()
  const animals = useAnimals()

  const pick = (t: LogType) => {
    if (t === 'buyAnimals' || t === 'expense') return openLog(t, ctx)
    setCurrent(t)
  }

  const back = type === 'menu' ? () => setCurrent('menu') : undefined
  const Form = current === 'menu' ? undefined : FORMS[current]
  const gated = !canEditHerd || (MONEY.includes(current as LogType) && !canSeeMoney)

  if (gated) {
    return (
      <Sheet open onClose={close} title="Registar" onBack={current !== 'menu' ? back : undefined}>
        <Empty icon="lock" title="Sem permissão" sub="O seu perfil não permite registar esta operação." />
      </Sheet>
    )
  }

  if (current !== 'menu') {
    if (pens.isPending || animals.isPending) return <Sheet open onClose={close} title="Registar" onBack={back}><Loading /></Sheet>
    const err = pens.error ?? animals.error
    if (err) return <Sheet open onClose={close} title="Registar" onBack={back}><ErrorState error={err} retry={() => { void pens.refetch(); void animals.refetch() }} /></Sheet>
    if (!Form) return <Sheet open onClose={close} title="Registar" onBack={back}><Empty icon="construction" title="Indisponível" /></Sheet>
    return <Form ctx={ctx} onBack={back} onClose={close} />
  }

  const types = LOG_TYPES.filter((l) => canSeeMoney || !(MONEY.includes(l.id) || l.id === 'buyAnimals'))
  return (
    <Sheet open onClose={close} title="Registar">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
        {types.map((l) => (
          <button key={l.id} type="button" onClick={() => pick(l.id)}
            className="flex min-h-[92px] flex-col items-start gap-2.5 rounded-[14px] border border-line bg-white p-3.5 text-left transition-[transform,border-color,background] duration-[250ms] ease-pf hover:-translate-y-0.5 hover:border-accent hover:bg-[#F5F4FF] active:scale-[0.97]">
            <Icon name={l.icon} size={22} className="text-accent" />
            <span className="font-medium">{l.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
