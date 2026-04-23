import React, { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Scale,
  Headphones,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Wallet,
  MessageCircle,
  Briefcase,
  Calculator,
  GraduationCap,
} from 'lucide-react';
import MacedoLogo from '../Brand/MacedoLogo';
import ThemeToggle from '../ThemeToggle';
import NotificationBell from '../NotificationBell';
import { Z_LAYERS } from '../../constants/zLayers';

const Layout = ({ children }) => {
  const { user, logout, hasModuleAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const showSectorAlertsShortcut = useMemo(() => {
    const path = location.pathname || '';
    const sectorRoots = ['/atendimento', '/comercial', '/financeiro', '/fiscal', '/contadores', '/trabalhista'];
    return sectorRoots.some((root) => path === root || path.startsWith(`${root}/`));
  }, [location.pathname]);

  const menuItems = useMemo(
    () => [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/admin', moduleKey: 'dashboard' },
      { name: 'Serviços', icon: FileText, path: '/servicos', moduleKey: 'servicos' },
      { name: 'Documentos', icon: FileText, path: '/documentos', moduleKey: 'documentos' },
      { name: 'Lista de Clientes', icon: Users, path: '/clientes', moduleKey: 'clientes' },
      { name: 'Comercial', icon: Briefcase, path: '/comercial', moduleKey: 'comercial' },
      { name: 'Contadores', icon: Calculator, path: '/contadores', moduleKey: 'contadores' },
      { name: 'Financeiro', icon: Wallet, path: '/financeiro', moduleKey: 'financeiro' },
      { name: 'Trabalhista', icon: FileText, path: '/trabalhista', moduleKey: 'trabalhista' },
      { name: 'Fiscal', icon: Scale, path: '/fiscal', moduleKey: 'fiscal' },
      { name: 'Macedo Academy', icon: GraduationCap, path: '/ourolandia', moduleKey: 'ourolandia' },
      { name: 'Atendimento', icon: Headphones, path: '/atendimento', moduleKey: 'atendimento' },
      { name: 'Chat', icon: MessageCircle, path: '/chat', moduleKey: 'chat' },
      { name: 'Configurações', icon: Settings, path: '/configuracoes', moduleKey: 'configuracoes', adminOnly: true },
    ],
    [],
  );

  const visibleMenuItems = menuItems.filter((item) => {
    if (!hasModuleAccess(item.moduleKey)) return false;
    if (item.adminOnly && user?.role !== 'admin') return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-futuristic">
      <div
        style={{ zIndex: Z_LAYERS.appSidebar }}
        className={`sidebar-futuristic fixed inset-y-0 left-0 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center space-x-3">
            <MacedoLogo size="md" className="ring-1 ring-white/15" />
            <div>
              <h1 className="text-lg font-bold text-white">Macedo SI</h1>
              <p className="text-[11px] uppercase tracking-[0.16em] text-red-200/90">Business Solutions</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white lg:hidden">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {visibleMenuItems.map((item) => {
            const isFinanceiroPath = [
              '/financeiro',
              '/clientes-financeiro',
              '/contas-receber',
              '/metricas-financeiras',
              '/contas-pagar',
            ].includes(location.pathname) || location.pathname.startsWith('/servicos-avulsos');
            const isActive =
              location.pathname === item.path ||
              (item.path === '/financeiro' && isFinanceiroPath);
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full rounded-xl px-4 py-2.5 text-left transition-all duration-200 ${
                  isActive
                    ? 'border border-red-500/30 bg-red-500/10 text-white'
                    : 'text-gray-300 hover:border hover:border-white/10 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center space-x-3">
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-4 flex items-center space-x-3">
            <div className="glow-red flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-600 via-red-500 to-red-700">
              <span className="text-sm font-bold text-white">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <button
                type="button"
                onClick={() => {
                  if (user?.role !== 'admin') {
                    navigate('/meus-dados');
                    setSidebarOpen(false);
                  }
                }}
                className={`text-sm font-medium ${user?.role !== 'admin' ? 'text-white hover:text-red-200' : 'text-white cursor-default'}`}
              >
                {user?.name}
              </button>
              <p className="text-xs capitalize text-gray-400">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-xl px-4 py-3 text-left text-gray-300 transition-all duration-200 hover:bg-red-500/10 hover:text-red-300"
          >
            <span className="flex items-center space-x-3">
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Sair</span>
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="glass-intense flex h-16 items-center justify-between border-b border-white/10 px-5">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white lg:hidden">
            <Menu className="h-6 w-6" />
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center space-x-4">
            {showSectorAlertsShortcut ? (
              <button
                type="button"
                onClick={() => navigate('/dashboard/alertas-setor')}
                className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20"
              >
                Alertas do Setor
              </button>
            ) : null}
            <div className="flex items-center space-x-2">
              <div className="status-online h-3 w-3 rounded-full" />
              <span className="text-sm text-gray-300">Sistema Integrado Local</span>
            </div>
            <NotificationBell
              mode="admin"
              userName={user?.name || 'Contabilidade'}
              user={user}
              hasModuleAccess={hasModuleAccess}
              onNavigate={(path) => navigate(path)}
            />
            <ThemeToggle compact />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">{children}</main>
      </div>

      {sidebarOpen && <div style={{ zIndex: Z_LAYERS.appSidebar - 1 }} className="fixed inset-0 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
};

export default Layout;
