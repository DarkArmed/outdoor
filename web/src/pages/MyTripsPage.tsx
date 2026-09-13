import { useState } from 'react'
import useSWR from 'swr'
import * as api from '@/api/client'
import type { TripDetailOut, PlanOut } from '@/api/types'
import { Link } from 'react-router-dom'

const fetcher = (url: string) => api.apiClient.get(url).then((res) => res.data)

export function MyTripsPage() {
  const { data: trips, error, isLoading, mutate } = useSWR<TripDetailOut[]>('/trips', fetcher)
  const { data: plans } = useSWR<PlanOut[]>('/plans', fetcher)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlan) return
    setCreating(true)
    try {
      await api.createTrip({ plan_id: selectedPlan, planned_date: plannedDate || undefined })
      await mutate()
      setSelectedPlan('')
      setPlannedDate('')
    } finally {
      setCreating(false)
    }
  }

  if (isLoading) return <div className="p-8 text-center">加载中…</div>
  if (error) return <div className="p-8 text-center text-coral">加载失败</div>

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">我的出行计划</h1>

      <form onSubmit={handleCreate} className="bg-card rounded-2xl p-6 shadow-sm mb-6 space-y-4">
        <h2 className="text-lg font-bold">从公共方案创建</h2>
        <div className="flex gap-3 flex-wrap">
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-300"
            required
          >
            <option value="">选择方案</option>
            {plans?.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.title}</option>
            ))}
          </select>
          <input
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-300"
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-sky text-ink px-4 py-2 rounded-full font-bold disabled:opacity-50"
          >
            {creating ? '创建中…' : '创建'}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {trips?.map((trip) => {
          const content = (trip.content || trip.snapshot || {}) as Record<string, unknown>
          return (
            <Link
              key={trip.id}
              to={`/plan/${trip.plan_id}`}
              className="block bg-card rounded-2xl p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="font-bold">{content.title as string}</div>
              <div className="text-sm text-muted">
                状态：{trip.status} · 计划日期：{trip.planned_date || '未安排'}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
