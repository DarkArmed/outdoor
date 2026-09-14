import type { PlanOut } from "@/api/types";
import { useNetwork, useRoutes } from "@/hooks/useApi";
import { driveMapSVG, hikeMapSVG } from "@/svg/maps";
import { driveSummary, hikeSummary, mapData } from "@/utils/content";
export function RouteMaps({ plan }: { plan: PlanOut }) {
  const routes = useRoutes(),
    network = useNetwork(),
    data = mapData(routes.data, network.data);
  const hike = hikeSummary(plan),
    hikeSvg = hikeMapSVG({ id: plan.id, hike }, data);
  return (
    <>
      {routes.error && <p role="status">路线暂时无法加载，显示示意图。</p>}
      <div className="map-block">
        <h3>
          🚗 自驾路线（{String(plan.drive?.from || "家")} →{" "}
          {String(plan.drive?.to || plan.location)}）
        </h3>
        <div
          dangerouslySetInnerHTML={{
            __html: driveMapSVG(
              { id: plan.id, drive: driveSummary(plan) },
              data,
            ),
          }}
        />
        <p className="map-note">
          真实地理数据（高德）卡通化渲染，可用于指路 · 导航仍推荐高德 App
        </p>
      </div>
      {hikeSvg && (
        <div className="map-block">
          <h3>🥾 {String(plan.hike?.title || "徒步路线")}</h3>
          <div dangerouslySetInnerHTML={{ __html: hikeSvg }} />
          <p className="map-note">标注关键地点与活动事项 · 数字 = 停留顺序</p>
        </div>
      )}
    </>
  );
}
