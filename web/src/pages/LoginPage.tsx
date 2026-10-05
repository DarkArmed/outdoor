import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { AuthShell } from "@/components/AuthShell";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pending) return;
    setPending(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("登录失败，请检查邮箱和密码");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell srTitle="登录">
      {(night) => (
        <>
          <p className="auth-brand">{night ? "🌙" : "🏕️"} 户外大冒险</p>
          <p className="auth-sub">
            {night ? "篝火已生起，就等你回来" : "登录，继续这个周末的冒险"}
          </p>
          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <span className="ico" aria-hidden="true">
                📧
              </span>
              <input
                aria-label="邮箱"
                autoComplete="email"
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="auth-field">
              <span className="ico" aria-hidden="true">
                🔒
              </span>
              <input
                aria-label="密码"
                autoComplete="current-password"
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              aria-label="登录"
              disabled={pending}
              type="submit"
              className="auth-go"
            >
              {pending ? "出发中…" : night ? "回到营地 →" : "出发探险 →"}
            </button>
          </form>
          <p className="auth-reg">
            还没有账号？
            <Link to="/register">{night ? "加入探险队" : "注册一个"}</Link>
          </p>
          <p className="auth-tag">
            {night ? "✨ 今晚晴，适合看星星" : "☀️ 天气不错，适合出门"}
          </p>
        </>
      )}
    </AuthShell>
  );
}
