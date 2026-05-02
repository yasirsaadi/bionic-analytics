import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useAuth } from "../auth";
import { api, ApiError } from "../api";
import type {
  Center,
  DailySessionRow,
  Device,
  MonthlyTarget,
  SessionCount,
  Shift,
} from "../types";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function EntryPage() {
  const { user } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [centerId, setCenterId] = useState<string>("");
  const [sessionDate, setSessionDate] = useState<string>(todayIso());
  const [shift, setShift] = useState<Shift>("morning");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [session, setSession] = useState<DailySessionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const isReception = user?.role === "reception";
  const today = todayIso();

  useEffect(() => {
    void (async () => {
      const [c, d] = await Promise.all([
        api<{ centers: Center[] }>("/centers"),
        api<{ devices: Device[] }>("/devices"),
      ]);
      setCenters(c.centers.filter((x) => x.isActive));
      setDevices(d.devices.filter((x) => x.isActive));
      if (user?.centerId) setCenterId(user.centerId);
      else if (c.centers.length > 0 && c.centers[0])
        setCenterId(c.centers[0].id);
    })().catch(() => undefined);
  }, [user?.centerId]);

  useEffect(() => {
    if (!centerId) return;
    void (async () => {
      try {
        const data = await api<{
          session: DailySessionRow | null;
          counts: SessionCount[];
        }>(
          `/sessions/by?centerId=${encodeURIComponent(centerId)}&sessionDate=${sessionDate}&shift=${shift}`,
        );
        setSession(data.session);
        const map: Record<string, number> = {};
        for (const c of data.counts) map[c.deviceId] = c.count;
        setCounts(map);
      } catch {
        setSession(null);
        setCounts({});
      }
    })();
  }, [centerId, sessionDate, shift]);

  useEffect(() => {
    if (!centerId) return;
    const [y, m] = sessionDate.split("-");
    const year = Number(y);
    const month = Number(m);
    void (async () => {
      try {
        const [a, t] = await Promise.all([
          api<{ actuals: { deviceId: string; total: number }[] }>(
            `/sessions/monthly-actuals?centerId=${encodeURIComponent(centerId)}&year=${year}&month=${month}`,
          ),
          api<{ targets: MonthlyTarget[] }>(
            `/targets?centerId=${encodeURIComponent(centerId)}&year=${year}&month=${month}`,
          ),
        ]);
        const aMap: Record<string, number> = {};
        for (const x of a.actuals) aMap[x.deviceId] = x.total;
        const tMap: Record<string, number> = {};
        for (const x of t.targets) tMap[x.deviceId] = x.targetCount;
        setActuals(aMap);
        setTargets(tMap);
      } catch {
        setActuals({});
        setTargets({});
      }
    })();
  }, [centerId, sessionDate]);

  const dateLabel = useMemo(() => {
    try {
      return format(new Date(`${sessionDate}T00:00:00`), "EEEE d MMMM yyyy", {
        locale: ar,
      });
    } catch {
      return sessionDate;
    }
  }, [sessionDate]);

  const setCount = (deviceId: string, raw: string) => {
    const n = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return;
    setCounts((prev) => ({ ...prev, [deviceId]: n }));
  };

  const onSave = async () => {
    if (!centerId) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        centerId,
        sessionDate,
        shift,
        counts: devices.map((d) => ({
          deviceId: d.id,
          count: counts[d.id] ?? 0,
        })),
      };
      await api("/sessions/upsert", { method: "POST", json: payload });
      setMessage({ kind: "ok", text: "تم الحفظ" });
      const refreshed = await api<{
        session: DailySessionRow | null;
        counts: SessionCount[];
      }>(
        `/sessions/by?centerId=${encodeURIComponent(centerId)}&sessionDate=${sessionDate}&shift=${shift}`,
      );
      setSession(refreshed.session);
      const [y, m] = sessionDate.split("-");
      const aRefresh = await api<{
        actuals: { deviceId: string; total: number }[];
      }>(
        `/sessions/monthly-actuals?centerId=${encodeURIComponent(centerId)}&year=${Number(y)}&month=${Number(m)}`,
      );
      const aMap: Record<string, number> = {};
      for (const x of aRefresh.actuals) aMap[x.deviceId] = x.total;
      setActuals(aMap);
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof ApiError ? err.message : "فشل الحفظ",
      });
    } finally {
      setSaving(false);
    }
  };

  const canEditDate = !isReception;
  const lockedToToday = isReception;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">إدخال الجلسات اليومية</h2>

      <div className="bg-white rounded-lg border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            المركز <span className="text-slate-400">(Center)</span>
          </label>
          <select
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            disabled={isReception}
            className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
          >
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr} — {c.city}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            التاريخ <span className="text-slate-400">(Date)</span>
          </label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            disabled={!canEditDate}
            min={lockedToToday ? today : undefined}
            max={lockedToToday ? today : undefined}
            className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
          />
          <p className="text-xs text-slate-500 mt-1">{dateLabel}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            الوردية <span className="text-slate-400">(Shift)</span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShift("morning")}
              className={`flex-1 px-3 py-2 rounded-md border ${
                shift === "morning"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
            >
              صباحي
            </button>
            <button
              type="button"
              onClick={() => setShift("evening")}
              className={`flex-1 px-3 py-2 rounded-md border ${
                shift === "evening"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
            >
              مسائي
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-start px-4 py-2 w-1/4">الجهاز</th>
              <th className="text-start px-4 py-2 w-32">العدد</th>
              <th className="text-start px-4 py-2">شريط التقدم الشهري</th>
              <th className="text-start px-4 py-2 w-32">% من الهدف</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => {
              const value = counts[d.id] ?? 0;
              const actual = actuals[d.id] ?? 0;
              const target = targets[d.id] ?? 0;
              const pct = target > 0 ? (actual / target) * 100 : 0;
              const visual = Math.min(100, pct);
              const color =
                pct >= 100
                  ? "bg-emerald-500"
                  : pct >= 70
                    ? "bg-amber-500"
                    : "bg-red-500";
              return (
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
                      value={value}
                      onChange={(e) => setCount(d.id, e.target.value)}
                      className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-end"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full ${color} transition-all`}
                        style={{ width: `${visual}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {actual} / {target || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-end">
                    {target > 0 ? `${pct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {session && (
        <p className="text-xs text-slate-500">
          آخر تحديث:{" "}
          {format(new Date(session.updatedAt), "yyyy-MM-dd HH:mm", {
            locale: ar,
          })}
        </p>
      )}

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
