import { usePlans, useTrips, useMilestones, useMyBadges } from '@/hooks/useApi'
import { buildBadgeViews, computeStats } from '@/utils/badges'

export function BadgeWall() {
  const { data: plans } = usePlans()
  const { data: trips } = useTrips()
  const { data: milestones } = useMilestones()
  const { data: myBadges } = useMyBadges()

  if (!plans || !trips || !milestones || !myBadges) {
    return <div className="p-8 text-center text-muted">加载中…</div>
  }

  const unlockedIds = myBadges.map((b) => b.badge_id)
  const views = buildBadgeViews(plans, milestones, trips, unlockedIds)
  const donePlans = trips
    .filter((t) => t.status === 'done')
    .map((t) => t.content)
    .filter(Boolean) as typeof plans
  const stats = computeStats(donePlans)

  return (
    <div className="space-y-6">
      <div className="text-center text-sm font-bold text-ink bg-paper py-3 rounded-xl">
        已冒险 {stats.count} 次 · 徒步 {stats.km} km · 露营 {stats.camps} 晚
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        {views.map((b) => (
          <div
            key={b.id}
            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition ${
              b.unlocked
                ? 'bg-white border-sun'
                : 'bg-paper border-gray-200 opacity-70'
            }`}
          >
            <div className="text-3xl">{b.unlocked ? b.icon : '🔒'}</div>
            <div className="text-xs font-bold text-center">
              {b.unlocked ? b.name : '???'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
