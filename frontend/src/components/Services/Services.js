import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ClipboardList, Eye, Filter, Plus, RefreshCw, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getMockInternalServices } from '../../dev/clientPortalData';
import { mockClients } from '../../dev/mockData';
import { accountingServiceProcessModels } from '../../dev/accountingProcessTemplates';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const MOCK_INTERNAL_SERVICES_KEY = 'mock_internal_services';
const MOCK_ADMIN_CLIENTS_KEY = 'mock_admin_clients_v1';
const MOCK_USERS_KEY = 'mock_users_management_v1';
const MODELS_KEY = 'mock_macedo_academy_process_models_v1';
const NOTIFICATIONS_KEY = 'mock_internal_notifications_v1';

const statusOptions = [
  { value: 'novo', label: 'Novo', className: 'bg-blue-500/15 text-blue-200 border border-blue-500/30' },
  { value: 'em_andamento', label: 'Em andamento', className: 'bg-amber-500/15 text-amber-200 border border-amber-500/30' },
  { value: 'concluido', label: 'Concluido', className: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30' },
  { value: 'cancelado', label: 'Cancelado', className: 'bg-rose-500/15 text-rose-200 border border-rose-500/30' },
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
  });
  const [appliedFilters, setAppliedFilters] = useState({
    cliente: '',
    setor: '',
  });
  const [accessDeniedBySector, setAccessDeniedBySector] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [newService, setNewService] = useState({
    empresa_id: '',
    empresa_nome: '',
    tipo_servico: '',
    modelo_id: '',
    descricao: '',
    setor_key: 'atendimento',
    cidade: '',
  });
  const [processModels, setProcessModels] = useState(accountingServiceProcessModels);
  const [processDraft, setProcessDraft] = useState({
    nome: '',
    descricao: '',
    setorDestinoKey: 'atendimento',
    etapas: [
      { nome: 'Triagem inicial', setorResponsavelKey: 'atendimento', tarefasTexto: 'Registrar solicitacao\nValidar documentos obrigatorios' },
      { nome: 'Execucao tecnica', setorResponsavelKey: 'atendimento', tarefasTexto: 'Executar servico\nRevisar entrega final' },
    ],
  });

  useEffect(() => {
    loadServicos();
    loadSupportData();
    try {
      const storedModels = JSON.parse(localStorage.getItem(MODELS_KEY) || '[]');
      if (Array.isArray(storedModels) && storedModels.length) {
        setProcessModels(storedModels);
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
      return matchCliente && matchSetor;
    });
  }, [userVisibleServicos, appliedFilters, accessDeniedBySector]);

  const canSearch = Boolean(draftFilters.cliente || draftFilters.setor);

  const handleSearch = () => {
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
  };

  const handleClearFilters = () => {
    const cleared = { cliente: '', setor: '' };
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setAccessDeniedBySector(false);
    setClientSearchTerm('');
    setClientDropdownOpen(false);
  };

  const resumo = useMemo(() => {
    return {
      total: filteredServicos.length,
      novo: filteredServicos.filter((item) => item.status_ui === 'novo').length,
      emAndamento: filteredServicos.filter((item) => item.status_ui === 'em_andamento').length,
      concluidos: filteredServicos.filter((item) => item.status_ui === 'concluido').length,
    };
  }, [filteredServicos]);

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
    });
    setShowCustomServiceInput(false);
    setCustomServiceName('');
    setIncludeAdmins(false);
    setEnableAdditionalCollaborators(false);
    setServiceTypeSearchTerm('');
    setAssignedBySector({ atendimento: [creatorId] });
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
    const novoModelo = {
      id: createId('proc-model'),
      nome,
      descricao: processDraft.descricao.trim() || `Modelo personalizado para ${nome.toLowerCase()}.`,
      setorInicial: 'Atendimento',
      setorDestino: setorDestinoLabel,
      alocacaoColaboradores: [
        { setor: 'Atendimento', modulo: 'atendimento', colaboradores: [] },
        { setor: setorDestinoLabel, modulo: sectorToModule[processDraft.setorDestinoKey] || 'atendimento', colaboradores: [] },
      ],
      etapas,
      criado_manual: true,
      criado_em: new Date().toISOString(),
    };

    const nextModels = [novoModelo, ...processModels];
    setProcessModels(nextModels);
    localStorage.setItem(MODELS_KEY, JSON.stringify(nextModels));

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
    <div className="space-y-6 p-6">
      <div className="glass-intense rounded-[24px] border border-white/10 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Servicos</h1>
            <p className="mt-1 text-sm text-gray-400">Painel administrativo para visualizar e gerenciar todos os servicos do sistema.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/15 px-4 py-2 text-sm text-red-100 hover:bg-red-500/25"
            >
              <Plus className="h-4 w-4" />
              Adicionar novo servico
            </button>
            <button
              type="button"
              onClick={loadServicos}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MiniCard title="Total" value={resumo.total} tone="border-white/10 bg-white/5 text-white" />
        <MiniCard title="Novo" value={resumo.novo} tone="border-blue-500/30 bg-blue-500/10 text-blue-100" />
        <MiniCard title="Em andamento" value={resumo.emAndamento} tone="border-amber-500/30 bg-amber-500/10 text-amber-100" />
        <MiniCard title="Concluidos" value={resumo.concluidos} tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-100" />
      </div>

      <div className="glass rounded-[24px] border border-white/10 p-4">
        <div className="mb-3 inline-flex items-center gap-2 text-sm text-gray-300">
          <Filter className="h-4 w-4" />
          Filtros
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setClientDropdownOpen((prev) => !prev)}
              className="inline-flex w-full items-center justify-between rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
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

          <select
            value={draftFilters.setor}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, setor: e.target.value }))}
            className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
          >
            <option value="">Todos os setores</option>
            {setorFilterOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canSearch ? (
            <button
              type="button"
              onClick={handleSearch}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/35 bg-red-500/15 px-4 py-2 text-sm text-red-100 hover:bg-red-500/25"
            >
              Buscar
            </button>
          ) : null}
          {(appliedFilters.cliente || appliedFilters.setor || accessDeniedBySector) ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
            >
              Limpar
            </button>
          ) : null}
        </div>
      </div>

      <div className="glass rounded-[24px] border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando servicos...</div>
        ) : filteredServicos.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {accessDeniedBySector ? 'Você não tem acesso a esse setor.' : 'Nenhum servico encontrado.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Tipo do servico</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Data de criacao</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-300">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-300">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredServicos.map((servico) => {
                  const statusMeta = getStatusMeta(servico.status_ui);
                  return (
                    <tr key={servico.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-white">{servico.empresa_nome || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-200">{servico.tipo_servico || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{formatDate(servico.created_at || servico.data_criacao || servico.data_prazo)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={servico.status_ui}
                          onChange={(e) => handleStatusChange(servico.id, e.target.value)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none ${statusMeta.className}`}
                        >
                          {statusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedServico(servico)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedServico ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-zinc-900 p-6">
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

      {showProcessModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-white/15 bg-zinc-900 p-6">
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
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
                  placeholder="Ex.: Simulacao de ferias"
                />
              </FormField>
              <FormField label="Setor destino principal">
                <select
                  value={processDraft.setorDestinoKey}
                  onChange={(e) => setProcessDraft((prev) => ({ ...prev, setorDestinoKey: e.target.value }))}
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
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
                    className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
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
                      className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
                    />
                    <select
                      value={etapa.setorResponsavelKey}
                      onChange={(e) => updateProcessStep(index, 'setorResponsavelKey', e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
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
                        className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
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
          <div className="w-full max-w-4xl rounded-2xl border border-white/15 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Novo servico</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-200">Fechar</button>
            </div>

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
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/15 px-3 py-2 text-xs font-medium text-red-100 hover:bg-red-500/25"
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
                  className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
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
                      className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
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
                      className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-red-500/35 bg-red-500/15 text-red-100 hover:bg-red-500/25"
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
                      className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
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
                  className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
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
                  className="rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
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

              <FormField label="Descricao">
                <textarea
                  value={newService.descricao}
                  onChange={(e) => setNewService((prev) => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descricao opcional do servico"
                  rows={3}
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400/40"
                />
              </FormField>
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
              <button type="button" onClick={handleCreateService} className="inline-flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/15 px-4 py-2 text-sm text-red-100 hover:bg-red-500/25">
                <Plus className="h-4 w-4" />
                Salvar servico
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
