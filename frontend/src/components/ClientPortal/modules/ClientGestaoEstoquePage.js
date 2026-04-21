import React from 'react';
import { AlertTriangle, Archive, BadgeCheck, TimerReset } from 'lucide-react';
import { getPortalGestaoEstoqueData } from '../../../dev/clientPortalData';

const statusStyles = {
  saudavel: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  critico: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const ClientGestaoEstoquePage = ({ clienteId }) => {
  const moduleData = getPortalGestaoEstoqueData(clienteId);
  if (!moduleData) return null;

  const { portalClient, estoque, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
              <Archive className="mr-2 h-4 w-4" />
              Gestão &gt; Estoque
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Controle de estoque</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Leitura rápida de saldo, cobertura e itens críticos para ajudar o cliente a agir antes da ruptura.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Empresa</div>
            <div className="mt-2 text-xl font-semibold text-white">{portalClient.nome_fantasia}</div>
            <div className="mt-1 text-sm text-gray-400">{portalClient.atividade}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SummaryCard icon={Archive} title="Itens" value={`${resumo.total}`} subtitle="Monitorados no estoque" color="text-violet-300" />
        <SummaryCard icon={AlertTriangle} title="Críticos" value={`${resumo.criticos}`} subtitle="Risco imediato" color="text-rose-300" />
        <SummaryCard icon={BadgeCheck} title="Saudáveis" value={`${resumo.saudaveis}`} subtitle="Dentro da meta" color="text-emerald-300" />
        <SummaryCard icon={TimerReset} title="Cobertura média" value={`${resumo.coberturaMediaDias} dias`} subtitle="Horizonte estimado" color="text-sky-300" />
      </div>

      <div className="glass rounded-[28px] p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">Itens acompanhados</h2>
          <p className="text-sm text-gray-400">Estrutura desenhada para reposição e gestão operacional do cliente.</p>
        </div>

        <div className="space-y-3">
          {estoque.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{item.item}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[item.status] || statusStyles.saudavel}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-4">
                    <span>Categoria: {item.categoria}</span>
                    <span>Saldo: {item.saldo}</span>
                    <span>Mínimo: {item.minimo}</span>
                    <span>Cobertura: {item.cobertura}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    onClick={() => window.alert(`Abrindo item de estoque: ${item.item}`)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                  >
                    Ver item
                  </button>
                  <button
                    onClick={() => window.alert(`Planejamento de reposicao iniciado para: ${item.item}`)}
                    className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-100 hover:bg-violet-500/20"
                  >
                    Planejar reposição
                  </button>
                </div>
              </div>
            </div>
          ))}
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

export default ClientGestaoEstoquePage;
