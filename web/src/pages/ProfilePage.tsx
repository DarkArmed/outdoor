import { useState } from 'react'
import useSWR from 'swr'
import * as api from '@/api/client'
import type { ProfileOut } from '@/api/types'

const fetcher = (url: string) => api.apiClient.get(url).then((res) => res.data)

export function ProfilePage() {
  const { data: profile, error, isLoading, mutate } = useSWR<ProfileOut>('/profile', fetcher)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = Object.fromEntries(form.entries())
    setSaving(true)
    try {
      await api.updateProfile(data)
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div className="p-8 text-center">加载中…</div>
  if (error) return <div className="p-8 text-center text-coral">加载失败</div>

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">家庭画像</h1>
      <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-6 shadow-sm space-y-4">
        <label className="block">
          家的大致位置
          <input
            name="home_name"
            defaultValue={profile?.home_name || ''}
            className="w-full mt-1 px-4 py-2 rounded-xl border border-gray-300"
          />
        </label>
        <label className="block">
          城市
          <input
            name="home_city"
            defaultValue={profile?.home_city || ''}
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
