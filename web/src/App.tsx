import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./auth/AuthContext";
import { HomePage } from "./pages/HomePage";
import { PlanDetailPage } from "./pages/PlanDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProfilePage } from "./pages/ProfilePage";
import { MyTripsPage } from "./pages/MyTripsPage";
import { LegacyMigration } from "./components/LegacyMigration";

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="p-8">加载中…</p>;
  if (!user)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  return (
    <>
      <LegacyMigration />
      <Outlet />
    </>
  );
}
function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8">加载中…</p>;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<GuestOnly />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route index element={<HomePage />} />
          <Route path="plan/:id" element={<PlanDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="my-trips" element={<MyTripsPage />} />
        </Route>
        <Route path="*" element={<p className="p-8">页面不存在</p>} />
      </Route>
    </Routes>
  );
}
