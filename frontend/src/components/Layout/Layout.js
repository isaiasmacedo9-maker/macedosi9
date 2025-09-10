import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  Scale,
  Headphones,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Wallet,
  MessageCircle
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
      access: [],
      emoji: '📊'
    },
    {
      name: 'Clientes',
      icon: Users,
      path: '/clientes',
      access: ['comercial'],
      emoji: '🏢'
    },
    {
      name: 'Clientes Financeiro',
      icon: Building2,
      path: '/clientes-financeiro',
      access: ['financeiro'],
      emoji: '💰'
    },
    {
      name: 'Contas a Receber',
      icon: Wallet,
      path: '/contas-receber',
      access: ['financeiro'],
      emoji: '💸'
    },
    {
      name: 'Trabalhista',
      icon: FileText,
      path: '/trabalhista',
      access: ['trabalhista'],
      emoji: '👥'
    },
    {
      name: 'Fiscal',
      icon: Scale,
      path: '/fiscal',
      access: ['fiscal'],
      emoji: '📋'
    },
    {
      name: 'Atendimento',
      icon: Headphones,
      path: '/atendimento',
      access: ['atendimento'],
      emoji: '📞'
    },
    {
      name: 'Chat',
      icon: MessageCircle,
      path: '/chat',
      access: [],
      emoji: '💬'
    },
    {
      name: 'Configurações',
      icon: Settings,
      path: '/configuracoes',
      access: [],
      emoji: '⚙️'
    }
  ];

  const hasMenuAccess = (access) => {
    if (user?.role === 'admin') return true;
    if (access.length === 0) return true;
    return access.some(sector => user?.allowed_sectors.includes(sector));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-futuristic">
      {/* Sidebar */}
      <div className={`sidebar-futuristic fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-red-600/30">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 via-red-500 to-red-700 rounded-lg flex items-center justify-center glow-red">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold neon-text-cosmic">🏢 Macedo SI</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => {
            if (!hasMenuAccess(item.access)) return null;
            
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-red-600 via-red-500 to-red-700 text-white glow-red border-cosmic'
                    : 'text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-red-900/20 hover:to-red-800/20 hover:border hover:border-red-600/30'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium flex items-center">
                  <span className="mr-2">{item.emoji}</span>
                  {item.name}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-red-600/30 p-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 via-red-500 to-red-700 rounded-full flex items-center justify-center glow-red">
              <span className="text-sm font-bold text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-white flex items-center">
                👤 {user?.name}
              </p>
              <p className="text-xs text-gray-400 capitalize flex items-center">
                {user?.role === 'admin' ? '👑' : '👨‍💼'} {user?.role}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">🚪 Sair</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="glass-intense h-16 flex items-center justify-between px-6 border-b border-red-600/30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 status-online rounded-full"></div>
              <span className="text-sm text-gray-300">🏠 Sistema Integrado Local</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;