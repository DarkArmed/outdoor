import { useEffect, useId, useRef, type ReactNode } from 'react'

export type BadgePanel = 'badges' | 'footprint'

export interface BadgeDrawerProps {
  open: boolean
  panel: BadgePanel
  onClose: () => void
  onPanelChange: (panel: BadgePanel) => void
  badges: ReactNode
  footprint: ReactNode
  stats?: ReactNode
}

/** Controlled shell: pages supply badge/footprint content and own URL/API state. */
export function BadgeDrawer({ open, panel, onClose, onPanelChange, badges, footprint, stats }: BadgeDrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()

  useEffect(() => {
    const element = dialog.current!
    if (!open) {
      if (element.open) element.close()
      return
    }
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [open])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      className="badge-drawer"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="flex flex-col h-full bg-paper">
        <header className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
          <h2 id={`${id}-title`} className="text-xl font-bold">🎖️ 成就面板</h2>
          <button type="button" onClick={onClose} aria-label="关闭成就面板" className="px-3 py-1 rounded-full bg-gray-100">✕</button>
        </header>
        <div role="tablist" aria-label="成就分类" className="flex gap-2 px-5 py-3 bg-white border-b border-gray-200">
          {(['badges', 'footprint'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`${id}-${tab}-tab`}
              aria-controls={`${id}-${tab}-panel`}
              aria-selected={panel === tab}
              tabIndex={panel === tab ? 0 : -1}
              onClick={() => onPanelChange(tab)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const next = event.key === 'Home' ? 'badges' : event.key === 'End' ? 'footprint' : tab === 'badges' ? 'footprint' : 'badges'
                onPanelChange(next)
                document.getElementById(`${id}-${next}-tab`)?.focus()
              }}
              className={`px-4 py-2 rounded-full font-bold ${panel === tab ? 'bg-sky text-ink' : 'bg-gray-100 text-muted'}`}
            >{tab === 'badges' ? '🏅 徽章' : '🗺️ 足迹'}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-7">
          <section role="tabpanel" id={`${id}-badges-panel`} aria-labelledby={`${id}-badges-tab`} hidden={panel !== 'badges'} tabIndex={0}>
            {badges}
            {stats && <div className="mt-4 text-muted">{stats}</div>}
          </section>
          <section role="tabpanel" id={`${id}-footprint-panel`} aria-labelledby={`${id}-footprint-tab`} hidden={panel !== 'footprint'} tabIndex={0}>
            {footprint}
          </section>
        </div>
      </div>
    </dialog>
  )
}
