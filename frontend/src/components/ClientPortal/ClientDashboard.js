import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  mockClients,
  mockDashboardStats,
  mockFinancialContas,
  mockFiscalObrigacoes,
  mockTrabalhistaObrigacoes,
  mockTrabalhistaSolicitacoes,
} from '../../dev/mockData';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DollarSign,
  FileClock,
  FileSpreadsheet,
  FolderKanban,
  Landmark,
  ShieldCheck,
} from 'lucide-react';

const statusStyles = {
  regular: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  pendente: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  atrasado: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const obligationStatusStyles = {
  entregue: 'bg-emerald-500/15 text-emerald-300',
  em_andamento: 'bg-amber-500/15 text-amber-300',
  pendente: 'bg-amber-500/15 text-amber-300',
  atrasado: 'bg-rose-500/15 text-rose-300',
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatDate = (value) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });

const getClientStatus = () => {
  const hasOverdue = mockFinancialContas.some((conta) => conta.situacao === 'atrasado');
  const hasPending = mockFiscalObrigacoes.some((item) => item.status === 'pendente' || item.status === 'em_andamento');

  if (hasOverdue) {
    return 'atrasado';
  }

  if (hasPending) {
    return 'pendente';
  }

  return 'regular';
};

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const client = mockClients[0];
  const overallStatus = getClientStatus();
  const impostosAPagar = mockFiscalObrigacoes
    .filter((item) => item.status !== 'entregue')
    .sort((a, b) => new Date(a.proximo_vencimento) - new Date(b.proximo_vencimento));
  const proximoImposto = impostosAPagar[0];
  const documentosPendentes = mockTrabalhistaSolicitacoes.filter(
    (item) => item.status === 'pendente' || item.status === 'em_andamento',
  );
  const obrigacoesRecentes = [...mockFiscalObrigacoes]
    .sort((a, b) => new Date(a.proximo_vencimento) - new Date(b.proximo_vencimento))
    .slice(0, 4);
  const alertas = [
    ...mockFiscalObrigacoes.map((item) => ({
      id: item.id,
      titulo: item.nome,
      descricao: `${item.empresa} • vence em ${formatDate(item.proximo_vencimento)}`,
      status: item.status === 'atrasado' ? 'atrasado' : 'pendente',
    })),
    ...mockTrabalhistaObrigacoes.map((item) => ({
      id: item.id,
      titulo: item.nome,
      descricao: `${item.empresa} • prazo ${formatDate(item.proximo_vencimento)}`,
      status: item.status === 'entregue' ? 'regular' : 'pendente',
    })),
  ].slice(0, 4);
  const atividadesRecentes = [
    {
      id: 'act-1',
      titulo: 'Guia fiscal preparada',
      descricao: 'PGDAS-D de Abril liberado para conferência.',
      horario: 'Hoje, 09:20',
      tipo: 'regular',
    },
    {
      id: 'act-2',
      titulo: 'Documento recebido',
      descricao: 'Comprovante bancário anexado ao financeiro.',
      horario: 'Ontem, 16:45',
      tipo: 'regular',
    },
    {
      id: 'act-3',
      titulo: 'Pendência identificada',
      descricao: 'Faltam documentos para fechamento trabalhista.',
      horario: 'Ontem, 11:10',
      tipo: 'pendente',
    },
  ];

  const topCards = [
    {
      title: 'Impostos a pagar',
      value: formatCurrency(impostosAPagar.reduce((sum, item) => sum + (item.valor || 0), 0)),
      subtitle: proximoImposto ? `Próximo vencimento em ${formatDate(proximoImposto.proximo_vencimento)}` : 'Sem vencimentos próximos',
      tone: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-200',
      icon: Landmark,
    },
    {
      title: 'Tarefas pendentes',
      value: `${mockDashboardStats.tasks.pendente}`,
      subtitle: `${mockDashboardStats.tasks.em_andamento} em andamento`,
      tone: 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-200',
      icon: FolderKanban,
    },
    {
      title: 'Documentos pendentes',
      value: `${documentosPendentes.length}`,
      subtitle: 'Aguardando envio ou validação',
      tone: 'from-violet-500/20 to-fuchsia-500/10 border-violet-500/30 text-violet-200',
      icon: FileClock,
    },
    {
      title: 'Situação financeira',
      value: formatCurrency(mockDashboardStats.financial.total_aberto.valor),
      subtitle: `${mockDashboardStats.financial.total_atrasado.count} títulos em atraso`,
      tone: 'from-rose-500/20 to-red-500/10 border-rose-500/30 text-rose-200',
      icon: DollarSign,
    },
  ];

  return (
    <div className="min-h-screen bg-futuristic text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="glass-intense rounded-[28px] border border-white/8 p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Área do cliente
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Visão executiva do seu escritório contábil
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
                Acompanhe impostos, pendências e movimentações do seu atendimento em um painel claro e pronto para uso diário.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => navigate('/admin')}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left transition hover:bg-red-500/15"
              >
                <div className="text-xs uppercase tracking-[0.2em] text-red-200">Operação interna</div>
                <div className="mt-1 flex items-center justify-between text-sm font-medium text-white">
                  Acessar visão administrativa
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Contato responsável</div>
                <div className="mt-1 text-sm font-medium text-white">{user?.name || 'Atendimento Macedo SI'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
          {topCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className={`glass rounded-[24px] border p-5 ${card.tone} shadow-[0_20px_60px_rgba(0,0,0,0.25)]`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{card.title}</p>
                    <p className="mt-4 text-2xl font-semibold text-white">{card.value}</p>
                    <p className="mt-2 text-sm text-gray-300">{card.subtitle}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
          <div className="space-y-6">
            <div className="glass rounded-[28px] p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Obrigações recentes</h2>
                  <p className="text-sm text-gray-400">Itens mais próximos do calendário fiscal e trabalhista.</p>
                </div>
                <FileSpreadsheet className="h-5 w-5 text-gray-400" />
              </div>

              <div className="space-y-3">
                {obrigacoesRecentes.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/20 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-white">{item.nome}</p>
                      <p className="mt-1 text-sm text-gray-400">
                        {item.empresa} • {item.responsavel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-300">{formatDate(item.proximo_vencimento)}</span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${obligationStatusStyles[item.status] || obligationStatusStyles.pendente}`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="glass rounded-[28px] p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Alertas importantes</h2>
                    <p className="text-sm text-gray-400">Prioridades que merecem acompanhamento.</p>
                  </div>
                  <BellRing className="h-5 w-5 text-amber-300" />
                </div>

                <div className="space-y-3">
                  {alertas.map((alerta) => (
                    <div
                      key={alerta.id}
                      className={`rounded-2xl border p-4 ${statusStyles[alerta.status] || statusStyles.pendente}`}
                    >
                      <div className="flex items-start gap-3">
                        {alerta.status === 'atrasado' ? (
                          <AlertTriangle className="mt-0.5 h-4 w-4" />
                        ) : alerta.status === 'regular' ? (
                          <BadgeCheck className="mt-0.5 h-4 w-4" />
                        ) : (
                          <CircleAlert className="mt-0.5 h-4 w-4" />
                        )}
                        <div>
                          <p className="font-medium">{alerta.titulo}</p>
                          <p className="mt-1 text-sm opacity-80">{alerta.descricao}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-[28px] p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Atividades recentes</h2>
                    <p className="text-sm text-gray-400">Últimas movimentações do seu atendimento.</p>
                  </div>
                  <Clock3 className="h-5 w-5 text-blue-300" />
                </div>

                <div className="space-y-3">
                  {atividadesRecentes.map((atividade) => (
                    <div
                      key={atividade.id}
                      className="rounded-2xl border border-white/8 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-white">{atividade.titulo}</p>
                          <p className="mt-1 text-sm text-gray-400">{atividade.descricao}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[atividade.tipo] || statusStyles.regular}`}>
                          {atividade.horario}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass rounded-[28px] p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Resumo do cliente</h2>
                  <p className="text-sm text-gray-400">Dados principais da empresa atendida.</p>
                </div>
                <Building2 className="h-5 w-5 text-gray-400" />
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Empresa</div>
                  <div className="mt-2 text-lg font-semibold text-white">{client.nome_empresa}</div>
                  <div className="mt-1 text-sm text-gray-400">{client.nome_fantasia}</div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-gray-500">CNPJ</div>
                    <div className="mt-2 text-sm font-medium text-white">{client.cnpj}</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Regime</div>
                    <div className="mt-2 text-sm font-medium capitalize text-white">
                      {client.tipo_regime.replace('_', ' ')}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Cidade de atendimento</div>
                  <div className="mt-2 text-sm font-medium text-white">{client.cidade_atendimento}</div>
                </div>
              </div>
            </div>

            <div className="glass rounded-[28px] p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Status geral</h2>
                  <p className="text-sm text-gray-400">Leitura rápida da saúde operacional.</p>
                </div>
                <CalendarClock className="h-5 w-5 text-gray-400" />
              </div>

              <div className={`rounded-3xl p-5 ${statusStyles[overallStatus]}`}>
                <div className="flex items-center gap-3">
                  {overallStatus === 'regular' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : overallStatus === 'atrasado' ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <CircleAlert className="h-5 w-5" />
                  )}
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] opacity-80">Status</p>
                    <p className="mt-1 text-xl font-semibold capitalize">{overallStatus}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <span className="text-sm text-gray-300">Obrigações fiscais próximas</span>
                  <span className="text-sm font-semibold text-white">{mockFiscalObrigacoes.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <span className="text-sm text-gray-300">Pendências documentais</span>
                  <span className="text-sm font-semibold text-white">{documentosPendentes.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                  <span className="text-sm text-gray-300">Valores em aberto</span>
                  <span className="text-sm font-semibold text-white">
                    {formatCurrency(mockDashboardStats.financial.total_aberto.valor)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
