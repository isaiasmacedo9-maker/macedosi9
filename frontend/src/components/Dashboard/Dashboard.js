import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { INTERNAL_MODULES } from '../../config/modules';
import { getDashboardTasks, getNewTasksForToday, getPendingTasks } from './dashboardTaskData';
import {
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  Building2,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileClock,
  FolderKanban,
  Headphones,
  MessageCircle,
  Scale,
  Settings,
  ShieldAlert,
  Users,
  Users2,
} from 'lucide-react';

const MOCK_SERVICES = [
  { id: 'srv-1', cliente: 'Loja Vila Centro', tipo: 'Certificado digital', status: 'em_andamento', moduleKey: 'servicos', criadoEm: '2026-04-10', assignedTo: ['dev-user'] },
  { id: 'srv-2', cliente: 'Macedo Comércio', tipo: 'Abertura de filial', status: 'novo', moduleKey: 'servicos', criadoEm: '2026-04-12', assignedTo: ['colaborador@macedosi.com'] },
  { id: 'srv-3', cliente: 'Clínica São Miguel', tipo: 'Regularização fiscal', status: 'concluido', moduleKey: 'servicos', criadoEm: '2026-04-02', assignedTo: ['dev-user'] },
];

const MOCK_ACTIVITIES = [
  { id: 'act-1', titulo: 'Serviço atualizado: Certificado digital', detalhe: 'Loja Vila Centro movido para em andamento', moduleKey: 'servicos', when: 'Agora', assignedTo: ['dev-user'] },
  { id: 'act-2', titulo: 'Novo processo fiscal criado', detalhe: 'Fechamento fiscal abril atribuído ao responsável', moduleKey: 'fiscal', when: 'Hoje, 09:24', assignedTo: ['dev-user', 'colaborador@macedosi.com'] },
  { id: 'act-3', titulo: 'Atendimento finalizado', detalhe: 'Retorno enviado para Clínica São Miguel', moduleKey: 'atendimento', when: 'Ontem', assignedTo: ['colaborador@macedosi.com'] },
];

const MOCK_DEADLINES = [
  { id: 'ddl-1', titulo: 'DAS - abril/2026', cliente: 'Macedo Comércio', valor: 640.2, moduleKey: 'fiscal', vencimento: '2026-04-20' },
  { id: 'ddl-2', titulo: 'FGTS - abril/2026', cliente: 'Loja Vila Centro', valor: 1810.45, moduleKey: 'trabalhista', vencimento: '2026-04-23' },
  { id: 'ddl-3', titulo: 'Parcela de serviço', cliente: 'Clínica São Miguel', valor: 3500, moduleKey: 'financeiro', vencimento: '2026-04-18' },
];

const MOCK_CLIENT_OWNERS = [
  { id: 'cli-1', nome: 'Macedo Comércio', assignedTo: ['dev-user', 'colaborador@macedosi.com'] },
  { id: 'cli-2', nome: 'Loja Vila Centro', assignedTo: ['dev-user'] },
  { id: 'cli-3', nome: 'Clínica São Miguel', assignedTo: ['colaborador@macedosi.com'] },
];

const statusBadge = {
  pendente: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  tarefa_aceita: 'bg-blue-500/15 text-blue-200 border border-blue-500/30',
  em_andamento: 'bg-sky-500/15 text-sky-200 border border-sky-500/30',
  aguardando: 'bg-orange-500/15 text-orange-200 border border-orange-500/30',
  concluida: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  concluido: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  transferido: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30',
  novo: 'bg-violet-500/15 text-violet-200 border border-violet-500/30',
};

const alertBadge = {
  alta: 'bg-rose-500/15 text-rose-200 border border-rose-500/30',
  media: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  baixa: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const daysBetween = (fromDate, toDate) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  const diff = Math.floor((to - from) / (1000 * 60 * 60 * 24));
  return Number.isNaN(diff) ? 0 : diff;
};

const normalizeIdentity = (value = '') => String(value).trim().toLowerCase();

