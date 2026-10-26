import SubdistrictDetailPage from '../pages/subdistricts/SubdistrictDetailPage';
import UnitDetailPage from '../pages/units/UnitDetailPage';
import GroupDetailPage from '../pages/groups/GroupDetailPage';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import Login from '../pages/auth/Login';
import Layout from '../components/layout/Layout';
import useAuth from '../hooks/useAuth';
import MembersPage from '../pages/members/MembersPage';
import MemberDetailPage from '../pages/members/MemberDetailPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import GroupsPage from '../pages/groups/GroupsPage';
import UnitsPage from '../pages/units/UnitsPage';
import SubdistrictsPage from '../pages/subdistricts/SubdistrictsPage';
import InactiveMembersPage from '../pages/inactiveMembers/InactiveMembersPage';
import CommunicationPage from '../pages/communication/CommunicationPage';
import AnalyticsPage from '../pages/analytics/AnalyticsPage';
import RagPage from '../pages/rag/RagPage';
import SettingsPage from '../pages/settings/SettingsPage';
import { INACTIVE_MEMBER_ACCESS_ROLES } from '../permissions/inactiveMember';
import {
  getDashboardPath,
  MEMBERS_ACCESS_ROLES,
  GROUPS_ACCESS_ROLES,
  UNITS_ACCESS_ROLES,
  SUBDISTRICTS_ACCESS_ROLES,
  COMMUNICATION_ACCESS_ROLES,
  ANALYTICS_ACCESS_ROLES,
  RAG_ACCESS_ROLES,
  SETTINGS_ACCESS_ROLES
} from '../permissions';

/* ── Root redirect — waits for auth to resolve ───────────────── */
const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={getDashboardPath(user.role)} replace />;
};

/* ── App Router ──────────────────────────────────────────────── */
const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Protected — dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected — analytics */}
      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={ANALYTICS_ACCESS_ROLES}>
            <Layout>
              <AnalyticsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected — members list */}
      <Route
        path="/members"
        element={
          <ProtectedRoute allowedRoles={MEMBERS_ACCESS_ROLES}>
            <Layout>
              <MembersPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected — groups */}
      <Route
        path="/groups"
        element={
          <ProtectedRoute allowedRoles={GROUPS_ACCESS_ROLES}>
            <Layout>
              <GroupsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected — units */}
      <Route
        path="/units"
        element={
          <ProtectedRoute allowedRoles={UNITS_ACCESS_ROLES}>
            <Layout>
              <UnitsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected — subdistricts */}
      <Route
        path="/subdistricts"
        element={
          <ProtectedRoute allowedRoles={SUBDISTRICTS_ACCESS_ROLES}>
            <Layout>
              <SubdistrictsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected — inactive members */}
      <Route
        path="/inactive-members"
        element={
          <ProtectedRoute allowedRoles={INACTIVE_MEMBER_ACCESS_ROLES}>
            <Layout>
              <InactiveMembersPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected — communication */}
      <Route
        path="/communication"
        element={
          <ProtectedRoute allowedRoles={COMMUNICATION_ACCESS_ROLES}>
            <Layout>
              <CommunicationPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected - RAG */}
      <Route
        path="/rag"
        element={
          <ProtectedRoute allowedRoles={RAG_ACCESS_ROLES}>
            <Layout>
              <RagPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected - settings */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={SETTINGS_ACCESS_ROLES}>
            <Layout>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected — member detail */}
      <Route
        path="/members/:id"
        element={
          <ProtectedRoute allowedRoles={MEMBERS_ACCESS_ROLES}>
            <Layout>
              <MemberDetailPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="/groups/:id" element={<ProtectedRoute allowedRoles={GROUPS_ACCESS_ROLES}><Layout><GroupDetailPage /></Layout></ProtectedRoute>} />
      <Route path="/units/:id" element={<ProtectedRoute allowedRoles={UNITS_ACCESS_ROLES}><Layout><UnitDetailPage /></Layout></ProtectedRoute>} />
      <Route path="/subdistricts/:id" element={<ProtectedRoute allowedRoles={SUBDISTRICTS_ACCESS_ROLES}><Layout><SubdistrictDetailPage /></Layout></ProtectedRoute>} />
      {/* Catchall */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
