import type { PlanOut } from "@/api/types";
import { useNetwork, useRoutes } from "@/hooks/useApi";
import { driveMapSVG, hikeMapSVG } from "@/svg/maps";
import { driveSummary, hikeSummary, mapData } from "@/utils/content";

export function RouteMaps({ plan }: { plan: PlanOut }) {
  const routes = useRoutes(),
    network = useNetwork();
  const data = mapData(routes.data, network.data);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        路线图仅供参考，请使用导航并核实实时路况。
      </p>
      {routes.error && <p role="status">路线暂时无法加载，显示示意图。</p>}
      <div
        dangerouslySetInnerHTML={{
          __html: driveMapSVG({ id: plan.id, drive: driveSummary(plan) }, data),
        }}
      />
      <div
        dangerouslySetInnerHTML={{
          __html: hikeMapSVG({ id: plan.id, hike: hikeSummary(plan) }, data),
        }}
      />
    </div>
  );
}
