import { useEffect, useState } from "react";
const SECTIONS = [
  { id: "goal", label: "🎯 目标" },
  { id: "tasks", label: "🗡️ 任务" },
  { id: "itinerary", label: "🕐 行程" },
  { id: "route", label: "🗺️ 路线" },
  { id: "gear", label: "🎒 装备" },
  { id: "safety", label: "🛡️ 安全" },
  { id: "review", label: "📝 回顾" },
];
export function SectionNav({ hasTasks = true }: { hasTasks?: boolean }) {
  const [active, setActive] = useState("goal");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    SECTIONS.filter((s) => s.id !== "tasks" || hasTasks).forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [hasTasks]);
  return (
    <nav className="snav" aria-label="详情区块导航">
      {SECTIONS.filter((s) => s.id !== "tasks" || hasTasks).map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`snav-item${active === s.id ? " active" : ""}`}
          aria-current={active === s.id ? "location" : undefined}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
