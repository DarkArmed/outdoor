import useSWR from 'swr'
import * as api from '@/api/client'
import type { PlanOut } from '@/api/types'

const fetcher = (url: string) => api.apiClient.get(url).then((res) => res.data)

export function HomePage() {
  const { data: plans, error, isLoading } = useSWR<PlanOut[]>('/plans', fetcher)

  if (isLoading) return <div className="p-8 text-center">加载中…</div>
  if (error) return <div className="p-8 text-center text-coral">加载失败</div>

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center mb-4">户外大冒险</h1>
      <p className="text-center text-muted mb-8">React 新版前端脚手架已跑通 🎉</p>

      <h2 className="text-xl font-bold mb-4">公共方案（{plans?.length || 0} 条）</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans?.map((plan) => (
          <a
            key={plan.id}
            href={`/plan/${plan.id}`}
            className="block bg-card rounded-2xl p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="text-2xl mb-2">{plan.emoji}</div>
            <div className="font-bold">{plan.title}</div>
            <div className="text-sm text-muted">{plan.date} · {plan.location}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
