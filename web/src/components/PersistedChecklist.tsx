import { useRef, useState } from "react";
import { useGearStates, useTaskStates } from "@/hooks/useApi";
import { updateGearStates, updateTaskStates } from "@/api/client";

export function PersistedChecklist({
  tripId,
  items,
  kind,
  baseCount,
}: {
  tripId?: number;
  items: string[];
  kind: "gear" | "tasks";
  baseCount?: number;
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
    if (!tripId || busy.current) return;
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
  if (tripId && !ready) return <p>加载清单…</p>;
  const count = items.filter((_, i) => checked.has(i)).length;
  const itemRow = (item: string, index: number) => (
    <label
      key={index}
      className={`${kind === "gear" ? "gear-item" : "task-item"}${checked.has(index) ? " done" : ""}`}
    >
      <input
        type="checkbox"
        disabled={!tripId || saving}
        checked={checked.has(index)}
        onChange={(e) => void toggle(index, e.target.checked)}
      />
      <span>{item}</span>
    </label>
  );
  return (
    <div>
      {kind === "gear" && (
        <>
          <div
            className="gear-progress"
            role="progressbar"
            aria-label="装备准备进度"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={count}
          >
            <div
              style={{
                width: `${items.length ? (count / items.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="gear-progress-text">
            {items.length && count === items.length
              ? "🎉 全部准备好啦，出发！"
              : `已准备 ${count}/${items.length} 件`}
          </p>
        </>
      )}
      {kind === "gear" ? (
        <div className="gear-section">
          <div className="gear-group">
            <h3>🎒 基础装备（每次必带）</h3>
            {items.slice(0, baseCount ?? items.length).map(itemRow)}
          </div>
          <div className="gear-group">
            <h3>⭐ 本周特需</h3>
            {items
              .slice(baseCount ?? items.length)
              .map((item, i) => itemRow(item, i + (baseCount ?? items.length)))}
          </div>
        </div>
      ) : (
        <div className="task-list">{items.map(itemRow)}</div>
      )}
      {!tripId && (
        <p className="muted">
          创建出行计划后开启{kind === "gear" ? "装备" : "任务"}清单。
        </p>
      )}
      {saving && (
        <p role="status" className="checklist-saving">
          保存中…
        </p>
      )}
      {error && (
        <p role="alert" className="text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
