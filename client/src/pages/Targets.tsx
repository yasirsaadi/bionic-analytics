import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import type { Center, Device, MonthlyTarget } from "../types";

export function TargetsPage() {
  const { user } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [centerId, setCenterId] = useState<string>("");
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const [c, d] = await Promise.all([
        api<{ centers: Center[] }>("/centers"),
        api<{ devices: Device[] }>("/devices"),
      ]);
      setCenters(c.centers.filter((x) => x.isActive));
      setDevices(d.devices.filter((x) => x.isActive));
      const initial =
        user?.role === "manager" && user.centerId
          ? user.centerId
          : (c.centers[0]?.id ?? "");
      setCenterId(initial);
    })().catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!centerId) return;
    void (async () => {
      try {
        const data = await api<{ targets: MonthlyTarget[] }>(
          `/targets?centerId=${encodeURIComponent(centerId)}&year=${year}&month=${month}`,
        );
        const map: Record<string, number> = {};
        for (const t of data.targets) map[t.deviceId] = t.targetCount;
        setTargets(map);
      } catch {
        setTargets({});
      }
    })();
  }, [centerId, year, month]);

  const setTargetValue = (deviceId: string, raw: string) => {
    const n = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return;
    setTargets((prev) => ({ ...prev, [deviceId]: n }));
  };

  const onSave = async () => {
    if (!centerId) return;
    setSaving(true);
    setMessage(null);
    try {
      await api("/targets/upsert", {
        method: "POST",
        json: {
          centerId,
          year,
          month,
          targets: devices.map((d) => ({
            deviceId: d.id,
            targetCount: targets[d.id] ?? 0,
          })),
        },
      });
      setMessage({ kind: "ok", text: "تم الحفظ" });
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof ApiError ? err.message : "فشل الحفظ",
      });
    } finally {
      setSaving(false);
    }
  };

  const onCopyPrev = async () => {
    if (!centerId) return;
    const fromMonth = month === 1 ? 12 : month - 1;
    const fromYear = month === 1 ? year - 1 : year;
    setSaving(true);
    setMessage(null);
    try {
      await api("/targets/copy", {
        method: "POST",
        json: {
          centerId,
          fromYear,
          fromMonth,
          toYear: year,
          toMonth: month,
        },
      });
      const data = await api<{ targets: MonthlyTarget[] }>(
        `/targets?centerId=${encodeURIComponent(centerId)}&year=${year}&month=${month}`,
      );
      const map: Record<string, number> = {};
      for (const t of data.targets) map[t.deviceId] = t.targetCount;
      setTargets(map);
      setMessage({ kind: "ok", text: "تم النسخ" });
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof ApiError ? err.message : "فشل النسخ",
      });
    } finally {
      setSaving(false);
    }
  };

  const isManager = user?.role === "manager";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">الأهداف الشهرية</h2>

      <div className="bg-white rounded-lg border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            المركز
          </label>
          <select
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            disabled={isManager}
            className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
          >
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            السنة
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            min={2024}
            max={2100}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            الشهر
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={onCopyPrev}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-md"
          >
            نسخ من الشهر السابق
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-start px-4 py-2">الجهاز</th>
              <th className="text-start px-4 py-2 w-40">الهدف</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="font-medium">{d.nameAr}</div>
                  <div className="text-xs text-slate-500">{d.nameEn}</div>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={targets[d.id] ?? 0}
                    onChange={(e) => setTargetValue(d.id, e.target.value)}
                    className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-end"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving || !centerId}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-6 py-2.5 rounded-md"
        >
          {saving ? "…جارٍ الحفظ" : "حفظ"}
        </button>
        {message && (
          <span
            className={
              message.kind === "ok"
                ? "text-emerald-700 text-sm"
                : "text-red-700 text-sm"
            }
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
