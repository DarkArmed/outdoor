import type { PlanOut } from '@/api/types'
import { PlanCard } from './PlanCard'

export function ArchiveGrid({ plans }: { plans: PlanOut[] }) {
  const archived = plans.filter((plan) => plan.archived)
  return (
    <section aria-label="备用计划">
      <h2 className="text-2xl font-bold mb-4">备用计划</h2>
      {archived.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]">
          {archived.map((plan) => <PlanCard key={plan.id} plan={plan} fluid />)}
        </div>
      ) : <p className="text-muted">暂无</p>}
    </section>
  )
}
