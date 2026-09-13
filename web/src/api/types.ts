import type { components } from './generated/api'

export type UserOut = components['schemas']['UserOut']
export type Token = components['schemas']['Token']
export type ProfileOut = components['schemas']['ProfileOut']
export type ProfileUpdate = components['schemas']['ProfileUpdate']
export type PlanOut = components['schemas']['PlanOut']
export type TripOut = components['schemas']['TripOut']
export type TripCreate = components['schemas']['TripCreate']
export type TripUpdate = components['schemas']['TripUpdate']
export type RouteOut = components['schemas']['RouteOut']
export type NetworkOut = components['schemas']['NetworkOut']
export type MilestoneOut = components['schemas']['MilestoneOut']
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
