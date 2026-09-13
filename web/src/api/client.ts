import axios from 'axios'
import type {
  UserRegister, UserOut, Token, ProfileOut, ProfileUpdate, PlanOut,
  TripOut, TripDetailOut, TripCreate, TripUpdate, RouteOut, NetworkOut,
  MilestoneOut, GearItemState, TaskItemState, CheckinOut, BadgeUnlockOut,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export async function register(data: UserRegister) {
  const res = await apiClient.post<UserOut>('/auth/register', data)
  return res.data
}

export async function login(username: string, password: string) {
  const params = new URLSearchParams()
  params.append('username', username)
  params.append('password', password)
  const res = await apiClient.post<Token>('/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data
}

export async function fetchMe() {
  const res = await apiClient.get<UserOut>('/auth/me')
  return res.data
}

export async function fetchProfile() {
  const res = await apiClient.get<ProfileOut>('/profile')
  return res.data
}

export async function updateProfile(data: ProfileUpdate) {
  const res = await apiClient.put<ProfileOut>('/profile', data)
  return res.data
}

export async function fetchPlans(archived?: boolean) {
  const res = await apiClient.get<PlanOut[]>('/plans', { params: { archived } })
  return res.data
}

export async function fetchPlan(id: string) {
  const res = await apiClient.get<PlanOut>(`/plans/${id}`)
  return res.data
}

export async function fetchTrips() {
  const res = await apiClient.get<TripOut[]>('/trips')
  return res.data
}

export async function fetchTrip(id: number) {
  const res = await apiClient.get<TripDetailOut>(`/trips/${id}`)
  return res.data
}

export async function createTrip(data: TripCreate) {
  const res = await apiClient.post<TripDetailOut>('/trips', data)
  return res.data
}

export async function updateTrip(id: number, data: TripUpdate) {
  const res = await apiClient.put<TripDetailOut>(`/trips/${id}`, data)
  return res.data
}

export async function deleteTrip(id: number) {
  await apiClient.delete(`/trips/${id}`)
}

export async function fetchTripRoute(id: number) {
  const res = await apiClient.get<RouteOut>(`/trips/${id}/route`)
  return res.data
}

export async function fetchNetwork() {
  const res = await apiClient.get<NetworkOut>('/network')
  return res.data
}

export async function fetchMilestones() {
  const res = await apiClient.get<MilestoneOut[]>('/milestones')
  return res.data
}

export async function fetchGearStates(tripId: number) {
  const res = await apiClient.get<GearItemState[]>(`/trips/${tripId}/gear`)
  return res.data
}

export async function updateGearStates(tripId: number, items: GearItemState[]) {
  const res = await apiClient.put<GearItemState[]>(`/trips/${tripId}/gear`, { items })
  return res.data
}

export async function fetchTaskStates(tripId: number) {
  const res = await apiClient.get<TaskItemState[]>(`/trips/${tripId}/tasks`)
  return res.data
}

export async function updateTaskStates(tripId: number, items: TaskItemState[]) {
  const res = await apiClient.put<TaskItemState[]>(`/trips/${tripId}/tasks`, { items })
  return res.data
}

export async function checkinTrip(tripId: number) {
  const res = await apiClient.post<CheckinOut>(`/trips/${tripId}/checkin`)
  return res.data
}

export async function unlockBadge(tripId: number, badgeId: string) {
  const res = await apiClient.post<BadgeUnlockOut>(`/trips/${tripId}/badges/${badgeId}`)
  return res.data
}

export async function fetchMyBadges() {
  const res = await apiClient.get<BadgeUnlockOut[]>('/me/badges')
  return res.data
}
