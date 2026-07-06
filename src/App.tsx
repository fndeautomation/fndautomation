import { Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './modules/auth/AuthContext';
import FNDLoader from './components/shared/FNDLoader';
import AppShell from './components/shared/AppShell';
import LoginPage from './modules/auth/LoginPage';
import ForgotPasswordPage from './modules/auth/ForgotPasswordPage';
import AcceptInvitePage from './modules/auth/AcceptInvitePage';
import SetupPage from './modules/setup/SetupPage';
import AdminDashboard from './modules/admin/AdminDashboard';
import FinanceDashboard from './modules/finance/FinanceDashboard';
import DirectorDashboard from './modules/director/DirectorDashboard';
import { supabase } from './lib/supabase';
import { Toaster } from './components/ui/toaster';

// Redirect authenticated users to their role-appropriate dashboard
function RoleRedirect() {
  const { profile } = useAuth();
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.status === 'pending') return <Navigate to="/accept-invite" replace />;
  if (profile.role === 'admin') return <Navigate to="/admin/users" replace />;
  if (profile.role === 'finance_officer') return <Navigate to="/finance/projects" replace />;
  if (profile.role === 'director_pm') return <Navigate to="/director/projects" replace />;
  return <Navigate to="/login" replace />;
}

// Guards
function RequireAuth({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FNDLoader />;
  if (!user || !profile) return <Navigate to="/login" state={{ from: location }} replace />;
  if (profile.status === 'pending' && !location.pathname.startsWith('/accept-invite')) {
    return <Navigate to="/accept-invite" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    // Redirect to their own dashboard
    if (profile.role === 'admin') return <Navigate to="/admin/users" replace />;
    if (profile.role === 'finance_officer') return <Navigate to="/finance/projects" replace />;
    if (profile.role === 'director_pm') return <Navigate to="/director/projects" replace />;
  }
  return <>{children}</>;
}

// Redirect already-logged-in users away from public pages
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <FNDLoader />;
  if (user && profile) return <RoleRedirect />;
  return <>{children}</>;
}

// Guard the /setup route
function SetupGuard({ children }: { children: React.ReactNode }) {
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAdminExists(true);
          navigate('/login', { replace: true });
        } else {
          setAdminExists(false);
        }
      });
  }, [navigate]);

  if (adminExists === null) return <FNDLoader message="Checking setup…" />;
  if (adminExists) return null;
  return <>{children}</>;
}

export default function App() {
  const { loading } = useAuth();

  if (loading) return <FNDLoader />;

  return (
    <>
      <Suspense fallback={<FNDLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/setup" element={<SetupGuard><SetupPage /></SetupGuard>} />

          {/* Admin routes */}
          <Route
            path="/admin/*"
            element={
              <RequireAuth allowedRoles={['admin']}>
                <AppShell>
                  <AdminDashboard />
                </AppShell>
              </RequireAuth>
            }
          />

          {/* Finance Officer routes */}
          <Route
            path="/finance/*"
            element={
              <RequireAuth allowedRoles={['finance_officer']}>
                <AppShell>
                  <FinanceDashboard />
                </AppShell>
              </RequireAuth>
            }
          />

          {/* Director / PM routes */}
          <Route
            path="/director/*"
            element={
              <RequireAuth allowedRoles={['director_pm']}>
                <AppShell>
                  <DirectorDashboard />
                </AppShell>
              </RequireAuth>
            }
          />

          {/* Root redirect */}
          <Route path="/" element={<RequireAuth><RoleRedirect /></RequireAuth>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
