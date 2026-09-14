import { useState } from "react";
import { useSWRConfig } from "swr";
import { useProfile } from "@/hooks/useApi";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/api/client";
import type { ProfileOut, ProfileUpdate } from "@/api/types";
import { record, strings } from "@/utils/content";
import { migrateLegacy, readLegacyStorage } from "@/utils/legacy";

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: ProfileOut | null;
  onSaved: () => Promise<unknown>;
}) {
  const [form, setForm] = useState<ProfileUpdate>(
    profile || {
      home_name: "",
      home_city: "",
      family_travelers: [],
      child: {},
      prefs: {},
    },
  );
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const child = record(form.child),
    prefs = record(form.prefs);
  const childField = (key: string, value: unknown) =>
    setForm((p) => ({ ...p, child: { ...child, [key]: value } }));
  const prefField = (key: string, value: unknown) =>
    setForm((p) => ({ ...p, prefs: { ...prefs, [key]: value } }));
  const list = (s: string) =>
    s
      .split(/[,，]/)
      .map((v) => v.trim())
      .filter(Boolean);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await api.updateProfile(form);
      await onSaved();
      setMessage("已保存");
    } catch {
      setMessage("保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-card">
      <label>
        家的大致位置
        <input
          value={form.home_name || ""}
          onChange={(e) => setForm({ ...form, home_name: e.target.value })}
        />
      </label>
      <label>
        城市
        <input
          value={form.home_city || ""}
          onChange={(e) => setForm({ ...form, home_city: e.target.value })}
        />
      </label>
      <label>
        出行成员（逗号分隔）
        <input
          defaultValue={form.family_travelers?.join("，")}
          onChange={(e) =>
            setForm({ ...form, family_travelers: list(e.target.value) })
          }
        />
      </label>
      <label>
        孩子小名
        <input
          value={String(child.name || "")}
          onChange={(e) => childField("name", e.target.value)}
        />
      </label>
      <label>
        孩子出生年份
        <input
          type="number"
          min="1900"
          max={new Date().getFullYear()}
          value={Number(child.birthYear) || ""}
          onChange={(e) =>
            childField(
              "birthYear",
              e.target.value ? Number(e.target.value) : null,
            )
          }
        />
      </label>
      <label>
        孩子耐力范围（公里，逗号分隔）
        <input
          defaultValue={
            Array.isArray(child.enduranceKm) ? child.enduranceKm.join("，") : ""
          }
          onChange={(e) =>
            childField(
              "enduranceKm",
              list(e.target.value).map(Number).filter(Number.isFinite),
            )
          }
        />
      </label>
      <label>
        兴趣（逗号分隔）
        <input
          defaultValue={strings(child.interests).join("，")}
          onChange={(e) => childField("interests", list(e.target.value))}
        />
      </label>
      <label>
        性格
        <input
          value={String(child.character || "")}
          onChange={(e) => childField("character", e.target.value)}
        />
      </label>
      <label>
        过敏信息（逗号分隔）
        <input
          defaultValue={strings(child.allergies).join("，")}
          onChange={(e) => childField("allergies", list(e.target.value))}
        />
      </label>
      <label>
        单程车程上限（小时）
        <input
          type="number"
          min="0"
          step="0.5"
          value={Number(prefs.maxDriveHoursOneWay) || ""}
          onChange={(e) =>
            prefField(
              "maxDriveHoursOneWay",
              e.target.value ? Number(e.target.value) : null,
            )
          }
        />
      </label>
      <label>
        可出行日期（逗号分隔）
        <input
          defaultValue={strings(prefs.availableDays).join("，")}
          onChange={(e) => prefField("availableDays", list(e.target.value))}
        />
      </label>
      <label>
        偏好活动（逗号分隔）
        <input
          defaultValue={strings(prefs.activityTypes).join("，")}
          onChange={(e) => prefField("activityTypes", list(e.target.value))}
        />
      </label>
      <label>
        饮食备注
        <textarea
          value={String(prefs.foodNotes || "")}
          onChange={(e) => prefField("foodNotes", e.target.value)}
        />
      </label>
      <button disabled={saving} className="action">
        {saving ? "保存中…" : "保存"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
export function ProfilePage() {
  const profile = useProfile(),
    { user } = useAuth(),
    { mutate } = useSWRConfig();
  const [importText, setImportText] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (profile.isLoading) return <p className="p-8">加载中…</p>;
  if (profile.error)
    return (
      <p role="alert" className="p-8">
        画像加载失败，请刷新重试。
      </p>
    );
  async function importData() {
    if (busy || !user) return;
    setBusy(true);
    try {
      const values = importText.trim()
        ? record(JSON.parse(importText))
        : readLegacyStorage();
      const changed = await migrateLegacy(values, user.id);
      setMessage(
        changed ? "旧记录已导入，原始数据已保留。" : "没有待导入的新记录。",
      );
      await mutate(() => true);
    } catch {
      setMessage("导入失败，请检查导出数据和网络；原始数据已保留。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">家庭画像</h1>
      <ProfileForm
        profile={profile.data || null}
        onSaved={() => profile.mutate()}
      />
      <section className="form-card mt-6">
        <h2 className="text-xl font-bold">导入旧站记录</h2>
        <p>
          同地址的旧记录会在登录后自动导入。若旧站通过文件打开，可粘贴从旧站导出的
          JSON。每份记录只导入到首次接收的账号。
        </p>
        <label>
          旧站记录 JSON
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={5}
          />
        </label>
        <button className="action" onClick={importData} disabled={busy}>
          导入旧记录
        </button>
        <p role="status">{message}</p>
      </section>
    </div>
  );
}
