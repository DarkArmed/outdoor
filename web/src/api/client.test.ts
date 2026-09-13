import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { apiClient, fetchPlans, fetchTrips, login, register } from './client'
import type { TripOut } from './types'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  localStorage.clear()
})

function capture(response: unknown) {
  const requests: InternalAxiosRequestConfig[] = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    return { data: response, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config }
  }
  return requests
}

describe('API contract', () => {
  it('sends OAuth2 form credentials with correctly escaped values', async () => {
    const requests = capture({ access_token: 'jwt', token_type: 'bearer' })
    expect(await login('a+b@example.com', 'a&b=c')).toEqual({ access_token: 'jwt', token_type: 'bearer' })
    expect(requests[0].url).toBe('/auth/login')
    expect(requests[0].headers.getContentType()).toContain('application/x-www-form-urlencoded')
    const form = new URLSearchParams(requests[0].data as string)
    expect(form.get('username')).toBe('a+b@example.com')
    expect(form.get('password')).toBe('a&b=c')
  })

  it('registers with JSON, injects the current token, and supports public plans', async () => {
    const requests = capture([])
    await register({ email: 'demo@example.com', password: 'password' })
    expect(JSON.parse(requests[0].data as string)).toEqual({ email: 'demo@example.com', password: 'password' })
    expect(requests[0].headers.Authorization).toBeUndefined()
    localStorage.setItem('token', 'new-session')
    expect(await fetchPlans(false)).toEqual([])
    expect(requests[1].url).toBe('/plans')
    expect(requests[1].params).toEqual({ archived: false })
    expect(requests[1].headers.Authorization).toBe('Bearer new-session')
  })

  it('exposes the list schema rather than promising detail-only content', async () => {
    expectTypeOf<Awaited<ReturnType<typeof fetchTrips>>>().toEqualTypeOf<TripOut[]>()
    capture([{ id: 1, snapshot: { title: 'Trip' }, overrides: {} }])
    const trips = await fetchTrips()
    expect(trips[0]).not.toHaveProperty('content')
  })
})
