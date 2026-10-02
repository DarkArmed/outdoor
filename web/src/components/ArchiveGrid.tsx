import type { PlanOut } from "@/api/types";
import { PlanCard } from "./PlanCard";
export function ArchiveGrid({ plans }: { plans: PlanOut[] }) {
  const archived = plans.filter((p) => p.archived);
  return (
    <section id="archive-section" aria-label="备用计划">
      <h2>📦 备用计划</h2>
      <p className="muted">去过的、暂缓的计划放这里，以后改期还能用</p>
      <div className="plan-grid">
        {archived.length ? (
          archived.map((p) => <PlanCard key={p.id} plan={p} fluid />)
        ) : (
          <p className="muted">暂无</p>
        )}
      </div>
    </section>
  );
}
