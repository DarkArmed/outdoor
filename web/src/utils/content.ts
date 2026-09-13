import type { PlanOut, TripOut } from "@/api/types";
import type { Coord, DriveSummary, HikeSummary, MapData } from "@/svg/maps";

export function tripContent(trip: TripOut, fallback?: PlanOut): PlanOut {
  return {
    ...fallback,
    ...trip.snapshot,
    ...trip.overrides,
    id: trip.plan_id,
  } as PlanOut;
}
export const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
const text = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const coord = (value: unknown): value is Coord =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((x) => typeof x === "number" && Number.isFinite(x));
const coords = (value: unknown): Coord[] =>
  Array.isArray(value) ? value.filter(coord) : [];
function spot(value: unknown) {
  const x = record(value);
  return coord(x.coord)
    ? {
        coord: x.coord,
        name: text(x.name),
        icon: text(x.icon),
        act: text(x.act),
      }
    : null;
}
export function mapData(
  routes: { plan_id: string; drive: unknown; hike: unknown }[] = [],
  network?: unknown,
  plans: PlanOut[] = [],
): MapData {
  const mapped: NonNullable<MapData["routes"]> = Object.fromEntries(
    routes.map((r) => {
      const d = record(r.drive),
        h = record(r.hike),
        from = spot(d.from),
        to = spot(d.to);
      const polyline = coords(d.polyline);
      const spots = Array.isArray(h.spots)
        ? h.spots.map(spot).filter((x) => x !== null)
        : [];
      return [
        r.plan_id,
        {
          drive:
            from && to && polyline.length >= 2
              ? {
                  from,
                  to,
                  polyline,
                  distance: Number(d.distance) || 0,
                  duration: Number(d.duration) || 0,
                  landmarks: Array.isArray(d.landmarks)
                    ? d.landmarks.map(spot).filter((x) => x !== null)
                    : [],
                  roads: Array.isArray(d.roads)
                    ? d.roads
                        .map(record)
                        .filter((x) => coord(x.point))
                        .map((x) => ({
                          name: text(x.name),
                          point: x.point as Coord,
                        }))
                    : [],
                }
              : null,
          hike: spots.length
            ? {
                title: text(h.title),
                length: text(h.length),
                spots,
                path: coords(h.path),
              }
            : null,
        },
      ];
    }),
  );
  const ways = record(network).ways;
  return {
    routes: mapped,
    network: {
      ways: Array.isArray(ways)
        ? ways
            .map(record)
            .map((w) => ({ cls: String(w.cls), polyline: coords(w.polyline) }))
        : [],
    },
    plans: plans.map((p) => ({
      ...p,
      title: text(p.title),
      date: text(p.date),
      location: text(p.location),
    })),
  };
}
export function driveSummary(plan: PlanOut): DriveSummary {
  return {
    from: text(plan.drive?.from || "家"),
    to: text(plan.drive?.to || plan.location),
    time: text(plan.drive?.time),
    km: Number(plan.drive?.km) || 0,
  };
}
export function hikeSummary(plan: PlanOut): HikeSummary | null {
  const h = record(plan.hike);
  if (!Array.isArray(h.waypoints) || !h.waypoints.length) return null;
  return {
    title: text(h.title),
    length: text(h.length),
    waypoints: h.waypoints
      .map(record)
      .map((p) => ({
        name: text(p.name),
        icon: text(p.icon),
        act: text(p.act),
      })),
  };
}
