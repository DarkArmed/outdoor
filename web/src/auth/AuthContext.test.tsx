import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import * as api from '@/api/client'
import type { UserOut } from '@/api/types'

vi.mock('@/api/client', () => ({ login: vi.fn(), register: vi.fn(), fetchMe: vi.fn() }))
const user: UserOut = { id: 1, email: 'demo@example.com', is_active: true, created_at: '2026-09-13' }
beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  vi.mocked(api.login).mockResolvedValue({ access_token: 'jwt', token_type: 'bearer' })
  vi.mocked(api.fetchMe).mockResolvedValue(user)
})
afterEach(cleanup)

describe('AuthProvider', () => {
  it('registers, logs in once, persists the token, and logs out', async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await act(async () => { await result.current.register(user.email, 'password') })
    expect(api.register).toHaveBeenCalledWith({ email: user.email, password: 'password' })
    expect(api.login).toHaveBeenCalledWith(user.email, 'password')
    expect(api.fetchMe).toHaveBeenCalledTimes(1)
    expect(result.current.user).toEqual(user)
    expect(localStorage.getItem('token')).toBe('jwt')
    act(() => result.current.logout())
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('restores a saved session', async () => {
    localStorage.setItem('token', 'saved')
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.user).toEqual(user))
    expect(result.current.token).toBe('saved')
  })

  it('does not restore an in-flight session after logout', async () => {
    localStorage.setItem('token', 'saved')
    let resolve!: (value: UserOut) => void
    vi.mocked(api.fetchMe).mockReturnValue(new Promise((done) => { resolve = done }))
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    act(() => result.current.logout())
    await act(async () => { resolve(user) })
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('clears a partially established session when identity lookup fails', async () => {
    vi.mocked(api.fetchMe).mockRejectedValue(new Error('identity unavailable'))
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await act(async () => { await expect(result.current.login(user.email, 'password')).rejects.toThrow('identity unavailable') })
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })
})
