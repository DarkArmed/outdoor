import { useState } from 'react'

interface TaskChecklistProps {
  tasks: string[]
}

export function TaskChecklist({ tasks }: TaskChecklistProps) {
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  return (
    <div className="space-y-2">
      {tasks.map((task, idx) => (
        <label key={idx} className="flex items-center gap-3 p-3 bg-card rounded-xl cursor-pointer border-2 border-sun">
          <input
            type="checkbox"
            className="w-5 h-5 accent-sun"
            checked={!!checked[idx]}
            onChange={(e) => setChecked((p) => ({ ...p, [idx]: e.target.checked }))}
          />
          <span className="font-bold">{task}</span>
        </label>
      ))}
    </div>
  )
}
