import { SWATCH } from '@/lib/constants'
import { cx } from '@/ui'

export function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SWATCH.map((c) => (
        <button key={c} type="button" aria-label={c} aria-pressed={value === c} onClick={() => onChange(c)}
          className={cx('h-8 w-8 rounded-full border-2 transition-transform', value === c ? 'scale-110 border-ink' : 'border-transparent')}
          style={{ background: c }} />
      ))}
    </div>
  )
}
