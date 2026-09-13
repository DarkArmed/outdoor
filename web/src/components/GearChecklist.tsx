import { useState } from 'react'

interface GearChecklistProps {
  base: string[]
  special: string[]
}

export function GearChecklist({ base, special }: GearChecklistProps) {
  const items = [...base, ...special]
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  const checkedCount = Object.values(checked).filter(Boolean).length
  const progress = items.length ? (checkedCount / items.length) * 100 : 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-grass transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm font-bold">{checkedCount}/{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <label key={idx} className="flex items-center gap-3 p-2 bg-card rounded-xl cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 accent-grass-dk"
              checked={!!checked[idx]}
              onChange={(e) => setChecked((p) => ({ ...p, [idx]: e.target.checked }))}
            />
            <span className={checked[idx] ? 'line-through text-muted' : ''}>{item}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
