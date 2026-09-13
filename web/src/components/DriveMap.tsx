import { useRoute, useNetwork } from '@/hooks/useApi'
import { driveMapSVG } from '@/svg/maps'

interface DriveMapProps {
  tripId?: number
  plan: Record<string, unknown>
}

export function DriveMap({ tripId, plan }: DriveMapProps) {
  const { data: route } = useRoute(tripId)
  const { data: network } = useNetwork()

  const svg = driveMapSVG(plan, route, network)
  if (!svg) {
    return (
      <div className="bg-paper border border-gray-200 rounded-xl p-8 text-center text-muted">
        暂无自驾路线数据
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
