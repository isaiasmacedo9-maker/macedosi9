import React from 'react';
import { BadgeCheck, Building2, RefreshCcw, Wallet } from 'lucide-react';
import { getPortalGestaoClientesData } from '../../../dev/clientPortalData';

const statusStyles = {
  ativo: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  reativacao: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
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

const ClientGestaoClientesPage = ({ clienteId }) => {
  const moduleData = getPortalGestaoClientesData(clienteId);
  if (!moduleData) return null;

  const { portalClient, clientes, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
              <Building2 className="mr-2 h-4 w-4" />
              Gestão &gt; Clientes
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Base de clientes</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Consulte seus principais clientes, estágio de relacionamento e faturamento mensal em uma visão executiva.
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
        <SummaryCard icon={Building2} title="Total" value={`${resumo.total}`} subtitle="Clientes monitorados" color="text-violet-300" />
        <SummaryCard icon={BadgeCheck} title="Ativos" value={`${resumo.ativos}`} subtitle="Carteira principal" color="text-emerald-300" />
        <SummaryCard icon={RefreshCcw} title="Reativação" value={`${resumo.reativacao}`} subtitle="Oportunidades em andamento" color="text-amber-300" />
        <SummaryCard icon={Wallet} title="Faturamento" value={formatCurrency(resumo.faturamentoMensal)} subtitle="Mensal estimado" color="text-sky-300" />
      </div>

      <div className="glass rounded-[28px] p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">Carteira acompanhada</h2>
          <p className="text-sm text-gray-400">Visualização organizada para relacionamento e operação comercial.</p>
        </div>

        <div className="space-y-3">
          {clientes.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{item.nome}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[item.status] || statusStyles.ativo}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-3">
                    <span>Categoria: {item.categoria}</span>
                    <span>Cidade: {item.cidade}</span>
                    <span>Último contato: {formatDate(item.ultimoContato)}</span>
                  </div>
                  <div className="text-sm font-semibold text-white">{formatCurrency(item.faturamentoMensal)}/mês</div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    onClick={() => window.alert(`Abrindo relacionamento de: ${item.nome}`)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                  >
                    Ver relacionamento
                  </button>
                  <button
                    onClick={() => window.alert(`Contato registrado para: ${item.nome}`)}
                    className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-100 hover:bg-violet-500/20"
                  >
                    Registrar contato
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

export default ClientGestaoClientesPage;
