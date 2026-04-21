import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, ChevronDown, ChevronRight, ClipboardList, Copy, Eye, MinusCircle, Plus, RefreshCw, RotateCcw, Search, Trash2, Users } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getMockInternalServices } from '../../dev/clientPortalData';
import { mockClients } from '../../dev/mockData';
import { accountingServiceProcessModels } from '../../dev/accountingProcessTemplates';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { createProcessModelFromDraft, hydrateProcessModels } from '../Ourolandia/processModelUtils';
import MacedoAcademy from '../Ourolandia/MacedoAcademy';
import ServicesSettingsPanel from './ServicesSettingsPanel';
import './ServicesDark.css';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const MOCK_INTERNAL_SERVICES_KEY = 'mock_internal_services';
const MOCK_ADMIN_CLIENTS_KEY = 'mock_admin_clients_v1';
const MOCK_USERS_KEY = 'mock_users_management_v1';
const MODELS_KEY = 'mock_macedo_academy_process_models_v1';
const NOTIFICATIONS_KEY = 'mock_internal_notifications_v1';

const statusOptions = [
  { value: 'novo', label: 'A fazer', className: 'border border-white/10 bg-[#2a3446] text-white' },
  { value: 'em_andamento', label: 'Em progresso', className: 'border border-cyan-500/40 bg-cyan-500/15 text-cyan-100' },
  { value: 'concluido', label: 'Concluido', className: 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-100' },
  { value: 'cancelado', label: 'Dispensada', className: 'border border-amber-500/40 bg-amber-500/15 text-amber-100' },
];

const normalizeStatus = (status) => {
  if (status === 'pendente') return 'novo';
  if (status === 'aguardando_cliente') return 'em_andamento';
  if (status === 'em_andamento' || status === 'concluido' || status === 'cancelado' || status === 'novo') return status;
  return 'novo';
};

const toStoredStatus = (status) => (status === 'novo' ? 'pendente' : status);
const getStatusMeta = (status) => statusOptions.find((item) => item.value === status) || statusOptions[0];

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeSectorKey = (raw = '') => {
  const value = normalizeText(raw);
  if (value.includes('todo')) return 'todos';
  if (value.includes('trabalh')) return 'trabalhista';
  if (value.includes('fiscal')) return 'fiscal';
  if (value.includes('finance')) return 'financeiro';
  if (value.includes('societ') || value.includes('contador')) return 'societario';
  if (value.includes('comercial')) return 'comercial';
  return 'atendimento';
};

const sectorLabelMap = {
  atendimento: 'Atendimento',
  financeiro: 'Financeiro',
  fiscal: 'Fiscal',
  trabalhista: 'Trabalhista',
  societario: 'Societario',
  comercial: 'Comercial',
};

const createId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const sectorToModule = {
  atendimento: 'atendimento',
  financeiro: 'financeiro',
  fiscal: 'fiscal',
  trabalhista: 'trabalhista',
  societario: 'contadores',
  comercial: 'comercial',
};

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const parseStorageArray = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const pushInternalNotification = (message, scope = 'servicos') => {
  const current = parseStorageArray(NOTIFICATIONS_KEY);
  const next = [
    ...current,
    {
      id: `ntf-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      message,
      createdAt: new Date().toISOString(),
      read: false,
      scope,
    },
  ];
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
};

const mergeClientsUnique = (...lists) => {
  const map = new Map();
  lists.flat().forEach((client) => {
    if (!client) return;
    const key = client.id || client.cnpj || `${client.nome_empresa || ''}-${client.nome_fantasia || ''}`;
    if (!key) return;
    if (!map.has(key)) map.set(key, client);
  });
  return Array.from(map.values());
};

const getClientCity = (client) => client?.cidade_atendimento || client?.cidade || '';
const getClientName = (client) => client?.nome_empresa || client?.nome_fantasia || client?.empresa_nome || '';

const getUserIdentifier = (record = {}) => record.id || record.email || '';

const userCanWorkOnSector = (record = {}, sectorKey) => {
  if (!record) return false;
  if (record.role === 'admin') return true;
  const perms = Array.isArray(record.permissoes) ? record.permissoes : [];
  const normalizedSectors = perms.map((perm) => normalizeSectorKey(perm?.setor));
  if (normalizedSectors.includes('todos')) return true;
  if (normalizedSectors.includes(sectorKey)) return true;
  const modules = new Set(record.allowed_modules || record.display_allowed_modules || []);
  const moduleKey = sectorToModule[sectorKey];
  if (moduleKey && modules.has(moduleKey)) return true;
  return false;
};

const deriveResponsibleSectors = (model, fallbackSectorKey) => {
  if (!model) return [fallbackSectorKey];
  const fromAllocation = (model.alocacaoColaboradores || []).map((item) => normalizeSectorKey(item.setor));
  const unique = Array.from(new Set(fromAllocation.filter(Boolean)));
  return unique.length ? unique : [fallbackSectorKey];
};

const getServiceAssignedIds = (service) => {
  const ids = new Set();

  if (service?.criado_por?.id) ids.add(service.criado_por.id);
  if (service?.criado_por?.email) ids.add(service.criado_por.email);
  if (service?.responsavel_id) ids.add(service.responsavel_id);
  if (service?.responsavel_email) ids.add(service.responsavel_email);
  if (Array.isArray(service?.assigned_to)) service.assigned_to.forEach((id) => ids.add(id));
  if (Array.isArray(service?.assignedTo)) service.assignedTo.forEach((id) => ids.add(id));

  const bySector = service?.colaboradores_por_setor;
  if (bySector && typeof bySector === 'object') {
    Object.values(bySector).forEach((list) => {
      if (Array.isArray(list)) list.forEach((id) => ids.add(id));
    });
  }

  return ids;
};

const isOrderService = (service = {}) => {
  const origem = normalizeText(service?.origem || '');
  const numero = String(service?.numero || service?.numero_os || '').toUpperCase();
  return origem.includes('servicos_avulsos') || numero.startsWith('OS-');
};

const Services = () => {
  const { user } = useAuth();
  const location = useLocation();
  const creatorId = user?.id || user?.email || 'dev-user';
  const creatorName = user?.name || user?.email || 'Colaborador';

  const [servicos, setServicos] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedServico, setSelectedServico] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [showBatchSendModal, setShowBatchSendModal] = useState(false);
  const [topViewTab, setTopViewTab] = useState('processos');
  const [processViewMode, setProcessViewMode] = useState('tabela');
  const [scopeTab, setScopeTab] = useState('cliente');
  const [teamPerformanceScope, setTeamPerformanceScope] = useState('equipe');
  const [selectedPeriodo, setSelectedPeriodo] = useState('all');
  const [selectedPrazo, setSelectedPrazo] = useState('all');
  const [selectedResponsavel, setSelectedResponsavel] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState('all');
  const [showResponsibleSelector, setShowResponsibleSelector] = useState(false);
  const [createMode, setCreateMode] = useState('modelo');
  const [expandedProcessRows, setExpandedProcessRows] = useState({});
  const [selectedProcessService, setSelectedProcessService] = useState(null);
  const [batchStatus, setBatchStatus] = useState('novo');
  const [quickSearch, setQuickSearch] = useState('');
  const [quickSearchDate, setQuickSearchDate] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [showCustomServiceInput, setShowCustomServiceInput] = useState(false);
  const [customServiceName, setCustomServiceName] = useState('');
  const [serviceTypeSearchTerm, setServiceTypeSearchTerm] = useState('');
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [enableAdditionalCollaborators, setEnableAdditionalCollaborators] = useState(false);
  const [customServicesBySector, setCustomServicesBySector] = useState({});
  const [assignedBySector, setAssignedBySector] = useState({});
  const [draftFilters, setDraftFilters] = useState({
    cliente: '',
    setor: '',
    cadastradosPorVoce: false,
    vinculados: false,
    ordensServico: false,
    servicosPadrao: false,
  });
  const [appliedFilters, setAppliedFilters] = useState({
    cliente: '',
    setor: '',
    cadastradosPorVoce: false,
    vinculados: false,
    ordensServico: false,
    servicosPadrao: false,
  });
  const [accessDeniedBySector, setAccessDeniedBySector] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showBatchGenerateModal, setShowBatchGenerateModal] = useState(false);
  const [batchGenerateServiceName, setBatchGenerateServiceName] = useState('');
  const [batchGenerateModelId, setBatchGenerateModelId] = useState('');
  const [batchGenerateSectorKey, setBatchGenerateSectorKey] = useState('atendimento');
  const [newService, setNewService] = useState({
    empresa_id: '',
    empresa_nome: '',
    tipo_servico: '',
    modelo_id: '',
    descricao: '',
    setor_key: 'atendimento',
    cidade: '',
    urgencia: 'normal',
    data_inicio: '',
    canal_atendimento: 'interno',
    vincular_ordem_servico: false,
    gerar_cobranca: false,
  });
  const [processModels, setProcessModels] = useState(() => hydrateProcessModels(accountingServiceProcessModels));
  const [processDraft, setProcessDraft] = useState({
    nome: '',
    descricao: '',
    setorDestinoKey: 'atendimento',
    etapas: [
      { nome: 'Triagem inicial', setorResponsavelKey: 'atendimento', tarefasTexto: 'Registrar solicitacao\nValidar documentos obrigatorios' },
      { nome: 'Execucao tecnica', setorResponsavelKey: 'atendimento', tarefasTexto: 'Executar servico\nRevisar entrega final' },
    ],
  });
  const clientDropdownRef = useRef(null);
  const responsibleDropdownRef = useRef(null);

  const isDashboardTab = topViewTab === 'dashboard';
  const isProcessosTab = topViewTab === 'processos';
  const isOrdemServicoTab = topViewTab === 'ordem_servico';
  const isModelosTab = topViewTab === 'modelos';
  const isConfiguracoesTab = topViewTab === 'configuracoes';
  const isProcessWorkspaceTab = isProcessosTab;

  const getServiceResponsibleName = (service) => {
    if (!service) return 'Nao atribuido';
    const directName = service.responsavel_nome || service.responsavel_conta || service.colaborador_responsavel || service.colaborador_lancamento_nome;
    if (directName) return directName;
    const assigned = Array.isArray(service.assigned_to) ? service.assigned_to : [];
    const firstAssigned = assigned[0];
    if (!firstAssigned) return 'Nao atribuido';
    const byId = allUsers.find((userItem) => getUserIdentifier(userItem) === firstAssigned);
    return byId?.name || byId?.email || 'Nao atribuido';
  };

  useEffect(() => {
    loadServicos();
    loadSupportData();
    try {
      const storedModels = JSON.parse(localStorage.getItem(MODELS_KEY) || '[]');
      if (Array.isArray(storedModels) && storedModels.length) {
        setProcessModels(hydrateProcessModels(storedModels));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetId = params.get('servicoId');
    if (!targetId || !servicos.length) return;
    const target = servicos.find((item) => String(item.id) === String(targetId));
    if (target) {
      setSelectedServico(target);
    }
  }, [location.search, servicos]);

  useEffect(() => {
    if (!showCreateModal) return;
    const selectedModel = processModels.find((item) => item.id === newService.modelo_id) || null;
    const responsibleSectors = deriveResponsibleSectors(selectedModel, newService.setor_key);
    const nextAssigned = {};
    responsibleSectors.forEach((sectorKey) => {
      if (sectorKey === newService.setor_key) {
        nextAssigned[sectorKey] = [creatorId];
      } else {
        nextAssigned[sectorKey] = [];
      }
    });
    setAssignedBySector(nextAssigned);
  }, [newService.modelo_id, newService.setor_key, showCreateModal, creatorId, processModels]);

  const loadSupportData = async () => {
    const token = localStorage.getItem('token');

    let backendClients = [];
    try {
      const response = await fetch(`${API_URL}/api/clients?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const payload = await response.json();
        backendClients = payload?.clients || payload || [];
      }
    } catch {}

    const localClients = parseStorageArray(MOCK_ADMIN_CLIENTS_KEY);
    const mergedClients = mergeClientsUnique(
      Array.isArray(backendClients) ? backendClients : [],
      localClients,
      mockClients,
    );
    setAllClients(mergedClients);

    let backendUsers = [];
    try {
      const response = await fetch(`${API_URL}/api/users-management/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const payload = await response.json();
        backendUsers = Array.isArray(payload) ? payload : [];
      }
    } catch {}

    const localUsers = parseStorageArray(MOCK_USERS_KEY);
    const mergedUsers = [...backendUsers, ...localUsers];
    const withCreator = mergedUsers.some((item) => getUserIdentifier(item) === creatorId)
      ? mergedUsers
      : [
          ...mergedUsers,
          {
            id: creatorId,
            name: creatorName,
            role: user?.role || 'colaborador',
            permissoes: user?.permissoes || [],
            allowed_modules: user?.allowed_modules || [],
          },
        ];
    setAllUsers(withCreator);
  };

  const loadServicos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/services/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const backendData = response.ok ? await response.json() : [];
      const backendServices = Array.isArray(backendData) ? backendData : [];
      const mockServices = getMockInternalServices();

      const merged = [...backendServices, ...mockServices].map((item) => ({
        ...item,
        status_ui: normalizeStatus(item.status),
      }));

      setServicos(merged);
    } catch (error) {
      console.error('Erro ao carregar servicos:', error);
      const mockServices = getMockInternalServices().map((item) => ({
        ...item,
        status_ui: normalizeStatus(item.status),
      }));
      setServicos(mockServices);
    } finally {
      setLoading(false);
    }
  };

  const userSectorKeys = useMemo(() => {
    if (user?.role === 'admin') return new Set(Object.keys(sectorLabelMap));
    const fromPerms = (user?.permissoes || []).map((perm) => normalizeSectorKey(perm?.setor));
    const fromModules = Object.entries(sectorToModule)
      .filter(([, moduleKey]) => (user?.allowed_modules || []).includes(moduleKey))
      .map(([sectorKey]) => sectorKey);
    return new Set([...fromPerms, ...fromModules]);
  }, [user]);

  const hasAtendimentoAccess = useMemo(() => {
    if (user?.role === 'admin') return true;
    return userSectorKeys.has('atendimento');
  }, [user?.role, userSectorKeys]);

  const isServiceVisibleToCurrentUser = (service) => {
    if (hasAtendimentoAccess) return true;

    const currentUserIds = new Set([user?.id, user?.email].filter(Boolean));
    const assignedIds = getServiceAssignedIds(service);
    const byId = Array.from(currentUserIds).some((id) => assignedIds.has(id));
    if (byId) return true;

    const currentUserName = normalizeText(user?.name);
    const serviceNames = [
      service?.responsavel_nome,
      service?.responsavel_conta,
      service?.colaborador_responsavel,
      service?.colaborador_lancamento_nome,
    ].map(normalizeText);
    const byName = Boolean(currentUserName) && serviceNames.includes(currentUserName);
    if (byName) return true;

    return false;
  };

  const userVisibleServicos = useMemo(
    () => servicos.filter((service) => isServiceVisibleToCurrentUser(service)),
    [servicos, hasAtendimentoAccess, user?.id, user?.email, user?.name],
  );

  const clienteOptions = useMemo(() => {
    const unique = new Map();
    userVisibleServicos.forEach((item) => {
      if (!item.empresa_id && !item.empresa_nome) return;
      const key = item.empresa_id || item.empresa_nome;
      if (!unique.has(key)) unique.set(key, item.empresa_nome || key);
    });
    return Array.from(unique.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
  }, [userVisibleServicos]);

  const setorFilterOptions = useMemo(() => {
    const map = new Map();
    servicos.forEach((item) => {
      const key = normalizeSectorKey(item.setor);
      if (!key) return;
      if (!map.has(key)) map.set(key, item.setor || sectorLabelMap[key] || key);
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
  }, [servicos]);

  const periodoOptions = useMemo(() => {
    const map = new Map();
    userVisibleServicos.forEach((item) => {
      const rawDate = item.data_prazo || item.created_at;
      if (!rawDate) return;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      map.set(key, label);
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => b.value.localeCompare(a.value));
  }, [userVisibleServicos]);

  const responsavelOptions = useMemo(() => {
    const map = new Map();
    userVisibleServicos.forEach((item) => {
      const name = getServiceResponsibleName(item);
      if (!name) return;
      const key = normalizeText(name);
      if (!map.has(key)) map.set(key, name);
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
  }, [userVisibleServicos, allUsers]);

  const rankedClienteOptions = useMemo(() => {
    const term = normalizeText(clientSearchTerm);
    if (!term) return clienteOptions;

    const startsWith = clienteOptions.filter((item) => normalizeText(item.label).startsWith(term));
    const contains = clienteOptions.filter(
      (item) =>
        !normalizeText(item.label).startsWith(term) &&
        normalizeText(item.label).includes(term),
    );
    return [...startsWith, ...contains];
  }, [clienteOptions, clientSearchTerm]);

  const selectedClienteLabel = useMemo(
    () => clienteOptions.find((item) => item.value === draftFilters.cliente)?.label || 'Todos os clientes',
    [clienteOptions, draftFilters.cliente],
  );

  const sectorOptions = useMemo(() => {
    const fromModels = processModels.map((model) => normalizeSectorKey(model.setorDestino || model.setorInicial));
    const fromServices = servicos.map((item) => normalizeSectorKey(item.setor));
    const fromUsers = (user?.permissoes || []).map((perm) => normalizeSectorKey(perm?.setor));
    const merged = Array.from(new Set([...fromModels, ...fromServices, ...fromUsers].filter(Boolean)));
    return merged.map((key) => ({ key, label: sectorLabelMap[key] || key }));
  }, [servicos, user, processModels]);

  const cityOptions = useMemo(() => {
    const uniqueCities = new Set(
      allClients
        .map((client) => getClientCity(client))
        .filter(Boolean),
    );
    return Array.from(uniqueCities).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allClients]);

  const companyOptionsByCity = useMemo(() => {
    if (!newService.cidade) return [];
    return allClients
      .filter((client) => normalizeText(getClientCity(client)) === normalizeText(newService.cidade))
      .map((client) => ({
        id: client.id || client.cnpj || getClientName(client),
        name: getClientName(client),
      }))
      .filter((item) => item.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allClients, newService.cidade]);

  const serviceTypeOptions = useMemo(() => {
    const selectedSector = newService.setor_key;
    const options = [];
    const usageByModelId = new Map();
    const usageByName = new Map();

    servicos
      .filter((item) => normalizeSectorKey(item.setor) === selectedSector)
      .forEach((item) => {
        const modelId = item?.process_model_id || item?.modelo_id || item?.model_id;
        if (modelId) usageByModelId.set(String(modelId), (usageByModelId.get(String(modelId)) || 0) + 1);
        const serviceName = normalizeText(item?.tipo_servico || item?.titulo || item?.nome || '');
        if (serviceName) usageByName.set(serviceName, (usageByName.get(serviceName) || 0) + 1);
      });

    processModels.forEach((model) => {
      const modelSector = normalizeSectorKey(model.setorDestino || model.setorInicial);
      if (modelSector !== selectedSector) return;
      const byIdCount = usageByModelId.get(String(model.id)) || 0;
      const usageCount = byIdCount > 0 ? byIdCount : (usageByName.get(normalizeText(model.nome)) || 0);
      options.push({
        key: `model:${model.id}`,
        label: model.nome,
        tipoServico: model.nome,
        modeloId: model.id,
        usageCount,
      });
    });

    servicos
      .filter((item) => normalizeSectorKey(item.setor) === selectedSector && item.tipo_servico)
      .forEach((item) => {
        const usageCount = usageByName.get(normalizeText(item.tipo_servico)) || 0;
        options.push({
          key: `history:${item.tipo_servico}`,
          label: item.tipo_servico,
          tipoServico: item.tipo_servico,
          modeloId: '',
          usageCount,
        });
      });

    (customServicesBySector[selectedSector] || []).forEach((name) => {
      const usageCount = usageByName.get(normalizeText(name)) || 0;
      options.push({
        key: `custom:${name}`,
        label: name,
        tipoServico: name,
        modeloId: '',
        usageCount,
      });
    });

    const uniqueMap = new Map();
    options.forEach((option) => {
      const uniqueKey = normalizeText(option.label);
      if (!uniqueMap.has(uniqueKey)) uniqueMap.set(uniqueKey, option);
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const countDiff = (b.usageCount || 0) - (a.usageCount || 0);
      if (countDiff !== 0) return countDiff;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
  }, [newService.setor_key, servicos, customServicesBySector, processModels]);

  const filteredServiceTypeOptions = useMemo(() => {
    const term = normalizeText(serviceTypeSearchTerm);
    if (!term) return serviceTypeOptions;
    const startsWith = serviceTypeOptions.filter((option) => normalizeText(option.label).startsWith(term));
    const contains = serviceTypeOptions.filter(
      (option) =>
        !normalizeText(option.label).startsWith(term) &&
        normalizeText(option.label).includes(term),
    );
    return [...startsWith, ...contains];
  }, [serviceTypeOptions, serviceTypeSearchTerm]);

  const selectedModel = useMemo(
    () => processModels.find((item) => item.id === newService.modelo_id) || null,
    [newService.modelo_id, processModels],
  );

  const responsibleSectors = useMemo(
    () => deriveResponsibleSectors(selectedModel, newService.setor_key),
    [selectedModel, newService.setor_key],
  );

  const showCollaboratorSection = useMemo(() => {
    if (user?.role === 'admin') return true;
    return responsibleSectors.some((sectorKey) => userSectorKeys.has(sectorKey));
  }, [responsibleSectors, user?.role, userSectorKeys]);

  const getCollaboratorOptionsBySector = (sectorKey) =>
    allUsers
      .filter((record) => {
        if (!includeAdmins && record.role === 'admin') return false;
        return userCanWorkOnSector(record, sectorKey);
      })
      .map((record) => ({
        id: getUserIdentifier(record),
        name: record.name || record.email || 'Sem nome',
        role: record.role || 'colaborador',
      }))
      .filter((record) => record.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const filteredServicos = useMemo(() => {
    if (accessDeniedBySector) return [];
    return userVisibleServicos.filter((item) => {
      const matchCliente = !appliedFilters.cliente || (item.empresa_id || item.empresa_nome) === appliedFilters.cliente;
      const matchSetor = !appliedFilters.setor || normalizeSectorKey(item.setor) === appliedFilters.setor;
      const createdByIds = new Set(
        [item?.criado_por?.id, item?.criado_por?.email, item?.responsavel_id, item?.responsavel_email].filter(Boolean),
      );
      const currentUserIds = [user?.id, user?.email].filter(Boolean);
      const matchCadastradosPorVoce = !appliedFilters.cadastradosPorVoce
        || currentUserIds.some((id) => createdByIds.has(id));

      const assignedIds = getServiceAssignedIds(item);
      const matchVinculados = !appliedFilters.vinculados
        || currentUserIds.some((id) => assignedIds.has(id));

      const itemIsOrderService = isOrderService(item);
      const matchOrdensServico = !appliedFilters.ordensServico || itemIsOrderService;
      const matchServicosPadrao = !appliedFilters.servicosPadrao || !itemIsOrderService;
      const rawDate = item.data_prazo || item.created_at;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedPeriodMatch = (() => {
        if (selectedPeriodo === 'all') return true;
        if (!parsedDate || Number.isNaN(parsedDate.getTime())) return false;
        const key = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
        return key === selectedPeriodo;
      })();
      const prazoMatch = (() => {
        if (selectedPrazo === 'all') return true;
        if (!parsedDate || Number.isNaN(parsedDate.getTime())) return false;
        const baseDate = new Date(parsedDate);
        baseDate.setHours(0, 0, 0, 0);
        if (selectedPrazo === 'late') return baseDate < today;
        if (selectedPrazo === 'on_time') return baseDate >= today;
        return true;
      })();
      const responsibleName = normalizeText(getServiceResponsibleName(item));
      const responsibleMatch = selectedResponsavel === 'all' || responsibleName === selectedResponsavel;
      const statusMatch = selectedStatusFilter === 'all' || item.status_ui === selectedStatusFilter;
      const urgencyRaw = normalizeText(item.urgencia || item.prioridade || 'normal');
      const urgencyMatch = selectedUrgencyFilter === 'all' || urgencyRaw === selectedUrgencyFilter;

      return (
        matchCliente
        && matchSetor
        && matchCadastradosPorVoce
        && matchVinculados
        && matchOrdensServico
        && matchServicosPadrao
        && selectedPeriodMatch
        && prazoMatch
        && responsibleMatch
        && statusMatch
        && urgencyMatch
      );
    });
  }, [userVisibleServicos, appliedFilters, accessDeniedBySector, user?.id, user?.email, selectedPeriodo, selectedPrazo, selectedResponsavel, selectedStatusFilter, selectedUrgencyFilter, allUsers]);

  useEffect(() => {
    if (
      draftFilters.setor &&
      !hasAtendimentoAccess &&
      !userCanWorkOnSector(user || {}, draftFilters.setor)
    ) {
      setAccessDeniedBySector(true);
      setAppliedFilters(draftFilters);
      return;
    }
    setAccessDeniedBySector(false);
    setAppliedFilters(draftFilters);
  }, [draftFilters, hasAtendimentoAccess, user]);

  useEffect(() => {
    if (selectedPeriodo !== 'all') return;
    if (!periodoOptions.length) return;
    setSelectedPeriodo(periodoOptions[0].value);
  }, [periodoOptions, selectedPeriodo]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
        setClientDropdownOpen(false);
      }
      if (responsibleDropdownRef.current && !responsibleDropdownRef.current.contains(event.target)) {
        setShowResponsibleSelector(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const resumo = useMemo(() => {
    return {
      total: filteredServicos.length,
      novo: filteredServicos.filter((item) => item.status_ui === 'novo').length,
      emAndamento: filteredServicos.filter((item) => item.status_ui === 'em_andamento').length,
      concluidos: filteredServicos.filter((item) => item.status_ui === 'concluido').length,
    };
  }, [filteredServicos]);

  const visibleServicos = useMemo(() => {
    const term = normalizeText(quickSearch);
    return filteredServicos.filter((item) => {
      const textMatch = !term
        || normalizeText(item.empresa_nome).includes(term)
        || normalizeText(item.tipo_servico).includes(term)
        || normalizeText(item.titulo).includes(term);
      if (!textMatch) return false;
      if (!quickSearchDate) return true;
      const itemDate = String(item.data_prazo || item.created_at || '').slice(0, 10);
      return itemDate === quickSearchDate;
    });
  }, [filteredServicos, quickSearch, quickSearchDate]);

  const groupedByClient = useMemo(() => {
    const grouped = new Map();
    visibleServicos.forEach((item) => {
      const key = item.empresa_nome || 'Sem cliente';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
    return Array.from(grouped.entries());
  }, [visibleServicos]);

  const groupedByProcess = useMemo(() => {
    const grouped = new Map();
    visibleServicos.forEach((item) => {
      const key = item.tipo_servico || item.titulo || 'Processo sem nome';
      if (!grouped.has(key)) {
        grouped.set(key, { clients: new Set(), total: 0, setor: item.setor || '-', items: [] });
      }
      const row = grouped.get(key);
      row.total += 1;
      if (item.empresa_nome) row.clients.add(item.empresa_nome);
      row.items.push(item);
    });
    return Array.from(grouped.entries()).map(([name, data]) => ({
      name,
      clients: data.clients.size,
      total: data.total,
      setor: data.setor,
      items: data.items,
    }));
  }, [visibleServicos]);

  const taskRows = useMemo(() => {
    const rows = [];
    visibleServicos.forEach((item) => {
      const deptKey = normalizeSectorKey(item.setor || '');
      const deptBadge =
        deptKey === 'financeiro' ? 'F' :
        deptKey === 'atendimento' ? 'A' :
        deptKey === 'comercial' ? 'C' :
        deptKey === 'trabalhista' ? 'T' :
        deptKey === 'fiscal' ? 'P' : 'P';
      const deptClass =
        deptBadge === 'F' ? 'bg-green-600' :
        deptBadge === 'A' ? 'bg-red-500' :
        deptBadge === 'C' ? 'bg-amber-500' :
        deptBadge === 'T' ? 'bg-blue-500' : 'bg-yellow-500';
      rows.push({
        key: `${item.id}-task`,
        tarefa: item.tipo_servico || item.titulo || 'Tarefa',
        situacao: getStatusMeta(item.status_ui).label,
        statusUi: item.status_ui,
        cliente: item.empresa_nome || '-',
        processo: item.tipo_servico || '-',
        prazo: formatDate(item.data_prazo || item.created_at),
        departamento: item.setor || '-',
        deptBadge,
        deptClass,
        sourceId: item.id,
      });
    });
    return rows;
  }, [visibleServicos]);

  const selectedTargetServicos = useMemo(
    () => visibleServicos.filter((item) => selectedServiceIds.includes(String(item.id))),
    [visibleServicos, selectedServiceIds],
  );

  useEffect(() => {
    const visibleIds = new Set(visibleServicos.map((item) => String(item.id)));
    setSelectedServiceIds((prev) => prev.filter((id) => visibleIds.has(String(id))));
  }, [visibleServicos]);

  const toggleServiceSelection = (serviceId, checked) => {
    const id = String(serviceId);
    setSelectedServiceIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  };

  const toggleAllVisibleSelection = (checked) => {
    if (!checked) {
      setSelectedServiceIds([]);
      return;
    }
    setSelectedServiceIds(visibleServicos.map((item) => String(item.id)));
  };


  const updateMockStatus = (serviceId, nextStatus) => {
    try {
      const raw = localStorage.getItem(MOCK_INTERNAL_SERVICES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const updated = parsed.map((item) =>
        item.id === serviceId ? { ...item, status: toStoredStatus(nextStatus) } : item,
      );
      localStorage.setItem(MOCK_INTERNAL_SERVICES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Erro ao salvar status mock:', error);
    }
  };

  const handleStatusChange = async (serviceId, nextStatus) => {
    setServicos((current) =>
      current.map((item) =>
        item.id === serviceId
          ? {
              ...item,
              status_ui: nextStatus,
              status: toStoredStatus(nextStatus),
            }
          : item,
      ),
    );

    const target = servicos.find((item) => item.id === serviceId);
    if (!target) return;
    if (target.mock_origin) {
      updateMockStatus(serviceId, nextStatus);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/services/${serviceId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...target,
          status: toStoredStatus(nextStatus),
        }),
      });
    } catch (error) {
      console.error('Erro ao atualizar status no backend:', error);
    }
  };

  const applyBatchStatus = (nextStatus) => {
    const targets = selectedTargetServicos.length ? selectedTargetServicos : filteredServicos;
    targets.forEach((item) => {
      handleStatusChange(item.id, nextStatus);
    });
    setShowBatchEditModal(false);
    toast.success(`Status atualizado em lote para ${targets.length} processos.`);
  };

  const handleBatchSend = () => {
    const targets = selectedTargetServicos.length ? selectedTargetServicos : filteredServicos;
    setShowBatchSendModal(false);
    toast.success(`${targets.length} processos enviados para fila de envio em lote.`);
  };

  const removeServicesFromStorage = (idsToRemove = []) => {
    if (!idsToRemove.length) return;
    try {
      const raw = JSON.parse(localStorage.getItem(MOCK_INTERNAL_SERVICES_KEY) || '[]');
      if (!Array.isArray(raw)) return;
      const blocked = new Set(idsToRemove.map((id) => String(id)));
      const next = raw.filter((item) => !blocked.has(String(item.id)));
      localStorage.setItem(MOCK_INTERNAL_SERVICES_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleDeleteSelected = async () => {
    const targets = selectedTargetServicos;
    if (!targets.length) {
      toast.error('Selecione ao menos um processo.');
      return;
    }
    const ids = targets.map((item) => String(item.id));
    setServicos((current) => current.filter((item) => !ids.includes(String(item.id))));
    removeServicesFromStorage(ids);
    setSelectedServiceIds([]);

    const token = localStorage.getItem('token');
    await Promise.all(
      targets
        .filter((item) => !item.mock_origin)
        .map((item) =>
          fetch(`${API_URL}/api/services/${item.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
        ),
    );
    toast.success(`${targets.length} processo(s) removido(s).`);
  };

  const handleDuplicateSelected = () => {
    const targets = selectedTargetServicos;
    if (!targets.length) {
      toast.error('Selecione ao menos um processo.');
      return;
    }
    const now = Date.now();
    const clones = targets.map((item, index) => {
      const createdAt = new Date(now + index * 1000).toISOString();
      return {
        ...item,
        id: `mock-dup-${now}-${index}`,
        numero: `${item.numero || 'SVC'}-DUP-${index + 1}`,
        status: 'pendente',
        status_ui: 'novo',
        created_at: createdAt,
        updated_at: createdAt,
        titulo: item.titulo || item.tipo_servico || 'Processo duplicado',
        mock_origin: 'manual_admin',
      };
    });
    setServicos((current) => [...clones, ...current]);
    const current = getMockInternalServices();
    localStorage.setItem(MOCK_INTERNAL_SERVICES_KEY, JSON.stringify([...clones, ...current]));
    setSelectedServiceIds(clones.map((item) => String(item.id)));
    toast.success(`${clones.length} processo(s) duplicado(s).`);
  };

  const handleGenerateBatch = () => {
    const selectedServiceLabel = batchGenerateServiceName.trim()
      || processModels.find((item) => item.id === batchGenerateModelId)?.nome
      || '';
    if (!selectedServiceLabel) {
      toast.error('Selecione o servico para geracao em lote.');
      return;
    }
    const companies = Array.from(
      new Map(
        selectedTargetServicos.map((item) => [String(item.empresa_id || item.empresa_nome), item]),
      ).values(),
    );
    if (!companies.length) {
      toast.error('Selecione processos com as empresas alvo.');
      return;
    }
    const now = Date.now();
    const generated = companies.map((company, index) => ({
      id: `mock-batch-${now}-${index}`,
      numero: `SVC-BATCH-${String(now + index).slice(-6)}`,
      titulo: selectedServiceLabel,
      empresa_id: company.empresa_id || '',
      empresa_nome: company.empresa_nome || 'Sem empresa',
      tipo_servico: selectedServiceLabel,
      process_model_id: batchGenerateModelId || '',
      descricao: `Geracao em lote para ${company.empresa_nome || 'empresa'}.`,
      setor: sectorLabelMap[batchGenerateSectorKey] || 'Atendimento',
      cidade: company.cidade || '',
      urgencia: 'normal',
      status: 'pendente',
      status_ui: 'novo',
      prioridade: 'media',
      created_at: new Date(now + index * 1000).toISOString(),
      mock_origin: 'manual_admin',
      criado_por: { id: creatorId, nome: creatorName },
    }));
    setServicos((current) => [...generated, ...current]);
    localStorage.setItem(MOCK_INTERNAL_SERVICES_KEY, JSON.stringify([...generated, ...getMockInternalServices()]));
    setShowBatchGenerateModal(false);
    setBatchGenerateServiceName('');
    setBatchGenerateModelId('');
    toast.success(`${generated.length} processo(s) gerado(s) em lote.`);
  };

  const handleOpenCreate = () => {
    const initialCity = cityOptions[0] || '';
    setNewService({
      empresa_id: '',
      empresa_nome: '',
      tipo_servico: '',
      modelo_id: '',
      descricao: '',
      setor_key: 'atendimento',
      cidade: initialCity,
      urgencia: 'normal',
      data_inicio: '',
      canal_atendimento: 'interno',
      vincular_ordem_servico: false,
      gerar_cobranca: false,
    });
    setShowCustomServiceInput(false);
    setCustomServiceName('');
    setIncludeAdmins(false);
    setEnableAdditionalCollaborators(false);
    setServiceTypeSearchTerm('');
    setAssignedBySector({ atendimento: [creatorId] });
    setCreateMode('modelo');
    setShowCreateModal(true);
  };

  const handleServiceOptionChange = (optionKey) => {
    const selected = serviceTypeOptions.find((item) => item.key === optionKey);
    if (!selected) {
      setNewService((prev) => ({ ...prev, tipo_servico: '', modelo_id: '' }));
      return;
    }
    setNewService((prev) => ({
      ...prev,
      tipo_servico: selected.tipoServico,
      modelo_id: selected.modeloId || '',
    }));
  };

  const handleAddCustomService = () => {
    const trimmed = customServiceName.trim();
    if (!trimmed) return;
    setCustomServicesBySector((prev) => {
      const current = prev[newService.setor_key] || [];
      if (current.some((item) => normalizeText(item) === normalizeText(trimmed))) return prev;
      return {
        ...prev,
        [newService.setor_key]: [...current, trimmed],
      };
    });
    setNewService((prev) => ({ ...prev, tipo_servico: trimmed, modelo_id: '' }));
    setCustomServiceName('');
    setShowCustomServiceInput(false);
  };

  const handleCityChange = (city) => {
    setNewService((prev) => ({
      ...prev,
      cidade: city,
      empresa_id: '',
      empresa_nome: '',
    }));
  };

  const handleCompanyChange = (companyId) => {
    const company = companyOptionsByCity.find((item) => item.id === companyId);
    if (!company) {
      setNewService((prev) => ({ ...prev, empresa_id: '', empresa_nome: '' }));
      return;
    }
    setNewService((prev) => ({
      ...prev,
      empresa_id: company.id,
      empresa_nome: company.name,
    }));
  };

  const toggleCollaborator = (sectorKey, collaboratorId, checked) => {
    setAssignedBySector((prev) => {
      const currentList = prev[sectorKey] || [];
      const nextList = checked
        ? [...new Set([...currentList, collaboratorId])]
        : currentList.filter((id) => id !== collaboratorId);
      return {
        ...prev,
        [sectorKey]: nextList,
      };
    });
  };

  const handleOpenProcessBuilder = () => {
    setProcessDraft({
      nome: '',
      descricao: '',
      setorDestinoKey: newService.setor_key || 'atendimento',
      etapas: [
        { nome: 'Triagem inicial', setorResponsavelKey: 'atendimento', tarefasTexto: 'Registrar solicitacao\nValidar documentos obrigatorios' },
        { nome: 'Execucao tecnica', setorResponsavelKey: newService.setor_key || 'atendimento', tarefasTexto: 'Executar servico\nRevisar entrega final' },
      ],
    });
    setShowCreateModal(false);
    setShowProcessModal(true);
  };

  const updateProcessStep = (index, field, value) => {
    setProcessDraft((prev) => ({
      ...prev,
      etapas: prev.etapas.map((step, idx) => (idx === index ? { ...step, [field]: value } : step)),
    }));
  };

  const addProcessStep = () => {
    setProcessDraft((prev) => ({
      ...prev,
      etapas: [
        ...prev.etapas,
        { nome: '', setorResponsavelKey: prev.setorDestinoKey || 'atendimento', tarefasTexto: '' },
      ],
    }));
  };

  const removeProcessStep = (index) => {
    setProcessDraft((prev) => ({
      ...prev,
      etapas: prev.etapas.filter((_, idx) => idx !== index),
    }));
  };

  const handleSaveNewProcessModel = () => {
    const nome = processDraft.nome.trim();
    if (!nome) {
      toast.error('Informe o nome do processo.');
      return;
    }
    if (!processDraft.etapas.length) {
      toast.error('Adicione ao menos uma etapa.');
      return;
    }

    const etapas = processDraft.etapas
      .map((etapa, etapaIndex) => {
        const tarefas = String(etapa.tarefasTexto || '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((descricao, tarefaIndex) => ({
            id: createId('task'),
            descricao,
            ordem: tarefaIndex + 1,
            observacoes: '',
          }));

        return {
          id: createId('step'),
          nome: etapa.nome || `Etapa ${etapaIndex + 1}`,
          setorResponsavel: sectorLabelMap[etapa.setorResponsavelKey] || 'Atendimento',
          moduloResponsavel: sectorToModule[etapa.setorResponsavelKey] || 'atendimento',
          ordem: etapaIndex + 1,
          tarefas,
        };
      })
      .filter((etapa) => etapa.tarefas.length > 0);

    if (!etapas.length) {
      toast.error('Cada etapa precisa ter ao menos uma tarefa.');
      return;
    }

    const setorDestinoLabel = sectorLabelMap[processDraft.setorDestinoKey] || 'Atendimento';
    const novoModelo = createProcessModelFromDraft({
      nome,
      descricao: processDraft.descricao.trim() || `Modelo personalizado para ${nome.toLowerCase()}.`,
      setorDestino: setorDestinoLabel,
      steps: etapas.map((etapa) => ({
        nome: etapa.nome,
        setorResponsavel: etapa.setorResponsavel,
        tarefas: (etapa.tarefas || []).map((tarefa) => ({
          descricao: tarefa.descricao,
          observacoes: tarefa.observacoes || '',
        })),
      })),
      idPrefix: 'proc-model',
    });
    if (!novoModelo) {
      toast.error('Nao foi possivel criar o modelo.');
      return;
    }

    const nextModels = [novoModelo, ...processModels];
    const hydratedNextModels = hydrateProcessModels(nextModels);
    setProcessModels(hydratedNextModels);
    localStorage.setItem(MODELS_KEY, JSON.stringify(hydratedNextModels));

    setNewService((prev) => ({
      ...prev,
      setor_key: processDraft.setorDestinoKey,
      tipo_servico: novoModelo.nome,
      modelo_id: novoModelo.id,
    }));
    setShowProcessModal(false);
    toast.success('Novo processo salvo e selecionado como servico.');
  };

  const handleCreateService = () => {
    if (!newService.empresa_nome || !newService.tipo_servico || !newService.setor_key) return;

    const now = new Date();
    const item = {
      id: `mock-manual-${now.getTime()}`,
      numero: `SVC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getTime()).slice(-4)}`,
      titulo: newService.tipo_servico,
      empresa_id: newService.empresa_id || '',
      empresa_nome: newService.empresa_nome,
      tipo_servico: newService.tipo_servico,
      process_model_id: newService.modelo_id || '',
      descricao: newService.descricao || 'Servico criado manualmente pelo painel interno.',
      setor: sectorLabelMap[newService.setor_key] || 'Atendimento',
      cidade: newService.cidade || '',
      urgencia: newService.urgencia || 'normal',
      data_inicio: newService.data_inicio || now.toISOString(),
      canal_atendimento: newService.canal_atendimento || 'interno',
      vincular_ordem_servico: Boolean(newService.vincular_ordem_servico),
      gerar_cobranca: Boolean(newService.gerar_cobranca),
      setores_responsaveis: responsibleSectors,
      colaboradores_por_setor: assignedBySector,
      status: 'pendente',
      status_ui: 'novo',
      prioridade: 'media',
      created_at: now.toISOString(),
      mock_origin: 'manual_admin',
      criado_por: {
        id: creatorId,
        nome: creatorName,
      },
    };

    const current = getMockInternalServices();
    localStorage.setItem(MOCK_INTERNAL_SERVICES_KEY, JSON.stringify([item, ...current]));
    setServicos((prev) => [item, ...prev]);
    pushInternalNotification(`Novo serviço criado: ${item.titulo} (${item.empresa_nome}).`);
    setShowCreateModal(false);
  };

  return (
    <div className="services-dark space-y-4 p-4">
      <div className="glass border-x-0 border-t-0 border-b border-white/10 rounded-none px-2 pb-0 pt-2">
        <div className="mb-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setTopViewTab('dashboard')}
            className={`inline-flex items-center gap-2 border-b-2 px-2 py-1 text-sm font-semibold ${
              isDashboardTab ? 'border-red-500 text-white' : 'border-transparent text-gray-400'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setTopViewTab('processos')}
            className={`inline-flex items-center gap-2 border-b-2 px-2 py-1 text-sm font-semibold ${
              isProcessosTab ? 'border-red-500 text-white' : 'border-transparent text-gray-400'
            }`}
          >
            Processos
            
          </button>
          <button
            type="button"
            onClick={() => setTopViewTab('ordem_servico')}
            className={`inline-flex items-center gap-2 border-b-2 px-2 py-1 text-sm font-semibold ${
              isOrdemServicoTab ? 'border-red-500 text-white' : 'border-transparent text-gray-400'
            }`}
          >
            Ordem de servico
          </button>
          <button
            type="button"
            onClick={() => setTopViewTab('modelos')}
            className={`inline-flex items-center gap-2 border-b-2 px-2 py-1 text-sm font-semibold ${
              isModelosTab ? 'border-red-500 text-white' : 'border-transparent text-gray-400'
            }`}
          >
            Modelos
          </button>
          <button
            type="button"
            onClick={() => setTopViewTab('configuracoes')}
            className={`inline-flex items-center gap-2 border-b-2 px-2 py-1 text-sm font-semibold ${
              isConfiguracoesTab ? 'border-red-500 text-white' : 'border-transparent text-gray-400'
            }`}
          >
            Configuracoes
          </button>
        </div>

        {isProcessWorkspaceTab ? (
          <>
            <div className="mb-5 inline-flex rounded-lg border border-white/10 bg-[#2a3446] p-1">
              {[
                ['cliente', 'Cliente'],
                ['processo', 'Processo'],
                ['tarefa', 'Tarefa'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScopeTab(key)}
                  className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                    scopeTab === key ? 'bg-slate-100 text-slate-900' : 'text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        ) : isOrdemServicoTab ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-gray-200">
            Ordem de servico em preparacao.
          </div>
        ) : isModelosTab ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-gray-200">
            Area de Modelos carregada a partir do modulo Macedo Academy.
          </div>
        ) : isConfiguracoesTab ? (
          <ServicesSettingsPanel allUsers={allUsers} allClients={allClients} currentUser={user} />
        ) : null}
      </div>

      {isModelosTab ? (
        <div className="rounded-[24px] border border-white/10 bg-transparent p-0">
          <MacedoAcademy />
        </div>
      ) : null}

      {isDashboardTab ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-4xl font-semibold text-white">Bem-vindo de volta, Sara Macedo</h2>
              <p className="mt-1 text-sm text-gray-400">Confira abaixo um panorama da sua performance e da sua equipe.</p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <div className="mb-1 text-xs text-gray-400">Selecione o periodo</div>
                <select className="rounded-lg border border-white/20 bg-[#0f1728] px-3 py-2 text-sm text-white outline-none">
                  <option>dezembro 2025</option>
                  <option>novembro 2025</option>
                  <option>outubro 2025</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  loadServicos();
                  toast.success('Dados atualizados com sucesso.');
                }}
                className="rounded-lg border border-white/20 bg-[#0f1728] px-3 py-2 text-gray-300"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-[#0f1728] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-white">Performance geral</h3>
                  <p className="mt-1 text-sm text-gray-400">Acompanhe o resumo dos processos e tarefas no periodo selecionado.</p>
                </div>
                <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200">
                  0 processo(s) dispensado(s)
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="flex items-center gap-4">
                  <div className="relative h-40 w-40 rounded-full border-[14px] border-slate-400">
                    <div className="absolute inset-[28px] rounded-full bg-[#0f1728]" />
                  </div>
                  <div>
                    <div className="text-3xl font-semibold text-white">Processos concluidos</div>
                    <div className="mt-2 text-5xl font-bold text-emerald-400">{resumo.concluidos}</div>
                    <div className="text-lg text-gray-400">de {resumo.total}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-2 text-sm font-semibold text-gray-300">Situacao das tarefas</div>
                    <div className="grid grid-cols-3 gap-2">
                      <MiniCard title="A fazer" value={resumo.novo} tone="border-white/20 bg-white/5 text-white" />
                      <MiniCard title="Em Progresso" value={resumo.emAndamento} tone="border-cyan-500/40 bg-cyan-500/10 text-cyan-100" />
                      <MiniCard title="Concluidas" value={resumo.concluidos} tone="border-emerald-500/40 bg-emerald-500/10 text-emerald-100" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-semibold text-gray-300">Requer atencao</div>
                    <div className="grid grid-cols-3 gap-2">
                      <MiniCard title="Em atraso" value={Math.max(0, resumo.total - resumo.concluidos)} tone="border-amber-500/40 bg-amber-500/10 text-amber-100" />
                      <MiniCard title="Proximo da multa" value={0} tone="border-orange-500/40 bg-orange-500/10 text-orange-100" />
                      <MiniCard title="Em multa" value={0} tone="border-rose-500/40 bg-rose-500/10 text-rose-100" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f1728] p-5">
              <h3 className="text-4xl font-semibold text-white">Nivel de desempenho geral</h3>
              <div className="mt-5 flex justify-center">
                <div className="relative h-44 w-80">
                  <div className="absolute inset-x-8 top-0 h-40 rounded-t-full border-[10px] border-b-0 border-slate-100/90" />
                  <div className="absolute inset-x-0 top-16 text-center text-6xl font-bold text-rose-500">0%</div>
                  <div className="absolute inset-x-0 top-44 border-t border-slate-300/30" />
                </div>
              </div>
              <p className="mt-2 text-center text-xl text-gray-200">
                Faltam <span className="font-semibold text-rose-400">{Math.max(0, resumo.total - resumo.concluidos)} processos</span> para avancar de nivel.
                Priorize os mais urgentes e comece agora!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-[#0f1728] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-semibold text-white">Performance da equipe</h3>
                  <p className="mt-1 text-sm text-gray-400">Clique em um colaborador para ver seus processos.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300">dezembro 2025</div>
              </div>

              <div className="mb-3 inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setTeamPerformanceScope('equipe')}
                  className={`rounded-md px-3 py-1 font-semibold ${teamPerformanceScope === 'equipe' ? 'bg-white text-slate-900' : 'text-gray-300'}`}
                >
                  Equipe
                </button>
                <button
                  type="button"
                  onClick={() => setTeamPerformanceScope('departamento')}
                  className={`rounded-md px-3 py-1 font-semibold ${teamPerformanceScope === 'departamento' ? 'bg-white text-slate-900' : 'text-gray-300'}`}
                >
                  Departamento
                </button>
              </div>

              <div className="overflow-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[980px]">
                  <thead className="bg-white/10 text-xs text-gray-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Colaborador</th>
                      <th className="px-3 py-2 text-left">Departamentos</th>
                      <th className="px-3 py-2 text-left">Situacao das tarefas</th>
                      <th className="px-3 py-2 text-left">Desempenho</th>
                      <th className="px-3 py-2 text-left">Relatorio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-sm">
                    {[
                      { nome: 'Galileu', departamentos: ['P'], pendente: 1, progresso: 0, concluidas: 2, desempenho: 67 },
                      { nome: 'Sara Macedo', departamentos: ['F', 'A', 'C', 'P'], pendente: 215, progresso: 0, concluidas: 0, desempenho: 0 },
                    ].map((row) => (
                      <tr key={row.nome} className="hover:bg-white/5">
                        <td className="px-3 py-3 text-white">{row.nome}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            {row.departamentos.map((dep) => (
                              <span
                                key={dep}
                                className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-semibold text-white ${
                                  dep === 'F'
                                    ? 'bg-lime-500'
                                    : dep === 'A'
                                      ? 'bg-rose-500'
                                      : dep === 'C'
                                        ? 'bg-amber-500'
                                        : dep === 'P'
                                          ? 'bg-yellow-500'
                                          : 'bg-white/15'
                                }`}
                              >
                                {dep}
                              </span>
                            ))}
                            {row.departamentos.length > 3 ? <span className="px-1 text-gray-400">...</span> : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2 text-xs">
                            <span className="min-w-[74px] rounded-md border border-white/10 bg-white/5 px-2 py-1 text-center text-white">{row.pendente}</span>
                            <span className="min-w-[74px] rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-center text-cyan-100">{row.progresso}</span>
                            <span className="min-w-[74px] rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-center text-emerald-100">{row.concluidas}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="h-3 w-32 overflow-hidden rounded bg-slate-700">
                            <div className="h-full bg-emerald-400" style={{ width: `${row.desempenho}%` }} />
                          </div>
                          <div className="mt-1 text-xs font-semibold text-emerald-300">{row.desempenho}%</div>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => toast.info(`Abrindo relatorio de ${row.nome}.`)}
                            className="rounded-lg border border-slate-200/20 bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-900"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#0f1728] p-5">
                <h3 className="text-3xl font-semibold text-white">Envio em lote</h3>
                <p className="text-sm text-gray-400">Confira a quantidade de processos na fila.</p>
                <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-2xl font-semibold text-white">0 na fila de envio</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0f1728] p-5">
                <h3 className="text-3xl font-semibold text-white">Ordem de servico</h3>
                <p className="text-sm text-gray-400">Acompanhe o resumo das solicitacoes de servico.</p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-gray-200">A fazer: {resumo.novo}</div>
                  <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-cyan-100">Em Progresso: {resumo.emAndamento}</div>
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-100">Concluidas: {resumo.concluidos}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`${isProcessWorkspaceTab && processViewMode === 'tabela' ? '' : 'hidden'}`}>
        <div className="mb-2 text-sm text-gray-300">Processos</div>
        <div className="mb-3 text-[38px] font-semibold leading-none text-white">Situação dos Processos</div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[286px_minmax(0,1fr)_164px]">
          <div ref={responsibleDropdownRef} className="rounded-[8px] border border-white/20 bg-[#111a2b] p-3">
            <div className="flex h-[88px] items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-slate-500/35 text-slate-100">
                <Users className="h-6 w-6" />
              </span>
              <div className="flex-1 text-[34px] font-semibold leading-none text-white">Todos</div>
              <button
                type="button"
                onClick={() => setShowResponsibleSelector((prev) => !prev)}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-gray-200"
              >
                Alterar
              </button>
            </div>
            <div className={`mt-2 ${showResponsibleSelector ? '' : 'hidden'}`}>
              <label className="mb-1 block text-xs text-gray-300">Selecione o responsável</label>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-white/20 bg-[#101827]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedResponsavel('all');
                    setShowResponsibleSelector(false);
                  }}
                  className="w-full border-b border-white/10 px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                >
                  Todos
                </button>
                {responsavelOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSelectedResponsavel(option.value);
                      setShowResponsibleSelector(false);
                    }}
                    className="w-full border-b border-white/10 px-3 py-2 text-left text-sm text-white last:border-b-0 hover:bg-white/10"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-end">
              <div className="rounded-lg border border-white/20 bg-[#303a4e] px-4 py-2 text-sm text-gray-300">
                Serão exibidos apenas os processos nos quais você é o gestor do departamento.
              </div>
            </div>
            <div className="flex h-[94px] overflow-hidden rounded-[8px] border border-white/15 bg-[#202939]">
              <div className="flex min-w-0 flex-1 items-center gap-3 border-r border-white/10 px-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-slate-200"><ClipboardList className="h-5 w-5" /></span>
                  <div><div className="text-xs text-gray-300">Total</div><div className="text-[34px] font-semibold leading-none text-white">{resumo.total}</div></div>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 border-r border-white/10 px-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300"><AlertTriangle className="h-5 w-5" /></span>
                  <div><div className="text-xs text-gray-300">Em multa</div><div className="text-[34px] font-semibold leading-none text-white">0</div></div>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 border-r border-white/10 px-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-slate-200"><ClipboardList className="h-5 w-5" /></span>
                  <div><div className="text-xs text-gray-300">A fazer</div><div className="text-[34px] font-semibold leading-none text-white">{resumo.novo}</div></div>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 border-r border-white/10 px-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300"><RotateCcw className="h-5 w-5" /></span>
                  <div><div className="text-xs text-gray-300">Em Progresso</div><div className="text-[34px] font-semibold leading-none text-white">{resumo.emAndamento}</div></div>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 border-r border-white/10 px-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300"><Check className="h-5 w-5" /></span>
                  <div><div className="text-xs text-gray-300">Concluído</div><div className="text-[34px] font-semibold leading-none text-white">{resumo.concluidos}</div></div>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300"><MinusCircle className="h-5 w-5" /></span>
                  <div><div className="text-xs text-gray-300">Dispensada</div><div className="text-[34px] font-semibold leading-none text-white">0</div></div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[40px] font-semibold leading-none text-white">Ações</div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleOpenCreate}
                className="w-full rounded-lg border border-emerald-500/45 bg-emerald-500/80 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                + Criar processo
              </button>
              <button
                type="button"
                onClick={() => setShowBatchEditModal(true)}
                className="w-full rounded-lg border border-white/20 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
              >
                Edição em lote
              </button>
              <button
                type="button"
                onClick={() => setShowBatchSendModal(true)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
              >
                Envio em lote
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-[10px] border border-white/10 bg-[#101827] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-gray-400">
              Selecionados: <span className="font-semibold text-white">{selectedServiceIds.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleAllVisibleSelection(true)}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
              >
                Selecionar visíveis
              </button>
              <button
                type="button"
                onClick={() => toggleAllVisibleSelection(false)}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
              >
                Limpar seleção
              </button>
              <button
                type="button"
                onClick={handleDuplicateSelected}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicar
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
              <button
                type="button"
                onClick={() => setShowBatchGenerateModal(true)}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
              >
                Geração em lote
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_1.4fr_220px_220px_220px_220px]">
            <div>
              <label className="mb-1 block text-xs text-gray-300">Exibir por prazo</label>
              <select
                value={selectedPeriodo}
                onChange={(e) => setSelectedPeriodo(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
              >
                <option value="all">Todos os meses</option>
                {periodoOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-300">Buscar</label>
              {scopeTab === 'tarefa' ? (
                <div ref={clientDropdownRef} className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    placeholder="Busque por cliente ou tarefa..."
                    className="w-full rounded-lg border border-white/15 bg-zinc-900 py-2 pl-9 pr-10 text-sm text-white outline-none placeholder:text-gray-500 focus:border-emerald-400/40"
                  />
                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setClientDropdownOpen((prev) => !prev)}
                    className="inline-flex w-full items-center justify-between rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                  >
                    <span className="truncate">{selectedClienteLabel}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${clientDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {clientDropdownOpen ? (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
                      <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                        <Search className="h-4 w-4 text-gray-500" />
                        <input
                          value={clientSearchTerm}
                          onChange={(e) => setClientSearchTerm(e.target.value)}
                          placeholder="Digite para buscar cliente"
                          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftFilters((prev) => ({ ...prev, cliente: '' }));
                          setClientDropdownOpen(false);
                        }}
                        className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-300 hover:bg-white/10"
                      >
                        Todos os clientes
                      </button>
                      <div className="max-h-52 overflow-y-auto">
                        {rankedClienteOptions.map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              setDraftFilters((prev) => ({ ...prev, cliente: item.value }));
                              setClientDropdownOpen(false);
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-white hover:bg-white/10"
                          >
                            {item.label}
                          </button>
                        ))}
                        {rankedClienteOptions.length === 0 ? (
                          <p className="px-2 py-3 text-xs text-gray-500">Nenhum cliente encontrado para essa busca.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-300">Data</label>
              <div className="relative">
                <input
                  type="date"
                  value={quickSearchDate}
                  onChange={(e) => setQuickSearchDate(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 pr-9 text-sm text-white outline-none focus:border-emerald-400/40"
                />
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-300">Prazo do processo</label>
              <select
                value={selectedPrazo}
                onChange={(e) => setSelectedPrazo(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
              >
                <option value="all">Todos</option>
                <option value="late">Atrasados</option>
                <option value="on_time">No prazo</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-300">Status</label>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
              >
                <option value="all">Todos</option>
                {statusOptions.map((status) => (
                  <option key={`status-filter-${status.value}`} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-300">Urgência</label>
              <select
                value={selectedUrgencyFilter}
                onChange={(e) => setSelectedUrgencyFilter(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
              >
                <option value="all">Todas</option>
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-300">Departamento</label>
              <select
                value={draftFilters.setor}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, setor: e.target.value }))}
                className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
              >
                <option value="">Todos</option>
                {setorFilterOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className={`glass rounded-[24px] border border-white/10 overflow-hidden ${isProcessWorkspaceTab && processViewMode === 'tabela' ? '' : 'hidden'}`}>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando servicos...</div>
        ) : visibleServicos.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {accessDeniedBySector ? 'Você não tem acesso a esse setor.' : 'Nenhum servico encontrado.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${scopeTab === 'tarefa' ? 'min-w-[1380px]' : 'min-w-[860px]'}`}>
              <thead className="bg-white/10">
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={visibleServicos.length > 0 && selectedServiceIds.length === visibleServicos.length}
                      onChange={(e) => toggleAllVisibleSelection(e.target.checked)}
                    />
                  </th>
                  {scopeTab === 'cliente' ? (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Processos</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Situação</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Prazo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Prazo-meta</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Departamentos</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Responsáveis</th>
                    </>
                  ) : null}
                  {scopeTab === 'processo' ? (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Processos</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Nº de clientes</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Nº de processos</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Departamentos</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Responsaveis</th>
                    </>
                  ) : null}
                  {scopeTab === 'tarefa' ? (
                    <>
                      <th className="px-4 py-3 text-left text-base font-semibold text-white">Tarefas</th>
                      <th className="px-4 py-3 text-left text-base font-semibold text-white">Situação</th>
                      <th className="px-4 py-3 text-left text-base font-semibold text-white">Cliente</th>
                      <th className="px-4 py-3 text-left text-base font-semibold text-white">Nome Processo</th>
                      <th className="px-4 py-3 text-left text-base font-semibold text-white">Prazo Processo</th>
                      <th className="px-4 py-3 text-left text-base font-semibold text-white">Departamento</th>
                      <th className="px-4 py-3 text-left text-base font-semibold text-white">Responsável</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {scopeTab === 'cliente'
                  ? groupedByClient.map(([clientName, clientItems]) => (
                    <React.Fragment key={clientName}>
                      <tr className="bg-white/10">
                        <td colSpan={7} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                          {clientName}
                        </td>
                      </tr>
                      {clientItems.map((servico) => {
                        const statusMeta = getStatusMeta(servico.status_ui);
                        const deptKey = normalizeSectorKey(servico.setor || '');
                        const deptBadge =
                          deptKey === 'financeiro' ? 'F' :
                          deptKey === 'atendimento' ? 'A' :
                          deptKey === 'comercial' ? 'C' :
                          deptKey === 'trabalhista' ? 'T' :
                          deptKey === 'fiscal' ? 'P' : 'P';
                        const deptClass =
                          deptBadge === 'F' ? 'bg-green-600' :
                          deptBadge === 'A' ? 'bg-red-500' :
                          deptBadge === 'C' ? 'bg-amber-500' :
                          deptBadge === 'T' ? 'bg-blue-500' : 'bg-yellow-500';
                        return (
                          <tr key={servico.id} className="hover:bg-white/5">
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={selectedServiceIds.includes(String(servico.id))}
                                onChange={(e) => toggleServiceSelection(servico.id, e.target.checked)}
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-white">
                              <button
                                type="button"
                                onClick={() => setSelectedProcessService(servico)}
                                className="inline-flex items-center gap-2 text-left hover:text-blue-100"
                              >
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                <span>{servico.tipo_servico || servico.titulo || '-'}</span>
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={servico.status_ui}
                                onChange={(e) => handleStatusChange(servico.id, e.target.value)}
                                className={`rounded-md px-2.5 py-1 text-xs font-semibold outline-none ${statusMeta.className}`}
                              >
                                {statusOptions.map((status) => (
                                  <option key={status.value} value={status.value}>
                                    {status.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-sm text-blue-200">{formatDate(servico.data_prazo || servico.created_at)}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">-</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-semibold text-white ${deptClass}`}>
                                {deptBadge}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <button
                                type="button"
                                onClick={() => setSelectedServico(servico)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-900"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                  : null}

                {scopeTab === 'processo'
                  ? groupedByProcess.map((row) => (
                    <React.Fragment key={row.name}>
                      <tr className="hover:bg-white/5">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={row.items.every((item) => selectedServiceIds.includes(String(item.id)))}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              row.items.forEach((item) => toggleServiceSelection(item.id, checked));
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-white">
                          <button
                            type="button"
                            onClick={() => setExpandedProcessRows((prev) => ({ ...prev, [row.name]: !prev[row.name] }))}
                            className="inline-flex items-center gap-2 text-left"
                          >
                            <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expandedProcessRows[row.name] ? 'rotate-90' : ''}`} />
                            <span>{row.name}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{row.clients} clientes</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{row.total} processos</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{row.setor}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{row.items.filter((item) => getServiceResponsibleName(item) !== 'Nao atribuido').length || '-'}</td>
                      </tr>
                      {expandedProcessRows[row.name]
                        ? row.items.map((servico) => {
                          const statusMeta = getStatusMeta(servico.status_ui);
                          const deptKey = normalizeSectorKey(servico.setor || '');
                          const deptBadge =
                            deptKey === 'financeiro' ? 'F' :
                            deptKey === 'atendimento' ? 'A' :
                            deptKey === 'comercial' ? 'C' :
                            deptKey === 'trabalhista' ? 'T' :
                            deptKey === 'fiscal' ? 'P' : '-';
                          const deptClass =
                            deptBadge === 'F' ? 'bg-green-600' :
                            deptBadge === 'A' ? 'bg-red-500' :
                            deptBadge === 'C' ? 'bg-amber-500' :
                            deptBadge === 'T' ? 'bg-blue-500' :
                            deptBadge === 'P' ? 'bg-yellow-500' : 'bg-slate-600';
                          return (
                            <tr key={`${row.name}-${servico.id}`} className="bg-white/[0.02] hover:bg-white/5">
                              <td className="px-3 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedServiceIds.includes(String(servico.id))}
                                  onChange={(e) => toggleServiceSelection(servico.id, e.target.checked)}
                                />
                              </td>
                              <td className="px-10 py-3 text-sm text-white">
                                <button
                                  type="button"
                                  onClick={() => setSelectedProcessService(servico)}
                                  className="max-w-[360px] truncate text-left text-blue-100 hover:text-white"
                                >
                                  {servico.empresa_nome || 'Sem cliente'}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={servico.status_ui}
                                  onChange={(e) => handleStatusChange(servico.id, e.target.value)}
                                  className={`rounded-md px-2.5 py-1 text-xs font-semibold outline-none ${statusMeta.className}`}
                                >
                                  {statusOptions.map((status) => (
                                    <option key={status.value} value={status.value}>
                                      {status.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3 text-sm text-blue-200">{formatDate(servico.data_prazo || servico.created_at)}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-semibold text-white ${deptClass}`}>
                                  {deptBadge}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-200">{getServiceResponsibleName(servico)}</td>
                            </tr>
                          );
                        })
                        : null}
                    </React.Fragment>
                  ))
                  : null}

                {scopeTab === 'tarefa'
                  ? taskRows.map((row) => (
                    <tr key={row.key} className="hover:bg-white/5">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedServiceIds.includes(String(row.sourceId))}
                          onChange={(e) => toggleServiceSelection(row.sourceId, e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">
                        <button
                          type="button"
                          onClick={() => {
                            const target = visibleServicos.find((item) => item.id === row.sourceId);
                            if (target) setSelectedProcessService(target);
                          }}
                          className="max-w-[420px] truncate text-left hover:text-blue-100"
                        >
                          {row.tarefa}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.statusUi}
                          onChange={(e) => handleStatusChange(row.sourceId, e.target.value)}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold outline-none ${getStatusMeta(row.statusUi).className}`}
                        >
                          {statusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-200">
                        <div className="max-w-[340px] truncate">{row.cliente}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-200">
                        <div className="max-w-[320px] truncate">{row.processo}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-200">{row.prazo}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-semibold text-white ${row.deptClass}`}>
                          {row.deptBadge}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            const target = visibleServicos.find((item) => item.id === row.sourceId);
                            if (target) setSelectedProcessService(target);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-900"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                  : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showBatchEditModal ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-zinc-900 p-5">
            <h3 className="text-lg font-semibold text-white">Edição em lote</h3>
            <p className="mt-1 text-sm text-gray-400">
              Processos alvo: {(selectedTargetServicos.length || filteredServicos.length)}
            </p>
            <div className="mt-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-gray-400">Novo status</label>
              <select
                value={batchStatus}
                onChange={(e) => setBatchStatus(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBatchEditModal(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => applyBatchStatus(batchStatus)}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBatchSendModal ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-zinc-900 p-5">
            <h3 className="text-lg font-semibold text-white">Envio em lote</h3>
            <p className="mt-1 text-sm text-gray-400">
              {(selectedTargetServicos.length || filteredServicos.length)} processos serao enviados para fila de processamento.
            </p>
            <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2">
              {(selectedTargetServicos.length ? selectedTargetServicos : filteredServicos).slice(0, 20).map((item) => (
                <div key={`send-${item.id}`} className="rounded-lg px-2 py-1.5 text-sm text-gray-200">
                  {item.empresa_nome} - {item.tipo_servico || item.titulo}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBatchSendModal(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBatchSend}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100"
              >
                Confirmar envio
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBatchGenerateModal ? (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-zinc-900 p-5">
            <h3 className="text-lg font-semibold text-white">Geracao em lote</h3>
            <p className="mt-1 text-sm text-gray-400">
              Selecione o servico e gere para as empresas marcadas.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-300">Modelo de servico (opcional)</label>
                <select
                  value={batchGenerateModelId}
                  onChange={(e) => setBatchGenerateModelId(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="">Selecionar manualmente</option>
                  {processModels.map((item) => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-300">Nome do servico</label>
                <input
                  value={batchGenerateServiceName}
                  onChange={(e) => setBatchGenerateServiceName(e.target.value)}
                  placeholder="Ex.: Cobranca de honorarios"
                  className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-300">Setor</label>
                <select
                  value={batchGenerateSectorKey}
                  onChange={(e) => setBatchGenerateSectorKey(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                >
                  {Object.entries(sectorLabelMap).map(([key, label]) => (
                    <option key={`batch-sector-${key}`} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
                Empresas selecionadas: <span className="font-semibold text-white">{selectedTargetServicos.length}</span>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBatchGenerateModal(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerateBatch}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100"
              >
                Gerar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedServico ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-white">
                <ClipboardList className="h-5 w-5" />
                Detalhes do servico
              </h2>
              <button
                type="button"
                onClick={() => setSelectedServico(null)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailItem label="Cliente" value={selectedServico.empresa_nome || '-'} />
              <DetailItem label="Tipo do servico" value={selectedServico.tipo_servico || '-'} />
              <DetailItem label="Data de criacao" value={formatDate(selectedServico.created_at || selectedServico.data_criacao)} />
              <DetailItem label="Status" value={getStatusMeta(selectedServico.status_ui).label} />
              <DetailItem label="Setor" value={selectedServico.setor || '-'} />
              <DetailItem label="Cidade" value={selectedServico.cidade || '-'} />
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">Descricao</div>
              <div className="mt-2 text-sm text-gray-200">{selectedServico.descricao || selectedServico.titulo || '-'}</div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedProcessService ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-[1400px] rounded-2xl border border-white/15 bg-zinc-900">
            <div className="grid grid-cols-1 xl:grid-cols-[2.2fr_0.9fr]">
              <div className="max-h-[86vh] overflow-y-auto border-r border-white/10 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-3xl font-semibold text-white">{selectedProcessService.tipo_servico || selectedProcessService.titulo || 'Processo'}</h2>
                  <button
                    type="button"
                    onClick={() => setSelectedProcessService(null)}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/10"
                  >
                    Fechar
                  </button>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-200">
                  {selectedProcessService.empresa_nome || 'Sem cliente'}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <DetailItem label="Situacao" value={getStatusMeta(selectedProcessService.status_ui).label} />
                  <DetailItem label="Departamento" value={selectedProcessService.setor || 'Nao atribuido'} />
                  <DetailItem label="Responsavel" value={getServiceResponsibleName(selectedProcessService)} />
                  <DetailItem label="Prazo" value={formatDate(selectedProcessService.data_prazo || selectedProcessService.created_at)} />
                  <DetailItem label="Prazo-meta" value="Sem prazo" />
                  <DetailItem label="Competencia" value="abril de 2026" />
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 text-sm font-semibold text-white">Descricao</div>
                  <p className="text-sm text-gray-300">{selectedProcessService.descricao || 'Sem descricao cadastrada.'}</p>
                </div>

                <div className="mt-4 border-b border-white/10">
                  <div className="inline-flex items-center gap-8 text-sm">
                    <span className="border-b-2 border-emerald-400 pb-2 font-semibold text-white">Anexos</span>
                    <span className="pb-2 text-gray-400">ConnectHub</span>
                    <span className="pb-2 text-gray-400">Comentarios</span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 text-lg font-semibold text-white">Tarefas com anexos</div>
                  <div className="rounded-xl border border-white/10 bg-[#111a2b] p-4 text-gray-300">
                    Arraste e solte o arquivo aqui
                  </div>
                </div>
              </div>

              <aside className="max-h-[86vh] overflow-y-auto p-5">
                <div className="mb-3 border-b border-white/10 pb-2 text-sm font-semibold text-white">Tarefas do processo</div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 text-sm font-semibold text-white">{selectedProcessService.tipo_servico || 'Tarefa padrão'}</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedProcessService.status_ui}
                      onChange={(e) => {
                        handleStatusChange(selectedProcessService.id, e.target.value);
                        setSelectedProcessService((prev) => ({ ...prev, status_ui: e.target.value }));
                      }}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold outline-none ${getStatusMeta(selectedProcessService.status_ui).className}`}
                    >
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <span className="rounded bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                      {normalizeSectorKey(selectedProcessService.setor || '') === 'financeiro' ? 'F' : 'A'}
                    </span>
                    <span className="text-xs text-gray-300">{formatDate(selectedProcessService.data_prazo || selectedProcessService.created_at)}</span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}

      {showProcessModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Novo processo (base do servico)</h2>
              <button
                type="button"
                onClick={() => setShowProcessModal(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-200"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField label="Nome do processo">
                <input
                  value={processDraft.nome}
                  onChange={(e) => setProcessDraft((prev) => ({ ...prev, nome: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                  placeholder="Ex.: Simulacao de ferias"
                />
              </FormField>
              <FormField label="Setor destino principal">
                <select
                  value={processDraft.setorDestinoKey}
                  onChange={(e) => setProcessDraft((prev) => ({ ...prev, setorDestinoKey: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                >
                  {Object.entries(sectorLabelMap).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </FormField>
              <div className="md:col-span-2">
                <FormField label="Descricao">
                  <textarea
                    value={processDraft.descricao}
                    onChange={(e) => setProcessDraft((prev) => ({ ...prev, descricao: e.target.value }))}
                    className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                    rows={2}
                    placeholder="Descreva o objetivo desse processo"
                  />
                </FormField>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Etapas do processo</p>
                <button
                  type="button"
                  onClick={addProcessStep}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-200"
                >
                  Adicionar etapa
                </button>
              </div>

              {processDraft.etapas.map((etapa, index) => (
                <div key={`etapa-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Etapa {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeProcessStep(index)}
                      className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input
                      value={etapa.nome}
                      onChange={(e) => updateProcessStep(index, 'nome', e.target.value)}
                      placeholder="Nome da etapa"
                      className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                    />
                    <select
                      value={etapa.setorResponsavelKey}
                      onChange={(e) => updateProcessStep(index, 'setorResponsavelKey', e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                    >
                      {Object.entries(sectorLabelMap).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <div className="md:col-span-2">
                      <textarea
                        value={etapa.tarefasTexto}
                        onChange={(e) => updateProcessStep(index, 'tarefasTexto', e.target.value)}
                        placeholder="Uma tarefa por linha"
                        rows={3}
                        className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveNewProcessModel}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25"
              >
                <Plus className="h-4 w-4" />
                Salvar processo e usar no servico
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Novo processo</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-200">Fechar</button>
            </div>

            <div className="mb-4 inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
              <button
                type="button"
                onClick={() => setCreateMode('modelo')}
                className={`rounded-md px-3 py-1.5 font-semibold ${createMode === 'modelo' ? 'bg-white text-slate-900' : 'text-gray-300'}`}
              >
                Criar com modelo
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('manual')}
                className={`rounded-md px-3 py-1.5 font-semibold ${createMode === 'manual' ? 'bg-white text-slate-900' : 'text-gray-300'}`}
              >
                Criar manualmente
              </button>
            </div>

            {createMode === 'modelo' ? (
            <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">Novo processo (base do servico)</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Cadastre um novo processo antes de preencher o formulario. Ele fica selecionado automaticamente no servico.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenProcessBuilder}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25"
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar novo processo
                </button>
              </div>
              {newService.modelo_id ? (
                <p className="mt-2 text-xs text-emerald-200">
                  Processo selecionado: {processModels.find((item) => item.id === newService.modelo_id)?.nome || newService.tipo_servico}
                </p>
              ) : null}
            </div>
            ) : (
              <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-medium text-white">Cadastro manual de processo</p>
                <p className="mt-1 text-xs text-gray-400">
                  O formulario manual abre em tela completa com detalhes e tarefas.
                </p>
                <button
                  type="button"
                  onClick={handleOpenProcessBuilder}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25"
                >
                  <Plus className="h-4 w-4" />
                  Abrir formulario manual
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField label="Setor (primeiro passo)">
                <select
                  value={newService.setor_key}
                  onChange={(e) =>
                    setNewService((prev) => ({
                      ...prev,
                      setor_key: e.target.value,
                      tipo_servico: '',
                      modelo_id: '',
                    }))
                  }
                  className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                >
                  {sectorOptions.map((sector) => (
                    <option key={sector.key} value={sector.key}>
                      {sector.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Selecione ou cadastre o servico">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-zinc-900 px-3 py-2">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                      value={serviceTypeSearchTerm}
                      onChange={(e) => setServiceTypeSearchTerm(e.target.value)}
                      placeholder="Buscar servico"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={
                        serviceTypeOptions.find((option) => option.tipoServico === newService.tipo_servico && option.modeloId === (newService.modelo_id || ''))
                          ?.key || ''
                      }
                      onChange={(e) => handleServiceOptionChange(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                    >
                      <option value="">Selecione um servico</option>
                      {filteredServiceTypeOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleOpenProcessBuilder}
                      className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                      title="Cadastrar novo processo"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setServiceTypeSearchTerm('')}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
                  >
                    Limpar busca
                  </button>
                </div>
                {showCustomServiceInput ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={customServiceName}
                      onChange={(e) => setCustomServiceName(e.target.value)}
                      placeholder="Digite o nome do novo servico"
                      className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomService}
                      className="rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25"
                    >
                      Salvar
                    </button>
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-gray-400">
                  Se o servico nao existir, clique no "+" para cadastrar um novo processo e ele sera selecionado automaticamente.
                </p>
              </FormField>

              <FormField label="Base do cliente (cidade)">
                <select
                  value={newService.cidade}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                >
                  <option value="">Selecione a base</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Cliente da base selecionada">
                <select
                  value={newService.empresa_id}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                  disabled={!newService.cidade}
                >
                  <option value="">{newService.cidade ? 'Selecione a empresa' : 'Selecione a cidade primeiro'}</option>
                  {companyOptionsByCity.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Urgencia">
                <select
                  value={newService.urgencia}
                  onChange={(e) => setNewService((prev) => ({ ...prev, urgencia: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                >
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </FormField>

              <FormField label="Data de inicio">
                <input
                  type="date"
                  value={newService.data_inicio}
                  onChange={(e) => setNewService((prev) => ({ ...prev, data_inicio: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                />
              </FormField>

              <FormField label="Canal de atendimento">
                <select
                  value={newService.canal_atendimento}
                  onChange={(e) => setNewService((prev) => ({ ...prev, canal_atendimento: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                >
                  <option value="interno">Interno</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="presencial">Presencial</option>
                </select>
              </FormField>

              <FormField label="Descricao">
                <textarea
                  value={newService.descricao}
                  onChange={(e) => setNewService((prev) => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descricao opcional do servico"
                  rows={3}
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                />
              </FormField>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={Boolean(newService.vincular_ordem_servico)}
                  onChange={(e) => setNewService((prev) => ({ ...prev, vincular_ordem_servico: e.target.checked }))}
                />
                Vincular a ordem de servico
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={Boolean(newService.gerar_cobranca)}
                  onChange={(e) => setNewService((prev) => ({ ...prev, gerar_cobranca: e.target.checked }))}
                />
                Gerar cobranca
              </label>
            </div>

            {showCollaboratorSection ? (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">Setores responsaveis por essa tarefa</p>
                <p className="mt-1 text-xs text-gray-400">
                  O criador entra automaticamente primeiro no setor principal. Voce pode adicionar outros colaboradores por setor.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={enableAdditionalCollaborators}
                      onChange={(e) => setEnableAdditionalCollaborators(e.target.checked)}
                    />
                    Adicionar outros colaboradores a essa tarefa
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={includeAdmins}
                      onChange={(e) => setIncludeAdmins(e.target.checked)}
                    />
                    Incluir administradores
                  </label>
                </div>

                <div className="mt-3 space-y-3">
                  {responsibleSectors.map((sectorKey) => {
                    const options = getCollaboratorOptionsBySector(sectorKey);
                    const selectedIds = assignedBySector[sectorKey] || [];
                    return (
                      <div key={sectorKey} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <p className="text-sm font-medium text-white">{sectorLabelMap[sectorKey] || sectorKey}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          Colaborador criador: {creatorName}
                        </p>

                        {enableAdditionalCollaborators ? (
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {options.map((collaborator) => (
                              <label key={`${sectorKey}-${collaborator.id}`} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-gray-200">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(collaborator.id)}
                                  onChange={(e) => toggleCollaborator(sectorKey, collaborator.id, e.target.checked)}
                                />
                                <span>{collaborator.name}</span>
                                <span className="text-[10px] uppercase text-gray-500">{collaborator.role}</span>
                              </label>
                            ))}
                            {options.length === 0 ? (
                              <p className="text-xs text-gray-400">Nenhum colaborador vinculado a este setor.</p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-gray-300">Somente o colaborador criador sera vinculado nesta etapa por enquanto.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button type="button" onClick={handleCreateService} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25">
                <Plus className="h-4 w-4" />
                Salvar processo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const MiniCard = ({ title, value, tone }) => (
  <div className={`rounded-2xl border p-4 ${tone}`}>
    <div className="text-xs uppercase tracking-wide opacity-80">{title}</div>
    <div className="mt-3 text-2xl font-semibold">{value}</div>
  </div>
);

const DetailItem = ({ label, value }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
    <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
    <div className="mt-2 text-sm text-white">{value}</div>
  </div>
);

const FormField = ({ label, children }) => (
  <div>
    <label className="mb-2 block text-xs uppercase tracking-wide text-gray-400">{label}</label>
    {children}
  </div>
);

export default Services;
