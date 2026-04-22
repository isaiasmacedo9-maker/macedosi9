import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  Crown,
  Gift,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquare,
  ShieldCheck,
  Wallet,
  Briefcase,
  Move,
  Users2,
  X,
} from 'lucide-react';
import MacedoLogo from '../Brand/MacedoLogo';
import ThemeToggle from '../ThemeToggle';
import NotificationBell from '../NotificationBell';
import {
  ALL_CLIENTS_PORTAL_ID,
  getAccessiblePortalClients,
  getClientEnabledModulesByClientRefId,
  getConsolidatedPortalOverview,
  getPortalClientById,
  userHasAccessToPortalClient,
} from '../../dev/clientPortalData';
import { useAuth } from '../../contexts/AuthContext';
import { Z_LAYERS } from '../../constants/zLayers';

const topButtonBase =
  'group flex min-h-[92px] items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200';
const WHATSAPP_POSITION_KEY = 'mock_client_whatsapp_button_position_v1';

const ClientPortalLayout = ({ children }) => {
  const { clienteId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDraggingWhatsapp, setIsDraggingWhatsapp] = useState(false);
  const [whatsappPosition, setWhatsappPosition] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(WHATSAPP_POSITION_KEY) || 'null');
      if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
    } catch {}
    return null;
  });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const whatsappMovedRef = useRef(false);

  const accessibleClients = useMemo(() => getAccessiblePortalClients(user), [user]);
  const consolidatedContext = useMemo(() => getConsolidatedPortalOverview(user), [user]);
  const isAllCompaniesView = clienteId === ALL_CLIENTS_PORTAL_ID;
  const isMacedogramView = location.pathname.includes('/macedogram');
  const portalClient = useMemo(() => getPortalClientById(clienteId), [clienteId]);
  const enabledModules = useMemo(
    () => getClientEnabledModulesByClientRefId(portalClient?.clientRefId),
    [portalClient?.clientRefId],
  );
  const hasAccess = isAllCompaniesView
    ? accessibleClients.length > 0
    : userHasAccessToPortalClient(user, clienteId);

  useEffect(() => {
    if (!isDraggingWhatsapp) return undefined;

    const handleMove = (event) => {
      whatsappMovedRef.current = true;
      const x = event.clientX - dragOffsetRef.current.x;
      const y = event.clientY - dragOffsetRef.current.y;
      setWhatsappPosition({ x: Math.max(12, x), y: Math.max(12, y) });
    };

    const handleUp = () => {
      setIsDraggingWhatsapp(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingWhatsapp]);

  useEffect(() => {
    if (!whatsappPosition) return;
    localStorage.setItem(WHATSAPP_POSITION_KEY, JSON.stringify(whatsappPosition));
  }, [whatsappPosition]);

  const topNavItems = useMemo(() => {
    if (isAllCompaniesView) {
      return [
        {
          key: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          to: `/cliente/${ALL_CLIENTS_PORTAL_ID}`,
          isActive: location.pathname === `/cliente/${ALL_CLIENTS_PORTAL_ID}`,
          color: 'text-cyan-300',
          tone: 'border-cyan-500/35 bg-cyan-500/10',
        },
      ];
    }

    const items = [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        to: `/cliente/${clienteId}`,
        isActive: location.pathname === `/cliente/${clienteId}`,
        color: 'text-cyan-300',
        tone: 'border-cyan-500/35 bg-cyan-500/10',
        visible: true,
      },
      {
        key: 'impostos',
        label: 'Impostos',
        icon: ShieldCheck,
        to: `/cliente/${clienteId}/impostos`,
        isActive: location.pathname.includes('/impostos') || location.pathname.includes('/das'),
        color: 'text-amber-300',
        tone: 'border-amber-500/35 bg-amber-500/10',
        visible: enabledModules.impostos,
      },
      {
        key: 'gestao',
        label: 'Gestão',
        icon: Users2,
        to: `/cliente/${clienteId}/gestao`,
        isActive:
          location.pathname.includes('/gestao') ||
          location.pathname.includes('/documentos') ||
          location.pathname.includes('/notas-fiscais'),
        color: 'text-emerald-300',
        tone: 'border-emerald-500/35 bg-emerald-500/10',
        visible: true,
      },
      {
        key: 'financeiro',
        label: 'Financeiro',
        icon: Wallet,
        to: `/cliente/${clienteId}/financeiro`,
        isActive: location.pathname.includes('/financeiro') || location.pathname.includes('/relatorios'),
        color: 'text-blue-300',
        tone: 'border-blue-500/35 bg-blue-500/10',
        visible: enabledModules.financeiro || enabledModules.relatorios,
      },
      {
        key: 'servicos',
        label: 'Serviços',
        icon: Briefcase,
        to: `/cliente/${clienteId}/servicos`,
        isActive: location.pathname.includes('/servicos'),
        color: 'text-violet-300',
        tone: 'border-violet-500/35 bg-violet-500/10',
        visible: enabledModules.servicos,
      },
      {
        key: 'academy',
        label: 'Academy',
        icon: GraduationCap,
        to: `/cliente/${clienteId}/academy`,
        isActive: location.pathname.includes('/academy'),
        color: 'text-indigo-300',
        tone: 'border-indigo-500/35 bg-indigo-500/10',
        visible: enabledModules.academy,
      },
      {
        key: 'chat',
        label: 'Chat',
        icon: MessageSquare,
        to: `/cliente/${clienteId}/chat`,
        isActive: location.pathname.includes('/chat'),
        color: 'text-rose-300',
        tone: 'border-rose-500/35 bg-rose-500/10',
        visible: enabledModules.chat,
      },
    ];

    return items.filter((item) => item.visible);
  }, [isAllCompaniesView, location.pathname, clienteId, enabledModules]);

  if ((!isAllCompaniesView && !portalClient) || !hasAccess) {
    return (
      <div className="min-h-screen bg-futuristic px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl glass rounded-[28px] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/15 text-red-300">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold">Cliente não encontrado ou sem acesso</h1>
          <p className="mt-3 text-sm text-gray-400">Este identificador não está vinculado ao usuário atual.</p>
        </div>
      </div>
    );
  }

  const handleClientChange = (nextClientId) => {
    navigate(`/cliente/${nextClientId}`);
    setMobileOpen(false);
  };

  const handleOpenClientChat = () => {
    if (isAllCompaniesView) return;
    navigate(`/cliente/${clienteId}/chat`);
  };

  const handleWhatsappMouseDown = (event) => {
    whatsappMovedRef.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setIsDraggingWhatsapp(true);
  };

  const handleWhatsappClick = () => {
    if (whatsappMovedRef.current) return;
    const message = `Olá, preciso de suporte da contabilidade para ${portalClient?.nome_fantasia || 'minha empresa'}.`;
    window.open(`https://wa.me/5574333355000?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-futuristic text-white">
      <div className="flex min-h-screen">
        {!isMacedogramView ? (
          <aside
            style={{ zIndex: Z_LAYERS.appSidebar }}
            className={`sidebar-futuristic fixed inset-y-0 left-0 w-[280px] border-r border-white/10 transition-transform duration-300 lg:translate-x-0 ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-5">
                <div className="flex items-center gap-3">
                  <MacedoLogo size="md" className="ring-1 ring-white/15" />
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-red-200/90">Macedo SI</div>
                    <div className="text-sm font-semibold text-white">Portal do cliente</div>
                  </div>
                </div>

                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 p-2 text-gray-300 lg:hidden"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 px-3 py-4">
                <NavLink
                  to={isAllCompaniesView ? `/cliente/${ALL_CLIENTS_PORTAL_ID}` : `/cliente/${clienteId}/empresa`}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-2xl border px-4 py-3 ${
                      isActive && !isAllCompaniesView
                        ? 'border-red-500/35 bg-red-500/10'
                        : 'border-white/10 bg-black/20 hover:bg-white/5'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-red-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">Empresa</p>
                      <p className="text-xs text-gray-400">
                        {isAllCompaniesView ? 'Selecione uma empresa' : portalClient?.nome_fantasia}
                      </p>
                    </div>
                  </div>
                </NavLink>

                {accessibleClients.length > 1 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-3 text-xs uppercase tracking-[0.18em] text-gray-400">Empresas vinculadas</div>
                    <div className="space-y-2">
                      <button
                        onClick={() => handleClientChange(ALL_CLIENTS_PORTAL_ID)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left ${
                          isAllCompaniesView
                            ? 'border-red-500/35 bg-red-500/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-sm font-medium text-white">Todas as empresas</div>
                      </button>
                      {accessibleClients.map((item) => (
                        <button
                          key={item.clienteId}
                          onClick={() => handleClientChange(item.clienteId)}
                          className={`w-full rounded-xl border px-3 py-2.5 text-left ${
                            !isAllCompaniesView && item.clienteId === clienteId
                              ? 'border-red-500/35 bg-red-500/10'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-sm font-medium text-white">{item.nome_fantasia}</div>
                          <div className="text-xs text-gray-400">{item.regime_label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!isAllCompaniesView ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-3 text-xs uppercase tracking-[0.18em] text-gray-400">Módulos rápidos</div>
                    <div className="space-y-2">
                      {enabledModules?.macedogram ? (
                        <NavLink
                          to={`/cliente/${clienteId}/macedogram`}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                              isActive
                                ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                                : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'
                            }`
                          }
                        >
                          <MessageSquare className="h-5 w-5 text-sky-300" />
                          Macedogram
                        </NavLink>
                      ) : null}

                      {enabledModules?.clube_beneficios ? (
                        <NavLink
                          to={`/cliente/${clienteId}/clube-beneficios`}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                              isActive
                                ? 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-100'
                                : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'
                            }`
                          }
                        >
                          <Gift className="h-5 w-5 text-fuchsia-300" />
                          Clube de Benefícios
                        </NavLink>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-auto border-t border-white/10 px-3 py-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-medium text-white">{user?.name}</div>
                  <div className="mt-1 text-xs text-gray-400">{user?.email}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => navigate('/admin')}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:bg-white/10"
                    >
                      /admin
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        navigate('/login');
                      }}
                      className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        ) : null}

        <div className={`flex min-h-screen min-w-0 flex-1 flex-col ${isMacedogramView ? '' : 'lg:ml-[280px]'}`}>
          {!isMacedogramView ? (
            <header style={{ zIndex: Z_LAYERS.stickyHeader }} className="glass-intense sticky top-0 border-b border-white/10 px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMobileOpen(true)}
                    className="rounded-2xl border border-white/10 bg-white/5 p-2 text-gray-300 lg:hidden"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <MacedoLogo size="sm" className="hidden ring-1 ring-white/15 sm:block" />
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Portal do cliente</div>
                    <h1 className="text-lg font-semibold text-white">
                      {isAllCompaniesView ? 'Visão consolidada' : portalClient.nome_fantasia}
                    </h1>
                  </div>
                </div>

                {!isAllCompaniesView ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenClientChat}
                      className="hidden rounded-xl border border-sky-500/30 bg-sky-500/15 px-3 py-2 text-xs font-medium text-sky-100 hover:bg-sky-500/25 md:inline-flex"
                    >
                      Contato com a contabilidade
                    </button>
                    <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 sm:flex">
                      <Crown className="h-5 w-5 text-sky-300" />
                      <span className="text-sm text-white">{portalClient.regime_label}</span>
                    </div>
                    <NotificationBell
                      mode="client"
                      clientId={clienteId}
                      clientName={portalClient?.nome_fantasia}
                      onOpenClientChat={handleOpenClientChat}
                    />
                    <ThemeToggle compact />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:block">
                      <div className="text-xs text-gray-400">Empresas</div>
                      <div className="text-sm font-semibold text-white">{consolidatedContext?.resumo?.totalEmpresas || 0}</div>
                    </div>
                    <ThemeToggle compact />
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
                {topNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      className={`${topButtonBase} ${
                        item.isActive
                          ? `${item.tone} border-white/20 shadow-[0_8px_20px_rgba(0,0,0,0.22)]`
                          : 'border-white/10 bg-black/30 hover:bg-black/40'
                      }`}
                    >
                      <div className={`rounded-xl border border-white/10 bg-black/25 p-2.5 ${item.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-white">{item.label}</div>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            </header>
          ) : null}

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      {!isAllCompaniesView && !isMacedogramView ? (
        <button
          type="button"
          onMouseDown={handleWhatsappMouseDown}
          onClick={handleWhatsappClick}
          style={whatsappPosition ? { left: `${whatsappPosition.x}px`, top: `${whatsappPosition.y}px`, zIndex: Z_LAYERS.floatingWidget } : { zIndex: Z_LAYERS.floatingWidget }}
          className={`fixed ${whatsappPosition ? '' : 'bottom-6 right-6'} inline-flex cursor-move items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2.5 text-sm font-medium text-emerald-50 shadow-[0_10px_24px_rgba(0,0,0,0.28)] hover:bg-emerald-500/30`}
          title="WhatsApp de suporte (arrastável)"
        >
          <Move className="h-4 w-4 text-emerald-100/90" />
          WhatsApp suporte
        </button>
      ) : null}
    </div>
  );
};

export default ClientPortalLayout;
