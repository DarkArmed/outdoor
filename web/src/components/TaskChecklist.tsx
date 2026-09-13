import { useState, useEffect, useCallback } from 'react'
import { useTaskStates, updateTaskStates } from '@/hooks/useApi'

interface TaskChecklistProps {
  tripId: number
  tasks: string[]
  onAllChecked?: (allChecked: boolean) => void
}

export function TaskChecklist({ tripId, tasks, onAllChecked }: TaskChecklistProps) {
  const { data: serverStates, mutate } = useTaskStates(tripId)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!serverStates) return
    const next: Record<number, boolean> = {}
    for (const s of serverStates) {
      next[s.task_idx] = s.checked
    }
    setChecked(next)
  }, [serverStates])

  const allChecked = tasks.length > 0 && tasks.every((_, i) => checked[i])

  useEffect(() => {
    onAllChecked?.(allChecked)
  }, [allChecked, onAllChecked])

  const handleToggle = useCallback(async (idx: number, value: boolean) => {
    setChecked((prev) => ({ ...prev, [idx]: value }))
    setSaving(true)
    try {
      const payload = tasks.map((_, i) => ({ task_idx: i, checked: i === idx ? value : !!checked[i] }))
      await updateTaskStates(tripId, payload)
      await mutate()
    } catch (e) {
      await mutate()
    } finally {
      setSaving(false)
    }
  }, [tripId, tasks, checked, mutate])

  return (
    <div className="space-y-2">
      {saving && <div className="text-xs text-muted mb-1">保存中…</div>}
      {tasks.map((task, idx) => (
        <label key={idx} className="flex items-center gap-3 p-3 bg-card rounded-xl cursor-pointer border-2 border-sun">
          <input
            type="checkbox"
            className="w-5 h-5 accent-sun"
            checked={!!checked[idx]}
            onChange={(e) => handleToggle(idx, e.target.checked)}
          />
          <span className={checked[idx] ? 'line-through text-muted font-bold' : 'font-bold'}>{task}</span>
        </label>
      ))}
    </div>
  )
}
