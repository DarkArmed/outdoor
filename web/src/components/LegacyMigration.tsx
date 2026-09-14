import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { migrateLegacy, readLegacyStorage } from "@/utils/legacy";

export function LegacyMigration() {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // Defer one microtask so StrictMode's discarded mount cannot send a second import.
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      try {
        if (await migrateLegacy(readLegacyStorage(), user.id)) {
          if (!cancelled) {
            setMessage("旧站记录已导入当前账号。");
            await mutate(() => true);
          }
        }
      } catch {
        if (!cancelled)
          setMessage("旧站记录导入失败，原数据已保留，请在家庭画像中重试。");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, mutate]);
  return message ? (
    <p role="status" className="px-4 py-2 bg-sun/20">
      {message} <Link to="/profile">家庭画像</Link>
    </p>
  ) : null;
}
