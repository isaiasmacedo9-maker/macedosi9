import React from 'react';
import { ArrowDownCircle, ArrowUpCircle, BadgeDollarSign, Landmark, Wallet } from 'lucide-react';
import { getPortalFinanceiroCaixaData } from '../../../dev/clientPortalData';

const statusStyles = {
  confirmado: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  conciliando: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  previsto: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

const typeStyles = {
  entrada: 'text-emerald-300',
  saida: 'text-rose-300',
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

const ClientFinanceiroCaixaPage = ({ clienteId }) => {
  const moduleData = getPortalFinanceiroCaixaData(clienteId);
  if (!moduleData) return null;

  const { portalClient, movimentacoes, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <Wallet className="mr-2 h-4 w-4" />
              Financeiro &gt; Caixa
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Fluxo de caixa</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Visão objetiva das entradas e saídas da empresa para acompanhamento financeiro diário.
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
        <SummaryCard icon={ArrowUpCircle} title="Entradas" value={formatCurrency(resumo.entradas)} subtitle="Receitas lançadas" color="text-emerald-300" />
        <SummaryCard icon={ArrowDownCircle} title="Saídas" value={formatCurrency(resumo.saidas)} subtitle="Despesas e pagamentos" color="text-rose-300" />
        <SummaryCard icon={Landmark} title="Saldo projetado" value={formatCurrency(resumo.saldoProjetado)} subtitle="Leitura consolidada" color="text-sky-300" />
        <SummaryCard icon={BadgeDollarSign} title="Conciliando" value={`${resumo.conciliando}`} subtitle="Movimentações em conferência" color="text-amber-300" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="glass rounded-[28px] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Movimentações recentes</h2>
              <p className="text-sm text-gray-400">Base visual pronta para conciliação e consulta pelo cliente.</p>
            </div>
          </div>

          <div className="space-y-3">
            {movimentacoes.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{item.descricao}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[item.status] || statusStyles.previsto}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-3">
                      <span>Data: {formatDate(item.data)}</span>
                      <span>Categoria: {item.categoria}</span>
                      <span>Canal: {item.canal}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-lg font-semibold ${typeStyles[item.tipo] || 'text-white'}`}>
                      {item.tipo === 'saida' ? '-' : '+'}
                      {formatCurrency(item.valor)}
                    </div>
                    <div className="mt-1 text-sm capitalize text-gray-400">{item.tipo}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-[28px] p-6">
            <h2 className="text-lg font-semibold text-white">Leitura rápida</h2>
            <div className="mt-5 space-y-3">
              {[
                'Entradas e saídas ficam centralizadas em uma única visão.',
                'O saldo projetado ajuda o cliente a entender a operação atual.',
                'A base está pronta para receber integração bancária depois.',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-gray-300">
                  {item}
                </div>
              ))}
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

export default ClientFinanceiroCaixaPage;
