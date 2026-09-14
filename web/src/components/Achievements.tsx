import {
  useMilestones,
  useMyBadges,
  useNetwork,
  usePlans,
  useRoutes,
  useTrips,
} from "@/hooks/useApi";
import { buildBadgeViews, computeStats } from "@/utils/badges";
import { mapData, tripContent } from "@/utils/content";
import { footprintMapSVG } from "@/svg/maps";

export function BadgeWall() {
  const plans = usePlans(),
    trips = useTrips(),
    badges = useMyBadges(),
    milestones = useMilestones();
  if (plans.error || trips.error || badges.error || milestones.error)
    return <p role="alert">成就加载失败，请稍后重试。</p>;
  if (!plans.data || !trips.data || !badges.data || !milestones.data)
    return <p>加载中…</p>;
  const views = buildBadgeViews(
    plans.data,
    milestones.data,
    trips.data,
    badges.data.map((b) => b.badge_id),
  );
  const completed = [
    ...new Map(
      trips.data
        .filter((t) => t.status === "done")
        .map((t) => [t.plan_id, tripContent(t)]),
    ).values(),
  ];
  const stats = computeStats(completed);
  return (
    <>
      <div className="badge-wall">
        {views.map((b) => (
          <div
            key={b.id}
            className={`badge-cell${b.unlocked ? " unlocked" : ""}${b.milestone ? " milestone" : ""}`}
          >
            <div className="badge-icon">{b.icon}</div>
            <div className="badge-name">{b.unlocked ? b.name : "？？？"}</div>
          </div>
        ))}
      </div>
      <p className="stats-bar">
        已冒险 {stats.count} 次 · 徒步 {stats.km} km · 露营 {stats.camps} 晚
      </p>
    </>
  );
}
export function FootprintMap() {
  const plans = usePlans(),
    trips = useTrips(),
    routes = useRoutes(),
    network = useNetwork();
  if (plans.error || trips.error || routes.error)
    return <p role="alert">足迹加载失败。</p>;
  const svg = footprintMapSVG(
    trips.data?.filter((t) => t.status === "done").map((t) => t.plan_id) || [],
    mapData(routes.data, network.data, plans.data),
  );
  return (
    <>
      <h3>🗺️ 我们的足迹</h3>
      {svg ? (
        <div
          className="footprint-map"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p>暂无路线坐标，完成路线数据导入后即可查看足迹。</p>
      )}
    </>
  );
}
