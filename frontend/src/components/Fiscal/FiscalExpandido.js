import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import {
  mockBasicUsers,
  mockClients,
  mockFiscalDashboardStats,
  mockFiscalNotasFiscais,
  mockFiscalObrigacoes,
} from '../../dev/mockData';
import { 
  Scale, Plus, FileText, Filter, Calendar, TrendingUp, 
  AlertTriangle, CheckCircle, Clock, Upload, Download,
  Search, Edit, Trash2, Eye, X, AlertCircle, FileUp
} from 'lucide-react';
import { toast } from 'sonner';

const FISCAL_CLIENT_SETUP_KEY = 'mock_fiscal_client_setup_v1';
const MOCK_ADMIN_CLIENTS_KEY = 'mock_admin_clients_v1';
const TAX_RULES_VERSION = '2026.04';

const mergeClientsUnique = (...lists) => {
  const map = new Map();
  lists.flat().forEach((client) => {
    if (!client) return;
    const key = client.id || client.cnpj || `${client.nome_empresa}-${client.nome_fantasia}`;
    if (!map.has(key)) map.set(key, client);
  });
  return Array.from(map.values());
};

const TAX_RULES_BY_SEGMENT = [
  { match: ['farmacia', 'drogaria'], flags: { farmacia: true, substituicaoTributaria: true, tributacaoMonofasica: true, difal: true, aliquotaZero: false, isencao: false, naoIncidencia: false, diferimento: false, antecipacaoTributaria: true } },
  { match: ['combustivel', 'posto'], flags: { farmacia: false, substituicaoTributaria: false, tributacaoMonofasica: true, difal: true, aliquotaZero: false, isencao: false, naoIncidencia: false, diferimento: false, antecipacaoTributaria: true } },
  { match: ['atacad', 'varej', 'mercad', 'comerc'], flags: { farmacia: false, substituicaoTributaria: true, tributacaoMonofasica: false, difal: true, aliquotaZero: false, isencao: false, naoIncidencia: false, diferimento: false, antecipacaoTributaria: true } },
  { match: ['industr', 'fabrica'], flags: { farmacia: false, substituicaoTributaria: true, tributacaoMonofasica: false, difal: true, aliquotaZero: false, isencao: false, naoIncidencia: false, diferimento: true, antecipacaoTributaria: false } },
  { match: ['clinica', 'medic', 'servic', 'consult'], flags: { farmacia: false, substituicaoTributaria: false, tributacaoMonofasica: false, difal: false, aliquotaZero: false, isencao: true, naoIncidencia: false, diferimento: false, antecipacaoTributaria: false } },
];

const CNAE_RULES = [
  { startsWith: ['47'], set: { substituicaoTributaria: true, difal: true, antecipacaoTributaria: true } }, // Comércio varejista
  { startsWith: ['46'], set: { substituicaoTributaria: true, difal: true, antecipacaoTributaria: true } }, // Comércio atacadista
  { startsWith: ['21'], set: { tributacaoMonofasica: true, farmacia: true } }, // Farmoquímicos e farmacêuticos
  { startsWith: ['19'], set: { tributacaoMonofasica: true, difal: true, antecipacaoTributaria: true } }, // Derivados de petróleo
  { startsWith: ['10', '11'], set: { substituicaoTributaria: true, diferimento: true } }, // Alimentação e bebidas
  { startsWith: ['29', '30'], set: { substituicaoTributaria: true, difal: true } }, // Autopeças e veículos
  { startsWith: ['41', '42', '43'], set: { diferimento: true, naoIncidencia: false } }, // Construção
  { startsWith: ['86'], set: { isencao: true, naoIncidencia: true } }, // Saúde humana
];

const NCM_RULES = [
  { startsWith: ['3003', '3004'], set: { tributacaoMonofasica: true, farmacia: true } }, // Medicamentos
  { startsWith: ['2710'], set: { tributacaoMonofasica: true, antecipacaoTributaria: true } }, // Combustíveis
  { startsWith: ['2203', '2208'], set: { substituicaoTributaria: true } }, // Bebidas
  { startsWith: ['8708'], set: { substituicaoTributaria: true } }, // Peças automotivas
  { startsWith: ['2402'], set: { tributacaoMonofasica: true } }, // Cigarros
];

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const inferSegmentByClient = (client) => {
  const source = normalizeText(`${client?.nome_empresa || ''} ${client?.nome_fantasia || ''}`);
  if (source.includes('farm') || source.includes('drog')) return 'Farmácia';
  if (source.includes('posto') || source.includes('combust')) return 'Combustíveis';
  if (source.includes('mercad') || source.includes('comerc') || source.includes('varej')) return 'Comércio';
  if (source.includes('constr') || source.includes('industr')) return 'Indústria';
  if (source.includes('clinica') || source.includes('medic') || source.includes('servic')) return 'Serviços';
  return 'Comércio';
};

const inferPorte = (client) => {
  const regime = normalizeText(client?.tipo_regime || client?.regime || '');
  if (regime.includes('mei')) return 'MEI';
  if (regime.includes('simples')) return 'EPP';
  if (regime.includes('presumido')) return 'Médio porte';
  if (regime.includes('real')) return 'Grande porte';
  return 'ME';
};

