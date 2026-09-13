import useSWR, { mutate as globalMutate } from 'swr'
import { apiClient } from '@/api/client'
import type {
  PlanOut, ProfileOut, TripDetailOut, GearItemState, TaskItemState,
  BadgeUnlockOut, CheckinOut, RouteOut, NetworkOut, MilestoneOut,
} from '@/api/types'

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data)

export function usePlans(archived?: boolean) {
  return useSWR<PlanOut[]>(['/plans', archived], () => fetcher('/plans' + (archived !== undefined ? `?archived=${archived}` : '')))
}

export function usePlan(id?: string) {
  return useSWR<PlanOut>(id ? `/plans/${id}` : null, fetcher)
}

export function useProfile() {
  return useSWR<ProfileOut>('/profile', fetcher)
}

export function useTrips() {
  return useSWR<TripDetailOut[]>('/trips', fetcher)
}

export function useTrip(id?: number) {
  return useSWR<TripDetailOut>(id ? `/trips/${id}` : null, fetcher)
}

export function useRoutes() {
  return useSWR<RouteOut[]>('/routes', fetcher)
}

export function useRoute(tripId?: number) {
  return useSWR<RouteOut>(tripId ? `/trips/${tripId}/route` : null, fetcher)
}

export function useNetwork() {
  return useSWR<NetworkOut>('/network', fetcher)
}

export function useMilestones() {
  return useSWR<MilestoneOut[]>('/milestones', fetcher)
}

export function useGearStates(tripId?: number) {
  return useSWR<GearItemState[]>(tripId ? `/trips/${tripId}/gear` : null, fetcher)
}

export async function updateGearStates(tripId: number, items: { item_idx: number; checked: boolean }[]) {
  const res = await apiClient.put(`/trips/${tripId}/gear`, { items })
  await globalMutate(`/trips/${tripId}/gear`)
  await globalMutate('/trips')
  return res.data as GearItemState[]
}

export function useTaskStates(tripId?: number) {
  return useSWR<TaskItemState[]>(tripId ? `/trips/${tripId}/tasks` : null, fetcher)
}

export async function updateTaskStates(tripId: number, items: { task_idx: number; checked: boolean }[]) {
  const res = await apiClient.put(`/trips/${tripId}/tasks`, { items })
  await globalMutate(`/trips/${tripId}/tasks`)
  await globalMutate('/trips')
  return res.data as TaskItemState[]
}

export async function checkinTrip(tripId: number) {
  const res = await apiClient.post(`/trips/${tripId}/checkin`)
  await globalMutate(`/trips/${tripId}`)
  await globalMutate('/trips')
  await globalMutate('/me/badges')
  return res.data as CheckinOut
}

export function useMyBadges() {
  return useSWR<BadgeUnlockOut[]>('/me/badges', fetcher)
}

export async function createTrip(planId: string, plannedDate?: string) {
  const res = await apiClient.post('/trips', { plan_id: planId, planned_date: plannedDate || null })
  await globalMutate('/trips')
  return res.data as TripDetailOut
}
