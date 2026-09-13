import { describe, it, expect } from 'vitest'
import { evaluateMilestone, buildBadgeViews, computeStats } from './badges'
import type { PlanOut, MilestoneOut, TripDetailOut } from '@/api/types'

const planA = {
  id: '2026-09-01_a',
  type: 'A',
  badge: { icon: '🌊', name: '溯溪小勇士' },
  drive: { km: 80 },
  hike: { length: '3.5 km' },
} as unknown as PlanOut

const planB = {
  id: '2026-09-08_b',
  type: 'B',
  badge: { icon: '⛰️', name: '徒步小勇士' },
  drive: { km: 120 },
  hike: { length: '5 km' },
} as unknown as PlanOut

const milestone: MilestoneOut = {
  id: 'm_first_a',
  icon: '🥾',
  name: '第一次溯溪',
  rule: { firstType: 'A' },
} as unknown as MilestoneOut

describe('badges utils', () => {
  it('evaluates firstType milestone', () => {
    expect(evaluateMilestone(milestone, [planA])).toBe(true)
    expect(evaluateMilestone(milestone, [planB])).toBe(false)
  })

  it('evaluates count milestone', () => {
    const m = { rule: { count: 2 } } as unknown as MilestoneOut
    expect(evaluateMilestone(m, [planA])).toBe(false)
    expect(evaluateMilestone(m, [planA, planB])).toBe(true)
  })

  it('evaluates minKm milestone', () => {
    const m = { rule: { minKm: 100 } } as unknown as MilestoneOut
    expect(evaluateMilestone(m, [planA])).toBe(false)
    expect(evaluateMilestone(m, [planB])).toBe(true)
  })

  it('builds badge views with plan and milestone badges', () => {
    const doneTrip = { status: 'done', plan_id: planA.id, snapshot: planA, overrides: {} } as unknown as TripDetailOut
    const views = buildBadgeViews([planA], [milestone], [doneTrip], [planA.id])
    expect(views).toHaveLength(2)
    const planBadge = views.find((v) => !v.milestone)
    expect(planBadge?.unlocked).toBe(true)
    const msBadge = views.find((v) => v.milestone)
    expect(msBadge?.unlocked).toBe(true)
  })

  it('computes stats from done plans', () => {
    const stats = computeStats([planA, planB])
    expect(stats.count).toBe(2)
    expect(stats.km).toBe(8.5)
    expect(stats.camps).toBe(0)
  })
})
