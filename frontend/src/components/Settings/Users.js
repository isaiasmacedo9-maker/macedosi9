import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Eye, EyeOff, Building2, History, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ALL_INTERNAL_MODULE_KEYS, deriveAllowedModules, getEmailFromName, INTERNAL_MODULES } from '../../config/modules';
import api from '../../config/api';

const MODULE_OVERRIDES_KEY = 'mock_user_modules_overrides_v1';

const DEFAULT_CONFIG = {
  cidades: ['Todas', 'Jacobina', 'Ourolândia', 'Umburanas', 'Uberlândia'],
  setores: {
    Todos: ['Todos'],
    Clientes: [
      'Adicionar',
      'Remover',
      'Editar',
      'Setup Empresa',
      'Setup Config',
      'Login Cliente',
      'Dados da empresa',
      'Modulos',
      'Servicos vinculados',
      'Documentos',
      'Financeiro',
      'Senhas',
    ],
    Financeiro: ['Contas a pagar', 'Contas a receber', 'Fluxo de caixa'],
    fiscal: ['Guias', 'Apurações', 'Obrigações acessórias'],
    trabalhista: ['Folha', 'Admissões', 'Rescisões'],
    comercial: ['Leads', 'Propostas', 'Pipeline'],
    atendimento: ['Chamados', 'Agendamentos'],
    contadores: ['Serviços Sara', 'Serviços Florivaldo', 'Agendamentos Sara', 'Agendamentos Florivaldo'],
  },
};

const SENHAS_PARENT_VIEW = 'Senhas';
const SENHAS_CHILD_VIEWS = [
  'Certificado digital',
  'Senha gov',
  'Senha do simples nacional',
  'Senha do emissor nacional',
  'Senha portal prefeitura',
];

const MODULE_TO_SETOR = {
  financeiro: 'financeiro',
  fiscal: 'fiscal',
  trabalhista: 'trabalhista',
  comercial: 'comercial',
  atendimento: 'atendimento',
  contadores: 'contadores',
};

const getFirstName = (fullName = '') => {
  const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned.split(' ')[0];
};

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getClientPrimaryName = (client = {}) =>
  client?.nome_fantasia || client?.nome_empresa || client?.name || 'Cliente';

const buildClientEmail = (clientName = '') => {
  const normalized = normalizeText(clientName).replace(/[^a-z0-9\s]/g, ' ');
  const firstWord = normalized.split(/\s+/).filter(Boolean)[0] || 'cliente';
  return `${firstWord}@macedosi.com`;
};

const mergeClientsUnique = (...lists) => {
  const map = new Map();
  lists.flat().forEach((client) => {
    if (!client) return;
    const key = String(client.id || client.clientRefId || client.cnpj || getClientPrimaryName(client));
    if (!map.has(key)) map.set(key, { ...client, id: key });
  });
  return Array.from(map.values());
};

const getSetupClientName = (setup = {}, fallback = 'Cliente') =>
  setup?.empresa?.nomeFantasia ||
  setup?.empresa?.nome_fantasia ||
  setup?.empresa?.razaoSocial ||
  setup?.empresa?.razao_social ||
  setup?.setupEmpresa?.nomeFantasia ||
  setup?.setupEmpresa?.nome_fantasia ||
  setup?.setupEmpresa?.razaoSocial ||
  setup?.setupEmpresa?.razao_social ||
  fallback;

const getLinkedClientRefIds = (clientUser = {}) => {
  if (Array.isArray(clientUser.linkedClientRefs)) {
    return [...new Set(clientUser.linkedClientRefs.map((value) => String(value || '').trim()).filter(Boolean))];
  }
  return [String(clientUser.clientRefId || '').trim()].filter(Boolean);
};

const getLinkedClienteIds = (clientUser = {}) => {
  if (Array.isArray(clientUser.linkedClientIds)) {
    return [...new Set(clientUser.linkedClientIds.map((value) => String(value || '').trim()).filter(Boolean))];
  }
  return [String(clientUser.clienteId || '').trim()].filter(Boolean);
};

const resolveExplicitModules = (user = {}) => {
  const source = Array.isArray(user.allowed_modules)
    ? user.allowed_modules
    : Array.isArray(user.modules_liberados)
      ? user.modules_liberados
      : [];

  const normalized = [...new Set(source.filter(Boolean))];
  return normalized.includes('dashboard') ? normalized : ['dashboard', ...normalized];
};

