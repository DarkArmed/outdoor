import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { loginSceneSVG } from "@/svg/scenes";

const THEME_KEY = "auth-theme";

const CLOUD = (
  <svg width="150" height="60" viewBox="0 0 150 60" aria-hidden="true">
    <g fill="#fff">
      <ellipse cx="40" cy="38" rx="34" ry="18" />
      <ellipse cx="70" cy="26" rx="26" ry="16" />
      <ellipse cx="100" cy="38" rx="30" ry="16" />
    </g>
  </svg>
);

function initialNight(): boolean {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved === "night";
  } catch {
    /* localStorage 不可用时忽略 */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/**
 * 登录/注册页外壳：日间营地（方案 A）+ 星空夜营（方案 B，dark mode）。
 * 默认跟随系统 prefers-color-scheme，右上角可手动切换并记忆选择。
 */
export function AuthShell({
  srTitle,
  children,
}: {
  srTitle: string;
  children: (night: boolean) => ReactNode;
}) {
  const [night, setNight] = useState(initialNight);
  const toggle = () =>
    setNight((n) => {
      try {
        localStorage.setItem(THEME_KEY, n ? "day" : "night");
      } catch {
        /* localStorage 不可用时忽略 */
      }
      return !n;
    });

  return (
    <div className={`auth-page${night ? " night" : ""}`}>
      <h1 className="sr-only">{srTitle}</h1>
      <Link to="/" className="auth-home">
        🏠 返回首页
      </Link>
      <button
        type="button"
        className="auth-toggle"
        onClick={toggle}
        aria-label={night ? "切换到日间模式" : "切换到夜间模式"}
      >
        {night ? "☀️" : "🌙"}
      </button>
      {night ? (
        <div className="auth-glow" />
      ) : (
        <>
          <div className="auth-cloud c1">{CLOUD}</div>
          <div className="auth-cloud c2">{CLOUD}</div>
        </>
      )}
      <div
        className="auth-scene"
        dangerouslySetInnerHTML={{ __html: loginSceneSVG(night) }}
      />
      <div className="auth-card">{children(night)}</div>
    </div>
  );
}
