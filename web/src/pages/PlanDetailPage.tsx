import { useParams } from 'react-router-dom'
import useSWR from 'swr'
import * as api from '@/api/client'
import type { PlanOut } from '@/api/types'

const fetcher = (url: string) => api.apiClient.get(url).then((res) => res.data)

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: plan, error, isLoading } = useSWR<PlanOut>(`/plans/${id}`, fetcher)

  if (isLoading) return <div className="p-8 text-center">加载中…</div>
  if (error || !plan) return <div className="p-8 text-center text-coral">计划不存在</div>

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{plan.emoji} {plan.title}</h1>
      <p className="text-muted mb-4">{plan.date} · {plan.location}</p>
      <div className="bg-card rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-2">本周目标</h2>
        <p>{plan.goal}</p>
      </div>
    </div>
  )
}
