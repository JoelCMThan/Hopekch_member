import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();
  const roleList = Array.isArray(allowedRoles) ? allowedRoles : [];

  if (loading) {
    return (
      <div className="route-loading">
        <div className="route-loading__content">
          <div className="route-loading__spinner" />
          <p className="route-loading__text">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roleList.length > 0 && !roleList.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;