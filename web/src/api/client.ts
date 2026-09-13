import axios from 'axios'
import type { UserRegister } from './types'

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
  const res = await apiClient.post('/auth/register', data)
  return res.data
}

export async function login(username: string, password: string) {
  const params = new URLSearchParams()
  params.append('username', username)
  params.append('password', password)
  const res = await apiClient.post('/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data as { access_token: string; token_type: string }
}

export async function fetchMe() {
  const res = await apiClient.get('/auth/me')
  return res.data
}

export async function fetchProfile() {
  const res = await apiClient.get('/profile')
  return res.data
}

export async function updateProfile(data: Record<string, unknown>) {
  const res = await apiClient.put('/profile', data)
  return res.data
}

export async function fetchPlans(archived?: boolean) {
  const res = await apiClient.get('/plans', { params: { archived } })
  return res.data
}

export async function fetchPlan(id: string) {
  const res = await apiClient.get(`/plans/${id}`)
  return res.data
}

export async function fetchTrips() {
  const res = await apiClient.get('/trips')
  return res.data
}

export async function fetchTrip(id: number) {
  const res = await apiClient.get(`/trips/${id}`)
  return res.data
}

export async function createTrip(data: { plan_id: string; planned_date?: string; overrides?: Record<string, unknown> }) {
  const res = await apiClient.post('/trips', data)
  return res.data
}

export async function updateTrip(id: number, data: { planned_date?: string; overrides?: Record<string, unknown>; status?: string }) {
  const res = await apiClient.put(`/trips/${id}`, data)
  return res.data
}

export async function deleteTrip(id: number) {
  await apiClient.delete(`/trips/${id}`)
}

export async function fetchTripRoute(id: number) {
  const res = await apiClient.get(`/trips/${id}/route`)
  return res.data
}

export async function fetchNetwork() {
  const res = await apiClient.get('/network')
  return res.data
}

export async function fetchMilestones() {
  const res = await apiClient.get('/milestones')
  return res.data
}

export async function fetchGearStates(tripId: number) {
  const res = await apiClient.get(`/trips/${tripId}/gear`)
  return res.data
}

export async function updateGearStates(tripId: number, items: { item_idx: number; checked: boolean }[]) {
  const res = await apiClient.put(`/trips/${tripId}/gear`, { items })
  return res.data
}

export async function fetchTaskStates(tripId: number) {
  const res = await apiClient.get(`/trips/${tripId}/tasks`)
  return res.data
}

export async function updateTaskStates(tripId: number, items: { task_idx: number; checked: boolean }[]) {
  const res = await apiClient.put(`/trips/${tripId}/tasks`, { items })
  return res.data
}

export async function checkinTrip(tripId: number) {
  const res = await apiClient.post(`/trips/${tripId}/checkin`)
  return res.data
}

export async function unlockBadge(tripId: number, badgeId: string) {
  const res = await apiClient.post(`/trips/${tripId}/badges/${badgeId}`)
  return res.data
}

export async function fetchMyBadges() {
  const res = await apiClient.get('/me/badges')
  return res.data
}
