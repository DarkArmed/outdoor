import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/auth/AuthContext";
import { AuthShell } from "@/components/AuthShell";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [taken, setTaken] = useState(false);
  const [pending, setPending] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTaken(false);
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (pending) return;
    setPending(true);
    try {
      await register(email, password);
      navigate("/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const detail: unknown = err.response?.data?.detail;
        if (status === 400) {
          setTaken(true);
        } else if (
          !err.response ||
          (status !== undefined && status >= 502 && status <= 504)
        ) {
          setError("连不上服务器，请确认后端已启动");
        } else if (status === 422 || Array.isArray(detail)) {
          setError("邮箱或密码格式不正确");
        } else {
          setError(
            `注册失败（${status}${typeof detail === "string" ? `：${detail}` : ""}），请稍后重试`,
          );
        }
      } else {
        setError("注册失败，请稍后重试");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell srTitle="注册">
      {(night) => (
        <>
          <p className="auth-brand">{night ? "🌙" : "🏕️"} 户外大冒险</p>
          <p className="auth-sub">
            {night ? "加入探险队，从篝火开始" : "注册，开启第一次冒险"}
          </p>
          {taken ? (
            <p role="alert" className="auth-error">
              这个邮箱已经注册过啦，
              <Link to="/login" className="auth-error-link">
                直接登录 →
              </Link>
            </p>
          ) : (
            error && (
              <p role="alert" className="auth-error">
                {error}
              </p>
            )
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
                autoComplete="new-password"
                type="password"
                placeholder="密码（至少 6 位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              aria-label="注册"
              disabled={pending}
              type="submit"
              className="auth-go"
            >
              {pending ? "登记中…" : night ? "加入探险队 →" : "开启冒险 →"}
            </button>
          </form>
          <p className="auth-reg">
            已有账号？
            <Link to="/login">{night ? "回到营地" : "去登录"}</Link>
          </p>
          <p className="auth-tag">
            {night ? "🔥 篝火旁还有位置" : "🎒 新队员报到"}
          </p>
        </>
      )}
    </AuthShell>
  );
}
