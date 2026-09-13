import useSWR from 'swr'
import * as api from '@/api/client'
import type { TripDetailOut, PlanOut } from '@/api/types'

const fetcher = (url: string) => api.apiClient.get(url).then((res) => res.data)

export function MyTripsPage() {
  const { data: trips, error, isLoading, mutate } = useSWR<TripDetailOut[]>('/trips', fetcher)
  const { data: plans } = useSWR<PlanOut[]>('/plans', fetcher)

  const handleCreate = async (planId: string) => {
    await api.createTrip({ plan_id: planId })
    await mutate()
  }

  if (isLoading) return <div className="p-8 text-center">加载中…</div>
  if (error) return <div className="p-8 text-center text-coral">加载失败</div>

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">我的出行计划</h1>

      <div className="bg-card rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-bold mb-4">从公共方案创建</h2>
        <div className="flex flex-wrap gap-2">
          {plans?.map((plan) => (
            <button
              key={plan.id}
              onClick={() => handleCreate(plan.id)}
              className="bg-sky text-ink px-4 py-2 rounded-full font-bold text-sm"
            >
              + {plan.title}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {trips?.map((trip) => (
          <div key={trip.id} className="bg-card rounded-2xl p-4 shadow-sm">
            <div className="font-bold">{trip.content?.title || trip.snapshot?.title}</div>
            <div className="text-sm text-muted">状态：{trip.status} · 计划日期：{trip.planned_date || '未安排'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
