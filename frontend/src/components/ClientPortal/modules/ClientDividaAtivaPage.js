import React from 'react';
import { AlertTriangle, BadgeAlert, BadgeCheck, Landmark, Scale, ShieldAlert } from 'lucide-react';
import { getPortalDividaAtivaData } from '../../../dev/clientPortalData';

const statusStyles = {
  alerta: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  negociacao: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  regularizado: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatDate = (value) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const ClientDividaAtivaPage = ({ clienteId }) => {
  const moduleData = getPortalDividaAtivaData(clienteId);

  if (!moduleData) return null;

  const { portalClient, dividas, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-200">
              <ShieldAlert className="mr-2 h-4 w-4" />
              DAS e dívida ativa
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Dívida ativa e regularização</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Um módulo executivo para acompanhar riscos, pendências e próximos passos de regularização tributária.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Empresa</div>
            <div className="mt-2 text-xl font-semibold text-white">{portalClient.nome_fantasia}</div>
            <div className="mt-1 text-sm text-gray-400">{portalClient.regime_label}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SummaryCard icon={Landmark} title="Valor atualizado" value={formatCurrency(resumo.valorAtualizado)} subtitle="Exposição monitorada" color="text-rose-300" />
        <SummaryCard icon={AlertTriangle} title="Casos urgentes" value={`${resumo.urgentes}`} subtitle="Demandam atenção prioritária" color="text-amber-300" />
        <SummaryCard icon={Scale} title="Em negociação" value={`${resumo.emNegociacao}`} subtitle="Possíveis alternativas de acordo" color="text-sky-300" />
        <SummaryCard icon={BadgeCheck} title="Total de casos" value={`${resumo.totalCasos}`} subtitle="Itens mapeados no portal" color="text-emerald-300" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="glass rounded-[28px] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Pendências e dívida ativa</h2>
              <p className="text-sm text-gray-400">Visão estruturada para tomada de decisão junto ao escritório.</p>
            </div>
            <BadgeAlert className="h-5 w-5 text-rose-300" />
          </div>

          <div className="space-y-3">
            {dividas.map((divida) => (
              <div key={divida.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{divida.descricao}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[divida.status] || statusStyles.alerta}`}>
                        {divida.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-2 xl:grid-cols-4">
                      <span>Origem: {divida.origem}</span>
                      <span>Atualização: {formatDate(divida.ultima_atualizacao)}</span>
                      <span>Prazo sugerido: {formatDate(divida.prazo_recomendado)}</span>
                      <span>Valor original: {formatCurrency(divida.valor_original)}</span>
                    </div>
                    <div className="text-lg font-semibold text-white">{formatCurrency(divida.valor_atualizado)}</div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <button
                      onClick={() => window.alert(`Abrindo detalhamento da divida: ${divida.descricao}`)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                    >
                      Ver detalhamento
                    </button>
                    <button
                      onClick={() => window.alert(`Solicitacao de regularizacao enviada para: ${divida.descricao}`)}
                      className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100 hover:bg-rose-500/20"
                    >
                      Solicitar regularização
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-[28px] p-6">
            <h2 className="text-lg font-semibold text-white">Próximos passos</h2>
            <div className="mt-5 space-y-3">
              {[
                'Priorize pendências com prazo mais próximo.',
                'Solicite a análise do escritório antes da negociação.',
                'Use esta área para centralizar histórico de regularização.',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-gray-300">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-[28px] p-6">
            <h2 className="text-lg font-semibold text-white">Risco operacional</h2>
            <div className="mt-4 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4">
              <div className="text-sm font-medium text-white">Atenção controlada</div>
              <div className="mt-2 text-sm text-rose-100">
                O portal já comunica valor atualizado, urgência e necessidade de negociação de forma executiva.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ icon: Icon, title, value, subtitle, color }) => (
  <div className="glass rounded-[24px] p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm text-gray-400">{title}</div>
        <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
        <div className="mt-2 text-sm text-gray-400">{subtitle}</div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <Icon className={`h-5 w-5 ${color || 'text-white'}`} />
      </div>
    </div>
  </div>
);

export default ClientDividaAtivaPage;
