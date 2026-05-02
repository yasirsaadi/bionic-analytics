import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Center, Device, Shift } from "../types";

interface RowFromApi {
  sessionId: string;
  centerId: string;
  sessionDate: string;
  shift: Shift;
  updatedAt: string;
  deviceId: string | null;
  count: number | null;
}

export function SessionsPage() {
  const { user } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [centerId, setCenterId] = useState<string>("");
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  const [from, setFrom] = useState<string>(fmt(firstOfMonth));
  const [to, setTo] = useState<string>(fmt(today));
  const [shift, setShift] = useState<Shift | "">("");
  const [rows, setRows] = useState<RowFromApi[]>([]);

  useEffect(() => {
    void (async () => {
      const [c, d] = await Promise.all([
        api<{ centers: Center[] }>("/centers"),
        api<{ devices: Device[] }>("/devices"),
      ]);
      setCenters(c.centers);
      setDevices(d.devices);
      const initial =
        user?.role === "manager" && user.centerId
          ? user.centerId
          : (c.centers[0]?.id ?? "");
      setCenterId(initial);
    })().catch(() => undefined);
  }, [user]);

  const load = async () => {
    if (!centerId) return;
    const params = new URLSearchParams({
      centerId,
      from,
      to,
    });
    if (shift) params.set("shift", shift);
    const data = await api<{ rows: RowFromApi[] }>(`/sessions?${params}`);
    setRows(data.rows);
  };

  useEffect(() => {
    void load();
  }, [centerId, from, to, shift]);

  const pivot = useMemo(() => {
    const byDateShift = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const key = `${r.sessionDate}__${r.shift}`;
      let m = byDateShift.get(key);
      if (!m) {
        m = new Map<string, number>();
        byDateShift.set(key, m);
      }
      if (r.deviceId) m.set(r.deviceId, (m.get(r.deviceId) ?? 0) + (r.count ?? 0));
    }
    const sorted = [...byDateShift.entries()].sort(([a], [b]) =>
      a < b ? -1 : 1,
    );
    return sorted;
  }, [rows]);

  const colTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const [, row] of pivot) {
      for (const [deviceId, n] of row) {
        m.set(deviceId, (m.get(deviceId) ?? 0) + n);
      }
    }
    return m;
  }, [pivot]);

  const onExport = () => {
    const header = [
      "date",
      "shift",
      ...devices.map((d) => d.nameEn),
      "row_total",
    ];
    const lines = [header.join(",")];
    for (const [key, row] of pivot) {
      const [date, sh] = key.split("__");
      let total = 0;
      const cells = devices.map((d) => {
        const n = row.get(d.id) ?? 0;
        total += n;
        return String(n);
      });
      lines.push([date, sh, ...cells, String(total)].join(","));
    }
    const totalsRow = [
      "TOTAL",
      "",
      ...devices.map((d) => String(colTotals.get(d.id) ?? 0)),
      String(
        devices.reduce((acc, d) => acc + (colTotals.get(d.id) ?? 0), 0),
      ),
    ];
    lines.push(totalsRow.join(","));
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sessions_${centerId}_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isManager = user?.role === "manager";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">سجلات الجلسات</h2>

      <div className="bg-white rounded-lg border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
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
            من
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            إلى
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            الوردية
          </label>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as Shift | "")}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">الكل</option>
            <option value="morning">صباحي</option>
            <option value="evening">مسائي</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={onExport}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-md"
          >
            تصدير CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-start px-3 py-2 sticky start-0 bg-slate-100">
                التاريخ
              </th>
              <th className="text-start px-3 py-2">الوردية</th>
              {devices.map((d) => (
                <th key={d.id} className="text-start px-3 py-2 whitespace-nowrap">
                  {d.nameAr}
                </th>
              ))}
              <th className="text-start px-3 py-2 font-bold">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {pivot.length === 0 ? (
              <tr>
                <td
                  colSpan={devices.length + 3}
                  className="text-center text-slate-500 py-6"
                >
                  لا توجد سجلات
                </td>
              </tr>
            ) : (
              pivot.map(([key, row]) => {
                const [date, sh] = key.split("__");
                let rowTotal = 0;
                const cells = devices.map((d) => {
                  const n = row.get(d.id) ?? 0;
                  rowTotal += n;
                  return n;
                });
                return (
                  <tr key={key} className="border-t border-slate-100">
                    <td className="px-3 py-2 sticky start-0 bg-white">
                      {date}
                    </td>
                    <td className="px-3 py-2">
                      {sh === "morning" ? "صباحي" : "مسائي"}
                    </td>
                    {cells.map((n, i) => (
                      <td key={i} className="px-3 py-2 text-end font-mono">
                        {n}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-end font-mono font-bold">
                      {rowTotal}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {pivot.length > 0 && (
            <tfoot className="bg-slate-50 font-bold">
              <tr>
                <td
                  className="px-3 py-2 sticky start-0 bg-slate-50"
                  colSpan={2}
                >
                  المجموع
                </td>
                {devices.map((d) => (
                  <td key={d.id} className="px-3 py-2 text-end font-mono">
                    {colTotals.get(d.id) ?? 0}
                  </td>
                ))}
                <td className="px-3 py-2 text-end font-mono">
                  {devices.reduce(
                    (acc, d) => acc + (colTotals.get(d.id) ?? 0),
                    0,
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
