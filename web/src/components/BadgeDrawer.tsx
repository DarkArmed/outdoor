import { useEffect } from 'react'
import { BadgeWall } from './BadgeWall'
import { FootprintMap } from './FootprintMap'

interface BadgeDrawerProps {
  open: boolean
  panel: 'badges' | 'footprint'
  onClose: () => void
  onChangePanel: (panel: 'badges' | 'footprint') => void
}

export function BadgeDrawer({ open, panel, onClose, onChangePanel }: BadgeDrawerProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-bold">成就</h2>
            <button onClick={onClose} className="text-2xl leading-none">×</button>
          </div>
          <div className="flex border-b">
            <button
              onClick={() => onChangePanel('badges')}
              className={`flex-1 py-3 font-bold ${panel === 'badges' ? 'text-sky border-b-4 border-sky' : 'text-muted'}`}
            >
              徽章墙
            </button>
            <button
              onClick={() => onChangePanel('footprint')}
              className={`flex-1 py-3 font-bold ${panel === 'footprint' ? 'text-sky border-b-4 border-sky' : 'text-muted'}`}
            >
              足迹地图
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {panel === 'badges' ? <BadgeWall /> : <FootprintMap />}
          </div>
        </div>
      </aside>
    </>
  )
}
