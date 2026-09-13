import { useRoute } from '@/hooks/useApi'
import { hikeMapSVG } from '@/svg/maps'

interface HikeMapProps {
  tripId?: number
  plan: Record<string, unknown>
}

export function HikeMap({ tripId, plan }: HikeMapProps) {
  const { data: route } = useRoute(tripId)

  const svg = hikeMapSVG(plan, route)
  if (!svg) {
    return (
      <div className="bg-paper border border-gray-200 rounded-xl p-8 text-center text-muted">
        暂无徒步路线数据
      </div>
    )
  }

  return (
    <div
      className="bg-paper border border-gray-200 rounded-xl overflow-hidden"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
