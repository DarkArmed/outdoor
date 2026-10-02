import { actIconSVG } from "@/svg/scenes";
export interface ItineraryItem {
  time: string;
  text: string;
}
export function ItineraryTimeline({
  items,
  dayNames,
}: {
  items: ItineraryItem[] | ItineraryItem[][];
  dayNames?: string[];
}) {
  const days = Array.isArray(items[0])
    ? (items as ItineraryItem[][])
    : [items as ItineraryItem[]];
  return (
    <>
      {days.map((day, idx) => (
        <div key={idx}>
          {days.length > 1 && (
            <h3 className="it-day">
              📅 {dayNames?.[idx] || `第 ${idx + 1} 天`}
            </h3>
          )}
          <div className="itinerary">
            {day.map((item, i) => (
              <div key={i} className="it-item">
                <span
                  className="it-icon"
                  dangerouslySetInnerHTML={{ __html: actIconSVG(item.text) }}
                />
                <div className="it-text">
                  <span className="it-time">{item.time}</span>
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
