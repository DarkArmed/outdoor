import { MONTHS } from '@/utils/date'

interface MonthRailProps {
  onSelect?: (key: string) => void
}

export function MonthRail({ onSelect }: MonthRailProps) {
  return (
    <nav className="sticky top-4 self-start flex flex-col items-center gap-6 py-4">
      {MONTHS.map((m) => (
        <button
          key={m.key}
          onClick={() => onSelect?.(m.key)}
          className="flex flex-col items-center group"
        >
          <span className="w-4 h-4 rounded-full bg-sun group-hover:scale-125 transition" />
          <span className="mt-1 font-bold text-sm">{m.label}</span>
          <span className="text-xs text-muted">{m.desc}</span>
        </button>
      ))}
    </nav>
  )
}
