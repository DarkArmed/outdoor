import { useEffect, useState } from 'react'

const SECTIONS = [
  { id: 'goal', label: '目标' },
  { id: 'itinerary', label: '行程' },
  { id: 'route', label: '路线' },
  { id: 'gear', label: '装备' },
  { id: 'safety', label: '安全' },
  { id: 'review', label: '回顾' },
]

export function SectionNav() {
  const [active, setActive] = useState('goal')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        })
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    )

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <nav className="sticky top-0 z-10 bg-paper/90 backdrop-blur py-3 border-b border-gray-200">
      <div className="flex gap-2 overflow-x-auto">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${
              active === s.id ? 'bg-sun text-ink' : 'bg-card text-muted'
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
