import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ALL_INTERNAL_MODULE_KEYS, deriveAllowedModules, resolveModuleFromPath } from '../config/modules';

const AuthContext = createContext();
const DEV_BYPASS_AUTH = false;
const DEV_BYPASS_TOKEN = 'dev-bypass-token';
const DEV_USER = {
  id: 'dev-user',
  email: 'dev@macedosi.local',
  name: 'Desenvolvimento',
  role: 'admin',
  linked_client_ids: [
    'c8f3d',
    'ca18c',
  ],
  allowed_cities: [],
  allowed_sectors: [],
  allowed_modules: [...ALL_INTERNAL_MODULE_KEYS],
  permissoes: [],
  is_active: true,
  created_at: new Date().toISOString(),
};

const MODULE_OVERRIDES_KEY = 'mock_user_modules_overrides_v1';
const CLIENT_PORTAL_USERS_KEY = 'mock_client_portal_users_v1';

const tryClientPortalLogin = (email, password) => {
  try {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPassword = String(password || '').trim();
    const portalUsers = JSON.parse(localStorage.getItem(CLIENT_PORTAL_USERS_KEY) || '[]');
    if (!Array.isArray(portalUsers)) return null;

    const match = portalUsers.find(
      (item) =>
        String(item.email || '').trim().toLowerCase() === normalizedEmail &&
        String(item.senha || '').trim() === normalizedPassword,
    );

    if (!match) return null;

    const linkedClientIds = [
      ...(Array.isArray(match.linkedClientIds) ? match.linkedClientIds : []),
      ...(Array.isArray(match.linkedClientRefs) ? match.linkedClientRefs : []),
      ...(match.clienteId ? [match.clienteId] : []),
      ...(match.clientRefId ? [match.clientRefId] : []),
    ];

    return {
      id: match.id || `portal-${normalizedEmail}`,
      email: normalizedEmail,
      name: match.nome || normalizedEmail.split('@')[0],
      role: 'cliente',
      linked_client_ids: [...new Set(linkedClientIds.map((item) => String(item).trim()).filter(Boolean))],
      allowed_cities: [],
      allowed_sectors: [],
      allowed_modules: ['dashboard', 'chat', 'documentos', 'servicos', 'financeiro', 'fiscal', 'trabalhista', 'atendimento', 'academy', 'macedogram'],
      permissoes: [],
      is_active: true,
      is_online: true,
      mock_client_login: true,
      created_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const applyModulePermissions = (userData) => {
  if (!userData) return null;

  let mergedUser = { ...userData };

  try {
    const overrides = JSON.parse(localStorage.getItem(MODULE_OVERRIDES_KEY) || '{}');
    const overrideForEmail = mergedUser.email ? overrides[mergedUser.email] : null;

    if (Array.isArray(overrideForEmail) && mergedUser.role !== 'admin') {
      mergedUser.allowed_modules = overrideForEmail;
    }
  } catch (error) {
    console.warn('Erro ao ler overrides de modulos:', error);
  }

  return {
    ...mergedUser,
    allowed_modules: deriveAllowedModules(mergedUser),
  };
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    if (DEV_BYPASS_AUTH) {
      return applyModulePermissions(DEV_USER);
    }

    const savedUser = localStorage.getItem('user');
    return savedUser ? applyModulePermissions(JSON.parse(savedUser)) : null;
  });
  const [loading, setLoading] = useState(!DEV_BYPASS_AUTH);
  const [token, setToken] = useState(() => {
    if (DEV_BYPASS_AUTH) {
      return DEV_BYPASS_TOKEN;
    }

    return localStorage.getItem('token');
  });

  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      delete axios.defaults.headers.common['Authorization'];
      return;
    }

    if (token && token !== DEV_BYPASS_TOKEN) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      if (token === DEV_BYPASS_TOKEN) {
        const savedUserRaw = localStorage.getItem('user');
        if (savedUserRaw) {
          try {
            const savedUser = JSON.parse(savedUserRaw);
            if (savedUser?.mock_client_login) {
              const userWithModules = applyModulePermissions(savedUser);
              setUser(userWithModules);
              setLoading(false);
              return;
            }
          } catch {
            // segue fluxo normal
          }
        }
      }

      if (token) {
        try {
          const response = await axios.get(`${API_URL}/api/auth/me`);
          const userWithModules = applyModulePermissions(response.data);
          setUser(userWithModules);
          localStorage.setItem('user', JSON.stringify(userWithModules));
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
    if (DEV_BYPASS_AUTH) {
      const devUser = applyModulePermissions(DEV_USER);
      setUser(devUser);
      setToken(DEV_BYPASS_TOKEN);
      localStorage.setItem('user', JSON.stringify(devUser));
      localStorage.setItem('token', DEV_BYPASS_TOKEN);
      delete axios.defaults.headers.common['Authorization'];
      return { success: true };
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });

      const { access_token, user: userData } = response.data;
      const userWithModules = applyModulePermissions(userData);

      setToken(access_token);
      setUser(userWithModules);
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userWithModules));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      toast.success('Login realizado com sucesso!', {
        description: `Bem-vindo, ${userWithModules.name}!`,
      });

      return { success: true };
    } catch (error) {
      const localClientUser = tryClientPortalLogin(email, password);
      if (localClientUser) {
        const userWithModules = applyModulePermissions(localClientUser);
        setToken(DEV_BYPASS_TOKEN);
        setUser(userWithModules);
        localStorage.setItem('token', DEV_BYPASS_TOKEN);
        localStorage.setItem('user', JSON.stringify(userWithModules));
        delete axios.defaults.headers.common['Authorization'];

        toast.success('Login do cliente realizado com sucesso!', {
          description: `Bem-vindo, ${userWithModules.name}!`,
        });

        return { success: true };
      }

      const message = error.response?.data?.detail || 'Erro ao fazer login';
      toast.error('Erro no login', {
        description: message,
      });
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const notifyOffline = () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken || DEV_BYPASS_AUTH) return;

    fetch(`${API_URL}/api/chat/offline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    }).catch(() => {});
  };

  const logout = () => {
    notifyOffline();
    setToken(DEV_BYPASS_AUTH ? DEV_BYPASS_TOKEN : null);
    setUser(DEV_BYPASS_AUTH ? applyModulePermissions(DEV_USER) : null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];

    if (!DEV_BYPASS_AUTH) {
      toast.info('Logout realizado', {
        description: 'Voce foi desconectado do sistema.',
      });
    }
  };

  const updateLocalUser = (patch = {}) => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      const nextUser = applyModulePermissions({ ...currentUser, ...patch });
      localStorage.setItem('user', JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const hasAccess = (cities = [], sectors = []) => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const hasCity = cities.length === 0 || cities.some((city) => user.allowed_cities.includes(city));
    const hasSector = sectors.length === 0 || sectors.some((sector) => user.allowed_sectors.includes(sector));

    return hasCity && hasSector;
  };

  const hasModuleAccess = (moduleKey) => {
    if (!user) return false;
    if (moduleKey === 'configuracoes' && user.role !== 'admin') return false;
    if (moduleKey === 'clientes') return true;
    if (moduleKey === 'documentos') return true;
    if (moduleKey === 'ourolandia') return true;
    if (user.role === 'admin') return true;
    if (!moduleKey) return true;
    return (user.allowed_modules || []).includes(moduleKey);
  };

  const canAccessPath = (pathname) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const moduleKey = resolveModuleFromPath(pathname);
    if (!moduleKey) return true;
    return hasModuleAccess(moduleKey);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    hasAccess,
    hasModuleAccess,
    canAccessPath,
    updateLocalUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
