import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-futuristic flex items-center justify-center">
        <div className="glass p-8 rounded-lg">
          <div className="spinner h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full"></div>
          <p className="text-white mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export const ModuleGuard = ({ moduleKey, children }) => {
  const { user, hasModuleAccess } = useAuth();
  const location = useLocation();

  if (!user || user.role === 'admin' || !moduleKey) {
    return children;
  }

  if (!hasModuleAccess(moduleKey)) {
    return <Navigate to="/admin" replace state={{ from: location }} />;
  }

  return children;
};

export const AdminGuard = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return <Navigate to="/admin" replace state={{ from: location }} />;
  }
  return children;
};

export const ColaboradorGuard = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') {
    return <Navigate to="/admin" replace state={{ from: location }} />;
  }
  return children;
};

export default ProtectedRoute;
