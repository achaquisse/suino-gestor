import { useState } from 'react'
import { useFarm } from '@/app/farm'
import { Icon } from '@/ui'
import { cx } from '@/ui'
import GeneralTab from './GeneralTab'
import AccountsTab from './AccountsTab'
import CategoriesTab from './CategoriesTab'
import ParamsTab from './ParamsTab'

type Tab = 'geral' | 'contas' | 'tipos' | 'params'

export default function SettingsPage() {
  const { canSeeMoney } = useFarm()
  const [tab, setTab] = useState<Tab>('geral')
  const tabs: [Tab, string, string][] = [
    ['geral', 'Geral', 'tune'],
    ...(canSeeMoney ? ([['contas', 'Contas', 'account_balance'], ['tipos', 'Tipos de custo', 'category']] as [Tab, string, string][]) : []),
    ['params', 'Parâmetros', 'settings_suggest'],
  ]
  const active = tabs.some(([v]) => v === tab) ? tab : 'geral'

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3.5">
        <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em] animate-pf-up">Definições</h1>
        <div role="tablist" className="flex max-w-full flex-wrap gap-1 self-start rounded-[14px] bg-[#EEEEF5] p-1">
          {tabs.map(([v, l, icon]) => (
            <button key={v} type="button" role="tab" aria-selected={v === active} onClick={() => setTab(v)}
              className={cx('flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[11px] border-0 px-3.5 text-sm font-semibold transition-colors',
                v === active ? 'bg-white text-ink shadow-[0_1px_2px_rgba(22,22,40,0.08),0_0_0_1px_#ECECF3]' : 'bg-transparent text-muted')}>
              <Icon name={icon} size={18} />{l}
            </button>
          ))}
        </div>
      </header>
      {active === 'geral' && <GeneralTab />}
      {active === 'contas' && <AccountsTab />}
      {active === 'tipos' && <CategoriesTab />}
      {active === 'params' && <ParamsTab />}
    </div>
  )
}
