export const MONTHS = [
  { key: '2026-09', label: '9月', desc: '初秋玩水', railClass: 'sep' },
  { key: '2026-10', label: '10月', desc: '金秋山野', railClass: 'oct' },
  { key: '2026-11', label: '11月', desc: '红叶与露营', railClass: 'nov' },
  { key: '2026-12', label: '12月', desc: '冰雪冬季', railClass: 'dec' },
]

export function groupPlansByMonth<T extends { id: string; archived?: boolean }>(plans: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const month of MONTHS) {
    groups[month.key] = []
  }
  for (const plan of plans) {
    const monthKey = plan.id.slice(0, 7)
    if (groups[monthKey]) {
      groups[monthKey].push(plan)
    }
  }
  for (const month of MONTHS) {
    groups[month.key].sort((a, b) => a.id.localeCompare(b.id))
  }
  return groups
}

export function computeAge(birthYear?: number): number | null {
  if (!birthYear) return null
  return new Date().getFullYear() - birthYear
}

export function siteTitle(childName?: string): string {
  return childName ? `${childName}的户外大冒险` : '我们的户外大冒险'
}

export function heroSubtitle(childName?: string, age: number | null = null, city?: string): string {
  const parts: string[] = []
  if (childName) parts.push(`${childName}${age !== null ? `（${age}岁）` : ''}`)
  if (city) parts.push(`从${city}出发`)
  if (parts.length === 0) return '周末出发，探索自然'
  return `${parts.join('，')} · 周末出发，探索自然`
}
