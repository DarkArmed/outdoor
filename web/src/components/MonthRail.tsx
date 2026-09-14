import { MONTHS } from "@/utils/date";
export function MonthRail({ onSelect }: { onSelect?: (key: string) => void }) {
  return (
    <nav className="month-rail" aria-label="月份时间轴">
      {MONTHS.map((m) => (
        <button
          key={m.key}
          onClick={() => onSelect?.(m.key)}
          className={`tl-node rail-${m.railClass}`}
        >
          <span className="tl-month block">{m.label}</span>
          <span className="tl-desc block">{m.desc}</span>
        </button>
      ))}
    </nav>
  );
}
