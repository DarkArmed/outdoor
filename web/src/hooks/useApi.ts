import useSWR from 'swr'
import * as api from '@/api/client'
import { useAuth } from '@/auth/AuthContext'

export function usePlans(archived?: boolean) {
  return useSWR(['/plans', archived], () => api.fetchPlans(archived))
}

export function usePlan(id?: string) {
  return useSWR(id ? ['/plans', id] : null, () => api.fetchPlan(id!))
}

export function useProfile() {
  const { user } = useAuth()
  return useSWR(user ? ['/profile', user.id] : null, api.fetchProfile)
}

export function useTrips() {
  const { user } = useAuth()
  return useSWR(user ? ['/trips', user.id] : null, api.fetchTrips)
}

export function useTrip(id?: number) {
  const { user } = useAuth()
  return useSWR(user && id ? ['/trips', user.id, id] : null, () => api.fetchTrip(id!))
}

export function useRoutes() {
  const { user } = useAuth()
  return useSWR(user ? ['/routes', user.id] : null, api.fetchRoutes)
}
export function useNetwork() {
  const { user } = useAuth()
  return useSWR(user ? ['/network', user.id] : null, api.fetchNetwork, { shouldRetryOnError: false })
}
export function useMilestones() {
  const { user } = useAuth()
  return useSWR(user ? ['/milestones', user.id] : null, api.fetchMilestones)
}
export function useMyBadges() {
  const { user } = useAuth()
  return useSWR(user ? ['/me/badges', user.id] : null, api.fetchMyBadges)
}
export function useGearStates(id?: number) {
  const { user } = useAuth()
  return useSWR(user && id ? ['/gear', user.id, id] : null, () => api.fetchGearStates(id!))
}
export function useTaskStates(id?: number) {
  const { user } = useAuth()
  return useSWR(user && id ? ['/tasks', user.id, id] : null, () => api.fetchTaskStates(id!))
}
