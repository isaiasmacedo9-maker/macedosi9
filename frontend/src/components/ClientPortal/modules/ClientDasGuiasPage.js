import React, { useMemo, useState } from 'react';
import { BadgeCheck, BellRing, CalendarClock, Download, FileText, Landmark, ReceiptText } from 'lucide-react';
import { getPortalDasGuiasData } from '../../../dev/clientPortalData';

const parcelamentoStatusStyles = {
  em_dia: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  atrasado: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  concluido: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
};

const parcelaStatusStyles = {
  pago: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  pendente: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  vencido: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const impostoTabsOrder = ['DAS', 'INSS', 'FGTS', 'Outros'];

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

const formatMonthFromCompetencia = (competencia) => {
  const [year, month] = String(competencia || '').split('-');
  if (!year || !month) return '--';
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
};

const toStatusLabel = (status) => {
  if (status === 'em_dia') return 'em dia';
  if (status === 'atrasado') return 'atrasado';
  if (status === 'concluido') return 'concluído';
  if (status === 'pago') return 'Pago';
  if (status === 'pendente') return 'Pendente';
  if (status === 'vencido') return 'Vencido';
  return status;
};

const normalizeParcelaStatus = (status) => {
  if (status === 'paga') return 'pago';
  if (status === 'aberta') return 'pendente';
  if (status === 'atrasada') return 'vencido';
  if (status === 'pago' || status === 'pendente' || status === 'vencido') return status;
  return 'pendente';
};

const normalizeGuiaStatus = (status) => {
  if (status === 'entregue') return 'pago';
  if (status === 'atrasado') return 'vencido';
  return 'pendente';
};

const getAliquotaByImpostoTipo = (impostoTipo) => {
  if (impostoTipo === 'DAS') return 6;
  if (impostoTipo === 'INSS') return 11;
  if (impostoTipo === 'FGTS') return 8;
  return 4;
};

const ClientDasGuiasPage = ({ clienteId }) => {
  const moduleData = getPortalDasGuiasData(clienteId);
  const [activeTab, setActiveTab] = useState('Todos');
  const [activeParcelamentoTab, setActiveParcelamentoTab] = useState('Todos');
  const [selectedParcelamentoId, setSelectedParcelamentoId] = useState(null);

  if (!moduleData) return null;

  const { portalClient, guias, resumo, parcelamentosAtivos = [] } = moduleData;
  const statusStorageKey = `mock_parcelas_status_${clienteId}`;

  const [parcelamentosState, setParcelamentosState] = useState(() => {
    let savedStatus = {};
    try {
      savedStatus = JSON.parse(localStorage.getItem(statusStorageKey) || '{}');
    } catch {
      savedStatus = {};
    }

    return parcelamentosAtivos.map((parcelamento) => ({
      ...parcelamento,
      parcelas: (parcelamento.parcelas || []).map((parcela) => {
        const key = `${parcelamento.id}-${parcela.numero}`;
        return {
          ...parcela,
          status: normalizeParcelaStatus(savedStatus[key] || parcela.status),
        };
      }),
    }));
  });

  const dynamicTabs = useMemo(() => {
    const tiposDisponiveis = new Set(guias.map((guia) => guia.imposto_tipo).filter(Boolean));
    const tabsDisponiveis = impostoTabsOrder.filter((tipo) => tiposDisponiveis.has(tipo));
    return ['Todos', ...(parcelamentosState.length ? ['Parcelamento'] : []), ...tabsDisponiveis];
  }, [guias, parcelamentosState]);

  const safeActiveTab = dynamicTabs.includes(activeTab) ? activeTab : 'Todos';

  const filteredGuias = useMemo(() => {
    if (safeActiveTab === 'Todos') return guias;
    if (safeActiveTab === 'Parcelamento') return [];
    return guias.filter((guia) => guia.imposto_tipo === safeActiveTab);
  }, [safeActiveTab, guias]);

  const parcelamentoSubTabs = ['Todos', 'Simples Nacional', 'Previdenciário', 'PGFN - Simples Nacional', 'PGFN - Previdenciário'];
  const filteredParcelamentos = useMemo(() => {
    if (activeParcelamentoTab === 'Todos') return parcelamentosState;
    return parcelamentosState.filter((item) => item.categoria === activeParcelamentoTab);
  }, [activeParcelamentoTab, parcelamentosState]);

  const handleParcelaStatusChange = (parcelamentoId, parcelaNumero, nextStatus) => {
    const normalized = normalizeParcelaStatus(nextStatus);
    setParcelamentosState((current) =>
      current.map((parcelamento) => {
        if (parcelamento.id !== parcelamentoId) return parcelamento;
        return {
          ...parcelamento,
          parcelas: (parcelamento.parcelas || []).map((parcela) =>
            parcela.numero === parcelaNumero ? { ...parcela, status: normalized } : parcela,
          ),
        };
      }),
    );

    try {
      const existing = JSON.parse(localStorage.getItem(statusStorageKey) || '{}');
      const next = { ...existing, [`${parcelamentoId}-${parcelaNumero}`]: normalized };
      localStorage.setItem(statusStorageKey, JSON.stringify(next));
    } catch {
      // no-op: fallback apenas em memória para desenvolvimento
    }
  };

  const proximaGuia = filteredGuias.find((item) => item.status !== 'entregue') || filteredGuias[0] || guias[0];
  const selectedParcelamento = filteredParcelamentos.find((item) => item.id === selectedParcelamentoId) || filteredParcelamentos[0] || null;
  const proximoItem = safeActiveTab === 'Parcelamento' ? selectedParcelamento : proximaGuia;
  const impostoRows = useMemo(
    () =>
      filteredGuias.map((guia) => {
        const aliquota = getAliquotaByImpostoTipo(guia.imposto_tipo);
        const receitaDeclarada = aliquota > 0 ? guia.valor / (aliquota / 100) : guia.valor;
        return {
          id: guia.id,
          mes: formatMonthFromCompetencia(guia.competencia),
          competencia: guia.competencia,
          receitaDeclarada,
          aliquota,
          valorImposto: guia.valor,
          status: normalizeGuiaStatus(guia.status),
          vencimento: guia.vencimento,
        };
      }),
    [filteredGuias],
  );

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-200">
              <ReceiptText className="mr-2 h-4 w-4" />
              Impostos e guias fiscais
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Impostos do {portalClient.regime_label}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-gray-300">
              Consulte competências, vencimentos e documentos por tipo de imposto.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm uppercase tracking-[0.15em] text-gray-400">Próximo vencimento</div>
            <div className="mt-2 text-2xl font-semibold text-white">{proximoItem ? formatDate(proximoItem.vencimento) : '--'}</div>
            <div className="mt-1 text-base text-gray-300">{proximoItem?.descricao || 'Sem lançamento pendente'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SummaryCard icon={Landmark} title="Total em aberto" value={formatCurrency(resumo.totalEmAberto)} subtitle="Guias pendentes e em andamento" />
        <SummaryCard icon={CalendarClock} title="Próximas guias" value={`${resumo.proximas}`} subtitle="Vencimentos monitorados" />
        <SummaryCard icon={BadgeCheck} title="Guias pagas" value={`${resumo.pagas}`} subtitle="Entregas concluídas" />
        <SummaryCard icon={BellRing} title="Competências" value={`${resumo.totalGuias}`} subtitle="Períodos disponíveis" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="glass rounded-[28px] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Impostos por competência</h2>
              <p className="text-base text-gray-300">Navegação por tipo de imposto com visão organizada.</p>
            </div>
            <FileText className="h-5 w-5 text-gray-400" />
          </div>

          <div className="mb-5 overflow-x-auto">
            {safeActiveTab === 'Parcelamento' ? (
              <div className="inline-flex min-w-full gap-2 rounded-2xl border border-white/8 bg-black/20 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('Todos');
                    setActiveParcelamentoTab('Todos');
                    setSelectedParcelamentoId(null);
                  }}
                  className="whitespace-nowrap rounded-xl border border-white/15 px-4 py-2.5 text-base font-medium text-gray-200 transition hover:bg-white/5 hover:text-white"
                >
                  Voltar
                </button>
                <button type="button" className="whitespace-nowrap rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-base font-medium text-white">
                  Parcelamento
                </button>
              </div>
            ) : (
              <div className="inline-flex min-w-full gap-2 rounded-2xl border border-white/8 bg-black/20 p-1.5">
                {dynamicTabs.map((tab) => {
                  const isActive = safeActiveTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab);
                        if (tab === 'Parcelamento') {
                          setActiveParcelamentoTab('Todos');
                          setSelectedParcelamentoId(null);
                        }
                      }}
                      className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-base font-medium transition ${
                        isActive
                          ? 'border border-red-500/40 bg-red-500/10 text-white'
                          : 'border border-transparent text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {safeActiveTab === 'Parcelamento' ? (
              <>
                <div className="overflow-x-auto">
                  <div className="inline-flex min-w-full gap-2 rounded-2xl border border-white/8 bg-black/15 p-1.5">
                    {parcelamentoSubTabs.map((subTab) => {
                      const isActive = activeParcelamentoTab === subTab;
                      return (
                        <button
                          key={subTab}
                          type="button"
                          onClick={() => {
                            setActiveParcelamentoTab(subTab);
                            setSelectedParcelamentoId(null);
                          }}
                          className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-base font-medium transition ${
                            isActive
                              ? 'border border-red-500/40 bg-red-500/10 text-white'
                              : 'border border-transparent text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {subTab}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredParcelamentos.map((parcelamento) => {
                    const isExpanded = selectedParcelamentoId === parcelamento.id;
                    const parcelas = parcelamento.parcelas || [];
                    const parcelasPagas = parcelas.filter((item) => item.status === 'pago').length;
                    const parcelasPendentes = parcelas.filter((item) => item.status === 'pendente').length;
                    const parcelasVencidas = parcelas.filter((item) => item.status === 'vencido').length;
                    const totalParcelas = parcelamento.total_parcelas || parcelas.length;
                    const valorTotal = Number(parcelamento.valor_parcela || 0) * Number(totalParcelas || 0);
                    const valorPago = parcelas
                      .filter((item) => item.status === 'pago')
                      .reduce((acc, item) => acc + Number(item.valor || 0), 0);
                    const valorEmAberto = Math.max(valorTotal - valorPago, 0);

                    return (
                      <div
                        key={parcelamento.id}
                        className={`rounded-3xl border p-4 transition ${
                          isExpanded ? 'border-red-500/40 bg-red-500/10' : 'border-white/8 bg-black/20'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedParcelamentoId((prev) => (prev === parcelamento.id ? null : parcelamento.id))}
                          className="w-full text-left"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-lg font-semibold text-white">{parcelamento.numero}</h3>
                            <span
                              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                                parcelamentoStatusStyles[parcelamento.status] || parcelamentoStatusStyles.em_dia
                              }`}
                            >
                              {toStatusLabel(parcelamento.status)}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-base text-gray-200 sm:grid-cols-2">
                            <span>Tipo: {parcelamento.categoria}</span>
                            <span>Criação: {formatDate(parcelamento.data_criacao)}</span>
                          </div>
                          <div className="mt-2 text-base text-gray-300">{parcelamento.descricao}</div>
                        </button>

                        {isExpanded && (
                          <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-sm uppercase tracking-[0.15em] text-gray-400">Resumo do parcelamento</div>
                                <div className="mt-1 text-base text-gray-300">
                                  {parcelamento.numero} • {parcelamento.categoria}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedParcelamentoId(null)}
                                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-white/10"
                              >
                                Voltar para a lista
                              </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                              <ResumoItem label="Total de parcelas" value={`${totalParcelas}`} />
                              <ResumoItem label="Parcelas pagas" value={`${parcelasPagas}`} valueClass="text-emerald-300" />
                              <ResumoItem label="Parcelas pendentes" value={`${parcelasPendentes}`} valueClass="text-amber-300" />
                              <ResumoItem label="Parcelas vencidas" value={`${parcelasVencidas}`} valueClass="text-rose-300" />
                              <ResumoItem label="Valor total" value={formatCurrency(valorTotal)} />
                              <ResumoItem label="Valor já pago" value={formatCurrency(valorPago)} valueClass="text-emerald-300" />
                              <ResumoItem label="Valor em aberto" value={formatCurrency(valorEmAberto)} valueClass="text-amber-200" />
                            </div>

                            <div className="space-y-2">
                              <div className="mb-1 text-sm uppercase tracking-[0.15em] text-gray-400">Parcelas</div>
                              <div className="hidden rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm font-medium text-gray-200 md:grid md:grid-cols-[140px_1fr_1fr_190px_140px]">
                                <span>Parcela</span>
                                <span>Vencimento</span>
                                <span>Valor</span>
                                <span>Status</span>
                                <span>Documento</span>
                              </div>
                              {parcelas.map((parcela) => (
                                <div key={`${parcelamento.id}-${parcela.numero}`} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_1fr_1fr_190px_140px] md:items-center">
                                    <div className="text-base font-semibold text-white">Parcela {parcela.numero}</div>
                                    <div className="text-sm text-gray-200">{formatDate(parcela.vencimento)}</div>
                                    <div className="text-sm text-gray-200">{formatCurrency(parcela.valor)}</div>
                                    <div>
                                      <select
                                        value={parcela.status}
                                        onChange={(event) =>
                                          handleParcelaStatusChange(parcelamento.id, parcela.numero, event.target.value)
                                        }
                                        className={`w-full rounded-xl border px-3 py-2 text-sm font-medium outline-none transition focus:ring-2 focus:ring-white/20 ${
                                          parcelaStatusStyles[parcela.status] || parcelaStatusStyles.pendente
                                        }`}
                                      >
                                        <option value="pago">Pago</option>
                                        <option value="pendente">Pendente</option>
                                        <option value="vencido">Vencido</option>
                                      </select>
                                    </div>
                                    <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-100 hover:bg-red-500/20">
                                      <Download className="h-4 w-4" />
                                      Download
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="hidden rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm font-medium text-gray-200 md:grid md:grid-cols-[1.1fr_120px_1.2fr_110px_1.1fr_130px_130px]">
                  <span>Mês</span>
                  <span>Competência</span>
                  <span>Receita declarada</span>
                  <span>Alíquota</span>
                  <span>Valor do imposto</span>
                  <span>Status</span>
                  <span>Vencimento</span>
                </div>

                {impostoRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.1fr_120px_1.2fr_110px_1.1fr_130px_130px] md:items-center">
                      <div className="text-base font-medium text-white capitalize">{row.mes}</div>
                      <div className="text-sm text-gray-200">{row.competencia}</div>
                      <div className="text-sm text-gray-200">{formatCurrency(row.receitaDeclarada)}</div>
                      <div className="text-sm text-gray-200">{`${row.aliquota.toFixed(2).replace('.', ',')}%`}</div>
                      <div className="text-base font-semibold text-white">{formatCurrency(row.valorImposto)}</div>
                      <div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                            parcelaStatusStyles[row.status] || parcelaStatusStyles.pendente
                          }`}
                        >
                          {toStatusLabel(row.status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-200">{formatDate(row.vencimento)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!filteredGuias.length && safeActiveTab !== 'Parcelamento' && (
              <div className="rounded-3xl border border-dashed border-white/20 bg-black/20 p-6 text-center text-base text-gray-300">
                Nenhum imposto encontrado para a aba selecionada.
              </div>
            )}

            {!filteredParcelamentos.length && safeActiveTab === 'Parcelamento' && (
              <div className="rounded-3xl border border-dashed border-white/20 bg-black/20 p-6 text-center text-base text-gray-300">
                Nenhum parcelamento encontrado para o filtro selecionado.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-[28px] p-6">
            <h2 className="text-xl font-semibold text-white">Como usar</h2>
            <div className="mt-5 space-y-3">
              {[
                'Selecione uma aba para filtrar o tipo de imposto.',
                'Clique em um parcelamento para abrir as parcelas abaixo.',
                'Use o botão Download para baixar o documento de cada parcela.',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-base text-gray-300">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-[28px] p-6">
            <h2 className="text-xl font-semibold text-white">Arquivo em destaque</h2>
            <div className="mt-4 rounded-3xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="text-base font-medium text-white">
                {safeActiveTab === 'Parcelamento'
                  ? selectedParcelamento?.numero || 'Sem parcelamento ativo'
                  : proximaGuia?.arquivo_nome || 'Sem arquivo disponível'}
              </div>
              <div className="mt-2 text-base text-red-100">
                {safeActiveTab === 'Parcelamento'
                  ? selectedParcelamento
                    ? `${selectedParcelamento.categoria} • parcela ${selectedParcelamento.parcela_atual}/${selectedParcelamento.total_parcelas}`
                    : 'Selecione uma aba com lançamentos ativos'
                  : proximaGuia
                    ? `Competência ${proximaGuia.competencia}`
                    : 'Selecione uma aba com guias ativas'}
              </div>
              <div className="mt-3 text-sm text-red-200">Documento preparado para download e conferência.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ icon: Icon, title, value, subtitle }) => (
  <div className="glass rounded-[24px] p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-base text-gray-300">{title}</div>
        <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
        <div className="mt-2 text-base text-gray-300">{subtitle}</div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <Icon className="h-5 w-5 text-red-300" />
      </div>
    </div>
  </div>
);

const ResumoItem = ({ label, value, valueClass = 'text-white' }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
    <div className="text-xs uppercase tracking-[0.12em] text-gray-400">{label}</div>
    <div className={`mt-2 text-lg font-semibold ${valueClass}`}>{value}</div>
  </div>
);

export default ClientDasGuiasPage;
