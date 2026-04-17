import React from 'react';
import { BarChart3, Landmark, TrendingUp, Wallet } from 'lucide-react';
import { getPortalRelatorioFaturamentoData } from '../../../dev/clientPortalData';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const ClientRelatorioFaturamentoPage = ({ clienteId }) => {
  const moduleData = getPortalRelatorioFaturamentoData(clienteId);
  if (!moduleData) return null;

  const { portalClient, serieMensal, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
              <BarChart3 className="mr-2 h-4 w-4" />
              Relatórios &gt; Faturamento
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Desempenho de faturamento</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Leitura executiva da evolução de receita para dar ao cliente uma percepção clara do momento do negócio.
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
        <SummaryCard icon={Wallet} title="Atual" value={formatCurrency(resumo.faturamentoAtual)} subtitle="Faturamento do mês" color="text-sky-300" />
        <SummaryCard icon={Landmark} title="Anterior" value={formatCurrency(resumo.faturamentoAnterior)} subtitle="Base comparativa" color="text-white" />
        <SummaryCard icon={TrendingUp} title="Crescimento" value={`${resumo.crescimentoPercentual.toFixed(1)}%`} subtitle="Variação mensal" color="text-emerald-300" />
        <SummaryCard icon={BarChart3} title="Ticket médio" value={formatCurrency(resumo.ticketMedio)} subtitle="Receita por operação" color="text-violet-300" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="glass rounded-[28px] p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Evolução mensal</h2>
            <p className="text-sm text-gray-400">Gráfico simplificado em cards para leitura rápida do cliente.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {serieMensal.map((item) => {
              const width = Math.max((item.valor / resumo.maiorValor) * 100, 18);

              return (
                <div key={item.mes} className="rounded-3xl border border-white/8 bg-black/20 p-4">
                  <div className="text-sm text-gray-400">{item.mes}</div>
                  <div className="mt-3 text-lg font-semibold text-white">{formatCurrency(item.valor)}</div>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-sky-400" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-[28px] p-6">
          <h2 className="text-lg font-semibold text-white">Leitura do período</h2>
          <div className="mt-5 space-y-3">
            {[
              `O mês atual fechou em ${formatCurrency(resumo.faturamentoAtual)}.`,
              `A variação frente ao mês anterior foi de ${resumo.crescimentoPercentual.toFixed(1)}%.`,
              'A estrutura já está pronta para receber gráficos reais da API depois.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-gray-300">
                {item}
              </div>
            ))}
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

export default ClientRelatorioFaturamentoPage;
