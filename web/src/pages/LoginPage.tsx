import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

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
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">登录</h1>
      {error && (
        <p role="alert" className="text-coral mb-4">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          aria-label="邮箱"
          autoComplete="email"
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-300"
          required
        />
        <input
          aria-label="密码"
          autoComplete="current-password"
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-300"
          required
        />
        <button
          disabled={pending}
          type="submit"
          className="w-full bg-sky text-ink font-bold py-3 rounded-full"
        >
          登录
        </button>
      </form>
      <p className="mt-4 text-center">
        还没有账号？
        <Link to="/register" className="text-sky-deep font-bold">
          注册
        </Link>
      </p>
    </div>
  );
}
