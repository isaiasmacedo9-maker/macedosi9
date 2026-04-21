import React from 'react';
import { BadgeCheck, FileSpreadsheet, Send, Wallet } from 'lucide-react';
import { getPortalFinanceiroOrcamentosData } from '../../../dev/clientPortalData';

const statusStyles = {
  aprovado: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  enviado: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  em_analise: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
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

const ClientFinanceiroOrcamentosPage = ({ clienteId }) => {
  const moduleData = getPortalFinanceiroOrcamentosData(clienteId);
  if (!moduleData) return null;

  const { portalClient, orcamentos, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Financeiro &gt; Orçamentos
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Propostas e orçamentos</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Acompanhe propostas comerciais ativas, validade e status de aprovação em uma leitura simples para o cliente.
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
        <SummaryCard icon={FileSpreadsheet} title="Total" value={`${resumo.total}`} subtitle="Propostas no portal" color="text-emerald-300" />
        <SummaryCard icon={Wallet} title="Valor total" value={formatCurrency(resumo.valorTotal)} subtitle="Pipeline consolidado" color="text-sky-300" />
        <SummaryCard icon={BadgeCheck} title="Aprovados" value={`${resumo.aprovados}`} subtitle="Prontos para execução" color="text-emerald-300" />
        <SummaryCard icon={Send} title="Em análise" value={`${resumo.emAnalise}`} subtitle="Aguardando retorno" color="text-amber-300" />
      </div>

      <div className="glass rounded-[28px] p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">Orçamentos recentes</h2>
          <p className="text-sm text-gray-400">Visual pronto para jornada comercial e acompanhamento de conversão.</p>
        </div>

        <div className="space-y-3">
          {orcamentos.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{item.titulo}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[item.status] || statusStyles.enviado}`}>
                      {item.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-3">
                    <span>Cliente: {item.cliente}</span>
                    <span>Emissão: {formatDate(item.emissao)}</span>
                    <span>Validade: {formatDate(item.validade)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="font-semibold text-white">{formatCurrency(item.valor)}</span>
                    <span className="text-gray-400">{item.origem}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    onClick={() => window.alert(`Abrindo proposta: ${item.titulo}`)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                  >
                    Ver proposta
                  </button>
                  <button
                    onClick={() => window.alert(`Compartilhamento iniciado para: ${item.titulo}`)}
                    className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20"
                  >
                    Compartilhar
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

export default ClientFinanceiroOrcamentosPage;
