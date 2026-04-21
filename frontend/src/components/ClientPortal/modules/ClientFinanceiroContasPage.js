import React from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, BadgeDollarSign, CalendarRange, CheckCircle2, Clock3, Wallet } from 'lucide-react';
import { getPortalFinanceiroContasData } from '../../../dev/clientPortalData';

const statusStyles = {
  pago: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  em_aberto: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  atrasado: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '-';

const ClientFinanceiroContasPage = ({ clienteId }) => {
  const moduleData = getPortalFinanceiroContasData(clienteId);

  if (!moduleData) return null;

  const { portalClient, contas, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <Wallet className="mr-2 h-4 w-4" />
              Financeiro &gt; Contas
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Contas da empresa</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Acompanhe títulos, vencimentos e situação financeira com leitura clara para cliente final.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Empresa atual</div>
            <div className="mt-2 text-xl font-semibold text-white">{portalClient.nome_fantasia}</div>
            <div className="mt-1 text-sm text-gray-400">{portalClient.regime_label}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SummaryCard icon={Clock3} title="Em aberto" value={formatCurrency(resumo.totalAberto)} subtitle="Títulos a vencer" tone="amber" />
        <SummaryCard icon={AlertTriangle} title="Em atraso" value={formatCurrency(resumo.totalAtrasado)} subtitle="Atenção prioritária" tone="rose" />
        <SummaryCard icon={CheckCircle2} title="Pagas" value={formatCurrency(resumo.totalPago)} subtitle="Baixas realizadas" tone="emerald" />
        <SummaryCard icon={BadgeDollarSign} title="Total monitorado" value={`${resumo.totalContas}`} subtitle="Contas no portal" tone="sky" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="glass rounded-[28px] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Títulos e lançamentos</h2>
              <p className="text-sm text-gray-400">Lista financeira organizada para consulta rápida e acompanhamento.</p>
            </div>
            <CalendarRange className="h-5 w-5 text-gray-400" />
          </div>

          <div className="space-y-3">
            {contas.map((conta) => (
              <div key={conta.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{conta.descricao}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[conta.situacao] || statusStyles.em_aberto}`}>
                        {conta.situacao.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 md:grid-cols-2 xl:grid-cols-3">
                      <span>Documento: {conta.documento}</span>
                      <span>Categoria: {conta.categoria}</span>
                      <span>Origem: {conta.origem}</span>
                      <span>Emissão: {formatDate(conta.data_emissao)}</span>
                      <span>Vencimento: {formatDate(conta.data_vencimento)}</span>
                      <span>Recebimento: {formatDate(conta.data_recebimento)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="font-semibold text-white">{formatCurrency(conta.total_liquido)}</span>
                      <span className="text-gray-400">{conta.forma_pagamento}</span>
                      <span className="text-gray-400">{conta.usuario_responsavel}</span>
                    </div>
                  </div>

                  <div className="flex min-w-[220px] flex-col gap-2">
                    <button
                      onClick={() => window.alert(`Abrindo comprovantes de: ${conta.descricao}`)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                    >
                      Ver comprovantes
                    </button>
                    <button
                      onClick={() => window.alert(`Solicitacao de atendimento criada para: ${conta.descricao}`)}
                      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20"
                    >
                      Solicitar atendimento
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-[28px] p-6">
            <h2 className="text-lg font-semibold text-white">Leitura financeira</h2>
            <div className="mt-5 space-y-3">
              <FinancialHint
                icon={ArrowUpRight}
                title="Recebimentos confirmados"
                value={formatCurrency(resumo.totalPago)}
                tone="emerald"
              />
              <FinancialHint
                icon={ArrowDownLeft}
                title="Pendências imediatas"
                value={formatCurrency(resumo.totalAtrasado)}
                tone="rose"
              />
              <FinancialHint
                icon={Clock3}
                title="A vencer"
                value={formatCurrency(resumo.totalAberto)}
                tone="amber"
              />
            </div>
          </div>

          <div className="glass rounded-[28px] p-6">
            <h2 className="text-lg font-semibold text-white">Orientações</h2>
            <div className="mt-5 space-y-3">
              {[
                'Use esta visão para acompanhar títulos sem depender do time interno.',
                'Os comprovantes e documentos financeiros podem ser centralizados aqui.',
                'O próximo passo é integrar segunda via, anexos e mensagens do financeiro.',
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

const SummaryCard = ({ icon: Icon, title, value, subtitle, tone }) => {
  const toneMap = {
    emerald: 'text-emerald-300',
    rose: 'text-rose-300',
    amber: 'text-amber-300',
    sky: 'text-sky-300',
  };

  return (
    <div className="glass rounded-[24px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-400">{title}</div>
          <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
          <div className="mt-2 text-sm text-gray-400">{subtitle}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <Icon className={`h-5 w-5 ${toneMap[tone] || 'text-white'}`} />
        </div>
      </div>
    </div>
  );
};

const FinancialHint = ({ icon: Icon, title, value, tone }) => {
  const toneMap = {
    emerald: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
    rose: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
    amber: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm opacity-80">{title}</div>
          <div className="mt-2 text-lg font-semibold text-white">{value}</div>
        </div>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
};

export default ClientFinanceiroContasPage;
