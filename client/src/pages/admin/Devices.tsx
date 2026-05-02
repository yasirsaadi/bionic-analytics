import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type { Device } from "../../types";

export function DevicesAdminPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [displayOrder, setDisplayOrder] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const data = await api<{ devices: Device[] }>("/devices");
    setDevices(data.devices);
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    setError(null);
    try {
      await api("/devices", {
        method: "POST",
        json: { code, nameAr, nameEn, displayOrder },
      });
      setCode("");
      setNameAr("");
      setNameEn("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشل الإنشاء");
    }
  };

  const onToggle = async (d: Device) => {
    await api(`/devices/${d.id}`, {
      method: "PATCH",
      json: { isActive: !d.isActive },
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">إدارة الأجهزة</h2>

      <div className="bg-white rounded-lg border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          placeholder="code (slug)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          placeholder="الاسم بالعربية"
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          placeholder="Name (EN)"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          type="number"
          placeholder="ترتيب العرض"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(Number(e.target.value))}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <button
          onClick={onCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2"
        >
          إضافة جهاز
        </button>
        {error && (
          <p className="md:col-span-5 text-red-700 text-sm">{error}</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-start px-4 py-2">الترتيب</th>
              <th className="text-start px-4 py-2">الكود</th>
              <th className="text-start px-4 py-2">الاسم</th>
              <th className="text-start px-4 py-2">الحالة</th>
              <th className="text-start px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono">{d.displayOrder}</td>
                <td className="px-4 py-2 font-mono text-xs">{d.code}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{d.nameAr}</div>
                  <div className="text-xs text-slate-500">{d.nameEn}</div>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={
                      d.isActive
                        ? "text-emerald-700 text-xs font-medium"
                        : "text-slate-400 text-xs"
                    }
                  >
                    {d.isActive ? "نشط" : "غير نشط"}
                  </span>
                </td>
                <td className="px-4 py-2 text-end">
                  <button
                    onClick={() => onToggle(d)}
                    className="text-sm bg-slate-100 hover:bg-slate-200 rounded px-3 py-1"
                  >
                    {d.isActive ? "تعطيل" : "تفعيل"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
