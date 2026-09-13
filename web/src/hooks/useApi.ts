import useSWR from 'swr'
import { apiClient } from '@/api/client'
import type { PlanOut, ProfileOut, TripDetailOut } from '@/api/types'

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