const buildTaxFlags = (segmento = '', cnae = '', ncm = '') => {
  const normalized = normalizeText(segmento);
  const matchedSegment = TAX_RULES_BY_SEGMENT.find((item) => item.match.some((keyword) => normalized.includes(normalizeText(keyword))));
  const base = matchedSegment?.flags || {
    farmacia: false,
    substituicaoTributaria: false,
    tributacaoMonofasica: false,
    diferimento: false,
    difal: false,
    aliquotaZero: false,
    isencao: false,
    naoIncidencia: false,
    antecipacaoTributaria: false,
  };

  const cnaeDigits = String(cnae || '').replace(/\D/g, '');
  const ncmDigits = String(ncm || '').replace(/\D/g, '');
  let next = { ...base };

  CNAE_RULES.forEach((rule) => {
    if (rule.startsWith.some((prefix) => cnaeDigits.startsWith(prefix))) {
      next = { ...next, ...rule.set };
    }
  });

  NCM_RULES.forEach((rule) => {
    if (rule.startsWith.some((prefix) => ncmDigits.startsWith(prefix))) {
      next = { ...next, ...rule.set };
    }
  });

  return next;
};

const explainTaxFlags = (segmento = '', cnae = '', ncm = '') => {
  const reasons = [];
  const normalizedSegment = normalizeText(segmento);
  const cnaeDigits = String(cnae || '').replace(/\D/g, '');
  const ncmDigits = String(ncm || '').replace(/\D/g, '');

  const segmentMatch = TAX_RULES_BY_SEGMENT.find((item) => item.match.some((keyword) => normalizedSegment.includes(normalizeText(keyword))));
  if (segmentMatch) {
    reasons.push(`Segmento "${segmento}" acionou regra de segmento`);
  }

  CNAE_RULES.forEach((rule) => {
    if (rule.startsWith.some((prefix) => cnaeDigits.startsWith(prefix))) {
      reasons.push(`CNAE ${cnae || '-'} acionou prefixo ${rule.startsWith.join(', ')}`);
    }
  });

  NCM_RULES.forEach((rule) => {
    if (rule.startsWith.some((prefix) => ncmDigits.startsWith(prefix))) {
      reasons.push(`NCM ${ncm || '-'} acionou prefixo ${rule.startsWith.join(', ')}`);
    }
  });

  return reasons;
};

const SN_BRACKETS = {
  'I': [
    { max: 180000, nominal: 0.04, deducao: 0 },
    { max: 360000, nominal: 0.073, deducao: 5940 },
    { max: 720000, nominal: 0.095, deducao: 13860 },
    { max: 1800000, nominal: 0.107, deducao: 22500 },
    { max: 3600000, nominal: 0.143, deducao: 87300 },
    { max: 4800000, nominal: 0.19, deducao: 378000 },
  ],
  'II': [
    { max: 180000, nominal: 0.045, deducao: 0 },
    { max: 360000, nominal: 0.078, deducao: 5940 },
    { max: 720000, nominal: 0.10, deducao: 13860 },
    { max: 1800000, nominal: 0.112, deducao: 22500 },
    { max: 3600000, nominal: 0.147, deducao: 85500 },
    { max: 4800000, nominal: 0.30, deducao: 720000 },
  ],
  'III': [
    { max: 180000, nominal: 0.06, deducao: 0 },
    { max: 360000, nominal: 0.112, deducao: 9360 },
    { max: 720000, nominal: 0.135, deducao: 17640 },
    { max: 1800000, nominal: 0.16, deducao: 35640 },
    { max: 3600000, nominal: 0.21, deducao: 125640 },
    { max: 4800000, nominal: 0.33, deducao: 648000 },
  ],
  'IV': [
    { max: 180000, nominal: 0.045, deducao: 0 },
    { max: 360000, nominal: 0.09, deducao: 8100 },
    { max: 720000, nominal: 0.102, deducao: 12420 },
    { max: 1800000, nominal: 0.14, deducao: 39780 },
    { max: 3600000, nominal: 0.22, deducao: 183780 },
    { max: 4800000, nominal: 0.33, deducao: 828000 },
  ],
  'V': [
    { max: 180000, nominal: 0.155, deducao: 0 },
    { max: 360000, nominal: 0.18, deducao: 4500 },
    { max: 720000, nominal: 0.195, deducao: 9900 },
    { max: 1800000, nominal: 0.205, deducao: 17100 },
    { max: 3600000, nominal: 0.23, deducao: 62100 },
    { max: 4800000, nominal: 0.305, deducao: 540000 },
  ],
};

const calculateAliquotaEfetiva = (anexo = 'I', rbt12 = 0) => {
  const faixas = SN_BRACKETS[anexo] || SN_BRACKETS.I;
  const receita = Number(rbt12 || 0);
  const faixa = faixas.find((item) => receita <= item.max) || faixas[faixas.length - 1];
  if (!receita) return 0;
  return (((receita * faixa.nominal) - faixa.deducao) / receita) * 100;
};

