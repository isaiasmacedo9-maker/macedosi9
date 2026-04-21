import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { DollarSign, Eye, Filter, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';


const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const canonicalCityKey = (city = '') => {
  const normalized = normalizeText(city);
  if (!normalized) return '';
  if (normalized.startsWith('ouroland')) return 'ourolandia';
  if (normalized.startsWith('uberland')) return 'uberlandia';
  if (normalized.startsWith('jacobin')) return 'jacobina';
  if (normalized.startsWith('umburan')) return 'umburanas';
  return normalized;
};

const canonicalCityLabel = (city = '') => {
  const key = canonicalCityKey(city);
  if (key === 'ourolandia') return 'Ourolandia';
  if (key === 'uberlandia') return 'Uberlandia';
  if (key === 'jacobina') return 'Jacobina';
  if (key === 'umburanas') return 'Umburanas';
  if (!key) return 'Sem cidade';
  return String(city || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const toCsv = (headers, rows) => {
  const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.map(escapeCell).join(';'), ...rows.map((row) => row.map(escapeCell).join(';'))].join('\n');
};

const mapFinancialFromApi = (item = {}) => ({
  ...item,
  client_id: item.client_id || item.empresa_id || '',
  empresa_nome: item.empresa_nome || item.empresa || '',
  cnpj: item.cnpj || '',
  cidade: item.cidade || '',
  valor_boleto: Number(item.valor_boleto || 0),
  valor_desconto: Number(item.valor_desconto || 0),
  valor_com_desconto: Number(item.valor_com_desconto || (Number(item.valor_boleto || 0) - Number(item.valor_desconto || 0))),
  quantidade_funcionarios: Number(item.quantidade_funcionarios || 0),
  responsavel_financeiro: item.responsavel_financeiro || '',
  status_fiscal: item.status_fiscal || 'sem_movimento',
  capacidade_pagamento: item.capacidade_pagamento || 'paga_em_dia',
  tipo_pagamento_especial: item.tipo_pagamento_especial || item.forma_pagamento_especial || '',
  data_vencimento: item.data_vencimento || '',
});

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
  assinaturaNome: 'Plano Essencial',
  assinaturaValorMensal: '',
  assinaturaDireitos: {
    financeiro: true,
    atendimento: true,
    fiscal: false,
    trabalhista: false,
  },
  assinaturaDescricaoLivre: '',
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

const defaultHonorariosConfig = [
  { key: 'baseMensal', label: 'Base mensal (BPO contábil)', valor: 280 },
  { key: 'porFuncionario', label: 'Por funcionário ativo', valor: 38 },
  { key: 'porNotaFiscal', label: 'Por nota fiscal mensal', valor: 3.5 },
  { key: 'atendimentoPrioritario', label: 'Atendimento prioritário', valor: 120 },
  { key: 'consultoriaHora', label: 'Consultoria por hora (média digital)', valor: 165 },
  { key: 'relatorioGerencial', label: 'Relatório gerencial extra', valor: 95 },
];

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
  const [honorariosConfig, setHonorariosConfig] = useState(defaultHonorariosConfig);
  const [honorariosInput, setHonorariosInput] = useState({
    funcionarios: 0,
    notasFiscais: 0,
    horasConsultoria: 0,
    includeAtendimentoPrioritario: false,
    includeRelatorioGerencial: false,
  });

  const [filterColumn, setFilterColumn] = useState('empresa_nome');
  const [filterValue, setFilterValue] = useState('');
  const [capacidadeFilter, setCapacidadeFilter] = useState('');
  const [activeCityGroup, setActiveCityGroup] = useState('todos');
  const [financialListMode, setFinancialListMode] = useState('detalhado');
  const [categoryFilters, setCategoryFilters] = useState({
    isentos: true,
    permuta: true,
    semMovimento: true,
    semFuncionarios: true,
  });
  const [reportClientId, setReportClientId] = useState('');

  useEffect(() => {
    if (!hasAccess([], ['financeiro'])) return;
    loadBaseClients();
    loadFinancialClients();
  }, []);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const capacidade = search.get('capacidade') || '';
    setCapacidadeFilter(capacidade);
  }, [location.search]);

  useEffect(() => {
    const loadHonorariosSettings = async () => {
      try {
        const response = await api.get('/financial/settings/honorarios');
        const items = response.data?.items;
        if (Array.isArray(items) && items.length) {
          setHonorariosConfig(items);
        }
      } catch (error) {
        console.error('Erro ao carregar configuração de honorários do backend:', error);
      }
    };
    loadHonorariosSettings();
  }, []);

  useEffect(() => {
    const persistHonorariosSettings = async () => {
      try {
        await api.put('/financial/settings/honorarios', { items: honorariosConfig });
      } catch (error) {
        console.error('Erro ao salvar configuração de honorários no backend:', error);
      }
    };
    persistHonorariosSettings();
  }, [honorariosConfig]);

  const loadBaseClients = async () => {
    try {
      const response = await api.get('/clients?limit=1000');
      const apiClients = response.data?.clients || response.data || [];
      setAllClients(Array.isArray(apiClients) ? apiClients : []);
    } catch {
      setAllClients([]);
    }
  };

  const loadFinancialClients = async () => {
    setLoading(true);
    try {
      const response = await api.get('/financial/clients?limit=5000');
      const apiItems = Array.isArray(response.data) ? response.data : [];
      setFinancialClients(apiItems.map(mapFinancialFromApi));
    } catch (error) {
      console.error('Erro ao carregar clientes financeiros:', error);
      setFinancialClients([]);
    }
    setLoading(false);
  };

  const openCreateModal = () => {
    setForm(defaultForm);
    setShowCreateModal(true);
  };

  const selectedClient = useMemo(
    () => allClients.find((client) => String(client.id) === String(form.clientId)),
    [allClients, form.clientId],
  );

  const getHonorarioValor = (key) => Number(honorariosConfig.find((item) => item.key === key)?.valor || 0);

  const honorariosResultado = useMemo(() => {
    const baseMensal = getHonorarioValor('baseMensal');
    const porFuncionario = getHonorarioValor('porFuncionario') * Number(honorariosInput.funcionarios || 0);
    const porNotaFiscal = getHonorarioValor('porNotaFiscal') * Number(honorariosInput.notasFiscais || 0);
    const consultoria = getHonorarioValor('consultoriaHora') * Number(honorariosInput.horasConsultoria || 0);
    const atendimentoPrioritario = honorariosInput.includeAtendimentoPrioritario ? getHonorarioValor('atendimentoPrioritario') : 0;
    const relatorioGerencial = honorariosInput.includeRelatorioGerencial ? getHonorarioValor('relatorioGerencial') : 0;
    const total = baseMensal + porFuncionario + porNotaFiscal + consultoria + atendimentoPrioritario + relatorioGerencial;
    return {
      baseMensal,
      porFuncionario,
      porNotaFiscal,
      consultoria,
      atendimentoPrioritario,
      relatorioGerencial,
      total,
    };
  }, [honorariosConfig, honorariosInput]);

  const updateHonorarioConfig = (key) => {
    const current = getHonorarioValor(key);
    const nextRaw = window.prompt('Novo valor desse campo (R$):', String(current));
    if (nextRaw === null) return;
    const nextValue = Number(String(nextRaw).replace(',', '.'));
    if (Number.isNaN(nextValue) || nextValue < 0) {
      toast.error('Valor inválido.');
      return;
    }
    setHonorariosConfig((prev) => prev.map((item) => (item.key === key ? { ...item, valor: nextValue } : item)));
  };

  const applyHonorarioToBoleto = () => {
    setForm((prev) => ({
      ...prev,
      valorBoleto: String(honorariosResultado.total.toFixed(2)),
      assinaturaValorMensal: String(honorariosResultado.total.toFixed(2)),
    }));
    toast.success('Valor da calculadora aplicado no boleto e na assinatura.');
  };

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
    setForm((prev) => ({
      ...prev,
      quantidadeFuncionarios: String(prev.quantidadeFuncionarios || 0),
    }));
  }, [form.clientId, selectedClient?.id]);

  const mapRegimeToTipoEmpresa = (regime) => {
    const key = normalizeText(regime || '');
    if (key.includes('mei')) return 'mei';
    if (key.includes('presumido')) return 'lucro_presumido';
    if (key.includes('real')) return 'lucro_real';
    return 'simples';
  };

  const saveFinancialClient = async () => {
    if (!selectedClient) {
      toast.error('Selecione um cliente da lista.');
      return;
    }
    const exists = financialClients.some((item) => String(item.client_id) === String(selectedClient.id));
    if (exists) {
      toast.error('Este cliente ja esta cadastrado no financeiro.');
      return;
    }

    const mesesAcordoTabela = form.tipoPagamento === 'acordo'
      ? form.acordoMeses.map((mes) => ({ ano: form.acordoAno, mes }))
      : [];
    const valorTotalDebito = Number(form.valorTotalDebito || 0);
    const valorAcordado = form.mesmoValorAcordado ? valorTotalDebito : Number(form.valorAcordado || 0);

    const payload = {
      empresa_id: String(selectedClient.id),
      client_id: String(selectedClient.id),
      empresa: selectedClient.nome_empresa || selectedClient.nome_fantasia || 'Empresa',
      empresa_nome: selectedClient.nome_empresa || selectedClient.nome_fantasia || 'Empresa',
      cnpj: selectedClient.cnpj || '',
      cidade: selectedClient.cidade || selectedClient.cidade_atendimento || '',
      valor_boleto: Number(form.valorBoleto || 0),
      valor_desconto: Number(form.valorDesconto || 0),
      valor_com_desconto: Math.max(0, Number(form.valorBoleto || 0) - Number(form.valorDesconto || 0)),
      data_vencimento: form.dataVencimento || '',
      dia_vencimento: form.dataVencimento ? new Date(`${form.dataVencimento}T00:00:00`).getDate() : 1,
      tipo_honorario: 'mensal',
      empresa_individual_grupo: form.tipoHonorario === 'grupo' ? 'grupo' : 'individual',
      contas_pagamento: form.tipoHonorario === 'grupo' ? form.empresasGrupo : [],
      tipo_pagamento: form.tipoPagamento === 'acordo' ? 'unico' : 'recorrente',
      forma_pagamento_especial: form.formaPagamentoEspecial ? (form.tipoPagamentoEspecial || 'especial') : '',
      tipo_pagamento_especial: form.formaPagamentoEspecial ? form.tipoPagamentoEspecial : '',
      tipo_empresa: mapRegimeToTipoEmpresa(selectedClient.tipo_regime || selectedClient.regime),
      status_pagamento: 'em_dia',
      status_fiscal: 'sem_movimento',
      responsavel_financeiro: form.responsavelFinanceiro || '',
      quantidade_funcionarios: Number(form.quantidadeFuncionarios || 0),
      capacidade_pagamento: form.capacidadePagamento,
      observacoes: JSON.stringify({
        data_primeiro_vencimento: form.tipoPagamento === 'acordo' ? form.dataPrimeiroVencimento : '',
        acordo_ano: form.tipoPagamento === 'acordo' ? form.acordoAno : '',
        acordo_meses: form.tipoPagamento === 'acordo' ? form.acordoMeses : [],
        acordo_meses_tabela: mesesAcordoTabela,
        valor_total_debito: form.tipoPagamento === 'acordo' ? valorTotalDebito : 0,
        valor_acordado: form.tipoPagamento === 'acordo' ? valorAcordado : 0,
        valor_parcela_acordo: form.tipoPagamento === 'acordo' ? Number(form.valorParcelaAcordo || 0) : 0,
        observacoes_acordo: form.tipoPagamento === 'acordo' && form.incluirObservacoesAcordo ? form.observacoesAcordo : '',
        assinatura: {
          nome: form.assinaturaNome || 'Plano personalizado',
          valor_mensal: Number(form.assinaturaValorMensal || form.valorBoleto || honorariosResultado.total || 0),
          direitos: {
            financeiro: Boolean(form.assinaturaDireitos?.financeiro),
            atendimento: Boolean(form.assinaturaDireitos?.atendimento),
            fiscal: Boolean(form.assinaturaDireitos?.fiscal),
            trabalhista: Boolean(form.assinaturaDireitos?.trabalhista),
          },
          descricao_livre: form.assinaturaDescricaoLivre || '',
        },
      }),
    };

    try {
      const response = await api.post('/financial/clients', payload);
      setFinancialClients((prev) => [mapFinancialFromApi(response.data), ...prev]);
      setShowCreateModal(false);
      toast.success('Cliente adicionado ao Financeiro.');
    } catch (error) {
      console.error('Erro ao criar cliente financeiro:', error);
      toast.error('Não foi possível salvar no backend.');
    }
  };

  const updateField = async (id, field, value) => {
    const item = financialClients.find((entry) => entry.id === id);
    if (!item) return;
    const patch = { [field]: value };
    if (field === 'valor_boleto' || field === 'valor_desconto') {
      const nextBoleto = Number(field === 'valor_boleto' ? value : item.valor_boleto || 0);
      const nextDesconto = Number(field === 'valor_desconto' ? value : item.valor_desconto || 0);
      patch.valor_com_desconto = Math.max(0, nextBoleto - nextDesconto);
    }
    try {
      const response = await api.put(`/financial/clients/${id}`, patch);
      const updated = mapFinancialFromApi(response.data);
      setFinancialClients((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));
    } catch (error) {
      console.error('Erro ao atualizar cliente financeiro:', error);
      toast.error('Falha ao salvar alteração no backend.');
    }
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
      const cityRaw = item.cidade || cityByClientId.get(String(item.client_id)) || 'Sem cidade';
      const cityKey = canonicalCityKey(cityRaw) || 'sem-cidade';
      const current = byCityMap.get(cityKey) || {
        city: canonicalCityLabel(cityRaw),
        totalReceber: 0,
        totalComDesconto: 0,
      };
      current.totalReceber += Number(item.valor_boleto || 0);
      current.totalComDesconto += Number(item.valor_com_desconto || 0);
      byCityMap.set(cityKey, current);
    });
    const byCity = Array.from(byCityMap.entries()).map(([cityKey, values]) => ({
      cityKey,
      city: values.city,
      totalReceber: values.totalReceber,
      totalComDesconto: values.totalComDesconto,
    }));
    return { totalReceber, totalComDesconto, byCity };
  }, [filteredList, cityByClientId]);

  const emAbertoList = useMemo(
    () => filteredList.filter((item) => (item.status_pagamento || 'em_dia') !== 'pago'),
    [filteredList],
  );

  const cityGroups = useMemo(() => {
    const grouped = new Map();
    filteredList.forEach((item) => {
      const cityRaw = item.cidade || cityByClientId.get(String(item.client_id)) || 'Sem cidade';
      const cityKey = canonicalCityKey(cityRaw) || 'sem-cidade';
      const current = grouped.get(cityKey) || { key: cityKey, label: canonicalCityLabel(cityRaw), count: 0 };
      current.count += 1;
      grouped.set(cityKey, current);
    });
    return [{ key: 'todos', label: 'Todos', count: filteredList.length }, ...Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))];
  }, [filteredList, cityByClientId]);

  const financialCardsByCity = useMemo(() => {
    if (activeCityGroup === 'todos') return filteredList;
    return filteredList.filter((item) => {
      const cityRaw = item.cidade || cityByClientId.get(String(item.client_id)) || 'Sem cidade';
      return (canonicalCityKey(cityRaw) || 'sem-cidade') === activeCityGroup;
    });
  }, [filteredList, activeCityGroup, cityByClientId]);

  const financeRowsForList = useMemo(() => financialCardsByCity, [financialCardsByCity]);
  const financeFullRows = useMemo(() => {
    if (!allowedCitiesSet) return financialClients;
    return financialClients.filter((item) =>
      allowedCitiesSet.has(normalizeText(item.cidade || cityByClientId.get(String(item.client_id)) || '')),
    );
  }, [financialClients, allowedCitiesSet, cityByClientId]);

  useEffect(() => {
    if (!cityGroups.find((item) => item.key === activeCityGroup)) {
      setActiveCityGroup('todos');
    }
  }, [cityGroups, activeCityGroup]);

  const selectedReportClient = useMemo(
    () => allClients.find((client) => String(client.id) === String(reportClientId)) || null,
    [allClients, reportClientId],
  );

  const downloadOpenReport = (mode = 'geral') => {
    const base = mode === 'cliente'
      ? emAbertoList.filter((item) => String(item.client_id) === String(reportClientId))
      : emAbertoList;

    if (!base.length) {
      toast.error(mode === 'cliente' ? 'Sem registros em aberto para este cliente.' : 'Sem registros em aberto para exportar.');
      return;
    }

    const headers = [
      'Empresa',
      'CNPJ',
      'Cidade',
      'Valor Boleto',
      'Valor com Desconto',
      'Data Vencimento',
      'Status Pagamento',
      'Status Fiscal',
      'Responsavel Financeiro',
    ];

    const rows = base.map((item) => [
      item.empresa_nome,
      item.cnpj || '',
      item.cidade || '',
      Number(item.valor_boleto || 0).toFixed(2),
      Number(item.valor_com_desconto || 0).toFixed(2),
      item.data_vencimento || '',
      item.status_pagamento || 'em_aberto',
      item.status_fiscal || '',
      item.responsavel_financeiro || '',
    ]);

    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = mode === 'cliente'
      ? `relatorio_em_aberto_${normalizeText(selectedReportClient?.nome_empresa || selectedReportClient?.nome_fantasia || 'cliente') || 'cliente'}.csv`
      : 'relatorio_geral_em_aberto.csv';
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(mode === 'cliente' ? 'Relatório por cliente exportado.' : 'Relatório geral exportado.');
  };

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

      <div className="glass rounded-2xl border border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Lista de clientes financeiro</h2>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
              <button
                type="button"
                onClick={() => setFinancialListMode('detalhado')}
                className={`rounded-md px-2.5 py-1 ${financialListMode === 'detalhado' ? 'bg-white text-slate-900' : 'text-gray-300'}`}
              >
                Detalhado
              </button>
              <button
                type="button"
                onClick={() => setFinancialListMode('resumido')}
                className={`rounded-md px-2.5 py-1 ${financialListMode === 'resumido' ? 'bg-white text-slate-900' : 'text-gray-300'}`}
              >
                Resumido
              </button>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
              Ativa {financialCardsByCity.length}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px,1fr]">
          <aside className="space-y-1 rounded-xl border border-white/10 bg-black/20 p-2">
            {cityGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                onClick={() => setActiveCityGroup(group.key)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  activeCityGroup === group.key
                    ? 'bg-red-600 text-white'
                    : 'text-gray-200 hover:bg-white/10'
                }`}
              >
                <span>{group.label}</span>
                <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-[11px]">{group.count}</span>
              </button>
            ))}
          </aside>

          <div className="space-y-2">
            {financialCardsByCity.map((item) => (
              <button
                key={`card-${item.id}`}
                type="button"
                onClick={() => {
                  setFinancialViewTab('dados_financeiros');
                  setSelectedFinancialClient(item);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/20 hover:bg-white/10"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{item.empresa_nome}</div>
                  {financialListMode === 'detalhado' ? (
                    <div className="mt-1 text-xs text-gray-400">{item.cnpj || 'Sem CNPJ'}</div>
                  ) : null}
                </div>
                {financialListMode === 'detalhado' ? (
                  <div className="ml-4 shrink-0 text-sm font-medium text-emerald-300">
                    {formatCurrency(item.valor_com_desconto || 0)}
                  </div>
                ) : null}
              </button>
            ))}
            {financialCardsByCity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-gray-400">
                Nenhum cliente encontrado para esta cidade.
              </div>
            ) : null}
          </div>
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

      <div className="glass rounded-2xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Modelo de relatórios em aberto do cliente</h2>
            <p className="mt-1 text-sm text-gray-400">Exporte visão geral ou focada por cliente com os valores em aberto.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadOpenReport('geral')}
              className="rounded-lg border border-sky-500/35 bg-sky-500/15 px-3 py-2 text-sm text-sky-100 hover:bg-sky-500/25"
            >
              Relatório Geral
            </button>
            <select
              value={reportClientId}
              onChange={(e) => setReportClientId(e.target.value)}
              className="bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Selecione o cliente</option>
              {allClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nome_empresa || client.nome_fantasia}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => downloadOpenReport('cliente')}
              disabled={!reportClientId}
              className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              Relatório por cliente
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Em aberto no filtro atual: {emAbertoList.length} cliente(s) • Valor total: {formatCurrency(emAbertoList.reduce((sum, item) => sum + Number(item.valor_com_desconto || 0), 0))}
        </p>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm text-gray-300">
            Lista principal do financeiro: <span className="font-semibold text-white">{financeRowsForList.length}</span> cliente(s)
          </p>
          <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
            <button
              type="button"
              onClick={() => setFinancialListMode('detalhado')}
              className={`rounded-md px-2.5 py-1 ${financialListMode === 'detalhado' ? 'bg-white text-slate-900' : 'text-gray-300'}`}
            >
              Detalhado
            </button>
            <button
              type="button"
              onClick={() => setFinancialListMode('resumido')}
              className={`rounded-md px-2.5 py-1 ${financialListMode === 'resumido' ? 'bg-white text-slate-900' : 'text-gray-300'}`}
            >
              Resumido
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={`table-futuristic w-full ${financialListMode === 'detalhado' ? 'min-w-[1600px]' : 'min-w-[520px]'}`}>
            <thead>
              <tr className="border-b border-red-600/30">
                <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                {financialListMode === 'detalhado' ? (
                  <>
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
                  </>
                ) : null}
                <th className="text-left p-4 text-gray-300 font-semibold">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={financialListMode === 'detalhado' ? 14 : 2} className="text-center p-8 text-gray-400">Carregando...</td>
                </tr>
              ) : financeRowsForList.length === 0 ? (
                <tr>
                  <td colSpan={financialListMode === 'detalhado' ? 14 : 2} className="text-center p-8 text-gray-400">Nenhum cliente financeiro encontrado.</td>
                </tr>
              ) : (
                financeRowsForList.map((item) => (
                  <tr key={item.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                    <td className="p-4 text-white font-medium">{item.empresa_nome}</td>
                    {financialListMode === 'detalhado' ? (
                      <>
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
                      </>
                    ) : null}
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

      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm text-gray-300">
            Lista completa dos clientes do financeiro: <span className="font-semibold text-white">{financeFullRows.length}</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="table-futuristic w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-red-600/30">
                <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                <th className="text-left p-4 text-gray-300 font-semibold">CNPJ</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Cidade</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Valor com desconto</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Responsável financeiro</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {financeFullRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-gray-400">Nenhum cliente financeiro cadastrado.</td>
                </tr>
              ) : (
                financeFullRows.map((item) => (
                  <tr key={`full-${item.id}`} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                    <td className="p-4 text-white font-medium">{item.empresa_nome}</td>
                    <td className="p-4 text-gray-300 text-xs font-mono">{item.cnpj || '-'}</td>
                    <td className="p-4 text-gray-300">{item.cidade || cityByClientId.get(String(item.client_id)) || '-'}</td>
                    <td className="p-4 text-emerald-300 text-sm font-semibold">{formatCurrency(item.valor_com_desconto || 0)}</td>
                    <td className="p-4 text-gray-200 text-sm">{item.responsavel_financeiro || '-'}</td>
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
              <div className="space-y-4">
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
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Assinatura vinculada (Financeiro + Atendimento)</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <DetailItem label="Plano" value={selectedFinancialClient.assinatura?.nome || 'Nao definido'} />
                    <DetailItem label="Valor mensal" value={formatCurrency(selectedFinancialClient.assinatura?.valor_mensal || 0)} />
                    <DetailItem
                      label="Direitos"
                      value={[
                        selectedFinancialClient.assinatura?.direitos?.financeiro ? 'Financeiro' : null,
                        selectedFinancialClient.assinatura?.direitos?.atendimento ? 'Atendimento' : null,
                        selectedFinancialClient.assinatura?.direitos?.fiscal ? 'Fiscal' : null,
                        selectedFinancialClient.assinatura?.direitos?.trabalhista ? 'Trabalhista' : null,
                      ].filter(Boolean).join(', ') || 'Sem direitos definidos'}
                    />
                  </div>
                  {selectedFinancialClient.assinatura?.descricao_livre ? (
                    <p className="mt-3 text-sm text-gray-300">{selectedFinancialClient.assinatura.descricao_livre}</p>
                  ) : null}
                </div>
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
              <div className="md:col-span-3 rounded-lg border border-gray-700 bg-black/20 p-3">
                <p className="text-sm font-medium text-white">Assinatura vinculada (direitos por plano)</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Nome do plano</label>
                    <input
                      value={form.assinaturaNome}
                      onChange={(e) => setForm((prev) => ({ ...prev, assinaturaNome: e.target.value }))}
                      className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Valor mensal da assinatura</label>
                    <input
                      type="number"
                      value={form.assinaturaValorMensal}
                      onChange={(e) => setForm((prev) => ({ ...prev, assinaturaValorMensal: e.target.value }))}
                      className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <p className="text-xs text-gray-400">Esta área define o que o cliente tem direito pelo preço pago.</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-200">
                  {[
                    { key: 'financeiro', label: 'Financeiro' },
                    { key: 'atendimento', label: 'Atendimento' },
                    { key: 'fiscal', label: 'Fiscal' },
                    { key: 'trabalhista', label: 'Trabalhista' },
                  ].map((item) => (
                    <label key={item.key} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(form.assinaturaDireitos?.[item.key])}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            assinaturaDireitos: {
                              ...(prev.assinaturaDireitos || {}),
                              [item.key]: e.target.checked,
                            },
                          }))
                        }
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="block text-sm text-gray-300 mb-2">Descrição do que está incluso</label>
                  <textarea
                    rows={2}
                    value={form.assinaturaDescricaoLivre}
                    onChange={(e) => setForm((prev) => ({ ...prev, assinaturaDescricaoLivre: e.target.value }))}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="Ex.: atendimento prioritário, fechamento mensal, suporte via chat..."
                  />
                </div>
              </div>
              <div className="md:col-span-3 rounded-lg border border-sky-700/50 bg-sky-900/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">Calculadora de valor de honorários</p>
                  <button
                    type="button"
                    onClick={applyHonorarioToBoleto}
                    className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/25"
                  >
                    Aplicar no boleto
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Referência de mercado digital por hora e escopo.
                </p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <CalcField
                    label="Funcionários ativos"
                    value={honorariosInput.funcionarios}
                    onChange={(value) => setHonorariosInput((prev) => ({ ...prev, funcionarios: value }))}
                    valorUnitario={getHonorarioValor('porFuncionario')}
                    onConfigurar={() => updateHonorarioConfig('porFuncionario')}
                  />
                  <CalcField
                    label="Notas fiscais/mês"
                    value={honorariosInput.notasFiscais}
                    onChange={(value) => setHonorariosInput((prev) => ({ ...prev, notasFiscais: value }))}
                    valorUnitario={getHonorarioValor('porNotaFiscal')}
                    onConfigurar={() => updateHonorarioConfig('porNotaFiscal')}
                  />
                  <CalcField
                    label="Horas consultoria/mês"
                    value={honorariosInput.horasConsultoria}
                    onChange={(value) => setHonorariosInput((prev) => ({ ...prev, horasConsultoria: value }))}
                    valorUnitario={getHonorarioValor('consultoriaHora')}
                    onConfigurar={() => updateHonorarioConfig('consultoriaHora')}
                  />
                  <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                    <p className="text-xs text-gray-300">Adicionais</p>
                    <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={honorariosInput.includeAtendimentoPrioritario}
                        onChange={(e) => setHonorariosInput((prev) => ({ ...prev, includeAtendimentoPrioritario: e.target.checked }))}
                      />
                      Atendimento prioritário ({formatCurrency(getHonorarioValor('atendimentoPrioritario'))})
                    </label>
                    <button type="button" onClick={() => updateHonorarioConfig('atendimentoPrioritario')} className="ml-2 text-xs text-sky-300 underline">
                      Configurar
                    </button>
                    <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={honorariosInput.includeRelatorioGerencial}
                        onChange={(e) => setHonorariosInput((prev) => ({ ...prev, includeRelatorioGerencial: e.target.checked }))}
                      />
                      Relatório gerencial ({formatCurrency(getHonorarioValor('relatorioGerencial'))})
                    </label>
                    <button type="button" onClick={() => updateHonorarioConfig('relatorioGerencial')} className="ml-2 text-xs text-sky-300 underline">
                      Configurar
                    </button>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3">
                  <p className="text-xs text-gray-200">Base mensal: {formatCurrency(getHonorarioValor('baseMensal'))} <button type="button" className="ml-2 text-xs text-sky-300 underline" onClick={() => updateHonorarioConfig('baseMensal')}>Configurar</button></p>
                  <p className="mt-1 text-lg font-semibold text-emerald-100">Honorário sugerido: {formatCurrency(honorariosResultado.total)}</p>
                </div>
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

const CalcField = ({ label, value, onChange, valorUnitario, onConfigurar }) => (
  <div className="rounded-lg border border-white/10 bg-black/25 p-3">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-gray-300">{label}</p>
      <button type="button" onClick={onConfigurar} className="text-xs text-sky-300 underline">
        Configurar
      </button>
    </div>
    <input
      type="number"
      min="0"
      value={value}
      onChange={(e) => onChange(Number(e.target.value || 0))}
      className="mt-2 w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
    />
    <p className="mt-2 text-xs text-gray-400">Valor unitário: {Number(valorUnitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
  </div>
);

export default FinancialClients;
