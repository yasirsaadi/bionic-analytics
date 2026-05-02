import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const linkBase =
  "px-3 py-2 rounded-md text-sm font-medium transition-colors";
const active = "bg-blue-600 text-white";
const inactive = "text-slate-700 hover:bg-slate-200";

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    nav("/login", { replace: true });
  };

  const showTargets = user.role === "admin" || user.role === "manager";
  const showSessions = user.role === "admin" || user.role === "manager";
  const showAdmin = user.role === "admin";

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-blue-700">
              متابعة الجلسات
              <span className="text-xs text-slate-500 ms-2">
                Physio Daily Tracker
              </span>
            </h1>
            <nav className="flex items-center gap-1">
              <NavLink
                to="/entry"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? active : inactive}`
                }
              >
                إدخال
              </NavLink>
              {showTargets && (
                <NavLink
                  to="/targets"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? active : inactive}`
                  }
                >
                  الأهداف
                </NavLink>
              )}
              {showSessions && (
                <NavLink
                  to="/sessions"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? active : inactive}`
                  }
                >
                  السجلات
                </NavLink>
              )}
              {showAdmin && (
                <>
                  <NavLink
                    to="/admin/centers"
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? active : inactive}`
                    }
                  >
                    المراكز
                  </NavLink>
                  <NavLink
                    to="/admin/devices"
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? active : inactive}`
                    }
                  >
                    الأجهزة
                  </NavLink>
                  <NavLink
                    to="/admin/users"
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? active : inactive}`
                    }
                  >
                    المستخدمون
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {user.fullName}{" "}
              <span className="text-slate-400">({roleLabel(user.role)})</span>
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-md text-sm bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              خروج
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "مدير النظام";
    case "manager":
      return "مدير المركز";
    case "reception":
      return "استقبال";
    default:
      return role;
  }
}
