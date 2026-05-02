import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { ApiError } from "../api";

export function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const nav = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("يجب أن لا تقل كلمة المرور الجديدة عن 8 أحرف");
      return;
    }
    if (next !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      nav("/entry", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "تعذّر تغيير كلمة المرور",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-slate-50 py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-xl font-bold text-center mb-1 text-blue-700">
          تغيير كلمة المرور
        </h1>
        {user.mustChangePassword && (
          <p className="text-center text-sm text-amber-600 mb-4">
            مطلوب تغيير كلمة المرور قبل المتابعة
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="كلمة المرور الحالية"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
          <Field
            label="كلمة المرور الجديدة"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
          />
          <Field
            label="تأكيد كلمة المرور الجديدة"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-md"
          >
            {submitting ? "…جارٍ الحفظ" : "حفظ"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
    </div>
  );
}
