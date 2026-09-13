import { usePlans, useTrips, useRoutes, useNetwork } from '@/hooks/useApi'
import { footprintMapSVG } from '@/svg/maps'

export function FootprintMap() {
  const { data: plans } = usePlans()
  const { data: trips } = useTrips()
  const { data: routes } = useRoutes()
  const { data: network } = useNetwork()

  if (!plans || !trips || !routes) {
    return <div className="p-8 text-center text-muted">加载中…</div>
  }

  const doneIds = trips.filter((t) => t.status === 'done').map((t) => t.plan_id)
  const routeMap: Record<string, (typeof routes)[number]> = {}
  for (const r of routes) {
    routeMap[r.plan_id] = r
  }

  const svg = footprintMapSVG(plans, routeMap, doneIds, network || undefined)
  if (!svg) {
    return <div className="text-center text-muted">暂无足迹数据</div>
  }

  return <div className="rounded-2xl overflow-hidden border border-gray-200" dangerouslySetInnerHTML={{ __html: svg }} />
}
