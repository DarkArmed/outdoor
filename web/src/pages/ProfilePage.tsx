import { useState, useEffect } from 'react'
import useSWR from 'swr'
import * as api from '@/api/client'
import type { ProfileOut, ProfileUpdate } from '@/api/types'

const fetcher = (url: string) => api.apiClient.get(url).then((res) => res.data)

export function ProfilePage() {
  const { data: profile, error, isLoading, mutate } = useSWR<ProfileOut>('/profile', fetcher)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (profile) {
      setForm({
        home_name: profile.home_name || '',
        home_city: profile.home_city || '',
        family_travelers: profile.family_travelers || [],
        child: profile.child || {},
        prefs: profile.prefs || {},
      })
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateProfile(form as ProfileUpdate)
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div className="p-8 text-center">加载中…</div>
  if (error) return <div className="p-8 text-center text-coral">加载失败</div>

  const child = (form.child || {}) as Record<string, unknown>
  const prefs = (form.prefs || {}) as Record<string, unknown>

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">家庭画像</h1>
      <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
        <label className="block">
          家的大致位置
          <input
            value={(form.home_name as string) || ''}
            onChange={(e) => setForm((p) => ({ ...p, home_name: e.target.value }))}
            className="w-full mt-1 px-4 py-2 rounded-xl border border-gray-300"
          />
        </label>
        <label className="block">
          城市
          <input
            value={(form.home_city as string) || ''}
            onChange={(e) => setForm((p) => ({ ...p, home_city: e.target.value }))}
            className="w-full mt-1 px-4 py-2 rounded-xl border border-gray-300"
          />
        </label>
        <label className="block">
          孩子小名
          <input
            value={(child.name as string) || ''}
            onChange={(e) => setForm((p) => ({ ...p, child: { ...child, name: e.target.value } }))}
            className="w-full mt-1 px-4 py-2 rounded-xl border border-gray-300"
          />
        </label>
        <label className="block">
          孩子出生年份
          <input
            type="number"
            value={(child.birthYear as number) || ''}
            onChange={(e) => setForm((p) => ({ ...p, child: { ...child, birthYear: Number(e.target.value) } }))}
            className="w-full mt-1 px-4 py-2 rounded-xl border border-gray-300"
          />
        </label>
        <label className="block">
          单程车程上限（小时）
          <input
            type="number"
            value={(prefs.maxDriveHoursOneWay as number) || ''}
            onChange={(e) => setForm((p) => ({ ...p, prefs: { ...prefs, maxDriveHoursOneWay: Number(e.target.value) } }))}
            className="w-full mt-1 px-4 py-2 rounded-xl border border-gray-300"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="bg-sky text-ink font-bold px-6 py-2 rounded-full disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </form>
    </div>
  )
}
