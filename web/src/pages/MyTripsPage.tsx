import { useState } from "react";
import { Link } from "react-router-dom";
import { usePlans, useTrips } from "@/hooks/useApi";
import * as api from "@/api/client";
import type { TripOut } from "@/api/types";
import { tripContent } from "@/utils/content";

function TripCard({
  trip,
  refresh,
}: {
  trip: TripOut;
  refresh: () => Promise<unknown>;
}) {
  const content = tripContent(trip);
  const [date, setDate] = useState(trip.planned_date || ""),
    [title, setTitle] = useState(content.title);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await api.updateTrip(trip.id, {
        planned_date: date,
        overrides: { ...trip.overrides, title },
      });
      await refresh();
      setMessage("已保存");
    } catch {
      setMessage("保存失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm("删除这次出行及其清单记录？")) return;
    setBusy(true);
    try {
      await api.deleteTrip(trip.id);
      await refresh();
    } catch {
      setMessage("删除失败，请重试。");
      setBusy(false);
    }
  }
  return (
    <article className="form-card">
      <Link
        to={`/plan/${trip.plan_id}?trip=${trip.id}`}
        className="text-xl font-bold underline"
      >
        {content.title}
      </Link>
      <p>状态：{trip.status === "done" ? "已完成" : "待出行"}</p>
      <label>
        本次出行名称
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        计划日期
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <div className="flex gap-4">
        <button className="action" onClick={save} disabled={busy}>
          保存修改
        </button>
        <button onClick={remove} disabled={busy} className="text-coral">
          删除出行
        </button>
      </div>
      <p role="status">{message}</p>
    </article>
  );
}
export function MyTripsPage() {
  const trips = useTrips(),
    plans = usePlans();
  const [selectedPlan, setSelectedPlan] = useState(""),
    [plannedDate, setPlannedDate] = useState("");
  const [creating, setCreating] = useState(false),
    [error, setError] = useState("");
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      await api.createTrip({
        plan_id: selectedPlan,
        planned_date: plannedDate || undefined,
      });
      await trips.mutate();
      setSelectedPlan("");
    } catch {
      setError("创建失败，请重试。");
    } finally {
      setCreating(false);
    }
  }
  if (trips.isLoading || plans.isLoading) return <p className="p-8">加载中…</p>;
  if (trips.error || plans.error)
    return (
      <p role="alert" className="p-8">
        加载失败，请刷新重试。
      </p>
    );
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">我的出行计划</h1>
      <form onSubmit={create} className="form-card mb-6">
        <h2 className="text-xl font-bold">从公共方案创建</h2>
        <label>
          选择方案
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            required
          >
            <option value="">请选择</option>
            {plans.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          出行日期
          <input
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
          />
        </label>
        <button className="action" disabled={creating}>
          {creating ? "创建中…" : "创建出行"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
      <div className="space-y-4">
        {trips.data?.length ? (
          trips.data.map((trip) => (
            <TripCard
              key={`${trip.id}-${trip.updated_at}`}
              trip={trip}
              refresh={() => trips.mutate()}
            />
          ))
        ) : (
          <p>还没有出行计划，先选一个喜欢的方案吧。</p>
        )}
      </div>
    </div>
  );
}
