import { useEffect, useRef, useState } from "react";

export function CheckinButton({
  done,
  onCheckin,
  badge,
}: {
  done: boolean;
  badge?: { icon: string; name: string };
  onCheckin: () => Promise<void>;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const start = () => {
    if (done || pending || timer.current) return;
    setHolding(true);
    setError("");
    timer.current = setTimeout(async () => {
      timer.current = null;
      setHolding(false);
      setPending(true);
      try {
        await onCheckin();
      } catch {
        setError("打卡未保存，请重试。");
      } finally {
        setPending(false);
      }
    }, 2000);
  };
  return (
    <>
      <button
        type="button"
        disabled={done || pending}
        onPointerDown={(e) => {
          if (e.button === 0) start();
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onBlur={cancel}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            cancel();
          }
        }}
        className={`checkin-btn ${holding ? "holding" : ""}`}
      >
        <span className="checkin-progress" />
        <span className="relative">
          {done
            ? `✅ 已完成本次冒险${badge ? ` · ${badge.icon} ${badge.name}` : ""}`
            : pending
              ? "保存中…"
              : "🏁 完成本次冒险（长按 2 秒打卡）"}
        </span>
      </button>
      {error && (
        <p role="alert" className="text-coral mt-2">
          {error}
        </p>
      )}
    </>
  );
}
