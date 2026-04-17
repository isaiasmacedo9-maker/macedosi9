import React from 'react';
import { BadgeCheck, FileStack, Filter, Receipt, Search, TrendingUp } from 'lucide-react';
import { getPortalNotasHistoricoData } from '../../../dev/clientPortalData';

const statusStyles = {
  conciliado: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  pendente: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  divergente: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  nao_conciliado: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
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

const ClientNotasHistoricoPage = ({ clienteId }) => {
  const moduleData = getPortalNotasHistoricoData(clienteId);

  if (!moduleData) return null;

  const { portalClient, notas, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
              <FileStack className="mr-2 h-4 w-4" />
              Notas fiscais e histórico
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Histórico de notas fiscais</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Consulte notas emitidas e entradas registradas com foco em conferência, faturamento e conciliação.
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
        <SummaryCard icon={Receipt} title="Notas no período" value={`${resumo.totalNotas}`} subtitle="Saídas e entradas registradas" />
        <SummaryCard icon={TrendingUp} title="Faturamento" value={formatCurrency(resumo.totalFaturado)} subtitle="Notas de saída consolidadas" />
        <SummaryCard icon={BadgeCheck} title="Entradas" value={formatCurrency(resumo.totalEntradas)} subtitle="Compras e suprimentos" />
        <SummaryCard icon={Filter} title="Pendentes" value={`${resumo.pendentes}`} subtitle="Aguardando conciliação" />
      </div>

      <div className="glass rounded-[28px] p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Lista de notas</h2>
            <p className="text-sm text-gray-400">Base pronta para filtros e integração futura com emissão real.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400">
              <Search className="h-4 w-4" />
              Buscar por número ou chave
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400">
              Últimos 90 dias
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {notas.map((nota) => (
            <div key={nota.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">
                      NF {nota.numero} • Série {nota.serie}
                    </h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[nota.status_conciliacao] || statusStyles.pendente}`}>
                      {nota.status_conciliacao.replace('_', ' ')}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 uppercase">
                      {nota.tipo}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 md:grid-cols-2 xl:grid-cols-3">
                    <span>Emissão: {formatDate(nota.data_emissao)}</span>
                    <span>CFOP: {nota.cfop}</span>
                    <span>Valor: {formatCurrency(nota.valor_total)}</span>
                    <span>Parceiro: {nota.cliente_fornecedor}</span>
                    <span>Natureza: {nota.natureza}</span>
                    <span>Emitente: {nota.emitente_razao_social}</span>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2 text-xs text-gray-400 break-all">
                    Chave de acesso: {nota.chave_nfe}
                  </div>
                </div>

                <div className="flex min-w-[210px] flex-col gap-2">
                  <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10">
                    Ver detalhes
                  </button>
                  <button className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-100 hover:bg-sky-500/20">
                    Baixar XML/PDF
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

const SummaryCard = ({ icon: Icon, title, value, subtitle }) => (
  <div className="glass rounded-[24px] p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm text-gray-400">{title}</div>
        <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
        <div className="mt-2 text-sm text-gray-400">{subtitle}</div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <Icon className="h-5 w-5 text-sky-300" />
      </div>
    </div>
  </div>
);

export default ClientNotasHistoricoPage;
