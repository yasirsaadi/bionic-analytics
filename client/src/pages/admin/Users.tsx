import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type { Center, UserRole, UserRow } from "../../types";

export function UsersAdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("reception");
  const [centerId, setCenterId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPwd, setResetPwd] = useState("");

  const load = async () => {
    const [u, c] = await Promise.all([
      api<{ users: UserRow[] }>("/users"),
      api<{ centers: Center[] }>("/centers"),
    ]);
    setUsers(u.users);
    setCenters(c.centers);
    if (!centerId && c.centers[0]) setCenterId(c.centers[0].id);
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    setError(null);
    try {
      await api("/users", {
        method: "POST",
        json: {
          fullName,
          username,
          password,
          role,
          centerId: role === "admin" ? null : centerId,
        },
      });
      setFullName("");
      setUsername("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "فشل الإنشاء");
    }
  };

  const onToggleActive = async (u: UserRow) => {
    await api(`/users/${u.id}/active`, {
      method: "PATCH",
      json: { isActive: !u.isActive },
    });
    await load();
  };

  const onResetPassword = async () => {
    if (!resetUserId) return;
    await api("/users/reset-password", {
      method: "POST",
      json: { userId: resetUserId, newPassword: resetPwd },
    });
    setResetUserId(null);
    setResetPwd("");
    await load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">إدارة المستخدمين</h2>

      <div className="bg-white rounded-lg border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <input
          placeholder="الاسم الكامل"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          type="password"
          placeholder="كلمة المرور المؤقتة"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          <option value="admin">مدير النظام</option>
          <option value="manager">مدير مركز</option>
          <option value="reception">استقبال</option>
        </select>
        <select
          value={centerId}
          onChange={(e) => setCenterId(e.target.value)}
          disabled={role === "admin"}
          className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
        >
          <option value="">— لا مركز —</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr}
            </option>
          ))}
        </select>
        <button
          onClick={onCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2"
        >
          إضافة مستخدم
        </button>
        {error && (
          <p className="md:col-span-6 text-red-700 text-sm">{error}</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-start px-4 py-2">الاسم</th>
              <th className="text-start px-4 py-2">المستخدم</th>
              <th className="text-start px-4 py-2">الدور</th>
              <th className="text-start px-4 py-2">المركز</th>
              <th className="text-start px-4 py-2">الحالة</th>
              <th className="text-start px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const center = centers.find((c) => c.id === u.centerId);
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{u.fullName}</td>
                  <td className="px-4 py-2 font-mono">{u.username}</td>
                  <td className="px-4 py-2">{u.role}</td>
                  <td className="px-4 py-2">{center?.nameAr ?? "—"}</td>
                  <td className="px-4 py-2">
                    {u.isActive ? "نشط" : "غير نشط"}
                  </td>
                  <td className="px-4 py-2 text-end space-x-2 space-x-reverse">
                    <button
                      onClick={() => setResetUserId(u.id)}
                      className="text-sm bg-amber-100 hover:bg-amber-200 text-amber-900 rounded px-3 py-1"
                    >
                      إعادة تعيين كلمة المرور
                    </button>
                    <button
                      onClick={() => onToggleActive(u)}
                      className="text-sm bg-slate-100 hover:bg-slate-200 rounded px-3 py-1"
                    >
                      {u.isActive ? "تعطيل" : "تفعيل"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {resetUserId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold">إعادة تعيين كلمة المرور</h3>
            <input
              type="password"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              placeholder="كلمة المرور الجديدة"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setResetUserId(null)}
                className="px-3 py-2 rounded-md bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={onResetPassword}
                className="px-3 py-2 rounded-md bg-blue-600 text-white"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
