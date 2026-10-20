import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function AdminLayout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="flex flex-wrap items-center gap-4 px-4 py-3 bg-slate-950 border-b border-slate-700">
        <span className="font-bold">管理后台</span>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              isActive
                ? "text-sky-300 font-bold"
                : "text-slate-300 hover:text-white"
            }
          >
            流水线 Dashboard
          </NavLink>
          <Link to="/" className="text-slate-300 hover:text-white">
            ← 返回主站
          </Link>
        </nav>
        <span className="ml-auto text-xs text-slate-400 break-all">
          {user?.email}
        </span>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
