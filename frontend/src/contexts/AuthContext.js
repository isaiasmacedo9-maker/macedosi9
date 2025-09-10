import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_URL}/api/auth/me`);
          setUser(response.data);
        } catch (error) {
          console.error('Auth check failed:', error);
          logout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token, API_URL]);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });

      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      
      // Configure axios with new token immediately
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      toast.success('Login realizado com sucesso!', {
        description: `Bem-vindo, ${userData.name}!`,
      });

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao fazer login';
      toast.error('Erro no login', {
        description: message,
      });
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    
    toast.info('Logout realizado', {
      description: 'Você foi desconectado do sistema.',
    });
  };

  const hasAccess = (cities = [], sectors = []) => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const hasCity = cities.length === 0 || cities.some(city => user.allowed_cities.includes(city));
    const hasSector = sectors.length === 0 || sectors.some(sector => user.allowed_sectors.includes(sector));

    return hasCity && hasSector;
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    hasAccess,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};