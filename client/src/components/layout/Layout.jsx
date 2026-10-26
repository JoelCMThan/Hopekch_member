import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import {
  canAccessMembersPage,
  canAccessGroupsPage,
  canAccessUnitsPage,
  canAccessSubdistrictsPage,
  canAccessInactiveMembersPage,
  canAccessCommunicationsPage,
  canAccessAnalyticsPage,
  canAccessRagPage,
  canAccessSettingsPage,
  getRoleLabel
} from '../../permissions';
import './Layout.css';

/* ── Icons ──────────────────────────────────────────────────── */
const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const DashboardIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const MembersIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
  </svg>
);

const GroupsIcon = () => (
  <svg
    width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const UnitsIcon = () => (
  <svg
    width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M6 21V9l6-6 6 6v12" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

const SubdistrictsIcon = () => (
  <svg
    width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M3 12h18" />
    <path d="M3 18h18" />
    <path d="M7 3v18" />
    <path d="M17 3v18" />
  </svg>
);

const InactiveMembersIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="3" />
    <path d="M3 19c0-2.5 2.5-4.5 6-4.5s6 2 6 4.5" />
    <path d="M17 10h5" />
    <path d="M19.5 7.5v5" />
  </svg>
);

const CommunicationIcon = () => (
  <span
    className="material-symbols-outlined layout-nav-icon"

  >
    chat
  </span>
);

const AnalyticsIcon = () => (
  <span
    className="material-symbols-outlined layout-nav-icon"

  >
    monitoring
  </span>
);

const RagIcon = () => (
  <span className="material-symbols-outlined layout-nav-icon">
    auto_awesome
  </span>
);

const SettingsIcon = () => (
  <span className="material-symbols-outlined layout-nav-icon">
    settings
  </span>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/* ── Logout Confirmation Modal ──────────────────────────────── */
const LogoutModal = ({ onConfirm, onCancel }) => (
  <div
    className="logout-overlay"
    onClick={onCancel}
  >
    <div
      className="logout-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="logout-modal__title">
        Confirm Logout
      </h3>
      <p className="logout-modal__description">
        Are you sure you want to log out?
      </p>
      <div className="logout-modal__actions">
        <button
          onClick={onCancel}
          className="btn btn--ghost btn--sm"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="btn btn--danger btn--sm"
        >
          Logout
        </button>
      </div>
    </div>
  </div>
);

/* ── Layout ──────────────────────────────────────────────────── */
const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    ...(canAccessAnalyticsPage(user?.role)
    ? [{ path: '/analytics', label: 'Analytics', icon: <AnalyticsIcon /> }]
    : []),
    ...(canAccessMembersPage(user?.role)
      ? [{ path: '/members', label: 'Members', icon: <MembersIcon /> }]
      : []),
    ...(canAccessGroupsPage(user?.role)
      ? [{ path: '/groups', label: 'Groups', icon: <GroupsIcon /> }]
      : []),
    ...(canAccessUnitsPage(user?.role)
      ? [{ path: '/units', label: 'Units', icon: <UnitsIcon /> }]
      : []),
    ...(canAccessSubdistrictsPage(user?.role)
    ? [{
        path: '/subdistricts', label: 'Subdistricts', icon: <SubdistrictsIcon />
      }]
    : []),
    ...(canAccessInactiveMembersPage(user?.role)
      ? [{ path: '/inactive-members', label: 'Inactive Members', icon: <InactiveMembersIcon /> }]
      : []),
    ...(canAccessCommunicationsPage(user?.role)
      ? [{ path: '/communication', label: 'Communication', icon: <CommunicationIcon /> }]
      : []),
    ...(canAccessRagPage(user?.role)
      ? [{ path: '/rag', label: 'AI Assistant', icon: <RagIcon />}]
      : []),
    ...(canAccessSettingsPage(user?.role)
      ? [{ path: '/settings', label: 'Settings', icon: <SettingsIcon /> }]
      : []),
  ];

  return (
    <div className={`layout${collapsed ? ' layout--collapsed' : ''}`}>
      <aside className="sidebar">

        <div className="sidebar__brand">
          {!collapsed && (
            <div className="sidebar__brand-text">
              <span className="sidebar__church-name">Hope Church</span>
              <span className="sidebar__role-label">
                Role: {getRoleLabel(user?.role)}
              </span>
            </div>
          )}

          <button
            className="sidebar__toggle"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <MenuIcon />
          </button>
        </div>

        <nav className="sidebar__nav">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar__nav-item${
                isActive(item.path) ? ' sidebar__nav-item--active' : ''
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar__nav-icon">{item.icon}</span>
              {!collapsed && (
                <span className="sidebar__nav-label">{item.label}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button
            className="sidebar__logout"
            onClick={() => setShowLogoutModal(true)}
            title={collapsed ? 'Logout' : undefined}
          >
            <LogoutIcon />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

      </aside>

      <main className="layout__main">
        {children}
      </main>

      {showLogoutModal && (
        <LogoutModal
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}
    </div>
  );
};

export default Layout;
