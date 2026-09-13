/** Renderer inputs, independent of API fetching and page state. Coordinates are GCJ-02. */
export type Coord = [number, number]
export type Bounds = [number, number, number, number]
export type Projection = (coord: Coord) => Coord

export interface MapSpot {
  name: string
  coord: Coord
  icon?: string
  act?: string
}

export interface DriveRoute {
  polyline: Coord[]
  from: MapSpot
  to: MapSpot
  distance: number
  duration: number
  landmarks?: (MapSpot & { icon: string })[]
  roads?: { name: string; point: Coord }[]
}

export interface HikeRoute {
  title: string
  length?: string
  spots: MapSpot[]
  path?: Coord[]
}

export interface MapRoute {
  drive?: DriveRoute | null
  hike?: HikeRoute | null
}

export interface MapNetwork {
  ways: { cls: string; polyline: Coord[] }[]
}

export interface DriveSummary {
  from?: string
  to: string
  time: string
  km: number
}

export interface HikeSummary {
  title: string
  length?: string
  waypoints: Omit<MapSpot, 'coord'>[]
}

export interface FootprintPlan {
  id: string
  location: string
  title: string
  date: string
  archived?: boolean
}

export interface MapData {
  routes?: Readonly<Record<string, MapRoute | undefined>>
  network?: MapNetwork | null
  plans?: readonly FootprintPlan[]
}