const mergeConfigWithDefaults = (incomingConfig = {}) => {
  const incomingSetores = incomingConfig?.setores && typeof incomingConfig.setores === 'object'
    ? incomingConfig.setores
    : {};

  const canonicalKeyMap = new Map(
    Object.keys(DEFAULT_CONFIG.setores).map((setor) => [normalizeText(setor), setor]),
  );
  const normalizedIncomingSetores = {};
  Object.entries(incomingSetores).forEach(([setor, visualizacoes]) => {
    const canonicalSetor = canonicalKeyMap.get(normalizeText(setor)) || setor;
    normalizedIncomingSetores[canonicalSetor] = Array.isArray(visualizacoes) ? visualizacoes : [];
  });

  const mergedSetores = {
    ...DEFAULT_CONFIG.setores,
    ...normalizedIncomingSetores,
  };

  const clientesBase = Array.isArray(mergedSetores.Clientes) ? mergedSetores.Clientes : [];
  mergedSetores.Clientes = [...new Set([...DEFAULT_CONFIG.setores.Clientes, ...clientesBase])];

  return {
    ...DEFAULT_CONFIG,
    ...incomingConfig,
    cidades: Array.isArray(incomingConfig?.cidades) && incomingConfig.cidades.length
      ? incomingConfig.cidades
      : DEFAULT_CONFIG.cidades,
    setores: mergedSetores,
  };
};

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('internos');
  const [clientUsers, setClientUsers] = useState([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClientUser, setEditingClientUser] = useState(null);
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [clientActivityLogs, setClientActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [logsActionFilter, setLogsActionFilter] = useState('todos');
  const [logsSearch, setLogsSearch] = useState('');
  const [selectedClientLog, setSelectedClientLog] = useState(null);
  const [clientCatalog, setClientCatalog] = useState([]);
  const [setupMap, setSetupMap] = useState({});
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [clientFormData, setClientFormData] = useState({
    email: '',
    senha: '',
    fixedClientRefId: '',
    fixedClienteId: '',
  });
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    role: 'colaborador',
    allowed_cities: [],
    permissoes: [],
    allowed_modules: ['dashboard'],
  });

  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  const moduleOptions = useMemo(
    () => INTERNAL_MODULES.filter((module) => module.key !== 'dashboard'),
    [],
  );

  useEffect(() => {
    loadUsers();
    loadConfig();
    loadClientUsers();
    loadClientCatalog();
    loadSetupMap();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs_clientes') {
      loadClientActivityLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'logs_clientes') {
      loadClientActivityLogs();
    }
  }, [logsActionFilter]);

  const safeParse = (value, fallback) => {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  };

  const getModuleOverrides = () => safeParse(localStorage.getItem(MODULE_OVERRIDES_KEY) || '{}', {});

  const saveModuleOverride = (email, role, modules) => {
    if (!email) return;
    const current = getModuleOverrides();
    if (role === 'admin') {
      delete current[email];
    } else {
      current[email] = [...new Set(modules)];
    }
    localStorage.setItem(MODULE_OVERRIDES_KEY, JSON.stringify(current));
  };

  const applyModuleOverrideToUsers = (list) => {
    const overrides = getModuleOverrides();
    return list.map((user) => {
      const override = user.email ? overrides[user.email] : null;
      const source = Array.isArray(override)
        ? { ...user, allowed_modules: override }
        : user;
      const explicitModules = source.role === 'admin'
        ? [...ALL_INTERNAL_MODULE_KEYS]
        : resolveExplicitModules(source);

      return {
        ...source,
        display_allowed_modules: explicitModules,
        allowed_modules: deriveAllowedModules({
          ...source,
          allowed_modules: explicitModules,
        }),
      };
    });
  };

  const loadConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users-management/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Config indisponível');
      const data = await response.json();
      setConfig(mergeConfigWithDefaults(data));
    } catch (error) {
      console.warn('Usando configuração mockada de usuários.');
      setConfig(mergeConfigWithDefaults(DEFAULT_CONFIG));
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users-management/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Lista de usuários indisponível');
      const data = await response.json();
      setUsers(applyModuleOverrideToUsers(data));
    } catch (error) {
      console.error('Erro ao carregar usuários internos:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadClientUsers = async () => {
    try {
      const response = await api.get('/clients/portal-users');
      const list = Array.isArray(response.data) ? response.data : [];
      setClientUsers(list);
    } catch (error) {
      console.error('Erro ao carregar usuários de portal:', error);
      setClientUsers([]);
    }
  };

  const loadSetupMap = async () => {
    try {
      const response = await api.get('/clients/setup-map');
      const map = response.data?.setup_map;
      setSetupMap(map && typeof map === 'object' ? map : {});
    } catch (error) {
      console.error('Erro ao carregar setup map de clientes:', error);
      setSetupMap({});
    }
  };

  const loadClientCatalog = async () => {
    try {
      const response = await api.get('/clients?limit=1000');
      const payload = response.data?.clients || response.data || [];
      setClientCatalog(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Erro ao carregar catálogo de clientes:', error);
      setClientCatalog([]);
    }
  };

  const loadClientActivityLogs = async () => {
    try {
      setLogsLoading(true);
      setLogsError('');
      const token = localStorage.getItem('token');
      const actionQuery = logsActionFilter !== 'todos' ? `&action=${encodeURIComponent(logsActionFilter)}` : '';
      const response = await fetch(`${API_URL}/api/clients/activity-logs/list?limit=200${actionQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Falha ao carregar auditoria de clientes');
      }
      const payload = await response.json();
      setClientActivityLogs(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error) {
      setClientActivityLogs([]);
      setLogsError('Nao foi possivel carregar os logs de atividade de clientes.');
    } finally {
      setLogsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      password: '',
      role: 'colaborador',
      allowed_cities: [],
      permissoes: [],
      allowed_modules: ['dashboard'],
    });
    setEditingUser(null);
    setShowPassword(false);
    setShowCurrentPassword(false);
    setIsEditingName(false);
    setIsChangingPassword(false);
    setShowForm(false);
  };

  const resetClientForm = () => {
    setClientFormData({
      email: '',
      senha: '',
      fixedClientRefId: '',
      fixedClienteId: '',
    });
    setSelectedClientId('');
    setSelectedClientIds([]);
    setEditingClientUser(null);
    setShowClientPassword(false);
    setShowClientForm(false);
  };

  const toggleCity = (city) => {
    if (city === 'Todas') {
      setFormData((prev) => ({
        ...prev,
        allowed_cities: prev.allowed_cities.includes('Todas') ? [] : ['Todas'],
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      allowed_cities: prev.allowed_cities.includes(city)
        ? prev.allowed_cities.filter((c) => c !== city)
        : [...prev.allowed_cities.filter((c) => c !== 'Todas'), city],
    }));
  };

  const upsertPermissaoComVisualizacoes = (permissoes, setor, visualizacoes = []) => {
    const normalizedVisualizacoes = [...new Set(visualizacoes)];
    const exists = permissoes.find((item) => item.setor === setor);
    if (exists) {
      return permissoes.map((item) =>
        item.setor === setor ? { ...item, visualizacoes: normalizedVisualizacoes } : item,
      );
    }
    return [...permissoes, { setor, visualizacoes: normalizedVisualizacoes }];
  };

  const removePermissaoBySetor = (permissoes, setor) =>
    permissoes.filter((item) => item.setor !== setor);

  const toggleSetor = (setor) => {
    setFormData((prev) => {
      if (setor === 'Todos') {
        const hasTodos = prev.permissoes.some((p) => p.setor === 'Todos');
        return {
          ...prev,
          permissoes: hasTodos ? [] : [{ setor: 'Todos', visualizacoes: ['Todos'] }],
        };
      }

      const exists = prev.permissoes.find((p) => p.setor === setor);
      if (exists) {
        return {
          ...prev,
          permissoes: removePermissaoBySetor(prev.permissoes, setor),
        };
      }
      return {
        ...prev,
        permissoes: [
          ...prev.permissoes.filter((p) => p.setor !== 'Todos'),
          { setor, visualizacoes: [] },
        ],
      };
    });
  };

  const toggleVisualizacao = (setor, vis) => {
    setFormData((prev) => ({
      ...prev,
      permissoes: prev.permissoes.map((perm) => {
        if (perm.setor !== setor) return perm;
        const visualizacoesAtuais = Array.isArray(perm.visualizacoes) ? perm.visualizacoes : [];

        if (setor === 'Clientes' && vis === SENHAS_PARENT_VIEW) {
          const parentExists = visualizacoesAtuais.includes(SENHAS_PARENT_VIEW);
          return {
            ...perm,
            visualizacoes: parentExists
              ? visualizacoesAtuais.filter((item) => item !== SENHAS_PARENT_VIEW && !SENHAS_CHILD_VIEWS.includes(item))
              : [...visualizacoesAtuais, SENHAS_PARENT_VIEW],
          };
        }

        if (setor === 'Clientes' && SENHAS_CHILD_VIEWS.includes(vis)) {
          const childExists = visualizacoesAtuais.includes(vis);
          if (childExists) {
            return {
              ...perm,
              visualizacoes: visualizacoesAtuais.filter((item) => item !== vis),
            };
          }
          const next = [...visualizacoesAtuais, vis];
          if (!next.includes(SENHAS_PARENT_VIEW)) next.push(SENHAS_PARENT_VIEW);
          return { ...perm, visualizacoes: next };
        }

        const exists = visualizacoesAtuais.includes(vis);
        return {
          ...perm,
          visualizacoes: exists
            ? visualizacoesAtuais.filter((item) => item !== vis)
            : [...visualizacoesAtuais, vis],
        };
      }),
    }));
  };

  const toggleModule = (moduleKey) => {
    setFormData((prev) => {
      const exists = prev.allowed_modules.includes(moduleKey);
      const updated = exists
        ? prev.allowed_modules.filter((item) => item !== moduleKey)
        : [...prev.allowed_modules, moduleKey];
      const mappedSetor = MODULE_TO_SETOR[moduleKey];
      let nextPermissoes = [...prev.permissoes];

      if (mappedSetor) {
        if (exists) {
          nextPermissoes = removePermissaoBySetor(nextPermissoes, mappedSetor);
        } else {
          nextPermissoes = removePermissaoBySetor(nextPermissoes, 'Todos');
          nextPermissoes = upsertPermissaoComVisualizacoes(
            nextPermissoes,
            mappedSetor,
            config.setores?.[mappedSetor] || [],
          );
        }
      }

      return {
        ...prev,
        allowed_modules: ['dashboard', ...updated.filter((item) => item !== 'dashboard')],
        permissoes: nextPermissoes,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedName = editingUser
      ? formData.name
      : getFirstName(formData.name);

    const normalizedPassword = String(formData.password || '').trim();
    const emailFromForm = getEmailFromName(formData.name);

    const payload = {
      ...formData,
      name: normalizedName,
      allowed_modules: formData.role === 'admin'
        ? [...ALL_INTERNAL_MODULE_KEYS]
        : ['dashboard', ...formData.allowed_modules.filter((item) => item !== 'dashboard')],
      password: editingUser
        ? (isChangingPassword && normalizedPassword ? normalizedPassword : undefined)
        : normalizedPassword,
    };

    try {
      const token = localStorage.getItem('token');
      const url = editingUser
        ? `${API_URL}/api/users-management/${editingUser.id}`
        : `${API_URL}/api/users-management/`;
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Falha no backend');

      const userEmail = editingUser?.email || emailFromForm;
      saveModuleOverride(userEmail, payload.role, payload.allowed_modules);
      await loadUsers();
      resetForm();
      alert(editingUser ? 'Usuário atualizado!' : 'Usuário criado!');
    } catch (error) {
      console.error('Falha ao salvar usuário no backend:', error);
      alert('Não foi possível salvar o usuário no backend.');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Tem certeza que deseja deletar este usuário?')) return;

    const target = users.find((user) => user.id === userId);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users-management/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Falha ao deletar');
      if (target?.email) saveModuleOverride(target.email, 'admin', []);
      await loadUsers();
      alert('Usuário deletado com sucesso!');
    } catch (error) {
      console.error('Falha ao deletar usuário no backend:', error);
      alert('Não foi possível deletar o usuário no backend.');
    }
  };

  const handleEdit = (user) => {
    const editableModules = user.role === 'admin'
      ? [...ALL_INTERNAL_MODULE_KEYS]
      : (user.display_allowed_modules || resolveExplicitModules(user));

    setEditingUser(user);
    setFormData({
      name: user.name,
      password: '',
      role: user.role,
      allowed_cities: user.allowed_cities || [],
      permissoes: user.permissoes || [],
      allowed_modules: editableModules,
    });
    setShowPassword(false);
    setShowCurrentPassword(false);
    setIsEditingName(false);
    setIsChangingPassword(false);
    setShowForm(true);
  };

  const handleEditClientUser = (clientUser) => {
    const linkedRefs = getLinkedClientRefIds(clientUser);
    setEditingClientUser(clientUser);
    setSelectedClientId('');
    setSelectedClientIds(linkedRefs);
    setClientFormData({
      email: clientUser.email || '',
      senha: clientUser.senha || '',
      fixedClientRefId: String(clientUser.clientRefId || '').trim(),
      fixedClienteId: String(clientUser.clienteId || '').trim(),
    });
    setShowClientPassword(false);
    setShowClientForm(true);
  };

  const handleDeleteClientUser = async (clientUserId) => {
    if (!window.confirm('Tem certeza que deseja remover este usuario cliente?')) return;
    try {
      await api.delete(`/clients/portal-users/by-id/${clientUserId}`);
      await loadClientUsers();
    } catch (error) {
      console.error('Erro ao remover usuário cliente no backend:', error);
      alert('Não foi possível remover o usuário cliente.');
    }
  };

  const handleToggleLinkedClient = (clientId, isChecked) => {
    const normalizedId = String(clientId || '');
    if (!normalizedId) return;

    if (isChecked) {
      const nextIds = selectedClientIds.filter((id) => id !== normalizedId);
      setSelectedClientIds(nextIds);
      if (String(selectedClientId) === normalizedId) {
        setSelectedClientId(nextIds[0] || '');
      }
      return;
    }

    setSelectedClientIds((prev) => [...new Set([normalizedId, ...prev])]);
  };

  const handleLinkSelectedClient = () => {
    const normalizedSelectedId = String(selectedClientId || '').trim();
    if (!normalizedSelectedId) return;
    if (selectedClientIds.includes(normalizedSelectedId)) return;
    const selectedOption = availableClientOptions.find((item) => String(item.id) === normalizedSelectedId) || null;
    const nextSelectedIds = [...new Set([...selectedClientIds, normalizedSelectedId])];
    setSelectedClientIds(nextSelectedIds);
    setClientFormData((prev) => {
      if (prev.fixedClientRefId && prev.fixedClienteId) return prev;
      return {
        ...prev,
        fixedClientRefId: prev.fixedClientRefId || String(selectedOption?.clientRefId || normalizedSelectedId),
        fixedClienteId: prev.fixedClienteId || String(selectedOption?.clienteId || normalizedSelectedId),
      };
    });
    const nextOption = availableClientOptions.find((item) => !nextSelectedIds.includes(String(item.id)));
    setSelectedClientId(nextOption ? String(nextOption.id) : '');
  };

  const handleSubmitClientUser = async (event) => {
    event.preventDefault();
    const senha = String(clientFormData.senha || '').trim();
    const normalizedSelectedClientIds = [...new Set(
      selectedClientIds.map((value) => String(value || '').trim()).filter(Boolean),
    )];
    const selectedIdsForSave = normalizedSelectedClientIds.length
      ? normalizedSelectedClientIds
      : [String(selectedClientId || '').trim()].filter(Boolean);
    const selectedClients = availableClientOptions.filter((item) =>
      selectedIdsForSave.includes(String(item.id)),
    );
    const primaryClient = selectedClients.find((item) => String(item.id) === String(selectedClientId)) || selectedClients[0];

    const email = String(clientFormData.email || primaryClient?.email || '').trim().toLowerCase();

    if (!primaryClient || !senha || !email) return;

    const nome = primaryClient.nome;
    const clientRefId = String(clientFormData.fixedClientRefId || primaryClient.clientRefId || '').trim();
    const clienteId = String(clientFormData.fixedClienteId || primaryClient.clienteId || '').trim();
    const linkedClientRefs = [...new Set(selectedClients.map((item) => String(item.clientRefId || '').trim()).filter(Boolean))];
    const linkedClientIds = [...new Set(selectedClients.map((item) => String(item.clienteId || '').trim()).filter(Boolean))];

    try {
      await api.put(`/clients/portal-users/${clientRefId}`, {
        id: editingClientUser?.id || null,
        nome,
        email,
        senha,
        clienteId: String(clienteId || '').trim(),
        linkedClientRefs,
        linkedClientIds,
      });
      await loadClientUsers();
      resetClientForm();
    } catch (error) {
      console.error('Erro ao salvar usuário cliente no backend:', error);
      alert('Não foi possível salvar o usuário cliente.');
    }
  };

  const availableClientOptions = useMemo(() => {
    const linkedToOtherUsers = new Set(
      clientUsers
        .filter((item) => !editingClientUser || item.id !== editingClientUser.id)
        .flatMap((item) => getLinkedClientRefIds(item))
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    );

    const fromCatalog = clientCatalog
      .map((client) => {
        const clientRefId = String(client.id || '');
        const setup = setupMap?.[clientRefId] || {};
        const nome = getClientPrimaryName(client);
        const clienteId = String(setup?.acessoCliente?.clienteId || clientRefId);
        return {
          id: clientRefId,
          nome,
          email: buildClientEmail(nome),
          clientRefId,
          clienteId,
        };
      })
      .filter((item) => item.clientRefId && !linkedToOtherUsers.has(String(item.clientRefId)));

    const fromSetupMap = Object.entries(setupMap || {}).map(([clientRefId, setup]) => {
      const refId = String(clientRefId || '').trim();
      const nome = getSetupClientName(setup, refId);
      const clienteId = String(setup?.acessoCliente?.clienteId || refId);
      return {
        id: refId,
        nome,
        email: buildClientEmail(nome),
        clientRefId: refId,
        clienteId,
      };
    }).filter((item) => item.clientRefId && !linkedToOtherUsers.has(String(item.clientRefId)));

    const byId = new Map();
    [...fromCatalog, ...fromSetupMap].forEach((item) => {
      const key = String(item.clientRefId || '').trim();
      if (!key) return;
      if (!byId.has(key)) {
        byId.set(key, item);
      }
    });

    const merged = Array.from(byId.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    if (editingClientUser) {
      const editingRefs = getLinkedClientRefIds(editingClientUser);
      const editingIds = getLinkedClienteIds(editingClientUser);
      editingRefs.forEach((refId, index) => {
        const hasCurrent = merged.some((item) => String(item.clientRefId) === String(refId));
        if (hasCurrent) return;
        merged.unshift({
          id: refId || String(editingClientUser.id || ''),
          nome: editingClientUser.nome || 'Cliente',
          email: editingClientUser.email || buildClientEmail(editingClientUser.nome || 'cliente'),
          clientRefId: refId,
          clienteId: String(editingIds[index] || editingClientUser.clienteId || refId || ''),
        });
      });
    }

    return merged;
  }, [clientCatalog, clientUsers, editingClientUser, setupMap]);

  const selectedClientOption = useMemo(
    () => availableClientOptions.find((item) => String(item.id) === String(selectedClientId)) || null,
    [availableClientOptions, selectedClientId],
  );

  useEffect(() => {
    if (!showClientForm) return;
    if (!selectedClientOption) return;
    setClientFormData((prev) => ({
      ...prev,
      email: prev.email || selectedClientOption.email || '',
    }));
  }, [showClientForm, selectedClientOption]);

  const unlinkedClientOptions = useMemo(
    () => availableClientOptions.filter((item) => !selectedClientIds.includes(String(item.id))),
    [availableClientOptions, selectedClientIds],
  );

  const selectedClientOptions = useMemo(
    () => availableClientOptions.filter((item) => selectedClientIds.includes(String(item.id))),
    [availableClientOptions, selectedClientIds],
  );

  useEffect(() => {
    if (!showClientForm) return;
    if (!availableClientOptions.length) return;

    if (selectedClientId && !selectedClientOption) {
      const fallbackId = String(unlinkedClientOptions[0]?.id || '');
      setSelectedClientId(String(fallbackId));
    }
  }, [
    showClientForm,
    selectedClientId,
    selectedClientOption,
    selectedClientIds,
    availableClientOptions,
    unlinkedClientOptions,
    editingClientUser,
  ]);

  const filteredClientLogs = useMemo(() => {
    const term = normalizeText(logsSearch);
    if (!term) return clientActivityLogs;
    return clientActivityLogs.filter((item) => {
      const actor = normalizeText(item?.actor_name || '');
      const actorEmail = normalizeText(item?.actor_email || '');
      const clientName = normalizeText(item?.client_name || '');
      const action = normalizeText(item?.action || '');
      return actor.includes(term) || actorEmail.includes(term) || clientName.includes(term) || action.includes(term);
    });
  }, [clientActivityLogs, logsSearch]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400">Carregando...</div>
      </div>
    );
  }

  const hasTodasCidades = formData.allowed_cities.includes('Todas');
  const hasTodosSetores = formData.permissoes.some((perm) => perm.setor === 'Todos');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gerenciar Usuários</h1>
          <p className="mt-1 text-sm text-gray-400">Gerencie usuários, permissões e módulos liberados do sistema</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/configuracoes')}
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10"
        >
          Voltar
        </button>
        {activeTab !== 'logs_clientes' ? (
          <button
            onClick={() => {
              if (activeTab === 'internos') {
                setEditingUser(null);
                setShowPassword(false);
                setShowCurrentPassword(false);
                setIsEditingName(false);
                setIsChangingPassword(false);
                setFormData({
                  name: '',
                  password: '',
                  role: 'colaborador',
                  allowed_cities: [],
                  permissoes: [],
                  allowed_modules: ['dashboard'],
                });
                setShowForm(true);
                return;
              }

              setEditingClientUser(null);
              setClientFormData({
                email: '',
                senha: '',
                fixedClientRefId: '',
                fixedClienteId: '',
              });
              setSelectedClientId('');
              setSelectedClientIds([]);
              setShowClientPassword(false);
              setShowClientForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
          >
            <Plus size={20} />
            {activeTab === 'internos' ? 'Novo Usuario Interno' : 'Novo Usuario Cliente'}
          </button>
        ) : (
          <button
            type="button"
            onClick={loadClientActivityLogs}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-white transition-colors hover:bg-white/10"
          >
            <RefreshCw size={16} />
            Atualizar logs
          </button>
        )}
      </div>

      <div className="glass rounded-xl border border-white/10 p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('internos')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'internos'
                ? 'bg-red-600 text-white'
                : 'bg-white/5 text-gray-200 hover:bg-white/10'
            }`}
          >
            Usuarios Macedo Interno
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clientes')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'clientes'
                ? 'bg-red-600 text-white'
                : 'bg-white/5 text-gray-200 hover:bg-white/10'
            }`}
          >
            Usuarios de clientes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs_clientes')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'logs_clientes'
                ? 'bg-red-600 text-white'
                : 'bg-white/5 text-gray-200 hover:bg-white/10'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <History size={14} />
              Logs de clientes
            </span>
          </button>
        </div>
      </div>

      {showForm && activeTab === 'internos' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-gray-800 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Nome Completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg bg-gray-700 px-4 py-2 text-white outline-none focus:ring-2 focus:ring-red-500"
                  required
                  disabled={!!editingUser && !isEditingName}
                />
                {editingUser ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingName((prev) => !prev)}
                    className="mt-2 rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
                  >
                    {isEditingName ? 'Bloquear nome' : 'Editar nome'}
                  </button>
                ) : null}
                {!editingUser ? (
                  <p className="mt-1 text-xs text-gray-400">
                    No cadastro, sera salvo apenas o primeiro nome: {formData.name ? getFirstName(formData.name) : 'nome'}.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">Nome não editável por padrão. Use o botão "Editar nome".</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Email será: {formData.name ? getEmailFromName(formData.name) : 'nome.completo@macedosi.com'}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Senha {editingUser && '(deixe em branco para não alterar)'}
                </label>
                {editingUser ? (
                  <div className="mb-3">
                    <p className="mb-1 text-xs text-gray-400">Senha atual</p>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={showCurrentPassword ? String(editingUser?.password || 'Senha nao disponivel') : '********'}
                        readOnly
                        className="w-full rounded-lg bg-gray-700 px-4 py-2 pr-11 text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        aria-label={showCurrentPassword ? 'Ocultar senha atual' : 'Mostrar senha atual'}
                      >
                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChangingPassword((prev) => !prev)}
                      className="mt-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                    >
                      {isChangingPassword ? 'Cancelar alteração de senha' : 'Alterar senha'}
                    </button>
                  </div>
                ) : null}
                {(!editingUser || isChangingPassword) ? (
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-lg bg-gray-700 px-4 py-2 pr-11 text-white outline-none focus:ring-2 focus:ring-red-500"
                    required={!editingUser || isChangingPassword}
                    minLength={6}
                    placeholder={editingUser ? 'Digite a nova senha' : ''}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Tipo de Usuário</label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      value="admin"
                      checked={formData.role === 'admin'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value,
                          allowed_modules: [...ALL_INTERNAL_MODULE_KEYS],
                        })
                      }
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-white">Administrador</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      value="colaborador"
                      checked={formData.role === 'colaborador'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value,
                          allowed_modules: formData.allowed_modules.length
                            ? formData.allowed_modules
                            : ['dashboard'],
                        })
                      }
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-white">Colaborador</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Módulos liberados</label>
                {formData.role === 'admin' ? (
                  <div className="rounded-lg border border-green-600/40 bg-green-900/20 p-3 text-sm text-green-200">
                    Administrador possui acesso automático a todos os módulos.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {moduleOptions.map((module) => {
                      const checked = formData.allowed_modules.includes(module.key);
                      return (
                        <label
                          key={module.key}
                          className="flex cursor-pointer items-center gap-2 rounded border border-gray-600 bg-gray-700 p-2"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleModule(module.key)}
                            className="text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm text-white">{module.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Cidades de Visualização</label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {config.cidades.map((city) => (
                    <label
                      key={city}
                      className={`flex items-center gap-2 rounded p-2 transition-all ${
                        hasTodasCidades && city !== 'Todas'
                          ? 'cursor-not-allowed bg-gray-800/80 opacity-45'
                          : 'cursor-pointer bg-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.allowed_cities.includes(city)}
                        disabled={hasTodasCidades && city !== 'Todas'}
                        onChange={() => toggleCity(city)}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-white">{city}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Setores e Visualizações</label>
                <div className="space-y-4">
                  {Object.keys(config.setores).map((setor) => {
                    const permissao = formData.permissoes.find((perm) => perm.setor === setor);
                    const isSelected = !!permissao;
                    const setorDisabled = hasTodosSetores && setor !== 'Todos';

                    return (
                      <div
                        key={setor}
                        className={`rounded-lg p-4 transition-all ${
                          setorDisabled ? 'bg-gray-800/80 opacity-50' : 'bg-gray-700'
                        }`}
                      >
                        <label className={`mb-3 flex items-center gap-2 ${setorDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={setorDisabled}
                            onChange={() => toggleSetor(setor)}
                            className="text-red-600 focus:ring-red-500"
                          />
                          <span className="font-medium text-white">{setor}</span>
                        </label>

                        {isSelected ? (
                          <div className="ml-6 grid grid-cols-2 gap-2">
                            {config.setores[setor].map((vis) => {
                              const isSenhasParent = setor === 'Clientes' && vis === SENHAS_PARENT_VIEW;
                              const showSenhasChildren = isSenhasParent && permissao.visualizacoes.includes(SENHAS_PARENT_VIEW);
                              return (
                                <div key={vis} className="space-y-2">
                                  <label
                                    className={`flex items-center gap-2 ${setorDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={permissao.visualizacoes.includes(vis)}
                                      disabled={setorDisabled}
                                      onChange={() => toggleVisualizacao(setor, vis)}
                                      className="text-red-600 focus:ring-red-500"
                                    />
                                    <span className="text-sm text-gray-300">{vis}</span>
                                  </label>
                                  {showSenhasChildren ? (
                                    <div className="ml-6 space-y-1 rounded-lg border border-white/10 bg-black/20 p-2">
                                      {SENHAS_CHILD_VIEWS.map((senhaVis) => (
                                        <label
                                          key={senhaVis}
                                          className={`flex items-center gap-2 ${setorDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={permissao.visualizacoes.includes(senhaVis)}
                                            disabled={setorDisabled}
                                            onChange={() => toggleVisualizacao(setor, senhaVis)}
                                            className="text-red-600 focus:ring-red-500"
                                          />
                                          <span className="text-xs text-gray-300">{senhaVis}</span>
                                        </label>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-white transition-colors hover:bg-red-700"
                >
                  <Save size={20} />
                  {editingUser ? 'Atualizar' : 'Criar'} Usuário
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg bg-gray-600 px-6 py-2 text-white transition-colors hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClientForm && activeTab === 'clientes' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-gray-800 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{editingClientUser ? 'Editar Usuario Cliente' : 'Novo Usuario Cliente'}</h2>
              <button type="button" onClick={resetClientForm} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmitClientUser} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Nome (cliente)</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full rounded-lg bg-gray-700 px-4 py-2 text-white outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Selecione uma empresa para vincular</option>
                  {!unlinkedClientOptions.length ? (
                    <option value="">Todas as empresas ja estao vinculadas</option>
                  ) : null}
                  {unlinkedClientOptions.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nome}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Escolha a empresa principal do acesso. Abaixo voce pode vincular outras empresas ao mesmo usuario.
                </p>
                <button
                  type="button"
                  onClick={handleLinkSelectedClient}
                  disabled={!selectedClientId || selectedClientIds.includes(String(selectedClientId))}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={14} />
                  Vincular empresa selecionada
                </button>
                {unlinkedClientOptions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {unlinkedClientOptions.slice(0, 8).map((client) => (
                      <button
                        key={`quick-select-${client.id}`}
                        type="button"
                        onClick={() => setSelectedClientId(String(client.id))}
                        className={`rounded-md border px-2 py-1 text-[11px] ${
                          String(selectedClientId) === String(client.id)
                            ? 'border-red-500/40 bg-red-500/20 text-red-100'
                            : 'border-white/15 bg-white/5 text-gray-200 hover:bg-white/10'
                        }`}
                      >
                        {client.nome}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Empresas vinculadas ao usuario</label>
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
                  {selectedClientOptions.map((client) => (
                    <div key={`selected-link-${client.id}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-sm text-white">{client.nome}</div>
                      <button
                        type="button"
                        onClick={() => handleToggleLinkedClient(client.id, true)}
                        className="rounded-md border border-white/20 px-2 py-1 text-xs text-gray-200 hover:bg-white/10"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  {selectedClientOptions.length === 0 && availableClientOptions.length > 0 ? (
                    <p className="text-xs text-gray-400">Nenhuma empresa vinculada ainda. Use o botao acima para vincular.</p>
                  ) : null}
                  {!availableClientOptions.length ? (
                    <p className="text-xs text-gray-400">Nenhum cliente disponivel para vinculo.</p>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Empresas selecionadas: {selectedClientOptions.length}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  value={clientFormData.email || ''}
                  onChange={(e) => setClientFormData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg bg-gray-700 px-4 py-2 text-white outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-400">
                  Preenchimento automatico habilitado. Voce pode editar manualmente antes de salvar.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Senha</label>
                <div className="relative">
                  <input
                    type={showClientPassword ? 'text' : 'password'}
                    value={clientFormData.senha}
                    onChange={(e) => setClientFormData((prev) => ({ ...prev, senha: e.target.value }))}
                    className="w-full rounded-lg bg-gray-700 px-4 py-2 pr-11 text-white outline-none focus:ring-2 focus:ring-red-500"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowClientPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showClientPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Client Ref ID</label>
                  <input
                    type="text"
                    value={clientFormData.fixedClientRefId || ''}
                    className="w-full rounded-lg bg-gray-700 px-4 py-2 text-white outline-none focus:ring-2 focus:ring-red-500"
                    readOnly
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Cliente ID (rota)</label>
                  <input
                    type="text"
                    value={clientFormData.fixedClienteId || ''}
                    className="w-full rounded-lg bg-gray-700 px-4 py-2 text-white outline-none focus:ring-2 focus:ring-red-500"
                    readOnly
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!selectedClientOptions.length}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-white hover:bg-red-700 disabled:opacity-40"
                >
                  <Save size={18} />
                  {editingClientUser ? 'Atualizar' : 'Criar'} usuario cliente
                </button>
                <button type="button" onClick={resetClientForm} className="rounded-lg bg-gray-600 px-6 py-2 text-white hover:bg-gray-700">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeTab === 'internos' ? (
      <div className="overflow-hidden rounded-lg bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">Módulos liberados</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">Cidades</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">Setores</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-300">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-700/50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${user.is_online ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span className="text-white">{user.name}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-gray-300">{user.email}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        user.role === 'admin' ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'
                      }`}
                    >
                      {user.role === 'admin' ? 'Admin' : 'Colaborador'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-300">
                      {user.role === 'admin'
                        ? 'Todos'
                        : INTERNAL_MODULES
                            .filter((module) => (user.display_allowed_modules || []).includes(module.key))
                            .filter((module) => module.key !== 'dashboard')
                            .map((module) => module.label)
                            .join(', ') || 'Nenhum'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{(user.allowed_cities || []).join(', ')}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {(user.permissoes || []).map((perm) => perm.setor).join(', ') || 'Nenhum'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        user.is_active ? 'bg-green-900/50 text-green-300' : 'bg-gray-900/50 text-gray-300'
                      }`}
                    >
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEdit(user)} className="text-blue-400 hover:text-blue-300" title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(user.id)} className="text-red-400 hover:text-red-300" title="Deletar">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      ) : activeTab === 'clientes' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
            Usuarios de clientes configurados para acesso ao portal.
          </div>
          <div className="grid grid-cols-1 gap-3">
            {clientUsers.map((clientUser) => (
              <div key={clientUser.id} className="rounded-xl border border-white/10 bg-gray-800 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                      <Building2 className="h-4 w-4 text-cyan-300" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{clientUser.nome}</p>
                      <p className="text-sm text-gray-300">{clientUser.email}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Empresas vinculadas: {getLinkedClienteIds(clientUser).join(', ') || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditClientUser(clientUser)} className="text-blue-400 hover:text-blue-300" title="Editar">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDeleteClientUser(clientUser.id)} className="text-red-400 hover:text-red-300" title="Deletar">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!clientUsers.length ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-5 text-sm text-gray-400">
                Nenhum usuario cliente cadastrado ainda.
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={logsActionFilter}
                onChange={(e) => setLogsActionFilter(e.target.value)}
                className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="todos">Todas as acoes</option>
                <option value="create">Criacao</option>
                <option value="update">Edicao</option>
                <option value="delete">Remocao</option>
              </select>
              <input
                value={logsSearch}
                onChange={(e) => setLogsSearch(e.target.value)}
                placeholder="Buscar por cliente, usuario ou acao..."
                className="min-w-[280px] flex-1 rounded-lg bg-gray-700 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {logsError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {logsError}
            </div>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px]">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-300">Data/Hora</th>
                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-300">Acao</th>
                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-300">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-300">Usuario</th>
                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-300">Email</th>
                    <th className="px-4 py-3 text-left text-xs uppercase text-gray-300">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {logsLoading ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-400">Carregando logs...</td>
                    </tr>
                  ) : filteredClientLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-400">Nenhuma atividade encontrada.</td>
                    </tr>
                  ) : (
                    filteredClientLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-sm text-gray-200">
                          {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`rounded px-2 py-1 text-xs ${
                              log.action === 'create'
                                ? 'bg-emerald-900/50 text-emerald-300'
                                : log.action === 'update'
                                  ? 'bg-amber-900/50 text-amber-300'
                                  : 'bg-red-900/50 text-red-300'
                            }`}
                          >
                            {log.action === 'create' ? 'Criacao' : log.action === 'update' ? 'Edicao' : 'Remocao'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-white">{log.client_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-200">{log.actor_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{log.actor_email || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            type="button"
                            onClick={() => setSelectedClientLog(log)}
                            className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs text-gray-100 hover:bg-white/10"
                          >
                            <Eye size={13} />
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedClientLog ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className="w-full max-w-4xl rounded-xl border border-white/15 bg-gray-900 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Detalhe da atividade</h3>
                    <p className="text-xs text-gray-400">
                      {selectedClientLog.created_at ? new Date(selectedClientLog.created_at).toLocaleString('pt-BR') : '-'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedClientLog(null)}
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
                  >
                    Fechar
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-xs uppercase text-gray-400">Ação</div>
                    <div className="mt-1 text-sm text-white">{selectedClientLog.action || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-xs uppercase text-gray-400">Cliente</div>
                    <div className="mt-1 text-sm text-white">{selectedClientLog.client_name || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-xs uppercase text-gray-400">Usuário</div>
                    <div className="mt-1 text-sm text-white">{selectedClientLog.actor_name || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-xs uppercase text-gray-400">Email</div>
                    <div className="mt-1 text-sm text-white">{selectedClientLog.actor_email || '-'}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 text-xs uppercase text-gray-400">Payload detalhado</div>
                  <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded bg-black/30 p-3 text-xs text-gray-200">
                    {JSON.stringify(selectedClientLog.details || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default Users;