const FiscalExpandido = () => {
  const { hasAccess, user } = useAuth();
  const [activeTab, setActiveTab] = useState('obrigacoes');
  const [obrigacoes, setObrigacoes] = useState([]);
  const [notasFiscais, setNotasFiscais] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // create, edit, view
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Filtros
  const [filters, setFilters] = useState({
    tipo: '',
    status: '',
    regime_tributario: '',
    responsavel: '',
    search: ''
  });
  const [fiscalModuleView, setFiscalModuleView] = useState('obrigacoes_mensais');
  const [fiscalAvulsoType, setFiscalAvulsoType] = useState('todos');

  // Filtros para Notas Fiscais
  const [notasFilters, setNotasFilters] = useState({
    tipo_nota: '',
    status_conciliacao: '',
    cnpj_emitente: '',
    periodo_inicio: '',
    periodo_fim: ''
  });

  // Form data para obrigações
  const [obrigacaoForm, setObrigacaoForm] = useState({
    empresa_id: '',
    empresa: '',
    tipo: 'pgdas',
    nome: '',
    descricao: '',
    periodicidade: 'mensal',
    dia_vencimento: 20,
    responsavel: '',
    regime_tributario: 'simples_nacional',
    observacoes: '',
    valor: 0
  });

  // Form data para notas fiscais
  const [notaForm, setNotaForm] = useState({
    empresa_id: '',
    cnpj_emitente: '',
    nome_emitente: '',
    chave_nfe: '',
    numero_nota: '',
    serie: '',
    tipo_nota: 'saida',
    data_emissao: getTodayInputDate(),
    valor_total: 0,
    valor_icms: 0,
    valor_ipi: 0,
    valor_pis: 0,
    valor_cofins: 0,
    status_conciliacao: 'nao_conciliado',
    observacoes: ''
  });

  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [fiscalSetup, setFiscalSetup] = useState({});

  useEffect(() => {
    if (hasAccess([], ['fiscal'])) {
      loadDashboardStats();
      loadClientes();
      loadUsuarios();
      try {
        const raw = localStorage.getItem(FISCAL_CLIENT_SETUP_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') setFiscalSetup(parsed);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FISCAL_CLIENT_SETUP_KEY, JSON.stringify(fiscalSetup));
  }, [fiscalSetup]);

  useEffect(() => {
    if (activeTab === 'obrigacoes') {
      loadObrigacoes();
    } else if (activeTab === 'notas') {
      loadNotasFiscais();
    }
  }, [activeTab, filters, notasFilters]);

  const loadDashboardStats = async () => {
    try {
      const response = await api.get('/fiscal/dashboard-stats');
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      setDashboardStats(mockFiscalDashboardStats);
    }
  };

  const loadObrigacoes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.tipo) params.append('tipo', filters.tipo);
      if (filters.status) params.append('status', filters.status);
      if (filters.regime_tributario) params.append('regime_tributario', filters.regime_tributario);
      if (filters.responsavel) params.append('responsavel', filters.responsavel);
      if (filters.search) params.append('search', filters.search);

      const response = await api.get(`/fiscal/obrigacoes?${params}`);
      setObrigacoes(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar obrigações:', error);
      setObrigacoes(mockFiscalObrigacoes);
    } finally {
      setLoading(false);
    }
  };

  const loadNotasFiscais = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (notasFilters.tipo_nota) params.append('tipo_nota', notasFilters.tipo_nota);
      if (notasFilters.status_conciliacao) params.append('status_conciliacao', notasFilters.status_conciliacao);
      if (notasFilters.cnpj_emitente) params.append('cnpj_emitente', notasFilters.cnpj_emitente);
      if (notasFilters.periodo_inicio) params.append('data_inicio', notasFilters.periodo_inicio);
      if (notasFilters.periodo_fim) params.append('data_fim', notasFilters.periodo_fim);

      const response = await api.get(`/fiscal/notas-fiscais?${params}`);
      setNotasFiscais(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar notas fiscais:', error);
      setNotasFiscais(mockFiscalNotasFiscais);
    } finally {
      setLoading(false);
    }
  };

  const loadClientes = async () => {
    let localMockClients = [];
    try {
      const localRaw = localStorage.getItem(MOCK_ADMIN_CLIENTS_KEY);
      const parsed = localRaw ? JSON.parse(localRaw) : [];
      localMockClients = Array.isArray(parsed) ? parsed : [];
    } catch {}

    try {
      const response = await api.get('/clients?limit=1000');
      const apiClients = response.data?.clients || response.data || [];
      const baseClients = Array.isArray(apiClients) && apiClients.length ? apiClients : mockClients;
      setClientes(mergeClientsUnique(baseClients, localMockClients));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setClientes(mergeClientsUnique(mockClients, localMockClients));
    }
  };

  const loadUsuarios = async () => {
    try {
      const response = await api.get('/users-management/basic');
      setUsuarios(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setUsuarios(mockBasicUsers);
    }
  };

  const handleCreateObrigacao = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fiscal/obrigacoes', obrigacaoForm);
      toast.success('Obrigação fiscal criada com sucesso!');
      setShowModal(false);
      resetObrigacaoForm();
      loadObrigacoes();
      loadDashboardStats();
    } catch (error) {
      console.error('Erro ao criar obrigação:', error);
      toast.error('Erro ao criar obrigação fiscal');
    }
  };

  const handleUpdateObrigacao = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/fiscal/obrigacoes/${selectedItem.id}`, obrigacaoForm);
      toast.success('Obrigação fiscal atualizada com sucesso!');
      setShowModal(false);
      resetObrigacaoForm();
      loadObrigacoes();
      loadDashboardStats();
    } catch (error) {
      console.error('Erro ao atualizar obrigação:', error);
      toast.error('Erro ao atualizar obrigação fiscal');
    }
  };

  const handleDeleteObrigacao = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta obrigação?')) return;
    
    try {
      await api.delete(`/fiscal/obrigacoes/${id}`);
      toast.success('Obrigação fiscal excluída com sucesso!');
      loadObrigacoes();
      loadDashboardStats();
    } catch (error) {
      console.error('Erro ao excluir obrigação:', error);
      toast.error('Erro ao excluir obrigação fiscal');
    }
  };

  const handleCreateNotaFiscal = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fiscal/notas-fiscais', notaForm);
      toast.success('Nota fiscal criada com sucesso!');
      setShowModal(false);
      resetNotaForm();
      loadNotasFiscais();
      loadDashboardStats();
    } catch (error) {
      console.error('Erro ao criar nota fiscal:', error);
      toast.error('Erro ao criar nota fiscal');
    }
  };

  const handleUploadXML = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/fiscal/notas-fiscais/upload-xml', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('XML processado com sucesso!');
      loadNotasFiscais();
      loadDashboardStats();
    } catch (error) {
      console.error('Erro ao processar XML:', error);
      toast.error('Erro ao processar arquivo XML');
    }
  };

  const resetObrigacaoForm = () => {
    setObrigacaoForm({
      empresa_id: '',
      empresa: '',
      tipo: 'pgdas',
      nome: '',
      descricao: '',
      periodicidade: 'mensal',
      dia_vencimento: 20,
      responsavel: '',
      regime_tributario: 'simples_nacional',
      observacoes: '',
      valor: 0
    });
    setSelectedItem(null);
  };

  const resetNotaForm = () => {
    setNotaForm({
      empresa_id: '',
      cnpj_emitente: '',
      nome_emitente: '',
      chave_nfe: '',
      numero_nota: '',
      serie: '',
      tipo_nota: 'saida',
      data_emissao: getTodayInputDate(),
      valor_total: 0,
      valor_icms: 0,
      valor_ipi: 0,
      valor_pis: 0,
      valor_cofins: 0,
      status_conciliacao: 'nao_conciliado',
      observacoes: ''
    });
    setSelectedItem(null);
  };

  const openCreateModal = (type) => {
    setModalType('create');
    if (type === 'obrigacao') {
      resetObrigacaoForm();
    } else {
      resetNotaForm();
    }
    setShowModal(true);
  };

  const openEditModal = (item, type) => {
    setModalType('edit');
    setSelectedItem(item);
    if (type === 'obrigacao') {
      setObrigacaoForm({
        empresa_id: item.empresa_id,
        empresa: item.empresa,
        tipo: item.tipo,
        nome: item.nome,
        descricao: item.descricao || '',
        periodicidade: item.periodicidade,
        dia_vencimento: item.dia_vencimento,
        responsavel: item.responsavel,
        regime_tributario: item.regime_tributario,
        observacoes: item.observacoes || '',
        valor: item.valor || 0
      });
    }
    setShowModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      'pendente': 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
      'em_andamento': 'bg-blue-600/20 text-blue-400 border-blue-600/30',
      'entregue': 'bg-green-600/20 text-green-400 border-green-600/30',
      'atrasado': 'bg-red-600/20 text-red-400 border-red-600/30',
      'retificado': 'bg-purple-600/20 text-purple-400 border-purple-600/30',
      'cancelado': 'bg-gray-600/20 text-gray-400 border-gray-600/30'
    };
    return colors[status] || 'bg-gray-600/20 text-gray-400 border-gray-600/30';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const classifyFiscalAvulsoType = (item = {}) => {
    const text = normalizeText(`${item.tipo || ''} ${item.nome || ''} ${item.descricao || ''}`);
    if (text.includes('parcelamento')) return 'parcelamento';
    if (text.includes('retific')) return 'retificacao';
    if (text.includes('regulariza') || text.includes('divida') || text.includes('pendenc')) return 'regularizacao';
    return 'outros';
  };

  const obrigacoesMensais = useMemo(
    () => obrigacoes.filter((item) => normalizeText(item.periodicidade || 'mensal') === 'mensal'),
    [obrigacoes],
  );

  const obrigacoesAvulsas = useMemo(
    () => obrigacoes.filter((item) => normalizeText(item.periodicidade || '') !== 'mensal'),
    [obrigacoes],
  );

  const avulsoTypeCounts = useMemo(() => ({
    parcelamento: obrigacoesAvulsas.filter((item) => classifyFiscalAvulsoType(item) === 'parcelamento').length,
    retificacao: obrigacoesAvulsas.filter((item) => classifyFiscalAvulsoType(item) === 'retificacao').length,
    regularizacao: obrigacoesAvulsas.filter((item) => classifyFiscalAvulsoType(item) === 'regularizacao').length,
    outros: obrigacoesAvulsas.filter((item) => classifyFiscalAvulsoType(item) === 'outros').length,
  }), [obrigacoesAvulsas]);

  const obrigacoesVisiveis = useMemo(() => {
    if (fiscalModuleView === 'obrigacoes_mensais') return obrigacoesMensais;
    if (fiscalAvulsoType === 'todos') return obrigacoesAvulsas;
    return obrigacoesAvulsas.filter((item) => classifyFiscalAvulsoType(item) === fiscalAvulsoType);
  }, [fiscalModuleView, fiscalAvulsoType, obrigacoesMensais, obrigacoesAvulsas]);

  const fiscalClients = useMemo(() => {
    return clientes.map((client) => {
      const setup = fiscalSetup[client.id] || {};
      const segmento = setup.segmento || inferSegmentByClient(client);
      const anexo = setup.anexo || 'I';
      const rbt12 = Number(setup.rbt12 || 360000);
      const aliquotaEfetiva = Number(setup.aliquotaEfetiva || calculateAliquotaEfetiva(anexo, rbt12));
      return {
        id: client.id,
        nome_empresa: client.nome_empresa,
        cnpj: client.cnpj,
        regime: client.tipo_regime || 'simples_nacional',
        statusFiscal: setup.statusFiscal || (setup.temMovimento ? 'com_movimento' : 'sem_movimento'),
        porte: setup.porte || inferPorte(client),
        segmento,
        cnae: setup.cnae || '',
        ncm: setup.ncm || '',
        anexo,
        rbt12,
        aliquotaEfetiva,
        flags: buildTaxFlags(segmento, setup.cnae || '', setup.ncm || ''),
        flagReasons: explainTaxFlags(segmento, setup.cnae || '', setup.ncm || ''),
        rulesVersion: TAX_RULES_VERSION,
      };
    });
  }, [clientes, fiscalSetup]);

  const updateFiscalClientSetup = (clientId, field, value) => {
    setFiscalSetup((current) => {
      const base = current[clientId] || {};
      const next = { ...base, [field]: value };
      if (field === 'anexo' || field === 'rbt12') {
        const anexo = field === 'anexo' ? value : (next.anexo || 'I');
        const rbt12 = field === 'rbt12' ? Number(value || 0) : Number(next.rbt12 || 0);
        next.aliquotaEfetiva = Number(calculateAliquotaEfetiva(anexo, rbt12).toFixed(2));
      }
      return { ...current, [clientId]: next };
    });
  };

  const fiscalClientsView = (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4">
        <p className="text-sm text-gray-300">
          Lista otimizada para o setor fiscal. O cadastro da empresa é importado e o colaborador complementa dados como CNAE, Anexo e RBT12.
        </p>
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-futuristic w-full min-w-[1420px]">
            <thead>
              <tr className="border-b border-red-600/30">
                <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                <th className="text-left p-4 text-gray-300 font-semibold">CNPJ</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Porte</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Status fiscal</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Segmento</th>
                <th className="text-left p-4 text-gray-300 font-semibold">CNAE</th>
                <th className="text-left p-4 text-gray-300 font-semibold">NCM base</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Anexo</th>
                <th className="text-left p-4 text-gray-300 font-semibold">RBT12</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Aliquota efetiva</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Matriz tributaria automatica (v{TAX_RULES_VERSION})</th>
              </tr>
            </thead>
            <tbody>
              {fiscalClients.map((client) => (
                <tr key={client.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                  <td className="p-4 text-white font-medium">{client.nome_empresa}</td>
                  <td className="p-4 text-gray-300 font-mono text-xs">{client.cnpj || '-'}</td>
                  <td className="p-4">
                    <select value={client.porte} onChange={(e) => updateFiscalClientSetup(client.id, 'porte', e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
                      <option>MEI</option>
                      <option>ME</option>
                      <option>EPP</option>
                      <option>Medio porte</option>
                      <option>Grande porte</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <select
                      value={client.statusFiscal}
                      onChange={(e) => {
                        const status = e.target.value;
                        updateFiscalClientSetup(client.id, 'statusFiscal', status);
                        updateFiscalClientSetup(client.id, 'temMovimento', status === 'com_movimento');
                      }}
                      className="bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="sem_movimento">Sem movimento</option>
                      <option value="com_movimento">Com movimento</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <input value={client.segmento} onChange={(e) => updateFiscalClientSetup(client.id, 'segmento', e.target.value)} className="w-32 bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                  </td>
                  <td className="p-4">
                    <input value={client.cnae} placeholder="0000-0/00" onChange={(e) => updateFiscalClientSetup(client.id, 'cnae', e.target.value)} className="w-28 bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                  </td>
                  <td className="p-4">
                    <input value={client.ncm} placeholder="0000.00.00" onChange={(e) => updateFiscalClientSetup(client.id, 'ncm', e.target.value)} className="w-28 bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                  </td>
                  <td className="p-4">
                    <select value={client.anexo} onChange={(e) => updateFiscalClientSetup(client.id, 'anexo', e.target.value)} className="bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
                      <option value="I">I</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                      <option value="IV">IV</option>
                      <option value="V">V</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <input type="number" value={client.rbt12} onChange={(e) => updateFiscalClientSetup(client.id, 'rbt12', Number(e.target.value || 0))} className="w-28 bg-black/30 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                  </td>
                  <td className="p-4 text-emerald-300 text-sm font-semibold">{client.aliquotaEfetiva.toFixed(2)}%</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(client.flags).filter(([, enabled]) => enabled).map(([flag]) => (
                        <span key={flag} className="px-2 py-1 rounded-full text-[10px] bg-blue-600/20 text-blue-200 border border-blue-600/30">
                          {flag === 'substituicaoTributaria' ? 'ST' :
                            flag === 'tributacaoMonofasica' ? 'Monofasica' :
                            flag === 'diferimento' ? 'Diferimento' :
                            flag === 'difal' ? 'DIFAL' :
                            flag === 'aliquotaZero' ? 'Aliquota Zero' :
                            flag === 'isencao' ? 'Isencao' :
                            flag === 'naoIncidencia' ? 'Nao incidencia' :
                            flag === 'antecipacaoTributaria' ? 'Antecipacao' : 'Farmacia'}
                        </span>
                      ))}
                      {Object.values(client.flags).every((enabled) => !enabled) ? <span className="text-xs text-gray-500">Sem gatilho automatico</span> : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      {client.flagReasons?.length ? client.flagReasons.slice(0, 3).map((reason, idx) => (
                        <p key={`${client.id}-reason-${idx}`} className="text-[11px] text-gray-400 leading-relaxed">
                          {reason}
                        </p>
                      )) : <p className="text-[11px] text-gray-500">Nenhuma regra adicional acionada.</p>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (!hasAccess([], ['fiscal'])) {
    return (
      <div className="glass p-8 rounded-2xl text-center">
        <Scale className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
        <p className="text-gray-400">Você não tem permissão para acessar este módulo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">📋</span>
            Fiscal
          </h1>
          <p className="text-gray-400 mt-2">Gestão completa de obrigações fiscais e notas</p>
        </div>
      </div>

      {/* Dashboard Cards */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass p-6 rounded-xl border border-yellow-600/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Obrigações Pendentes</p>
                <p className="text-3xl font-bold text-yellow-400 mt-2">
                  {dashboardStats.obrigacoes_por_status?.pendente || 0}
                </p>
              </div>
              <Clock className="w-12 h-12 text-yellow-400 opacity-50" />
            </div>
          </div>

          <div className="glass p-6 rounded-xl border border-red-600/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Vencendo em 30 dias</p>
                <p className="text-3xl font-bold text-red-400 mt-2">
                  {dashboardStats.obrigacoes_vencendo_30_dias || 0}
                </p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-400 opacity-50" />
            </div>
          </div>

          <div className="glass p-6 rounded-xl border border-green-600/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Entregas do Mês</p>
                <p className="text-3xl font-bold text-green-400 mt-2">
                  {dashboardStats.obrigacoes_por_status?.entregue || 0}
                </p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-400 opacity-50" />
            </div>
          </div>

          <div className="glass p-6 rounded-xl border border-blue-600/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Notas Fiscais</p>
                <p className="text-3xl font-bold text-blue-400 mt-2">
                  {dashboardStats.notas_fiscais_mes || 0}
                </p>
              </div>
              <FileText className="w-12 h-12 text-blue-400 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="glass rounded-xl p-1 inline-flex">
        <button
          onClick={() => setActiveTab('obrigacoes')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'obrigacoes'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📊 Obrigações Fiscais
        </button>
        <button
          onClick={() => setActiveTab('notas')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'notas'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📄 Notas Fiscais
        </button>
        <button
          onClick={() => setActiveTab('clientes_fiscais')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'clientes_fiscais'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          🏢 Clientes Fiscais
        </button>
      </div>

      {/* Filtros e Ações */}
      {activeTab === 'clientes_fiscais' ? fiscalClientsView : activeTab === 'obrigacoes' ? (
        <>
          <div className="glass rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFiscalModuleView('obrigacoes_mensais')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  fiscalModuleView === 'obrigacoes_mensais'
                    ? 'bg-red-600 text-white'
                    : 'bg-black/30 text-gray-300 hover:text-white'
                }`}
              >
                Obrigações mensais
              </button>
              <button
                onClick={() => setFiscalModuleView('servicos_avulsos')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  fiscalModuleView === 'servicos_avulsos'
                    ? 'bg-red-600 text-white'
                    : 'bg-black/30 text-gray-300 hover:text-white'
                }`}
              >
                Serviços avulsos
              </button>
            </div>
            {fiscalModuleView === 'servicos_avulsos' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { key: 'todos', label: `Todos (${obrigacoesAvulsas.length})` },
                  { key: 'parcelamento', label: `Parcelamento (${avulsoTypeCounts.parcelamento})` },
                  { key: 'retificacao', label: `Retificação (${avulsoTypeCounts.retificacao})` },
                  { key: 'regularizacao', label: `Regularização (${avulsoTypeCounts.regularizacao})` },
                  { key: 'outros', label: `Outros (${avulsoTypeCounts.outros})` },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setFiscalAvulsoType(item.key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      fiscalAvulsoType === item.key
                        ? 'border-red-500/35 bg-red-500/15 text-red-100'
                        : 'border-white/15 bg-white/5 text-gray-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="glass rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo</label>
                <select
                  value={filters.tipo}
                  onChange={(e) => setFilters({...filters, tipo: e.target.value})}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Todos</option>
                  <option value="pgdas">PGDAS</option>
                  <option value="defis">DEFIS</option>
                  <option value="dctf">DCTF</option>
                  <option value="sped_fiscal">SPED Fiscal</option>
                  <option value="sped_contribuicoes">SPED Contribuições</option>
                  <option value="ecf">ECF</option>
                  <option value="darf">DARF</option>
                  <option value="gias">GIAS</option>
                  <option value="dif">DIF</option>
                  <option value="dirf">DIRF</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="entregue">Entregue</option>
                  <option value="atrasado">Atrasado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Regime Tributário</label>
                <select
                  value={filters.regime_tributario}
                  onChange={(e) => setFilters({...filters, regime_tributario: e.target.value})}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Todos</option>
                  <option value="simples_nacional">Simples Nacional</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="lucro_real">Lucro Real</option>
                  <option value="mei">MEI</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    placeholder="Empresa ou responsável..."
                    className="w-full bg-black/30 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => openCreateModal('obrigacao')}
                  className="w-full btn-futuristic px-4 py-2 rounded-lg text-white font-semibold flex items-center justify-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Nova Obrigação</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Obrigações */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-futuristic w-full">
                <thead>
                  <tr className="border-b border-red-600/30">
                    <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Tipo</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Nome</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Periodicidade</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Próximo Vencimento</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Regime</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center p-8">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-gray-400">Carregando...</span>
                        </div>
                      </td>
                    </tr>
                  ) : obrigacoesVisiveis.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center p-8">
                        <div className="text-gray-400">
                          <Scale className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Nenhuma obrigação encontrada</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    obrigacoesVisiveis.map((obrigacao) => (
                      <tr key={obrigacao.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                        <td className="p-4 text-white font-medium">{obrigacao.empresa}</td>
                        <td className="p-4 text-gray-300 uppercase">{obrigacao.tipo.replace('_', ' ')}</td>
                        <td className="p-4 text-gray-300">{obrigacao.nome}</td>
                        <td className="p-4 text-gray-300 capitalize">{obrigacao.periodicidade}</td>
                        <td className="p-4 text-gray-300">
                          {new Date(obrigacao.proximo_vencimento).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-4 text-gray-300 capitalize">
                          {obrigacao.regime_tributario.replace('_', ' ')}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(obrigacao.status)}`}>
                            {obrigacao.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => openEditModal(obrigacao, 'obrigacao')}
                              className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4 text-blue-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteObrigacao(obrigacao.id)}
                              className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Filtros Notas Fiscais */}
          <div className="glass rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo Nota</label>
                <select
                  value={notasFilters.tipo_nota}
                  onChange={(e) => setNotasFilters({...notasFilters, tipo_nota: e.target.value})}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Todas</option>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status Conciliação</label>
                <select
                  value={notasFilters.status_conciliacao}
                  onChange={(e) => setNotasFilters({...notasFilters, status_conciliacao: e.target.value})}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Todos</option>
                  <option value="nao_conciliado">Não Conciliado</option>
                  <option value="conciliado">Conciliado</option>
                  <option value="divergente">Divergente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Data Início</label>
                <input
                  type="date"
                  value={notasFilters.periodo_inicio}
                  onChange={(e) => setNotasFilters({...notasFilters, periodo_inicio: e.target.value})}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Data Fim</label>
                <input
                  type="date"
                  value={notasFilters.periodo_fim}
                  onChange={(e) => setNotasFilters({...notasFilters, periodo_fim: e.target.value})}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div className="flex items-end space-x-2">
                <button
                  onClick={() => openCreateModal('nota')}
                  className="flex-1 btn-futuristic px-4 py-2 rounded-lg text-white font-semibold flex items-center justify-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Nova Nota</span>
                </button>
                <label className="flex-1 btn-futuristic px-4 py-2 rounded-lg text-white font-semibold flex items-center justify-center space-x-2 cursor-pointer">
                  <Upload className="w-5 h-5" />
                  <span>XML</span>
                  <input type="file" accept=".xml" onChange={handleUploadXML} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          {/* Tabela Notas Fiscais */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-futuristic w-full">
                <thead>
                  <tr className="border-b border-red-600/30">
                    <th className="text-left p-4 text-gray-300 font-semibold">Número</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Emitente</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">CNPJ</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Tipo</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Data Emissão</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Valor Total</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center p-8">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-gray-400">Carregando...</span>
                        </div>
                      </td>
                    </tr>
                  ) : notasFiscais.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center p-8">
                        <div className="text-gray-400">
                          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Nenhuma nota fiscal encontrada</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    notasFiscais.map((nota) => (
                      <tr key={nota.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                        <td className="p-4 text-white font-medium">{nota.numero_nota}/{nota.serie}</td>
                        <td className="p-4 text-gray-300">{nota.nome_emitente}</td>
                        <td className="p-4 text-gray-300 font-mono text-sm">{nota.cnpj_emitente}</td>
                        <td className="p-4 text-gray-300 capitalize">{nota.tipo_nota}</td>
                        <td className="p-4 text-gray-300">
                          {new Date(nota.data_emissao).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-4 text-green-400 font-semibold">
                          {formatCurrency(nota.valor_total)}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            nota.status_conciliacao === 'conciliado' 
                              ? 'bg-green-600/20 text-green-400 border-green-600/30'
                              : nota.status_conciliacao === 'divergente'
                              ? 'bg-red-600/20 text-red-400 border-red-600/30'
                              : 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
                          }`}>
                            {nota.status_conciliacao.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal para Criar/Editar Obrigação */}
      {showModal && activeTab === 'obrigacoes' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <FileText className="w-6 h-6 mr-2 text-red-400" />
                {modalType === 'create' ? 'Nova Obrigação Fiscal' : 'Editar Obrigação Fiscal'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={modalType === 'create' ? handleCreateObrigacao : handleUpdateObrigacao}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Empresa *</label>
                  <select
                    required
                    value={obrigacaoForm.empresa_id}
                    onChange={(e) => {
                      const cliente = clientes.find(c => c.id === e.target.value);
                      setObrigacaoForm({
                        ...obrigacaoForm,
                        empresa_id: e.target.value,
                        empresa: cliente ? cliente.nome_empresa : ''
                      });
                    }}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Selecione...</option>
                    {clientes.map(cliente => (
                      <option key={cliente.id} value={cliente.id}>{cliente.nome_empresa}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Obrigação *</label>
                  <select
                    required
                    value={obrigacaoForm.tipo}
                    onChange={(e) => setObrigacaoForm({...obrigacaoForm, tipo: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="pgdas">PGDAS</option>
                    <option value="defis">DEFIS</option>
                    <option value="dctf">DCTF</option>
                    <option value="sped_fiscal">SPED Fiscal</option>
                    <option value="sped_contribuicoes">SPED Contribuições</option>
                    <option value="ecf">ECF</option>
                    <option value="darf">DARF</option>
                    <option value="gias">GIAS</option>
                    <option value="dif">DIF</option>
                    <option value="dirf">DIRF</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome da Obrigação *</label>
                  <input
                    required
                    type="text"
                    value={obrigacaoForm.nome}
                    onChange={(e) => setObrigacaoForm({...obrigacaoForm, nome: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    placeholder="Ex: PGDAS-D Mensal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Periodicidade *</label>
                  <select
                    required
                    value={obrigacaoForm.periodicidade}
                    onChange={(e) => setObrigacaoForm({...obrigacaoForm, periodicidade: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="bimestral">Bimestral</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                    <option value="eventual">Eventual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Dia do Vencimento *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="31"
                    value={obrigacaoForm.dia_vencimento}
                    onChange={(e) => setObrigacaoForm({...obrigacaoForm, dia_vencimento: parseInt(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Regime Tributário *</label>
                  <select
                    required
                    value={obrigacaoForm.regime_tributario}
                    onChange={(e) => setObrigacaoForm({...obrigacaoForm, regime_tributario: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="simples_nacional">Simples Nacional</option>
                    <option value="lucro_presumido">Lucro Presumido</option>
                    <option value="lucro_real">Lucro Real</option>
                    <option value="mei">MEI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Responsável *</label>
                  <select
                    required
                    value={obrigacaoForm.responsavel}
                    onChange={(e) => setObrigacaoForm({...obrigacaoForm, responsavel: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Selecione...</option>
                    {usuarios.map(usuario => (
                      <option key={usuario.id} value={usuario.name}>{usuario.name}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                  <textarea
                    value={obrigacaoForm.descricao}
                    onChange={(e) => setObrigacaoForm({...obrigacaoForm, descricao: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    rows="3"
                    placeholder="Detalhes da obrigação..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Observações</label>
                  <textarea
                    value={obrigacaoForm.observacoes}
                    onChange={(e) => setObrigacaoForm({...obrigacaoForm, observacoes: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    rows="2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 btn-futuristic rounded-lg text-white font-medium"
                >
                  {modalType === 'create' ? 'Criar' : 'Atualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Criar Nota Fiscal */}
      {showModal && activeTab === 'notas' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <FileText className="w-6 h-6 mr-2 text-red-400" />
                Nova Nota Fiscal
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateNotaFiscal}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Empresa *</label>
                  <select
                    required
                    value={notaForm.empresa_id}
                    onChange={(e) => setNotaForm({...notaForm, empresa_id: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Selecione...</option>
                    {clientes.map(cliente => (
                      <option key={cliente.id} value={cliente.id}>{cliente.nome_empresa}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">CNPJ Emitente *</label>
                  <input
                    required
                    type="text"
                    value={notaForm.cnpj_emitente}
                    onChange={(e) => setNotaForm({...notaForm, cnpj_emitente: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome Emitente *</label>
                  <input
                    required
                    type="text"
                    value={notaForm.nome_emitente}
                    onChange={(e) => setNotaForm({...notaForm, nome_emitente: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Número Nota *</label>
                  <input
                    required
                    type="text"
                    value={notaForm.numero_nota}
                    onChange={(e) => setNotaForm({...notaForm, numero_nota: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Série *</label>
                  <input
                    required
                    type="text"
                    value={notaForm.serie}
                    onChange={(e) => setNotaForm({...notaForm, serie: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo Nota *</label>
                  <select
                    required
                    value={notaForm.tipo_nota}
                    onChange={(e) => setNotaForm({...notaForm, tipo_nota: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Data Emissão *</label>
                  <input
                    required
                    type="date"
                    value={notaForm.data_emissao}
                    onChange={(e) => setNotaForm({...notaForm, data_emissao: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Valor Total *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={notaForm.valor_total}
                    onChange={(e) => setNotaForm({...notaForm, valor_total: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">ICMS</label>
                  <input
                    type="number"
                    step="0.01"
                    value={notaForm.valor_icms}
                    onChange={(e) => setNotaForm({...notaForm, valor_icms: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">PIS</label>
                  <input
                    type="number"
                    step="0.01"
                    value={notaForm.valor_pis}
                    onChange={(e) => setNotaForm({...notaForm, valor_pis: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">COFINS</label>
                  <input
                    type="number"
                    step="0.01"
                    value={notaForm.valor_cofins}
                    onChange={(e) => setNotaForm({...notaForm, valor_cofins: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Chave NFe (44 dígitos)</label>
                  <input
                    type="text"
                    maxLength="44"
                    value={notaForm.chave_nfe}
                    onChange={(e) => setNotaForm({...notaForm, chave_nfe: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono"
                    placeholder="00000000000000000000000000000000000000000000"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 btn-futuristic rounded-lg text-white font-medium"
                >
                  Criar Nota Fiscal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FiscalExpandido;
  const getTodayInputDate = () => new Date().toISOString().split('T')[0];
