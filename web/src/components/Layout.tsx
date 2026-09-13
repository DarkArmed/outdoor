import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-sky text-ink px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg">户外大冒险</Link>
        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm">{user.email}</span>
              <Link to="/my-trips" className="bg-card px-4 py-2 rounded-full font-bold shadow-sm">
                我的出行
              </Link>
              <Link to="/profile" className="bg-card px-4 py-2 rounded-full font-bold shadow-sm">
                画像
              </Link>
              <button
                onClick={logout}
                className="bg-card px-4 py-2 rounded-full font-bold shadow-sm"
              >
                退出
              </button>
            </>
          ) : (
            <Link to="/login" className="bg-card px-4 py-2 rounded-full font-bold shadow-sm">
              登录
            </Link>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
