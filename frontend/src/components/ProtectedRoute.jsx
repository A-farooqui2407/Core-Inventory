import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { authEnabled, isAuthenticated, authChecked } = useAuth();
  const location = useLocation();

  if (!authChecked) {
    return <div className="page"><p aria-live="polite">Checking auth…</p></div>;
  }

  if (authEnabled && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
