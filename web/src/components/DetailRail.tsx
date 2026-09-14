import { Link } from "react-router-dom";
import type { PlanOut } from "@/api/types";
import { sceneSVG } from "@/svg/scenes";
export function DetailRail({
  plans,
  currentId,
}: {
  plans: PlanOut[];
  currentId: string;
}) {
  return (
    <nav className="month-rail detail-rail" aria-label="全赛季周计划时间轴">
      {[...plans]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((p) => (
          <Link
            key={p.id}
            to={`/plan/${p.id}`}
            className={`tl-week${p.id === currentId ? " current" : ""}`}
            aria-current={p.id === currentId ? "page" : undefined}
          >
            <span className="tl-date">
              {Number(p.id.slice(5, 7))}/{Number(p.id.slice(8, 10))}
            </span>
            <div
              className="tl-thumb"
              dangerouslySetInnerHTML={{ __html: sceneSVG(p.theme, p.mom) }}
            />
            <div className="tl-week-title">{p.title}</div>
          </Link>
        ))}
    </nav>
  );
}
