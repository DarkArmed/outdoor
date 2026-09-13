import { useParams } from 'react-router-dom'
import { usePlans, usePlan } from '@/hooks/useApi'
import { DetailRail } from '@/components/DetailRail'
import { SectionNav } from '@/components/SectionNav'
import { ItineraryTimeline, type ItineraryItem } from '@/components/ItineraryTimeline'
import { GearChecklist } from '@/components/GearChecklist'
import { TaskChecklist } from '@/components/TaskChecklist'
import { sceneSVG } from '@/svg/scenes'

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: plan, error, isLoading } = usePlan(id)
  const { data: allPlans } = usePlans()

  if (isLoading) return <div className="p-8 text-center">加载中…</div>
  if (error || !plan) return <div className="p-8 text-center text-coral">计划不存在</div>

  const typeClass = `type-${plan.type.charAt(0)}`

  return (
    <div className="bg-paper">
      {/* Hero */}
      <section className="text-center pt-3">
        <div
          className="mx-auto max-w-[620px]"
          dangerouslySetInnerHTML={{ __html: sceneSVG(plan.theme, plan.mom) }}
        />
        <h1 className="text-3xl font-bold mt-2">{plan.emoji} {plan.title}</h1>
        <div className="flex justify-center gap-2 mt-2 flex-wrap">
          <span className={`badge ${typeClass}`}>{plan.type}</span>
          <span className="badge">{plan.date}</span>
          <span className="badge">{plan.location}</span>
          {plan.mom && <span className="badge badge-mom">👩 妈妈同行</span>}
        </div>
      </section>

      <SectionNav />

      <div className="max-w-[1560px] mx-auto px-4 py-6 flex gap-6">
        {allPlans && <DetailRail plans={allPlans.filter((p) => !p.archived)} currentId={plan.id} />}

        <div className="flex-1 space-y-8">
          {/* Goal + Tips */}
          <section id="goal" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">本周目标</h2>
            <p className="text-lg mb-4">{plan.goal}</p>
            {plan.tips && plan.tips.length > 0 && (
              <div className="bg-sky/20 rounded-xl p-4">
                <h3 className="font-bold mb-2">爸爸的小抄</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {plan.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Tasks */}
          {plan.tasks && plan.tasks.length > 0 && (
            <section id="tasks" className="bg-card rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">小勇士任务</h2>
              <TaskChecklist tasks={plan.tasks} />
            </section>
          )}

          {/* Itinerary */}
          <section id="itinerary" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">行程安排</h2>
            <ItineraryTimeline items={plan.itinerary as ItineraryItem[] | ItineraryItem[][]} dayNames={plan.day_names as string[] | undefined} />
          </section>

          {/* Route */}
          <section id="route" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">路线</h2>
            <div className="bg-paper border border-gray-200 rounded-xl p-8 text-center text-muted">
              地图占位（后续从 site/js/maps.js 移植真实地理路线图）
            </div>
          </section>

          {/* Gear */}
          <section id="gear" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">本周必带装备</h2>
            {plan.gear && (
              <GearChecklist base={plan.gear.base || []} special={plan.gear.special || []} />
            )}
          </section>

          {/* Safety */}
          <section id="safety" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">安全要点</h2>
            <ul className="list-disc pl-5 space-y-2">
              {plan.safety?.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </section>

          {/* Review */}
          <section id="review" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">回顾</h2>
            <ul className="list-disc pl-5 space-y-2">
              {plan.review?.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
