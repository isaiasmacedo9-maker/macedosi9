import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockSimplesNacionalCard } from '../../dev/mockData';
import { useTheme } from '../../contexts/ThemeContext';
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
  pendente: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  atrasado: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const obligationStatusStyles = {
  entregue: 'bg-emerald-500/15 text-emerald-300',
  em_andamento: 'bg-blue-500/15 text-blue-300',
  pendente: 'bg-blue-500/15 text-blue-300',
  atrasado: 'bg-rose-500/15 text-rose-300',
};

const faixaStatusStyles = {
  confortavel: {
    label: 'Confortavel na faixa',
    className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  },
  proximo: {
    label: 'Proximo da mudanca de faixa',
    className: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  },
  atencao: {
    label: 'Atencao ao limite',
    className: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200',
  },
  risco: {
    label: 'Risco de desenquadramento',
    className: 'border-rose-500/40 bg-rose-500/15 text-rose-200',
  },
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

const getFaixaStatus = (percentual, faltante, limiteAnual, rbt12) => {
  if (limiteAnual - rbt12 <= 12000 || percentual >= 98) return faixaStatusStyles.risco;
  if (percentual > 90) return faixaStatusStyles.atencao;
  if (percentual >= 70) return faixaStatusStyles.proximo;
  return faixaStatusStyles.confortavel;
};

const ClientPortalHome = ({ portalContext }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const {
    portalClient,
    company,
    contas,
    obrigacoesFiscais,
    obrigacoesTrabalhistas,
    documentosPendentes,
    alertas,
    statusFinanceiro,
    resumoImpostos,
    companyHighlights,
    activityHighlights,
  } = portalContext;

  const impostosAPagar = obrigacoesFiscais.filter((item) => item.status !== 'entregue');
  const proximoImposto = impostosAPagar[0];
  const showSimplesNacionalCard = portalClient?.tipo_empresa !== 'mei';

  const simplesCard = useMemo(() => {
    const isMei = portalClient.tipo_empresa === 'mei';
    const base = isMei
      ? {
          nome_empresa: portalClient.nome_fantasia,
          aliquota_efetiva: 5.0,
          anexo: 'MEI',
          rbt12: 74800,
          faixa_atual: 'Faixa unica',
          faixa_numero: 1,
          limite_faixa: 81000,
          limite_anual: 81000,
        }
      : {
          ...mockSimplesNacionalCard,
          nome_empresa: portalClient.nome_fantasia,
        };

    const percentualUtilizado = Math.min((base.rbt12 / base.limite_faixa) * 100, 100);
    const faltante = Math.max(base.limite_faixa - base.rbt12, 0);
    const status = getFaixaStatus(percentualUtilizado, faltante, base.limite_anual, base.rbt12);

    return {
      ...base,
      percentualUtilizado,
      faltante,
      status,
    };
  }, [portalClient]);

  const atividadesRecentes = [
    {
      id: 'act-1',
      titulo: 'Painel sincronizado',
      descricao: 'Dados executivos atualizados para acompanhamento do cliente.',
      horario: 'Agora',
      tipo: 'regular',
    },
    {
      id: 'act-2',
      titulo: 'Rotina fiscal em andamento',
      descricao: `${obrigacoesFiscais.length} obrigacoes fiscais monitoradas no periodo.`,
      horario: 'Hoje',
      tipo: 'pendente',
    },
    {
      id: 'act-3',
      titulo: 'Atendimento personalizado',
      descricao: `Portal configurado para ${portalClient.tipo_empresa.toUpperCase()} com atividade ${portalClient.atividade}.`,
      horario: 'Hoje',
      tipo: 'regular',
    },
  ];

  const topCards = [
    {
      title: 'Impostos a pagar',
      value: formatCurrency(impostosAPagar.reduce((sum, item) => sum + (item.valor || 0), 0)),
      subtitle: proximoImposto ? `Proximo vencimento em ${formatDate(proximoImposto.proximo_vencimento)}` : 'Sem vencimentos proximos',
      tone: isLight
        ? 'light-solid-card light-solid-card--blue border-blue-700 text-white'
        : 'from-sky-500/20 to-blue-500/10 border-sky-500/30 text-sky-200',
      icon: Landmark,
    },
    {
      title: 'Tarefas pendentes',
      value: `${obrigacoesTrabalhistas.filter((item) => item.status !== 'entregue').length}`,
      subtitle: `${documentosPendentes.length} documentos aguardando retorno`,
      tone: isLight
        ? 'light-solid-card light-solid-card--cyan border-cyan-700 text-white'
        : 'from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-200',
      icon: FolderKanban,
    },
    {
      title: 'Documentos pendentes',
      value: `${documentosPendentes.length}`,
      subtitle: companyHighlights.emphasis,
      tone: isLight
        ? 'light-solid-card light-solid-card--purple border-violet-700 text-white'
        : 'from-violet-500/20 to-fuchsia-500/10 border-violet-500/30 text-violet-200',
      icon: FileClock,
    },
    {
      title: 'Situacao financeira',
      value: formatCurrency(contas.reduce((sum, item) => sum + (item.total_liquido || 0), 0)),
      subtitle: `${contas.filter((item) => item.situacao === 'atrasado').length} titulos em atraso`,
      tone: isLight
        ? 'light-solid-card light-solid-card--red border-rose-700 text-white'
        : 'from-rose-500/20 to-red-500/10 border-rose-500/30 text-rose-200',
      icon: DollarSign,
    },
  ];

  const fiscalResumoCards = [
    {
      title: 'Impostos a vencer',
      quantidade: resumoImpostos?.aVencer?.quantidade || 0,
      valorTotal: resumoImpostos?.aVencer?.valorTotal || 0,
      statusLabel: 'pendente',
      tone: isLight
        ? 'light-solid-card light-solid-card--blue border-blue-700 text-white'
        : 'border-blue-500/30 bg-blue-500/10 text-blue-100',
      icon: BellRing,
    },
    {
      title: 'Impostos vencidos',
      quantidade: resumoImpostos?.vencidos?.quantidade || 0,
      valorTotal: resumoImpostos?.vencidos?.valorTotal || 0,
      statusLabel: 'vencido',
      tone: isLight
        ? 'light-solid-card light-solid-card--red border-rose-700 text-white'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-100',
      icon: AlertTriangle,
    },
    {
      title: 'Parcelamentos em aberto',
      quantidade: resumoImpostos?.parcelamentosEmAberto?.quantidade || 0,
      valorTotal: resumoImpostos?.parcelamentosEmAberto?.valorTotal || 0,
      statusLabel: 'acompanhamento',
      tone: isLight
        ? 'light-solid-card light-solid-card--cyan border-cyan-700 text-white'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-100',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="glass-intense rounded-[26px] border border-white/8 p-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <ShieldCheck className="mr-2 h-4 w-4" />
              {companyHighlights.heroTag}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {portalClient.nome_fantasia}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
              {portalClient.personalizacao.destaquePrimario}. {portalClient.personalizacao.destaqueSecundario}.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate('/admin')}
              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left transition hover:bg-red-500/15"
            >
              <div className="text-xs uppercase tracking-[0.2em] text-red-200">Area interna</div>
              <div className="mt-1 flex items-center justify-between text-sm font-medium text-white">
                Acessar visao administrativa
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Responsavel pela conta</div>
              <div className="mt-1 text-sm font-medium text-white">{portalClient.responsavel_conta}</div>
              <div className="mt-1 text-xs text-gray-400">{portalClient.email_responsavel}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {topCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className={`glass rounded-[22px] border p-4 ${card.tone} shadow-[0_14px_36px_rgba(0,0,0,0.22)]`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-200">{card.title}</p>
                  <p className="mt-2 text-xl font-semibold text-white">{card.value}</p>
                  <p className="mt-1.5 text-sm text-gray-300">{card.subtitle}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="glass rounded-[26px] border border-white/8 p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Resumo fiscal rápido</h2>
            <p className="text-sm text-gray-400">Leitura imediata da situação de impostos ao entrar no portal.</p>
          </div>
          <Landmark className="h-5 w-5 text-gray-400" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {fiscalResumoCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className={`rounded-2xl border p-3.5 ${card.tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-xs uppercase tracking-[0.18em] ${isLight ? '!text-white' : 'opacity-80'}`}>{card.title}</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{card.quantidade}</div>
                    <div className={`mt-2 text-sm ${isLight ? '!text-white' : 'opacity-90'}`}>{formatCurrency(card.valorTotal)}</div>
                    <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${
                      isLight ? 'border-white/40 bg-white/20 !text-white' : 'border-white/15 bg-black/20'
                    }`}>
                      {card.statusLabel}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_340px]">
        <div className="space-y-5">
          <div className="glass rounded-[26px] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Obrigacoes recentes</h2>
                <p className="text-sm text-gray-400">Compromissos mais proximos do calendario.</p>
              </div>
              <FileSpreadsheet className="h-5 w-5 text-gray-400" />
            </div>

            <div className="space-y-3">
              {[...obrigacoesFiscais, ...obrigacoesTrabalhistas]
                .sort((a, b) => new Date(a.proximo_vencimento) - new Date(b.proximo_vencimento))
                .slice(0, 4)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/20 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-white">{item.nome}</p>
                      <p className="mt-1 text-sm text-gray-400">
                        {company.nome_fantasia} - {item.responsavel}
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

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="glass rounded-[26px] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Alertas importantes</h2>
                  <p className="text-sm text-gray-400">Prioridades com impacto imediato.</p>
                </div>
                <BellRing className="h-5 w-5 text-sky-300" />
              </div>

              <div className="space-y-3">
                {alertas.map((alerta) => {
                  const status = alerta.status === 'atrasado' ? 'atrasado' : alerta.status === 'entregue' ? 'regular' : 'pendente';

                  return (
                    <div
                      key={alerta.id}
                      className={`rounded-2xl border p-4 ${statusStyles[status] || statusStyles.pendente}`}
                    >
                      <div className="flex items-start gap-3">
                        {status === 'atrasado' ? (
                          <AlertTriangle className="mt-0.5 h-4 w-4" />
                        ) : status === 'regular' ? (
                          <BadgeCheck className="mt-0.5 h-4 w-4" />
                        ) : (
                          <CircleAlert className="mt-0.5 h-4 w-4" />
                        )}
                        <div>
                          <p className="font-medium">{alerta.nome}</p>
                          <p className="mt-1 text-sm opacity-80">
                            Prazo em {formatDate(alerta.proximo_vencimento)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass rounded-[26px] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Atividades recentes</h2>
                  <p className="text-sm text-gray-400">Ultimas movimentacoes do atendimento.</p>
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

        <div className="space-y-5">
          {showSimplesNacionalCard ? (
            <div className="glass rounded-[26px] border border-cyan-500/30 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Destaque Simples Nacional</h2>
                  <p className="text-sm text-gray-400">{simplesCard.nome_empresa}</p>
                </div>
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-right">
                  <div className="text-xs uppercase tracking-[0.16em] text-cyan-300">Aliquota</div>
                  <div className="text-2xl font-bold text-cyan-200">
                    {simplesCard.aliquota_efetiva.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    %
                  </div>
                </div>
              </div>

              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${simplesCard.status.className}`}>
                {simplesCard.status.label}
              </div>

              <div className="mt-4 rounded-xl border border-cyan-500/20 bg-black/25 p-3.5">
                <p className="text-sm font-medium text-cyan-100">
                  {simplesCard.percentualUtilizado.toLocaleString('pt-BR', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  % da faixa utilizada
                </p>
                <p className="mt-1 text-xs text-gray-300">
                  Faltam {formatCurrency(simplesCard.faltante)} para a proxima faixa
                </p>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 transition-all duration-700"
                    style={{ width: `${simplesCard.percentualUtilizado}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniInfo label="RBT12" value={formatCurrency(simplesCard.rbt12)} />
                <MiniInfo label="Anexo" value={simplesCard.anexo} />
                <MiniInfo label="Faixa atual" value={`${simplesCard.faixa_numero}`} />
                <MiniInfo label="Limite anual" value={formatCurrency(simplesCard.limite_anual)} />
              </div>
            </div>
          ) : null}

          <div className="glass rounded-[26px] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Resumo da empresa</h2>
                <p className="text-sm text-gray-400">Dados principais e enquadramento atual.</p>
              </div>
              <Building2 className="h-5 w-5 text-gray-400" />
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Empresa</div>
                <div className="mt-2 text-lg font-semibold text-white">{company.nome_empresa}</div>
                <div className="mt-1 text-sm text-gray-400">{company.nome_fantasia}</div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500">CNPJ</div>
                  <div className="mt-2 text-sm font-medium text-white">{company.cnpj}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Regime</div>
                  <div className="mt-2 text-sm font-medium text-white">{portalClient.regime_label}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Atividade</div>
                <div className="mt-2 text-sm font-medium capitalize text-white">{portalClient.atividade}</div>
                <div className="mt-2 space-y-2 text-sm text-gray-400">
                  {activityHighlights.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-emerald-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-[26px] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Status geral</h2>
                <p className="text-sm text-gray-400">Leitura executiva da operacao.</p>
              </div>
              <CalendarClock className="h-5 w-5 text-gray-400" />
            </div>

            <div className={`rounded-3xl p-5 ${statusStyles[statusFinanceiro]}`}>
              <div className="flex items-center gap-3">
                {statusFinanceiro === 'regular' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : statusFinanceiro === 'atrasado' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <CircleAlert className="h-5 w-5" />
                )}
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] opacity-80">Status</p>
                  <p className="mt-1 text-xl font-semibold capitalize">{statusFinanceiro}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <span className="text-sm text-gray-300">Obrigacoes fiscais</span>
                <span className="text-sm font-semibold text-white">{obrigacoesFiscais.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <span className="text-sm text-gray-300">Pendencias documentais</span>
                <span className="text-sm font-semibold text-white">{documentosPendentes.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <span className="text-sm text-gray-300">Saldo monitorado</span>
                <span className="text-sm font-semibold text-white">
                  {formatCurrency(contas.reduce((sum, item) => sum + (item.total_liquido || 0), 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MiniInfo = ({ label, value }) => (
  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
    <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
  </div>
);

export default ClientPortalHome;