const Dashboard = () => {
  const { user, hasModuleAccess } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const quickSectorCards = useMemo(
    () => [
      { key: 'clientes', title: 'Lista de Clientes', description: 'Cadastros e configuração dos clientes.', path: '/clientes', icon: Users2, tone: 'border-violet-500/30 bg-violet-500/10' },
      { key: 'comercial', title: 'Comercial', description: 'Pipeline, propostas e conversões.', path: '/comercial', icon: Briefcase, tone: 'border-indigo-500/30 bg-indigo-500/10' },
      { key: 'financeiro', title: 'Financeiro', description: 'Clientes Financeiro e Contas a Receber.', path: '/financeiro', icon: Building2, tone: 'border-emerald-500/30 bg-emerald-500/10' },
      { key: 'fiscal', title: 'Fiscal', description: 'Obrigações, guias e acompanhamento fiscal.', path: '/fiscal', icon: Scale, tone: 'border-amber-500/30 bg-amber-500/10' },
      { key: 'trabalhista', title: 'Trabalhista', description: 'Rotinas de pessoal e prazos do setor.', path: '/trabalhista', icon: FileClock, tone: 'border-sky-500/30 bg-sky-500/10' },
      { key: 'atendimento', title: 'Atendimento', description: 'Chamados, retornos e agenda da equipe.', path: '/atendimento', icon: Headphones, tone: 'border-rose-500/30 bg-rose-500/10' },
      { key: 'contadores', title: 'Contadores', description: 'Painel interno dos contadores.', path: '/contadores', icon: Calculator, tone: 'border-cyan-500/30 bg-cyan-500/10' },
      { key: 'servicos', title: 'Serviços', description: 'Execução e status de serviços ativos.', path: '/servicos', icon: FolderKanban, tone: 'border-teal-500/30 bg-teal-500/10' },
      { key: 'chat', title: 'Chat', description: 'Comunicação interna entre setores.', path: '/chat', icon: MessageCircle, tone: 'border-fuchsia-500/30 bg-fuchsia-500/10' },
      { key: 'configuracoes', title: 'Configurações', description: 'Ajustes e dados do usuário.', path: '/configuracoes', icon: Settings, tone: 'border-gray-400/30 bg-gray-500/10' },
    ],
    [],
  );

  const quickSectorCardsColored = useMemo(
    () => [
      { key: 'clientes', title: 'Lista de Clientes', description: 'Cadastros e configuração dos clientes.', path: '/clientes', icon: Users2, tone: 'border-violet-400/50 bg-violet-600 text-white hover:bg-violet-500' },
      { key: 'comercial', title: 'Comercial', description: 'Pipeline, propostas e conversões.', path: '/comercial', icon: Briefcase, tone: 'border-indigo-400/50 bg-indigo-600 text-white hover:bg-indigo-500' },
      { key: 'financeiro', title: 'Financeiro', description: 'Clientes Financeiro e Contas a Receber.', path: '/financeiro', icon: Building2, tone: 'border-emerald-400/50 bg-emerald-600 text-white hover:bg-emerald-500' },
      { key: 'fiscal', title: 'Fiscal', description: 'Obrigações, guias e acompanhamento fiscal.', path: '/fiscal', icon: Scale, tone: 'border-amber-400/50 bg-amber-500 text-white hover:bg-amber-400' },
      { key: 'trabalhista', title: 'Trabalhista', description: 'Rotinas de pessoal e prazos do setor.', path: '/trabalhista', icon: FileClock, tone: 'border-sky-400/50 bg-sky-600 text-white hover:bg-sky-500' },
      { key: 'atendimento', title: 'Atendimento', description: 'Chamados, retornos e agenda da equipe.', path: '/atendimento', icon: Headphones, tone: 'border-rose-400/50 bg-rose-600 text-white hover:bg-rose-500' },
      { key: 'contadores', title: 'Contadores', description: 'Painel interno dos contadores.', path: '/contadores', icon: Calculator, tone: 'border-cyan-400/50 bg-cyan-600 text-white hover:bg-cyan-500' },
      { key: 'servicos', title: 'Serviços', description: 'Execução e status de serviços ativos.', path: '/servicos', icon: FolderKanban, tone: 'border-teal-400/50 bg-teal-600 text-white hover:bg-teal-500' },
      { key: 'chat', title: 'Chat', description: 'Comunicação interna entre setores.', path: '/chat', icon: MessageCircle, tone: 'border-fuchsia-400/50 bg-fuchsia-600 text-white hover:bg-fuchsia-500' },
      { key: 'configuracoes', title: 'Configurações', description: 'Ajustes e dados do usuário.', path: '/configuracoes', icon: Settings, tone: 'border-slate-300/40 bg-slate-600 text-white hover:bg-slate-500' },
    ],
    [],
  );

  const visibleQuickSectorCards = useMemo(
    () => quickSectorCardsColored.filter((card) => hasModuleAccess(card.key)),
    [quickSectorCardsColored, hasModuleAccess],
  );

  const moduleLabelByKey = useMemo(
    () =>
      INTERNAL_MODULES.reduce((acc, item) => {
        acc[item.key] = item.label;
        return acc;
      }, {}),
    [],
  );

  const viewerIdentity = useMemo(
    () => [user?.id, user?.email, user?.name].filter(Boolean).map(normalizeIdentity),
    [user],
  );

  const isAssignedToViewer = (item) => {
    if (isAdmin) return true;
    if (!Array.isArray(item?.assignedTo) || item.assignedTo.length === 0) return false;
    const assigned = item.assignedTo.map(normalizeIdentity);
    return viewerIdentity.some((identity) => assigned.includes(identity));
  };

  const tasks = useMemo(
    () => getDashboardTasks({ user, isAdmin, hasModuleAccess }),
    [user, isAdmin, hasModuleAccess],
  );

  const services = useMemo(
    () =>
      MOCK_SERVICES.filter(
        (item) => isAssignedToViewer(item) && hasModuleAccess(item.moduleKey),
      ),
    [user, hasModuleAccess],
  );

  const alerts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const taskAlerts = tasks
      .filter((item) => item.status !== 'concluida' && item.status !== 'concluido')
      .map((item) => {
        const diasComTarefa = Math.max(0, daysBetween(item.atribuidoEm || item.vencimento || today, today));
        const diasParaVencer = daysBetween(today, item.vencimento || today);
        const criticidade = diasParaVencer <= 1 ? 'alta' : diasParaVencer <= 3 ? 'media' : 'baixa';
        return {
          id: `alert-task-${item.id}`,
          titulo: `${item.titulo}: tem ${diasComTarefa} dia(s) que você está com essa tarefa.`,
          moduleKey: item.moduleKey,
          criticidade,
          vencimento: item.vencimento || today,
        };
      });

    const serviceAlerts = services
      .filter((item) => item.status !== 'concluido')
      .map((item) => {
        const diasComServico = Math.max(0, daysBetween(item.criadoEm || today, today));
        return {
          id: `alert-service-${item.id}`,
          titulo: `${item.tipo} (${item.cliente}): tem ${diasComServico} dia(s) em aberto com você.`,
          moduleKey: item.moduleKey,
          criticidade: diasComServico >= 7 ? 'alta' : diasComServico >= 3 ? 'media' : 'baixa',
          vencimento: item.vencimento || item.criadoEm || today,
        };
      });

    return [...taskAlerts, ...serviceAlerts].sort(
      (a, b) => new Date(a.vencimento) - new Date(b.vencimento),
    );
  }, [tasks, services]);

  const activities = useMemo(
    () =>
      MOCK_ACTIVITIES.filter(
        (item) => isAssignedToViewer(item) && hasModuleAccess(item.moduleKey),
      ),
    [user, hasModuleAccess],
  );

  const deadlines = useMemo(
    () => MOCK_DEADLINES.filter((item) => hasModuleAccess(item.moduleKey)),
    [hasModuleAccess],
  );

  const ownedClients = useMemo(
    () => MOCK_CLIENT_OWNERS.filter((item) => isAssignedToViewer(item)),
    [user],
  );
  const hasSingleCityAccess = useMemo(() => {
    if (isAdmin) return false;
    const allowedCities = Array.isArray(user?.allowed_cities) ? user.allowed_cities.filter(Boolean) : [];
    if (allowedCities.includes('Todas') || allowedCities.includes('todas')) return false;
    return allowedCities.length === 1;
  }, [user, isAdmin]);

  const topCards = useMemo(() => {
    const pendingTasks = getPendingTasks(tasks);
    const novasTarefas = getNewTasksForToday({ user, tasks, todayIso: new Date().toISOString().slice(0, 10) });
    const highAlerts = alerts.filter((item) => item.criticidade === 'alta');

    return [
      {
        key: 'tarefas',
        title: 'Tarefas pendentes',
        value: pendingTasks.length,
        subtitle: pendingTasks[0] ? `Prioridade: ${pendingTasks[0].titulo}` : 'Sem pendencias ativas',
        icon: FolderKanban,
        tone: 'border-amber-500/30 bg-amber-500/10',
        visible: true,
        path: '/dashboard/tarefas-pendentes',
      },
      {
        key: 'novas_tarefas',
        title: 'Novas tarefas',
        value: novasTarefas.length,
        subtitle: novasTarefas[0] ? novasTarefas[0].titulo : 'Nenhuma nova tarefa não visualizada',
        icon: FolderKanban,
        tone: 'border-sky-500/30 bg-sky-500/10',
        visible: true,
        path: '/dashboard/novas-tarefas',
      },
      {
        key: 'clientes',
        title: 'Clientes sob responsabilidade',
        value: ownedClients.length,
        subtitle: ownedClients[0] ? ownedClients[0].nome : 'Sem clientes vinculados',
        icon: Users,
        tone: 'border-violet-500/30 bg-violet-500/10',
        visible: true,
        path: '/clientes',
      },
      {
        key: 'alertas',
        title: 'Alertas do setor',
        value: alerts.length,
        subtitle: highAlerts.length > 0 ? `${highAlerts.length} alertas de alta prioridade` : 'Sem alertas criticos',
        icon: ShieldAlert,
        tone: 'border-rose-500/30 bg-rose-500/10',
        visible: true,
        path: '/dashboard/alertas-setor',
      },
      {
        key: 'todas_tarefas',
        title: 'Todas as tarefas',
        value: pendingTasks.length,
        subtitle: pendingTasks[0] ? pendingTasks[0].titulo : 'Sem tarefas em aberto',
        icon: FolderKanban,
        tone: 'border-cyan-500/30 bg-cyan-500/10',
        visible: hasSingleCityAccess,
        path: '/dashboard/tarefas-gerais',
      },
    ].filter((item) => item.visible);
  }, [tasks, ownedClients, alerts, user, hasSingleCityAccess]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const resumoHoje = useMemo(() => {
    const solicitacoesCriadasHoje = services.filter((item) => (item.criadoEm || '').slice(0, 10) === todayIso);
    const empresasAtendidasHoje = new Set(
      solicitacoesCriadasHoje
        .map((item) => item.cliente)
        .filter(Boolean),
    ).size;
    const servicosConcluidosHoje = solicitacoesCriadasHoje.filter((item) => item.status === 'concluido').length;

    return {
      solicitacoesCriadasHoje: solicitacoesCriadasHoje.length,
      empresasAtendidasHoje,
      servicosConcluidosHoje,
    };
  }, [services, todayIso]);

  const desempenhoMensal = useMemo(() => {
    const current = new Date();
    const month = current.getMonth();
    const year = current.getFullYear();
    const isInCurrentMonth = (value) => {
      if (!value) return false;
      const date = new Date(`${value}T00:00:00`);
      return date.getMonth() === month && date.getFullYear() === year;
    };

    const tarefasVinculadasMes = tasks.filter((item) => isInCurrentMonth(item.atribuidoEm || item.vencimento));
    const tarefasConcluidasMes = tarefasVinculadasMes.filter(
      (item) => item.status === 'concluida' || item.status === 'concluido',
    );
    const percentual = tarefasVinculadasMes.length
      ? Math.min(100, Math.round((tarefasConcluidasMes.length / tarefasVinculadasMes.length) * 100))
      : 0;

    return {
      total: tarefasVinculadasMes.length,
      concluidas: tarefasConcluidasMes.length,
      percentual,
    };
  }, [tasks]);

  const handleTopCardClick = (card) => {
    if (card.path) {
      navigate(card.path);
      return;
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass-intense rounded-2xl border border-white/10 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard interno</h1>
            <p className="mt-2 text-sm text-gray-300">
              {isAdmin
                ? 'Visão completa da operação com todos os módulos.'
                : 'Visão por itens atribuídos, com panorama completo dos módulos do sistema.'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Usuario</div>
            <div className="mt-1 text-sm font-semibold text-white">{user?.name}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {INTERNAL_MODULES
                .slice(0, 8)
                .map((moduleKey) => (
                  <span key={moduleKey.key} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">
                    {moduleKey.label}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>

      <section className="glass rounded-2xl border border-white/10 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="dashboard-section-title">Atalhos de setores</h2>
            <p className="dashboard-section-subtitle">Acesso rápido aos módulos principais do painel interno.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {visibleQuickSectorCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                onClick={() => navigate(card.path)}
                className={`card-hover rounded-2xl border p-4 text-left transition-colors ${card.tone}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{card.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-white/90">{card.description}</p>
                  </div>
                  <div className="rounded-xl border border-white/30 bg-white/15 p-2">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {topCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              onClick={() => handleTopCardClick(card)}
              className={`glass card-hover rounded-2xl border p-4 text-left cursor-pointer ${card.tone}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200">{card.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-gray-300">{card.subtitle}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section id="dashboard-servicos-atribuidos" className="glass rounded-2xl border border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="dashboard-section-title">Serviços atribuídos</h2>
              <p className="dashboard-section-subtitle">Lista priorizada de serviços sob sua responsabilidade.</p>
            </div>
            <button
              onClick={() => navigate('/servicos')}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:bg-white/10"
            >
              Abrir módulo
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            {services.length > 0 ? (
              services.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.tipo}</p>
                      <p className="mt-1 text-xs text-gray-400">{item.cliente}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${statusBadge[item.status] || statusBadge.pendente}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(item.criadoEm)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
                Nenhum serviço atribuído no momento.
              </div>
            )}
          </div>
        </section>

        <section id="dashboard-alertas-setor" className="glass rounded-2xl border border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="dashboard-section-title">Como você está indo hoje</h2>
              <p className="dashboard-section-subtitle">Visão rápida da sua produtividade diária.</p>
            </div>
            <Building2 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <span className="text-xs text-gray-300">Solicitações criadas por você hoje</span>
              <span className="text-sm font-semibold text-white">{resumoHoje.solicitacoesCriadasHoje}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <span className="text-xs text-gray-300">Empresas atendidas hoje</span>
              <span className="text-sm font-semibold text-white">{resumoHoje.empresasAtendidasHoje}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <span className="text-xs text-gray-300">Serviços concluídos hoje</span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {resumoHoje.servicosConcluidosHoje}
              </span>
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl border border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="dashboard-section-title">Atividades recentes</h2>
              <p className="dashboard-section-subtitle">Movimentações dos módulos liberados para este perfil.</p>
            </div>
            <Clock3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-2.5">
            {activities.length > 0 ? (
              activities.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.titulo}</p>
                      <p className="mt-1 text-xs text-gray-400">{item.detalhe}</p>
                      <p className="mt-2 text-xs text-gray-500">{moduleLabelByKey[item.moduleKey] || item.moduleKey}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300">{item.when}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
                Nenhuma atividade recente para os módulos deste perfil.
              </div>
            )}
          </div>
        </section>

        <section className="glass rounded-2xl border border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="dashboard-section-title">Próximos vencimentos</h2>
              <p className="dashboard-section-subtitle">Compromissos financeiros e fiscais mais próximos.</p>
            </div>
            <CalendarClock className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-2.5">
            {deadlines.length > 0 ? (
              deadlines
                .sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento))
                .slice(0, 3)
                .map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-sm font-semibold text-white">{item.titulo}</p>
                    <p className="mt-1 text-xs text-gray-400">{item.cliente}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{formatCurrency(item.valor)}</span>
                      <span className="text-xs text-amber-300">{formatDate(item.vencimento)}</span>
                    </div>
                  </div>
                ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
                Sem vencimentos para os módulos liberados.
              </div>
            )}
          </div>
        </section>

        <section className="glass rounded-2xl border border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="dashboard-section-title">Alertas do setor</h2>
              <p className="dashboard-section-subtitle">Sinais de atenção por módulo e prazo.</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-300" />
          </div>
          <div className="space-y-2.5">
            {alerts.length > 0 ? (
              alerts.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-sm font-medium text-white">{item.titulo}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{moduleLabelByKey[item.moduleKey] || item.moduleKey}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${alertBadge[item.criticidade] || alertBadge.media}`}>
                      {item.criticidade}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-400">
                Nenhum alerta para os módulos liberados.
              </div>
            )}
          </div>
        </section>

        <section className="glass rounded-2xl border border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="dashboard-section-title">Seu desempenho no mês</h2>
              <p className="dashboard-section-subtitle">Tarefas vinculadas e concluídas no mês atual.</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Conclusao mensal</p>
                <p className="mt-1.5 text-2xl font-semibold text-white">{desempenhoMensal.percentual}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Tarefas vinculadas a você esse mês</p>
                <p className="text-lg font-semibold text-white">{desempenhoMensal.total}</p>
                <p className="mt-1 text-xs text-gray-400">Tarefas concluídas</p>
                <p className="text-lg font-semibold text-emerald-300">{desempenhoMensal.concluidas}</p>
              </div>
            </div>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${desempenhoMensal.percentual}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {desempenhoMensal.percentual}% das tarefas do mês foram concluídas.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
