import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { ChangePasswordPage } from "./pages/ChangePassword";
import { EntryPage } from "./pages/Entry";
import { TargetsPage } from "./pages/Targets";
import { SessionsPage } from "./pages/Sessions";
import { CentersAdminPage } from "./pages/admin/Centers";
import { DevicesAdminPage } from "./pages/admin/Devices";
import { UsersAdminPage } from "./pages/admin/Users";
import type { UserRole } from "./types";
import type { ReactNode } from "react";

function Protected({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserRole[];
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-center">جارٍ التحميل…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/entry" replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center">جارٍ التحميل…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Navigate to="/entry" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/entry" element={<EntryPage />} />
          <Route
            path="/targets"
            element={
              <Protected roles={["admin", "manager"]}>
                <TargetsPage />
              </Protected>
            }
          />
          <Route
            path="/sessions"
            element={
              <Protected roles={["admin", "manager"]}>
                <SessionsPage />
              </Protected>
            }
          />
          <Route
            path="/admin/centers"
            element={
              <Protected roles={["admin"]}>
                <CentersAdminPage />
              </Protected>
            }
          />
          <Route
            path="/admin/devices"
            element={
              <Protected roles={["admin"]}>
                <DevicesAdminPage />
              </Protected>
            }
          />
          <Route
            path="/admin/users"
            element={
              <Protected roles={["admin"]}>
                <UsersAdminPage />
              </Protected>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
