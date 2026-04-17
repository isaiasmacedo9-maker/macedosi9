import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { DollarSign, Eye, Filter, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { mockClients } from '../../dev/mockData';
import { useLocation, useNavigate } from 'react-router-dom';

const MOCK_ADMIN_CLIENTS_KEY = 'mock_admin_clients_v1';
const FINANCIAL_CLIENTS_KEY = 'mock_financial_clients_v2';
const WORKFORCE_STORAGE_KEY = 'mock_trabalhista_workforce_v1';
const FISCAL_CLIENT_SETUP_KEY = 'mock_fiscal_client_setup_v1';
const NOTIFICATIONS_KEY = 'mock_internal_notifications_v1';
const FINANCIAL_SYNC_META_KEY = 'mock_financial_sync_meta_v1';

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mergeClientsUnique = (...lists) => {
  const map = new Map();
  lists.flat().forEach((client) => {
    if (!client) return;
    const key = client.id || client.cnpj || `${client.nome_empresa}-${client.nome_fantasia}`;
    if (!map.has(key)) map.set(key, client);
  });
  return Array.from(map.values());
};

const readJson = (key, fallback) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const pushNotification = (message) => {
  const current = readJson(NOTIFICATIONS_KEY, []);
  const next = [
    ...current,
    {
      id: `ntf-fin-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      message,
      createdAt: new Date().toISOString(),
      read: false,
      scope: 'financeiro',
    },
  ];
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
};

const defaultForm = {
  clientId: '',
  valorBoleto: '',
  valorDesconto: '',
  dataVencimento: '',
  quantidadeFuncionarios: '',
  responsavelFinanceiro: '',
  tipoHonorario: 'individual',
  empresasGrupo: [],
  formaPagamentoEspecial: false,
  tipoPagamentoEspecial: '',
  tipoPagamento: 'honorario',
  dataPrimeiroVencimento: '',
  acordoAno: '2026',
  acordoMeses: [],
  valorTotalDebito: '',
  mesmoValorAcordado: true,
  valorAcordado: '',
  valorParcelaAcordo: '',
  incluirObservacoesAcordo: false,
  observacoesAcordo: '',
  capacidadePagamento: 'paga_em_dia',
};

const MESES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Marco' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];
const ANOS_ACORDO = ['2021', '2022', '2023', '2024', '2025', '2026'];
const CAPACIDADE_OPTIONS = [
  { value: 'paga_em_dia', label: 'Paga em Dia' },
  { value: 'paga_no_mes', label: 'Paga Dentro do Mes' },
  { value: 'atraso_recorrente', label: 'Atraso Recorrente' },
];
const capacidadeLabel = (value) =>
  CAPACIDADE_OPTIONS.find((item) => item.value === value)?.label || 'Nao informado';

const FinancialClients = () => {
  const { user, hasAccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [allClients, setAllClients] = useState([]);
  const [financialClients, setFinancialClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFinancialClient, setSelectedFinancialClient] = useState(null);
  const [financialViewTab, setFinancialViewTab] = useState('dados_financeiros');
  const [form, setForm] = useState(defaultForm);

  const [filterColumn, setFilterColumn] = useState('empresa_nome');
  const [filterValue, setFilterValue] = useState('');
  const [capacidadeFilter, setCapacidadeFilter] = useState('');
  const [categoryFilters, setCategoryFilters] = useState({
    isentos: true,
    permuta: true,
    semMovimento: true,
    semFuncionarios: true,
  });

  useEffect(() => {
    if (!hasAccess([], ['financeiro'])) return;
    loadBaseClients();
    loadFinancialClients();
    syncFromExternalModules();

    const interval = setInterval(syncFromExternalModules, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const capacidade = search.get('capacidade') || '';
    setCapacidadeFilter(capacidade);
  }, [location.search]);

  const loadBaseClients = async () => {
    let localClients = [];
    try {
      const localRaw = localStorage.getItem(MOCK_ADMIN_CLIENTS_KEY);
      const parsed = localRaw ? JSON.parse(localRaw) : [];
      localClients = Array.isArray(parsed) ? parsed : [];
    } catch {}

    try {
      const response = await api.get('/clients?limit=1000');
      const apiClients = response.data?.clients || response.data || [];
      const merged = mergeClientsUnique(Array.isArray(apiClients) ? apiClients : [], localClients, mockClients);
      setAllClients(merged);
    } catch {
      setAllClients(mergeClientsUnique(localClients, mockClients));
    }
  };

  const loadFinancialClients = () => {
    setLoading(true);
    const stored = readJson(FINANCIAL_CLIENTS_KEY, []);
    setFinancialClients(Array.isArray(stored) ? stored : []);
    setLoading(false);
  };

  const syncFromExternalModules = () => {
    const workforceMap = readJson(WORKFORCE_STORAGE_KEY, {});
    const fiscalSetup = readJson(FISCAL_CLIENT_SETUP_KEY, {});
    const syncMeta = readJson(FINANCIAL_SYNC_META_KEY, {});
    const list = readJson(FINANCIAL_CLIENTS_KEY, []);

    let changed = false;
    const nextList = list.map((item) => {
      const next = { ...item };
      const workforce = workforceMap[item.client_id];
      const nextQtd = Number(item.quantidade_funcionarios || 0);
      const workforceQtd = Array.isArray(workforce?.funcionarios) ? workforce.funcionarios.length : null;

      if (workforceQtd !== null && workforceQtd !== nextQtd) {
        next.quantidade_funcionarios = workforceQtd;
        changed = true;
        pushNotification(
          `Financeiro: quantidade de funcionarios da empresa ${item.empresa_nome} atualizada para ${workforceQtd} com base no Trabalhista.`,
        );
      }

      const fiscalClient = fiscalSetup[item.client_id] || {};
      const statusFiscal = fiscalClient.statusFiscal || (fiscalClient.temMovimento ? 'com_movimento' : 'sem_movimento');
      const prevStatus = syncMeta[`fiscal-status-${item.client_id}`] || item.status_fiscal || 'sem_movimento';
      next.status_fiscal = statusFiscal;

      if (prevStatus === 'sem_movimento' && statusFiscal === 'com_movimento') {
        pushNotification(
          `Financeiro: empresa ${item.empresa_nome} saiu de "Sem movimento" para "Com movimento" no Fiscal.`,
        );
      }

      syncMeta[`fiscal-status-${item.client_id}`] = statusFiscal;
      return next;
    });

    if (changed || JSON.stringify(nextList) !== JSON.stringify(list)) {
      localStorage.setItem(FINANCIAL_CLIENTS_KEY, JSON.stringify(nextList));
      setFinancialClients(nextList);
    }
    localStorage.setItem(FINANCIAL_SYNC_META_KEY, JSON.stringify(syncMeta));
  };

  const openCreateModal = () => {
    setForm(defaultForm);
    setShowCreateModal(true);
  };

  const selectedClient = useMemo(
    () => allClients.find((client) => String(client.id) === String(form.clientId)),
    [allClients, form.clientId],
  );

  const selectedBaseClientForView = useMemo(() => {
    if (!selectedFinancialClient) return null;
    return allClients.find((client) => String(client.id) === String(selectedFinancialClient.client_id)) || null;
  }, [selectedFinancialClient, allClients]);

  const allowedCitiesSet = useMemo(() => {
    if (user?.role === 'admin') return null;
    const cities = Array.isArray(user?.allowed_cities) ? user.allowed_cities : [];
    const normalized = cities.map(normalizeText);
    if (!normalized.length || normalized.includes('todas')) return null;
    return new Set(normalized);
  }, [user]);

  const cityByClientId = useMemo(() => {
    const map = new Map();
    allClients.forEach((client) => {
      map.set(String(client.id), client.cidade || '');
    });
    return map;
  }, [allClients]);

  useEffect(() => {
    if (!selectedClient) return;
    const workforceMap = readJson(WORKFORCE_STORAGE_KEY, {});
    const workforce = workforceMap[selectedClient.id];
    const qtd = Array.isArray(workforce?.funcionarios) ? workforce.funcionarios.length : 0;
    setForm((prev) => ({
      ...prev,
      quantidadeFuncionarios: String(qtd || prev.quantidadeFuncionarios || 0),
    }));
  }, [form.clientId, selectedClient?.id]);

  const saveFinancialClient = () => {
    if (!selectedClient) {
      toast.error('Selecione um cliente da lista.');
      return;
    }
    const current = readJson(FINANCIAL_CLIENTS_KEY, []);
    const exists = current.some((item) => String(item.client_id) === String(selectedClient.id));
    if (exists) {
      toast.error('Este cliente ja esta cadastrado no financeiro.');
      return;
    }

    const mesesAcordoTabela = form.tipoPagamento === 'acordo'
      ? form.acordoMeses.map((mes) => ({ ano: form.acordoAno, mes }))
      : [];
    const valorTotalDebito = Number(form.valorTotalDebito || 0);
    const valorAcordado = form.mesmoValorAcordado ? valorTotalDebito : Number(form.valorAcordado || 0);

    const novo = {
      id: `fin-${Date.now()}`,
      client_id: selectedClient.id,
      empresa_nome: selectedClient.nome_empresa || selectedClient.nome_fantasia || 'Empresa',
      cnpj: selectedClient.cnpj || '',
      valor_boleto: Number(form.valorBoleto || 0),
      valor_desconto: Number(form.valorDesconto || 0),
      valor_com_desconto: Math.max(0, Number(form.valorBoleto || 0) - Number(form.valorDesconto || 0)),
      data_vencimento: form.dataVencimento || '',
      dia_vencimento: form.dataVencimento ? new Date(`${form.dataVencimento}T00:00:00`).getDate() : null,
      quantidade_funcionarios: Number(form.quantidadeFuncionarios || 0),
      responsavel_financeiro: form.responsavelFinanceiro || '',
      tipo_honorario: form.tipoHonorario,
      empresas_grupo: form.tipoHonorario === 'grupo' ? form.empresasGrupo : [],
      forma_pagamento_especial: form.formaPagamentoEspecial,
      tipo_pagamento_especial: form.formaPagamentoEspecial ? form.tipoPagamentoEspecial : '',
      capacidade_pagamento: form.capacidadePagamento,
      tipo_pagamento: form.tipoPagamento,
      data_primeiro_vencimento: form.tipoPagamento === 'acordo' ? form.dataPrimeiroVencimento : '',
      acordo_ano: form.tipoPagamento === 'acordo' ? form.acordoAno : '',
      acordo_meses: form.tipoPagamento === 'acordo' ? form.acordoMeses : [],
      acordo_meses_tabela: mesesAcordoTabela,
      valor_total_debito: form.tipoPagamento === 'acordo' ? valorTotalDebito : 0,
      valor_acordado: form.tipoPagamento === 'acordo' ? valorAcordado : 0,
      valor_parcela_acordo: form.tipoPagamento === 'acordo' ? Number(form.valorParcelaAcordo || 0) : 0,
      observacoes_acordo: form.tipoPagamento === 'acordo' && form.incluirObservacoesAcordo ? form.observacoesAcordo : '',
      status_fiscal: readJson(FISCAL_CLIENT_SETUP_KEY, {})[selectedClient.id]?.statusFiscal || 'sem_movimento',
      status_pagamento: 'em_dia',
      cidade: selectedClient.cidade || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const next = [novo, ...current];
    localStorage.setItem(FINANCIAL_CLIENTS_KEY, JSON.stringify(next));
    setFinancialClients(next);
    setShowCreateModal(false);
    toast.success('Cliente adicionado ao Financeiro.');
  };

  const updateField = (id, field, value) => {
    const next = financialClients.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value, updated_at: new Date().toISOString() };
      if (field === 'valor_boleto' || field === 'valor_desconto') {
        updated.valor_com_desconto = Math.max(
          0,
          Number(field === 'valor_boleto' ? value : updated.valor_boleto || 0) -
            Number(field === 'valor_desconto' ? value : updated.valor_desconto || 0),
        );
      }
      return updated;
    });
    setFinancialClients(next);
    localStorage.setItem(FINANCIAL_CLIENTS_KEY, JSON.stringify(next));
  };

  const filterOptions = [
    { value: 'empresa_nome', label: 'Empresa' },
    { value: 'responsavel_financeiro', label: 'Responsavel financeiro' },
    { value: 'status_fiscal', label: 'Status fiscal' },
    { value: 'tipo_honorario', label: 'Tipo de honorario' },
    { value: 'tipo_pagamento_especial', label: 'Pagamento especial' },
    { value: 'data_vencimento', label: 'Data de vencimento' },
  ];

  const filteredList = useMemo(() => {
    let base = [...financialClients];

    if (allowedCitiesSet) {
      base = base.filter((item) => allowedCitiesSet.has(normalizeText(item.cidade || cityByClientId.get(String(item.client_id)) || '')));
    }

    base = base.filter((item) => {
      if (!categoryFilters.isentos && item.tipo_pagamento_especial === 'isento') return false;
      if (!categoryFilters.permuta && item.tipo_pagamento_especial === 'permuta') return false;
      if (!categoryFilters.semMovimento && item.status_fiscal === 'sem_movimento') return false;
      if (!categoryFilters.semFuncionarios && Number(item.quantidade_funcionarios || 0) === 0) return false;
      return true;
    });

    if (capacidadeFilter) {
      base = base.filter((item) => item.capacidade_pagamento === capacidadeFilter);
    }

    if (!filterValue.trim()) return base;
    const value = normalizeText(filterValue);
    return base.filter((item) => normalizeText(item?.[filterColumn] || '').includes(value));
  }, [financialClients, filterColumn, filterValue, allowedCitiesSet, cityByClientId, categoryFilters, capacidadeFilter]);

  const summaryCards = useMemo(() => {
    const totalReceber = filteredList.reduce((sum, item) => sum + Number(item.valor_boleto || 0), 0);
    const totalComDesconto = filteredList.reduce((sum, item) => sum + Number(item.valor_com_desconto || 0), 0);
    const byCityMap = new Map();
    filteredList.forEach((item) => {
      const city = item.cidade || cityByClientId.get(String(item.client_id)) || 'Sem cidade';
      const current = byCityMap.get(city) || { totalReceber: 0, totalComDesconto: 0 };
      current.totalReceber += Number(item.valor_boleto || 0);
      current.totalComDesconto += Number(item.valor_com_desconto || 0);
      byCityMap.set(city, current);
    });
    const byCity = Array.from(byCityMap.entries()).map(([city, values]) => ({ city, ...values }));
    return { totalReceber, totalComDesconto, byCity };
  }, [filteredList, cityByClientId]);

  if (!hasAccess([], ['financeiro'])) {
    return (
      <div className="glass p-8 rounded-2xl text-center">
        <DollarSign className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
        <p className="text-gray-400">Voce nao tem permissao para acessar este modulo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-red-400" />
            Clientes Financeiro
          </h1>
          <p className="text-gray-400 mt-2">Cadastro financeiro integrado com Lista de Clientes, Trabalhista e Fiscal.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/financeiro')}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-gray-200 hover:bg-white/10"
          >
            Voltar para Financeiro
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-futuristic px-6 py-3 rounded-xl text-white font-semibold flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Cliente Financeiro</span>
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-300">
            <Filter className="w-4 h-4" />
            Filtro por coluna
          </div>
          <select
            value={filterColumn}
            onChange={(e) => setFilterColumn(e.target.value)}
            className="bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="flex-1 bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
            placeholder="Digite para filtrar resultados da coluna selecionada..."
          />
          <select
            value={capacidadeFilter}
            onChange={(e) => setCapacidadeFilter(e.target.value)}
            className="bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">Todas capacidades</option>
            {CAPACIDADE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-200">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={categoryFilters.isentos} onChange={(e) => setCategoryFilters((p) => ({ ...p, isentos: e.target.checked }))} />
            Clientes Isentos
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={categoryFilters.permuta} onChange={(e) => setCategoryFilters((p) => ({ ...p, permuta: e.target.checked }))} />
            Clientes Permuta
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={categoryFilters.semMovimento} onChange={(e) => setCategoryFilters((p) => ({ ...p, semMovimento: e.target.checked }))} />
            Clientes Sem Movimento
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={categoryFilters.semFuncionarios} onChange={(e) => setCategoryFilters((p) => ({ ...p, semFuncionarios: e.target.checked }))} />
            Clientes Sem Funcionarios
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-blue-400/45 bg-blue-600 text-white p-5">
          <p className="text-sm font-medium text-white/90">Valor Total a Receber</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(summaryCards.totalReceber)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/45 bg-emerald-600 text-white p-5">
          <p className="text-sm font-medium text-white/90">Valor Total com Desconto</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(summaryCards.totalComDesconto)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-violet-400/45 bg-violet-600 text-white p-5">
        <p className="text-sm font-medium text-white/90">Valor Total por Cidade</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {summaryCards.byCity.map((item) => (
            <div key={item.city} className="rounded-xl border border-white/30 bg-white/10 p-3">
              <p className="text-sm font-semibold">{item.city}</p>
              <p className="text-xs mt-1">A receber: {formatCurrency(item.totalReceber)}</p>
              <p className="text-xs mt-1">Com desconto: {formatCurrency(item.totalComDesconto)}</p>
            </div>
          ))}
          {summaryCards.byCity.length === 0 ? (
            <div className="rounded-xl border border-white/30 bg-white/10 p-3 text-sm">Sem dados por cidade.</div>
          ) : null}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-futuristic w-full min-w-[1600px]">
            <thead>
              <tr className="border-b border-red-600/30">
                <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                <th className="text-left p-4 text-gray-300 font-semibold">CNPJ</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Valor boleto</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Valor desconto</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Valor com desconto</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Data vencimento</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Qtd. funcionarios</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Status fiscal</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Responsavel financeiro</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Tipo honorario</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Tipo pagamento</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Capacidade de pagamento</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Pagamento especial</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="14" className="text-center p-8 text-gray-400">Carregando...</td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan="14" className="text-center p-8 text-gray-400">Nenhum cliente financeiro encontrado.</td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                    <td className="p-4 text-white font-medium">{item.empresa_nome}</td>
                    <td className="p-4 text-gray-300 text-xs font-mono">{item.cnpj || '-'}</td>
                    <td className="p-4">
                      <input
                        type="number"
                        value={item.valor_boleto || 0}
                        onChange={(e) => updateField(item.id, 'valor_boleto', Number(e.target.value || 0))}
                        className="w-28 bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        value={item.valor_desconto || 0}
                        onChange={(e) => updateField(item.id, 'valor_desconto', Number(e.target.value || 0))}
                        className="w-24 bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="p-4 text-emerald-300 text-sm font-semibold">{formatCurrency(item.valor_com_desconto || 0)}</td>
                    <td className="p-4">
                      <input
                        type="date"
                        value={item.data_vencimento || ''}
                        onChange={(e) => updateField(item.id, 'data_vencimento', e.target.value)}
                        className="bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        value={item.quantidade_funcionarios || 0}
                        onChange={(e) => updateField(item.id, 'quantidade_funcionarios', Number(e.target.value || 0))}
                        className="w-20 bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        item.status_fiscal === 'com_movimento'
                          ? 'bg-green-600/20 text-green-300 border-green-600/30'
                          : 'bg-zinc-600/20 text-zinc-300 border-zinc-600/30'
                      }`}>
                        {item.status_fiscal === 'com_movimento' ? 'Com movimento' : 'Sem movimento'}
                      </span>
                    </td>
                    <td className="p-4">
                      <input
                        value={item.responsavel_financeiro || ''}
                        onChange={(e) => updateField(item.id, 'responsavel_financeiro', e.target.value)}
                        className="w-40 bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-gray-200">
                        {item.tipo_honorario === 'grupo' ? 'Grupo de empresas' : 'Empresa individual'}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-gray-200">{item.tipo_pagamento === 'acordo' ? 'Acordo' : 'Honorario'}</td>
                    <td className="p-4">
                      <select
                        value={item.capacidade_pagamento || 'paga_em_dia'}
                        onChange={(e) => updateField(item.id, 'capacidade_pagamento', e.target.value)}
                        className="bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        {CAPACIDADE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      {item.forma_pagamento_especial
                        ? <span className="text-xs text-amber-300">{item.tipo_pagamento_especial || 'Especial'}</span>
                        : <span className="text-xs text-gray-400">Padrao</span>}
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => {
                          setFinancialViewTab('dados_financeiros');
                          setSelectedFinancialClient(item);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-gray-200 hover:bg-white/10"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Dados
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedFinancialClient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-white/15 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Dados da empresa - Financeiro</h2>
              <button type="button" onClick={() => setSelectedFinancialClient(null)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-200">
                Fechar
              </button>
            </div>
            <div className="mb-4 flex gap-2">
              <button type="button" onClick={() => setFinancialViewTab('dados_financeiros')} className={`px-3 py-2 rounded-lg text-sm ${financialViewTab === 'dados_financeiros' ? 'bg-red-500/15 border border-red-500/35 text-red-100' : 'bg-black/25 border border-gray-700 text-gray-200'}`}>Dados financeiros</button>
              <button type="button" onClick={() => setFinancialViewTab('dados_empresa')} className={`px-3 py-2 rounded-lg text-sm ${financialViewTab === 'dados_empresa' ? 'bg-red-500/15 border border-red-500/35 text-red-100' : 'bg-black/25 border border-gray-700 text-gray-200'}`}>Dados da empresa</button>
            </div>
            {financialViewTab === 'dados_financeiros' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <DetailItem label="Empresa" value={selectedFinancialClient.empresa_nome} />
                <DetailItem label="CNPJ" value={selectedFinancialClient.cnpj || '-'} />
                <DetailItem label="Cidade" value={selectedFinancialClient.cidade || '-'} />
                <DetailItem label="Valor boleto" value={formatCurrency(selectedFinancialClient.valor_boleto)} />
                <DetailItem label="Valor desconto" value={formatCurrency(selectedFinancialClient.valor_desconto)} />
                <DetailItem label="Valor com desconto" value={formatCurrency(selectedFinancialClient.valor_com_desconto)} />
                <DetailItem label="Data vencimento" value={selectedFinancialClient.data_vencimento || '-'} />
                <DetailItem label="Qtd. funcionarios" value={selectedFinancialClient.quantidade_funcionarios ?? 0} />
                <DetailItem label="Status fiscal" value={selectedFinancialClient.status_fiscal === 'com_movimento' ? 'Com movimento' : 'Sem movimento'} />
                <DetailItem label="Responsavel financeiro" value={selectedFinancialClient.responsavel_financeiro || '-'} />
                <DetailItem label="Tipo honorario" value={selectedFinancialClient.tipo_honorario === 'grupo' ? 'Grupo de empresas' : 'Empresa individual'} />
                <DetailItem label="Tipo pagamento" value={selectedFinancialClient.tipo_pagamento === 'acordo' ? 'Acordo' : 'Honorario'} />
                <DetailItem label="Capacidade de pagamento" value={capacidadeLabel(selectedFinancialClient.capacidade_pagamento)} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <DetailItem label="Razao social" value={selectedBaseClientForView?.nome_empresa || selectedFinancialClient.empresa_nome} />
                <DetailItem label="Nome fantasia" value={selectedBaseClientForView?.nome_fantasia || '-'} />
                <DetailItem label="CNPJ" value={selectedBaseClientForView?.cnpj || selectedFinancialClient.cnpj || '-'} />
                <DetailItem label="Cidade" value={selectedBaseClientForView?.cidade || selectedFinancialClient.cidade || '-'} />
                <DetailItem label="Regime" value={selectedBaseClientForView?.tipo_regime || '-'} />
                <DetailItem label="Status" value={selectedBaseClientForView?.status || 'ativo'} />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-white/15 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Novo Cliente Financeiro</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Cliente (Lista de Clientes)</label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Selecione...</option>
                  {allClients
                    .filter((client) => {
                      if (!allowedCitiesSet) return true;
                      return allowedCitiesSet.has(normalizeText(client.cidade || ''));
                    })
                    .map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nome_empresa || client.nome_fantasia}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Valor boleto</label>
                <input
                  type="number"
                  value={form.valorBoleto}
                  onChange={(e) => setForm((prev) => ({ ...prev, valorBoleto: e.target.value }))}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Valor desconto</label>
                <input
                  type="number"
                  value={form.valorDesconto}
                  onChange={(e) => setForm((prev) => ({ ...prev, valorDesconto: e.target.value }))}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Data de vencimento</label>
                <input
                  type="date"
                  value={form.dataVencimento}
                  onChange={(e) => setForm((prev) => ({ ...prev, dataVencimento: e.target.value }))}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Quantidade de funcionarios</label>
                <input
                  type="number"
                  value={form.quantidadeFuncionarios}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantidadeFuncionarios: e.target.value }))}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Responsavel financeiro</label>
                <input
                  value={form.responsavelFinanceiro}
                  onChange={(e) => setForm((prev) => ({ ...prev, responsavelFinanceiro: e.target.value }))}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Tipo de honorario</label>
                <select
                  value={form.tipoHonorario}
                  onChange={(e) => setForm((prev) => ({ ...prev, tipoHonorario: e.target.value }))}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="individual">Empresa Individual</option>
                  <option value="grupo">Grupo de Empresas</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Tipo de pagamento</label>
                <select
                  value={form.tipoPagamento}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      tipoPagamento: e.target.value,
                      dataPrimeiroVencimento: e.target.value === 'acordo' ? prev.dataPrimeiroVencimento : '',
                    }))
                  }
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="honorario">Honorario</option>
                  <option value="acordo">Acordo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Capacidade de pagamento</label>
                <select
                  value={form.capacidadePagamento}
                  onChange={(e) => setForm((prev) => ({ ...prev, capacidadePagamento: e.target.value }))}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  {CAPACIDADE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {form.tipoHonorario === 'grupo' ? (
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-300 mb-2">Vincular empresas do grupo</label>
                  <select
                    multiple
                    value={form.empresasGrupo}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        empresasGrupo: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                      }))
                    }
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm min-h-[90px]"
                  >
                    {allClients
                      .filter((client) => String(client.id) !== String(form.clientId))
                      .map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.nome_empresa || client.nome_fantasia}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
              {form.tipoPagamento === 'acordo' ? (
                <div className="md:col-span-3 rounded-lg border border-gray-700 bg-black/20 p-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Data do primeiro vencimento</label>
                      <input type="date" value={form.dataPrimeiroVencimento} onChange={(e) => setForm((p) => ({ ...p, dataPrimeiroVencimento: e.target.value }))} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Ano dos meses em aberto</label>
                      <select value={form.acordoAno} onChange={(e) => setForm((p) => ({ ...p, acordoAno: e.target.value }))} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                        {ANOS_ACORDO.map((ano) => <option key={ano} value={ano}>{ano}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Meses em aberto</label>
                      <select
                        multiple
                        value={form.acordoMeses}
                        onChange={(e) => setForm((p) => ({ ...p, acordoMeses: Array.from(e.target.selectedOptions).map((opt) => opt.value) }))}
                        className="w-full min-h-[90px] bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                      >
                        {MESES.map((mes) => <option key={mes.value} value={mes.value}>{mes.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-black/30 p-3">
                    <p className="text-xs text-gray-400 mb-2">Tabela de meses do acordo</p>
                    <div className="max-h-28 overflow-y-auto">
                      {form.acordoMeses.length ? (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400">
                              <th className="text-left py-1">Ano</th>
                              <th className="text-left py-1">Mes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.acordoMeses.map((mes) => (
                              <tr key={`${form.acordoAno}-${mes}`}>
                                <td className="py-1 text-white">{form.acordoAno}</td>
                                <td className="py-1 text-white">{MESES.find((m) => m.value === mes)?.label || mes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-gray-500">Nenhum mes selecionado.</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Valor total do debito</label>
                      <input type="number" value={form.valorTotalDebito} onChange={(e) => setForm((p) => ({ ...p, valorTotalDebito: e.target.value }))} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-300 mb-2">Valor acordado</label>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                          <input type="checkbox" checked={form.mesmoValorAcordado} onChange={(e) => setForm((p) => ({ ...p, mesmoValorAcordado: e.target.checked }))} />
                          Mesmo Valor
                        </label>
                        {!form.mesmoValorAcordado ? (
                          <input type="number" value={form.valorAcordado} onChange={(e) => setForm((p) => ({ ...p, valorAcordado: e.target.value }))} className="flex-1 bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                        ) : (
                          <div className="text-sm text-emerald-300">{formatCurrency(form.valorTotalDebito || 0)}</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Valor parcela do acordo</label>
                      <input type="number" value={form.valorParcelaAcordo} onChange={(e) => setForm((p) => ({ ...p, valorParcelaAcordo: e.target.value }))} className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={form.incluirObservacoesAcordo}
                        onChange={(e) => setForm((p) => ({ ...p, incluirObservacoesAcordo: e.target.checked }))}
                      />
                      Observacoes
                    </label>
                    {form.incluirObservacoesAcordo ? (
                      <textarea
                        rows={3}
                        value={form.observacoesAcordo}
                        onChange={(e) => setForm((p) => ({ ...p, observacoesAcordo: e.target.value }))}
                        className="mt-2 w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="md:col-span-3 rounded-lg border border-gray-700 bg-black/20 p-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.formaPagamentoEspecial}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        formaPagamentoEspecial: e.target.checked,
                        tipoPagamentoEspecial: e.target.checked ? prev.tipoPagamentoEspecial : '',
                      }))
                    }
                  />
                  Forma de pagamento especial
                </label>
                {form.formaPagamentoEspecial ? (
                  <div className="mt-3">
                    <select
                      value={form.tipoPagamentoEspecial}
                      onChange={(e) => setForm((prev) => ({ ...prev, tipoPagamentoEspecial: e.target.value }))}
                      className="bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option value="">Selecione...</option>
                      <option value="isento">Isento</option>
                      <option value="permuta">Permuta</option>
                    </select>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={saveFinancialClient}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25"
              >
                <Save className="h-4 w-4" />
                Salvar cliente financeiro
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const DetailItem = ({ label, value }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
    <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
    <div className="mt-2 text-sm text-white">{value}</div>
  </div>
);

export default FinancialClients;
