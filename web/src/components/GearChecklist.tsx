import { useState, useEffect, useCallback } from 'react'
import { useGearStates, updateGearStates } from '@/hooks/useApi'

interface GearChecklistProps {
  tripId: number
  base: string[]
  special: string[]
}

export function GearChecklist({ tripId, base, special }: GearChecklistProps) {
  const items = [...base, ...special]
  const { data: serverStates, mutate } = useGearStates(tripId)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)

  // Sync server state into local UI
  useEffect(() => {
    if (!serverStates) return
    const next: Record<number, boolean> = {}
    for (const s of serverStates) {
      next[s.item_idx] = s.checked
    }
    setChecked(next)
  }, [serverStates])

  const handleToggle = useCallback(async (idx: number, value: boolean) => {
    setChecked((prev) => ({ ...prev, [idx]: value }))
    setSaving(true)
    try {
      const payload = items.map((_, i) => ({ item_idx: i, checked: i === idx ? value : !!checked[i] }))
      await updateGearStates(tripId, payload)
      await mutate()
    } catch (e) {
      // Roll back on error by re-syncing from server
      await mutate()
    } finally {
      setSaving(false)
    }
  }, [tripId, items, checked, mutate])

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
        {saving && <span className="text-xs text-muted">保存中…</span>}
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <label key={idx} className="flex items-center gap-3 p-2 bg-card rounded-xl cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 accent-grass-dk"
              checked={!!checked[idx]}
              onChange={(e) => handleToggle(idx, e.target.checked)}
            />
            <span className={checked[idx] ? 'line-through text-muted' : ''}>{item}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
