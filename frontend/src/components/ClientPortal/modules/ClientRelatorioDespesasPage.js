import React from 'react';
import { BarChart3, CircleDollarSign, Landmark, Wallet } from 'lucide-react';
import { getPortalRelatorioDespesasData } from '../../../dev/clientPortalData';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const ClientRelatorioDespesasPage = ({ clienteId }) => {
  const moduleData = getPortalRelatorioDespesasData(clienteId);
  if (!moduleData) return null;

  const { portalClient, despesas, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
              <BarChart3 className="mr-2 h-4 w-4" />
              Relatórios &gt; Despesas
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Mapa de despesas</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Entenda rapidamente para onde vai o dinheiro da operação e quais centros de custo mais pesam no mês.
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
        <SummaryCard icon={Wallet} title="Total" value={formatCurrency(resumo.total)} subtitle="Despesas consolidadas" color="text-sky-300" />
        <SummaryCard icon={Landmark} title="Maior centro" value={resumo.maiorCentroCusto} subtitle="Principal pressão" color="text-amber-300" />
        <SummaryCard icon={CircleDollarSign} title="Média" value={formatCurrency(resumo.mediaMensal)} subtitle="Por categoria" color="text-violet-300" />
        <SummaryCard icon={BarChart3} title="Categorias" value={`${resumo.categorias}`} subtitle="Frentes monitoradas" color="text-emerald-300" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="glass rounded-[28px] p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Composição das despesas</h2>
            <p className="text-sm text-gray-400">Visual simples para leitura executiva do cliente final.</p>
          </div>

          <div className="space-y-3">
            {despesas.map((item) => (
              <div key={item.categoria} className="rounded-3xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-white">{item.categoria}</div>
                    <div className="mt-1 text-sm text-gray-400">{item.participacao}% do total</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold text-white">{formatCurrency(item.valor)}</div>
                  </div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-sky-400" style={{ width: `${item.participacao}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-[28px] p-6">
          <h2 className="text-lg font-semibold text-white">Leitura do período</h2>
          <div className="mt-5 space-y-3">
            {[
              `O total monitorado no período foi de ${formatCurrency(resumo.total)}.`,
              `${resumo.maiorCentroCusto} é hoje o maior centro de custo da operação.`,
              'A estrutura está pronta para evoluir para gráficos reais e comparativos mensais.',
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

export default ClientRelatorioDespesasPage;
