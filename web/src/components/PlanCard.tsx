import { Link } from 'react-router-dom'
import type { PlanOut } from '@/api/types'
import { sceneSVG } from '@/svg/scenes'

interface PlanCardProps {
  plan: PlanOut
  fluid?: boolean
}

export function PlanCard({ plan, fluid = false }: PlanCardProps) {
  const typeClass = `type-${plan.type.charAt(0)}`
  return (
    <Link
      to={`/plan/${plan.id}`}
      className={`block bg-card rounded-[20px] overflow-hidden shadow-[0_4px_0_rgba(0,0,0,0.10)] hover:-translate-y-1 hover:rotate-[-1deg] hover:border-sun transition border-[3px] border-transparent ${fluid ? 'w-full min-w-0' : 'min-w-[260px] w-[260px]'}`}
    >
      <div
        className="art"
        dangerouslySetInnerHTML={{ __html: sceneSVG(plan.theme, plan.mom) }}
      />
      <div className="p-3 pb-4">
        <div className="font-bold text-base">{plan.title}</div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className={`badge ${typeClass}`}>{plan.type}</span>
          <span className="badge">{plan.date}</span>
          <span className="badge">{plan.location}</span>
          <span className="badge">{String(plan.drive?.time ?? '')}</span>
          {plan.mom && <span className="badge badge-mom">👩 妈妈同行</span>}
          {plan.archived && <span className="badge archived">备用</span>}
        </div>
      </div>
    </Link>
  )
}
