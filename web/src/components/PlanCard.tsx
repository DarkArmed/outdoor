import { Link } from "react-router-dom";
import type { PlanOut } from "@/api/types";
import { sceneSVG } from "@/svg/scenes";
export function PlanCard({
  plan,
  fluid = false,
}: {
  plan: PlanOut;
  fluid?: boolean;
}) {
  return (
    <Link
      to={`/plan/${plan.id}`}
      className={`plan-card ${fluid ? "w-full min-w-0" : ""}`}
    >
      <div
        className="art"
        dangerouslySetInnerHTML={{ __html: sceneSVG(plan.theme, plan.mom) }}
      />
      <div className="body">
        <div className="title">
          {plan.emoji} {plan.title}
        </div>
        <div className="badges">
          <span className={`badge type-${plan.type.charAt(0)}`}>
            {plan.type}
          </span>
          <span className="badge">🗓️ {plan.date}</span>
          <span className="badge">📍 {plan.location}</span>
          <span className="badge">🚗 {String(plan.drive?.time ?? "")}</span>
          {plan.mom && <span className="badge badge-mom">👩 妈妈同行</span>}
        </div>
      </div>
    </Link>
  );
}
