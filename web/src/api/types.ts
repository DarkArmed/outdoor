import type { components } from './generated/api'

export type UserOut = components['schemas']['UserOut']
export type Token = components['schemas']['Token']
export type ProfileOut = components['schemas']['ProfileOut']
export type ProfileUpdate = components['schemas']['ProfileUpdate']

/** OpenAPI generator emits empty records for free-form dicts; widen them for real runtime data. */
type _PlanOut = components['schemas']['PlanOut']
export type PlanOut = _PlanOut & {
  badge?: { icon: string; name: string } | null
}

export type TripOut = components['schemas']['TripOut']
export type TripCreate = components['schemas']['TripCreate']
export type TripUpdate = components['schemas']['TripUpdate']
export type RouteOut = components['schemas']['RouteOut'] & {
  drive: Record<string, unknown>
  hike: Record<string, unknown>
}
export type NetworkOut = components['schemas']['NetworkOut'] & {
  ways: Array<Record<string, unknown> & { cls?: string; polyline?: number[][] }>
}
export type MilestoneOut = Omit<components['schemas']['MilestoneOut'], 'rule'> & {
  rule: Record<string, unknown>
}
export type GearItemState = components['schemas']['GearItemState']
export type GearStateBatch = components['schemas']['GearStateBatch']
export type TaskItemState = components['schemas']['TaskItemState']
export type TaskStateBatch = components['schemas']['TaskStateBatch']
export type CheckinOut = components['schemas']['CheckinOut']
export type BadgeUnlockOut = components['schemas']['BadgeUnlockOut']
export type UserRegister = components['schemas']['UserRegister']
export type BodyLogin = components['schemas']['Body_login_api_auth_login_post']

/** OpenAPI generator emits empty records for free-form dicts; widen them for real runtime data. */
type _TripDetailOut = components['schemas']['TripDetailOut']
export type TripDetailOut = Omit<_TripDetailOut, 'snapshot' | 'overrides' | 'content'> & {
  snapshot: Record<string, unknown>
  overrides: Record<string, unknown>
  content?: PlanOut
}
