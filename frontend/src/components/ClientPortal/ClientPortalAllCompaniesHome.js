import React from 'react';
import { BadgeCheck, BellRing, Building2, CircleAlert, Landmark, Wallet } from 'lucide-react';

const statusStyles = {
  regular: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  pendente: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  atrasado: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const formatDate = (value) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });

const ClientPortalAllCompaniesHome = ({ consolidatedContext }) => {
  if (!consolidatedContext) return null;

  const { resumo, accessibleClients, alertas, statusFinanceiro, obrigacoesFiscais } = consolidatedContext;
  const impostosPorEmpresa = accessibleClients.map((company) => {
    const impostos = (obrigacoesFiscais || [])
      .filter((item) => item.empresa_id === company.clientRefId && item.status !== 'entregue')
      .sort((a, b) => new Date(a.proximo_vencimento) - new Date(b.proximo_vencimento));

    const proximo = impostos[0] || null;
    return {
      clienteId: company.clienteId,
      nome: company.nome_fantasia,
      regime: company.regime_label,
      total: impostos.reduce((sum, item) => sum + (item.valor || 0), 0),
      quantidade: impostos.length,
      proximo,
    };
  });
  const totalImpostosVencer = impostosPorEmpresa.reduce((sum, item) => sum + item.total, 0);
  const empresasComImpostos = impostosPorEmpresa.filter((item) => item.quantidade > 0).length;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Visão consolidada</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Todas as empresas vinculadas</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-300">
              Painel geral para acompanhar indicadores principais sem focar em um regime especifico.
            </p>
          </div>
          <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusStyles[statusFinanceiro]}`}>
            Status consolidado: {statusFinanceiro}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="glass rounded-[24px] border border-white/10 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-300">Empresas vinculadas</p>
            <Building2 className="h-5 w-5 text-blue-300" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{resumo.totalEmpresas}</p>
        </div>
        <div className="glass rounded-[24px] border border-white/10 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-300">Saldo monitorado</p>
            <Wallet className="h-5 w-5 text-emerald-300" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(resumo.saldoMonitorado)}</p>
        </div>
        <div className="glass rounded-[24px] border border-white/10 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-300">Impostos a vencer</p>
            <Landmark className="h-5 w-5 text-amber-300" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(totalImpostosVencer)}</p>
          <p className="mt-1 text-xs text-gray-400">{empresasComImpostos} empresa(s) com vencimentos</p>
        </div>
        <div className="glass rounded-[24px] border border-white/10 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-300">Documentos pendentes</p>
            <BellRing className="h-5 w-5 text-rose-300" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{resumo.documentosPendentes}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass rounded-[28px] p-6 xl:col-span-2">
          <h2 className="text-lg font-semibold text-white">Impostos a vencer por empresa</h2>
          <p className="mt-1 text-sm text-gray-400">Visão consolidada dos tributos pendentes das empresas vinculadas.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {impostosPorEmpresa.map((item) => (
              <div key={item.clienteId} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">{item.nome}</p>
                    <p className="mt-1 text-xs text-gray-400">{item.regime}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      item.quantidade > 0 ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'
                    }`}
                  >
                    {item.quantidade > 0 ? `${item.quantidade} imposto(s)` : 'Sem pendencias'}
                  </span>
                </div>
                <div className="mt-4">
                  {item.proximo ? (
                    <>
                      <p className="text-2xl font-semibold text-white">{formatCurrency(item.total)}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Proximo vencimento: {formatDate(item.proximo.proximo_vencimento)} ({item.proximo.nome})
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-300">Nao ha impostos a vencer no momento para esta empresa.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-[28px] p-6">
          <h2 className="text-lg font-semibold text-white">Empresas no portal</h2>
          <p className="mt-1 text-sm text-gray-400">Selecione uma empresa na lateral para abrir menu detalhado por regime.</p>
          <div className="mt-4 space-y-3">
            {accessibleClients.map((item) => (
              <div key={item.clienteId} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="text-sm font-medium text-white">{item.nome_fantasia}</div>
                <div className="mt-1 text-xs text-gray-400">
                  {item.regime_label} • {item.atividade}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-[28px] p-6">
          <h2 className="text-lg font-semibold text-white">Alertas consolidados</h2>
          <p className="mt-1 text-sm text-gray-400">Pendencias mais proximas entre todas as empresas.</p>
          <div className="mt-4 space-y-3">
            {alertas.slice(0, 5).map((alerta) => {
              const isLate = alerta.status === 'atrasado';
              return (
                <div key={`${alerta.id}-${alerta.empresa_id}`} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-start gap-3">
                    {isLate ? (
                      <CircleAlert className="mt-0.5 h-4 w-4 text-rose-300" />
                    ) : (
                      <BadgeCheck className="mt-0.5 h-4 w-4 text-amber-300" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">{alerta.nome}</p>
                      <p className="mt-1 text-xs text-gray-400">Vencimento: {formatDate(alerta.proximo_vencimento)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientPortalAllCompaniesHome;
