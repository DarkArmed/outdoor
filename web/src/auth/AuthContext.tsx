import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { SWRConfig } from 'swr'
import * as api from '@/api/client'
import type { UserOut } from '@/api/types'

interface AuthContextValue {
  user: UserOut | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const sessionCache = { provider: () => new Map() }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(Boolean(token))
  const revision = useRef(0)

  useEffect(() => {
    const sessionRevision = revision
    const current = ++sessionRevision.current
    if (localStorage.getItem('token')) {
      api.fetchMe()
        .then((data) => { if (sessionRevision.current === current) setUser(data) })
        .catch(() => {
          if (sessionRevision.current !== current) return
          localStorage.removeItem('token')
          setToken(null)
        })
        .finally(() => { if (sessionRevision.current === current) setLoading(false) })
    }
    return () => { sessionRevision.current++ }
  }, [])

  const login = async (email: string, password: string) => {
    const current = ++revision.current
    setLoading(true)
    try {
      const data = await api.login(email, password)
      if (revision.current !== current) return
      localStorage.setItem('token', data.access_token)
      const me = await api.fetchMe()
      if (revision.current !== current) return
      setToken(data.access_token)
      setUser(me)
    } catch (error) {
      if (revision.current === current) {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      }
      throw error
    } finally {
      if (revision.current === current) setLoading(false)
    }
  }

  const register = async (email: string, password: string) => {
    await api.register({ email, password })
    await login(email, password)
  }

  const logout = () => {
    revision.current++
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      <SWRConfig key={token ?? 'anonymous'} value={sessionCache}>{children}</SWRConfig>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
