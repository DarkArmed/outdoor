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
