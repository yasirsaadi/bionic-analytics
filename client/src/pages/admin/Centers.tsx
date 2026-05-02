import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type { Center } from "../../types";

export function CentersAdminPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const data = await api<{ centers: Center[] }>("/centers");
    setCenters(data.centers);
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    setError(null);
    try {
      await api("/centers", {
        method: "POST",
        json: { nameAr, nameEn, city },
      });
      setNameAr("");
      setNameEn("");
      setCity("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشل الإنشاء");
    }
  };

  const onToggle = async (c: Center) => {
    await api(`/centers/${c.id}`, {
      method: "PATCH",
      json: { isActive: !c.isActive },
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">إدارة المراكز</h2>

      <div className="bg-white rounded-lg border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          placeholder="الاسم بالعربية"
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          placeholder="Name in English"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          placeholder="المدينة"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <button
          onClick={onCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2"
        >
          إضافة مركز
        </button>
        {error && (
          <p className="md:col-span-4 text-red-700 text-sm">{error}</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-start px-4 py-2">الاسم</th>
              <th className="text-start px-4 py-2">المدينة</th>
              <th className="text-start px-4 py-2">الحالة</th>
              <th className="text-start px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {centers.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <div className="font-medium">{c.nameAr}</div>
                  <div className="text-xs text-slate-500">{c.nameEn}</div>
                </td>
                <td className="px-4 py-2">{c.city}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      c.isActive
                        ? "text-emerald-700 text-xs font-medium"
                        : "text-slate-400 text-xs"
                    }
                  >
                    {c.isActive ? "نشط" : "غير نشط"}
                  </span>
                </td>
                <td className="px-4 py-2 text-end">
                  <button
                    onClick={() => onToggle(c)}
                    className="text-sm bg-slate-100 hover:bg-slate-200 rounded px-3 py-1"
                  >
                    {c.isActive ? "تعطيل" : "تفعيل"}
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
