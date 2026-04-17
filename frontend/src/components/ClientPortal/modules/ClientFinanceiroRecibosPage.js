import React from 'react';
import { BadgeCheck, Download, ReceiptText, Wallet } from 'lucide-react';
import { getPortalFinanceiroRecibosData } from '../../../dev/clientPortalData';

const statusStyles = {
  emitido: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  disponivel: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
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

const ClientFinanceiroRecibosPage = ({ clienteId }) => {
  const moduleData = getPortalFinanceiroRecibosData(clienteId);
  if (!moduleData) return null;

  const { portalClient, recibos, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <ReceiptText className="mr-2 h-4 w-4" />
              Financeiro &gt; Recibos
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Recibos e comprovantes</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Consulte recibos emitidos, comprovantes disponíveis e o histórico financeiro consolidado do portal.
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
        <SummaryCard icon={ReceiptText} title="Total de recibos" value={`${resumo.total}`} subtitle="Documentos no portal" color="text-emerald-300" />
        <SummaryCard icon={BadgeCheck} title="Emitidos" value={`${resumo.emitidos}`} subtitle="Recibos confirmados" color="text-sky-300" />
        <SummaryCard icon={Download} title="Disponíveis" value={`${resumo.disponiveis}`} subtitle="Prontos para consulta" color="text-violet-300" />
        <SummaryCard icon={Wallet} title="Valor total" value={formatCurrency(resumo.valorTotal)} subtitle="Base consolidada dos recibos" color="text-amber-300" />
      </div>

      <div className="glass rounded-[28px] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Recibos disponíveis</h2>
            <p className="text-sm text-gray-400">Visualização simples e profissional para baixar, consultar e compartilhar.</p>
          </div>
        </div>

        <div className="space-y-3">
          {recibos.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{item.numero}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[item.status] || statusStyles.disponivel}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-3">
                    <span>Descrição: {item.descricao}</span>
                    <span>Emissão: {formatDate(item.emissao)}</span>
                    <span>Pagamento: {item.forma_pagamento}</span>
                  </div>
                  <div className="text-lg font-semibold text-white">{formatCurrency(item.valor)}</div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10">
                    Visualizar recibo
                  </button>
                  <button className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20">
                    Baixar PDF
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

export default ClientFinanceiroRecibosPage;
