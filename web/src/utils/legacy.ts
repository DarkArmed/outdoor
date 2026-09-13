import { importLegacy, type LegacyPayload } from "@/api/client";

export function legacyPayload(values: Record<string, unknown>): LegacyPayload {
  const plans = new Map<string, LegacyPayload["plans"][number]>();
  const ensure = (id: string) => {
    if (!plans.has(id))
      plans.set(id, { plan_id: id, gear: {}, tasks: {}, done: false });
    return plans.get(id)!;
  };
  function ids(key: string): string[] {
    const raw = values[key];
    const parsed: unknown =
      typeof raw === "string" ? JSON.parse(raw) : (raw ?? []);
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string"))
      throw new Error("旧数据格式不正确");
    return parsed as string[];
  }
  for (const [key, value] of Object.entries(values).sort()) {
    const match = /^(gear|tasks):(.+):(\d+)$/.exec(key);
    if (!match) continue;
    if (!["0", "1", false, true].includes(value as string | boolean))
      throw new Error("旧清单状态不正确");
    ensure(match[2])[match[1] === "gear" ? "gear" : "tasks"][Number(match[3])] =
      value === "1" || value === true;
  }
  for (const id of ids("plans:done")) ensure(id).done = true;
  return {
    plans: [...plans.values()].sort((a, b) =>
      a.plan_id.localeCompare(b.plan_id),
    ),
    badges: [...new Set(ids("badges:unlocked"))].sort(),
  };
}
export function readLegacyStorage(): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(localStorage)
      .filter(
        (key) =>
          /^(gear|tasks):/.test(key) ||
          ["plans:done", "badges:unlocked"].includes(key),
      )
      .map((key) => [key, localStorage.getItem(key)]),
  );
}
export async function migrateLegacy(
  values: Record<string, unknown>,
  userId: number,
) {
  const token = localStorage.getItem("token");
  const payload = legacyPayload(values);
  if (!payload.plans.length && !payload.badges.length) return false;
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const key = `outdoor:legacy-import:${hash}`;
  if (localStorage.getItem(key)) return false;
  if (!token || localStorage.getItem("token") !== token)
    throw new Error("账号已变化，请重新导入");
  await importLegacy(payload);
  // Keep the original state; one browser export belongs to the first importing account.
  localStorage.setItem(key, String(userId));
  return true;
}
