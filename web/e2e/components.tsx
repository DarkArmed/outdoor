// Browser-only test fixture; not an application page or a production build entry.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ArchiveGrid } from '../src/components/ArchiveGrid'
import { SafetyBanner } from '../src/components/SafetyBanner'
import { BadgeDrawer, type BadgePanel } from '../src/components/BadgeDrawer'
import type { PlanOut } from '../src/api/types'
import '../src/index.css'

const archived: PlanOut = {
  id: 'archive', title: '山野备用计划', date: '9月', type: 'A 徒步', theme: 'hike',
  emoji: '🌲', location: '山野', archived: true, mom: false, goal: '', tips: [],
  itinerary: [], day_names: [], drive: { time: '1小时' }, hike: {}, gear: {},
  safety: [], review: [], badge: null, tasks: [], created_at: '', updated_at: '',
}

export function Fixture() {
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<BadgePanel>('badges')
  return (
    <main className="max-w-5xl mx-auto p-6">
      <button onClick={() => setOpen(true)} className="bg-sun px-5 py-2 rounded-full mb-6">打开成就面板</button>
      <ArchiveGrid plans={[archived, { ...archived, id: 'active', title: '非归档计划', archived: false }]} />
      <SafetyBanner />
      <BadgeDrawer open={open} panel={panel} onClose={() => setOpen(false)} onPanelChange={setPanel}
        badges={<p>徽章内容</p>} footprint={<p>足迹内容</p>} stats="已完成 1 次出行" />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><MemoryRouter><Fixture /></MemoryRouter></StrictMode>)
