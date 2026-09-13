import { useRef, useState } from "react";
import { useGearStates, useTaskStates } from "@/hooks/useApi";
import { updateGearStates, updateTaskStates } from "@/api/client";

export function PersistedChecklist({
  tripId,
  items,
  kind,
}: {
  tripId: number;
  items: string[];
  kind: "gear" | "tasks";
}) {
  const gear = useGearStates(kind === "gear" ? tripId : undefined);
  const tasks = useTaskStates(kind === "tasks" ? tripId : undefined);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false);
  const checked = new Set(
    kind === "gear"
      ? gear.data?.filter((s) => s.checked).map((s) => s.item_idx)
      : tasks.data?.filter((s) => s.checked).map((s) => s.task_idx),
  );
  const ready = kind === "gear" ? gear.data : tasks.data;
  const loadError = kind === "gear" ? gear.error : tasks.error;
  async function toggle(index: number, value: boolean) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      if (kind === "gear")
        await gear.mutate(
          await updateGearStates(tripId, [{ item_idx: index, checked: value }]),
          false,
        );
      else
        await tasks.mutate(
          await updateTaskStates(tripId, [{ task_idx: index, checked: value }]),
          false,
        );
    } catch {
      setError("保存失败，勾选未更改，请重试。");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  if (loadError)
    return (
      <p role="alert">
        清单加载失败。
        <button
          onClick={() => (kind === "gear" ? gear.mutate() : tasks.mutate())}
        >
          重试
        </button>
      </p>
    );
  if (!ready) return <p>加载清单…</p>;
  const count = items.filter((_, i) => checked.has(i)).length;
  return (
    <div>
      <div className="flex gap-3 items-center mb-3">
        <progress
          max={items.length || 1}
          value={count}
          className="flex-1 accent-grass-dk"
          aria-label="清单完成进度"
        />
        <span>
          {count}/{items.length}
        </span>
        {saving && <span role="status">保存中…</span>}
      </div>
      {items.map((item, index) => (
        <label
          key={index}
          className="flex items-center gap-3 p-3 my-2 rounded-xl bg-paper border border-gray-200"
        >
          <input
            type="checkbox"
            className="w-5 h-5 accent-grass-dk"
            disabled={saving}
            checked={checked.has(index)}
            onChange={(e) => void toggle(index, e.target.checked)}
          />
          <span className={checked.has(index) ? "line-through text-muted" : ""}>
            {item}
          </span>
        </label>
      ))}
      {error && (
        <p role="alert" className="text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
