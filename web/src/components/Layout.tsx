import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="topnav bg-sky text-ink px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
        <Link to="/" className="font-bold text-lg">
          {location.pathname.startsWith("/plan/")
            ? "🏠 返回首页"
            : "户外大冒险"}
        </Link>
        <nav className="flex flex-wrap items-center gap-3">
          {user ? (
            <>
              <span className="text-sm break-all">{user.email}</span>
              <Link
                to="/my-trips"
                className="bg-card px-4 py-2 rounded-full font-bold shadow-sm"
              >
                我的出行
              </Link>
              <Link
                to="/profile"
                className="bg-card px-4 py-2 rounded-full font-bold shadow-sm"
              >
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
            <Link
              to="/login"
              className="bg-card px-4 py-2 rounded-full font-bold shadow-sm"
            >
              登录
            </Link>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="site-footer">
        🌲 路线图仅供参考，导航请用两步路/高德 · 清单与打卡记录保存在当前账号
      </footer>
    </div>
  );
}
