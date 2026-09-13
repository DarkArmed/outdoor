import { usePlans, useProfile } from '@/hooks/useApi'
import { PlanCard } from '@/components/PlanCard'
import { MonthRail } from '@/components/MonthRail'
import { sceneSVG } from '@/svg/scenes'
import { groupPlansByMonth, heroSubtitle, MONTHS, siteTitle } from '@/utils/date'

export function HomePage() {
  const { data: plans, error, isLoading } = usePlans()
  const { data: profile } = useProfile()

  if (isLoading) return <div className="p-8 text-center">加载中…</div>
  if (error) return <div className="p-8 text-center text-coral">加载失败</div>

  const activePlans = plans?.filter((p) => !p.archived) || []
  const archivedPlans = plans?.filter((p) => p.archived) || []
  const grouped = groupPlansByMonth(activePlans)
  const child = profile?.child as { name?: string; birthYear?: number } | undefined
  const age = child?.birthYear ? new Date().getFullYear() - child.birthYear : null

  const scrollToMonth = (key: string) => {
    const el = document.getElementById(`month-${key}`)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="bg-paper">
      {/* Hero */}
      <section className="text-center pt-4 pb-1 bg-gradient-to-b from-sky to-paper">
        <div
          className="mx-auto max-w-[560px]"
          dangerouslySetInnerHTML={{ __html: sceneSVG('hero', false) }}
        />
        <h1 className="mt-3 text-4xl font-bold text-ink drop-shadow-[2px_2px_0_#FFD93D]">
          {siteTitle(child?.name)}
        </h1>
        <p className="text-lg text-gray-700 mt-1">{heroSubtitle(child?.name, age, profile?.home_city)}</p>
      </section>

      {/* Main */}
      <div className="max-w-[1560px] mx-auto px-4 pb-12 flex gap-6">
        <MonthRail onSelect={scrollToMonth} />

        <div className="flex-1 space-y-8">
          {MONTHS.map((m) => (
            <section key={m.key} id={`month-${m.key}`} className="scroll-mt-4">
              <h2 className="text-2xl font-bold mb-4 pl-3 border-l-[8px] border-sun rounded">
                {m.label} · {m.desc}
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {grouped[m.key].map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            </section>
          ))}

          {/* Archive */}
          {archivedPlans.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4 pl-3 border-l-[8px] border-gray-400 rounded">备用计划</h2>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {archivedPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            </section>
          )}

          {/* Safety Banner */}
          <section className="bg-safety-bg border-[3px] border-dashed border-coral rounded-[20px] p-6 mt-10">
            <h3 className="font-bold text-lg mb-2">安全口诀</h3>
            <ul className="space-y-1">
              <li>不单独行动，紧跟大人</li>
              <li>天气变化快，雨衣要常备</li>
              <li>玩水先观察，深浅要知道</li>
              <li>迷路不要慌，原地等救援</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
