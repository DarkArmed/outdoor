import { tripContent } from './content'
import type { PlanOut, MilestoneOut, TripOut } from '@/api/types'

export interface BadgeView {
  id: string
  icon: string
  name: string
  unlocked: boolean
  milestone: boolean
}

export function evaluateMilestone(m: MilestoneOut, donePlans: PlanOut[]): boolean {
  const rule = m.rule
  if (rule.firstType) {
    return donePlans.some((p) => p.type.startsWith(String(rule.firstType)))
  }
  if (typeof rule.count === 'number') {
    const count = rule.count
    return donePlans.length >= count
  }
  if (typeof rule.minKm === 'number') {
    const minKm = rule.minKm
    return donePlans.some((p) => {
      const km = (p.drive as Record<string, unknown>)?.km
      return typeof km === 'number' ? km >= minKm : false
    })
  }
  return false
}

export function buildBadgeViews(
  plans: PlanOut[],
  milestones: MilestoneOut[],
  trips: TripOut[],
  unlockedIds: string[]
): BadgeView[] {
  const donePlans = trips
    .filter((t) => t.status === 'done')
    .map((t) => tripContent(t))
    .filter(Boolean) as PlanOut[]

  const planBadges = plans
    .filter((p) => !p.archived && p.badge)
    .map((p) => ({
      id: p.id,
      icon: p.badge!.icon,
      name: p.badge!.name,
      unlocked: unlockedIds.includes(p.id) || trips.some((t) => t.plan_id === p.id && t.status === 'done'),
      milestone: false,
    }))

  const milestoneBadges = milestones.map((m) => ({
    id: m.id,
    icon: m.icon,
    name: m.name,
    unlocked: unlockedIds.includes(m.id) || evaluateMilestone(m, [...new Map(donePlans.map((p) => [p.id, p])).values()]),
    milestone: true,
  }))

  return [...planBadges, ...milestoneBadges]
}

export function computeStats(donePlans: PlanOut[]) {
  const count = donePlans.length
  const km = donePlans.reduce((sum, p) => {
    const hikeLen = (p.hike as Record<string, unknown>)?.length
    if (typeof hikeLen === 'string') {
      const match = /([\d.]+)\s*(?:km|公里)/i.exec(hikeLen)
      return sum + (match ? parseFloat(match[1]) : 0)
    }
    return sum
  }, 0)
  const camps = donePlans.filter((p) => p.type.startsWith('C')).length
  return { count, km: Math.round(km * 10) / 10, camps }
}
