import { Link } from 'react-router-dom'
import type { PlanOut } from '@/api/types'
import { sceneSVG } from '@/svg/scenes'

interface DetailRailProps {
  plans: PlanOut[]
  currentId: string
}

export function DetailRail({ plans, currentId }: DetailRailProps) {
  return (
    <nav className="hidden lg:flex flex-col gap-3 w-64 sticky top-24 self-start max-h-[80vh] overflow-y-auto pr-2">
      {plans.map((p) => (
        <Link
          key={p.id}
          to={`/plan/${p.id}`}
          className={`flex items-center gap-3 p-2 rounded-xl transition ${
            p.id === currentId ? 'bg-sun/20' : 'hover:bg-gray-100'
          }`}
        >
          <div
            className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
            dangerouslySetInnerHTML={{ __html: sceneSVG(p.theme, p.mom) }}
          />
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{p.title}</div>
            <div className="text-xs text-muted">{p.date}</div>
          </div>
        </Link>
      ))}
    </nav>
  )
}
