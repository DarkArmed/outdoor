import { actIconSVG } from '@/svg/scenes'

export interface ItineraryItem {
  time: string
  text: string
}

interface ItineraryTimelineProps {
  items: ItineraryItem[] | ItineraryItem[][]
  dayNames?: string[]
}

export function ItineraryTimeline({ items, dayNames }: ItineraryTimelineProps) {
  const isMultiDay = Array.isArray(items[0])
  const days = isMultiDay ? (items as ItineraryItem[][]) : [items as ItineraryItem[]]

  return (
    <div className="space-y-6">
      {days.map((day, idx) => (
        <div key={idx}>
          {dayNames && <h4 className="font-bold text-lg mb-2">{dayNames[idx]}</h4>}
          <div className="relative pl-4 border-l-2 border-dashed border-gray-300 space-y-4">
            {day.map((it, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-10 h-10 flex-shrink-0"
                  dangerouslySetInnerHTML={{ __html: actIconSVG(it.text) }}
                />
                <div>
                  <span className="font-bold text-sm">{it.time}</span>
                  <span className="ml-2">{it.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
