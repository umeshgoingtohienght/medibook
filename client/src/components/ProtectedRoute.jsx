import { Navigate, useLocation } from "react-router-dom";
import { homeFor, useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ roles, children }) {
  const { token, user, loading } = useAuth();
  const location = useLocation();
  if (loading || (token && !user)) return <div className="center"><div className="spinner" /></div>;
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}
