import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading, error, retry } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Loading your account…</p>;
  if (error) return <div role="alert">{error} <button onClick={retry}>Try again</button></div>;
  if (!user) {
    const from = location.pathname + location.search + location.hash;
    return <Navigate to="/login" state={{ from }} replace />;
  }
  if (roles && !roles.includes(user.role)) return <p role="alert">Access denied.</p>;
  return children ?? <Outlet />;
}
