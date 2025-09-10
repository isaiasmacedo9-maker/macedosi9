import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

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

export default ProtectedRoute;