import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Eye, Search, Settings, SlidersHorizontal, UploadCloud } from 'lucide-react';
import api from '../../config/api';
import { getMockInternalServices } from '../../dev/clientPortalData';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const CITY_ORDER = ['Jacobina', 'Ourolandia', 'Umburanas', 'Uberlandia'];

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
  if (!key) return '';
  return String(city || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatCityLabel = (city = '') => {
  return canonicalCityLabel(city);
};

const getClientCity = (client) => canonicalCityLabel(client?.cidade || client?.cidade_atendimento || client?.endereco?.cidade || '');

const sectionTabs = [
  { id: 'setup_empresa', label: 'Setup Empresa' },
  { id: 'setup_config', label: 'Setup Config' },
  { id: 'acesso_cliente', label: 'Login Cliente' },
  { id: 'dados_empresa', label: 'Dados da empresa' },
  { id: 'assinatura', label: 'Assinatura' },
  { id: 'modulos_liberados', label: 'Módulos' },
  { id: 'servicos_vinculados', label: 'Serviços vinculados' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'senhas', label: 'Senhas' },
  { id: 'financeiro', label: 'Financeiro' },
];

const modulosBase = [
  'Financeiro',
  'Fiscal',
  'Impostos',
  'Serviços',
  'Documentos',
  'Trabalhista',
  'Atendimento',
  'Relatórios',
  'Macedogram',
  'Clube de Benefícios',
  'Chat',
];

const regimeOptions = [
  { value: 'mei', label: 'MEI' },
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
];

const tipoEmpresaOptions = [
  'MEI',
  'Microempresa',
  'Empresa de pequeno porte',
  'Empresa de medio porte',
  'Empresa de grande porte',
];

const naturezaJuridicaOptions = [
  'SLU',
  'LTDA',
  'EI',
  'SA',
  'EIRELI',
  'Sociedade Simples',
];

const canalOptions = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'portal', label: 'Portal' },
];

const monitoramentoOptions = ['basico', 'padrao', 'premium'];
const configTypeOptions = ['simples', 'intermediario', 'completo', 'personalizado'];
const segmentoPrincipalOptions = [
  { value: 'comercio', label: 'Comercio' },
  { value: 'servico', label: 'Servico' },
  { value: 'misto', label: 'Misto (Comercio e Servico)' },
  { value: 'industria', label: 'Industria' },
];
const socioFuncaoOptions = ['Socio Administrador', 'Socio'];
const setupTipoServicoOptions = ['Contabil', 'Fiscal', 'Trabalhista', 'Financeiro', 'Societario', 'Consultoria'];
const setupRegistrarEntradasOptions = ['Manual', 'Importacao por planilha', 'Integracao automatica', 'Misto'];
const setupFluxoServicoOptions = ['Padrao', 'Por etapa', 'Kanban', 'SLA rigido'];
const setupPagamentosRecebimentosOptions = ['Basico', 'Intermediario', 'Avancado'];
const setupTipoVendaOptions = ['Produto', 'Servico', 'Misto', 'Assinatura'];
const setupSlaInternoOptions = ['24h', '48h', '72h', '5 dias uteis'];
const estadoOptions = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapa' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceara' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espirito Santo' },
  { sigla: 'GO', nome: 'Goias' },
  { sigla: 'MA', nome: 'Maranhao' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Para' },
  { sigla: 'PB', nome: 'Paraiba' },
  { sigla: 'PR', nome: 'Parana' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piaui' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondonia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'Sao Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

const formatCep = (value = '') => {
  const digits = String(value).replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`;
};

const formatRegimeLabel = (value = '') =>
  String(value || '')
    .split('_')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ');

const enforceSocioAdminRule = (socios = []) => {
  if (!Array.isArray(socios) || socios.length === 0) return [];
  if (socios.length === 1) {
    return socios.map((socio) => ({ ...socio, funcao: 'Socio Administrador' }));
  }
  let adminFound = false;
  const normalized = socios.map((socio) => {
    const isAdmin = socio?.funcao === 'Socio Administrador';
    if (isAdmin && !adminFound) {
      adminFound = true;
      return { ...socio, funcao: 'Socio Administrador' };
    }
    return { ...socio, funcao: 'Socio' };
  });
  if (!adminFound) normalized[0] = { ...normalized[0], funcao: 'Socio Administrador' };
  return normalized;
};
const customToggleFields = [
  { key: 'mostrarPix', label: 'Mostrar PIX' },
  { key: 'mostrarContasBancarias', label: 'Mostrar contas bancárias' },
  { key: 'mostrarCategorias', label: 'Mostrar categorias' },
  { key: 'mostrarFechamentos', label: 'Mostrar fechamentos' },
  { key: 'mostrarValidadeSaldo', label: 'Mostrar validade de saldo' },
  { key: 'mostrarOrcamento', label: 'Mostrar orçamento' },
  { key: 'mostrarAssinatura', label: 'Mostrar assinatura' },
  { key: 'mostrarControle', label: 'Mostrar controle' },
  { key: 'mostrarCustoFixo', label: 'Mostrar custo fixo' },
  { key: 'mostrarMetas', label: 'Mostrar metas' },
  { key: 'mostrarResumoSemanal', label: 'Mostrar resumo semanal' },
  { key: 'permitirCriarContas', label: 'Permitir criar contas' },
  { key: 'permitirRegistrarPagamentos', label: 'Permitir registrar pagamentos' },
  { key: 'permitirRegistrarRecebimentos', label: 'Permitir registrar recebimentos' },
  { key: 'permitirSaidas', label: 'Permitir saídas' },
  { key: 'alertaVencimento', label: 'Alerta de vencimento' },
  { key: 'avisoAoRegistrar', label: 'Aviso ao registrar' },
  { key: 'travarEdicaoAposPago', label: 'Travar edição após pago' },
  { key: 'ativarModoVendaAVenda', label: 'Ativar modo venda a venda' },
  { key: 'ativarModoCpf', label: 'Ativar modo CPF' },
];

const suggestedModulesByConfigType = {
  simples: ['Impostos', 'Financeiro', 'Documentos'],
  intermediario: ['Impostos', 'Financeiro', 'Fiscal', 'Serviços', 'Documentos', 'Relatórios'],
  completo: ['Financeiro', 'Fiscal', 'Impostos', 'Serviços', 'Documentos', 'Atendimento', 'Relatórios', 'Chat'],
  personalizado: modulosBase,
};

const ClientesExpandido = () => {
  const { user, hasModuleAccess } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeSection, setActiveSection] = useState('setup_empresa');
  const [clientSetupMap, setClientSetupMap] = useState({});
  const [portalUsers, setPortalUsers] = useState([]);
  const [financialByClientId, setFinancialByClientId] = useState({});
  const [assinaturaPlans, setAssinaturaPlans] = useState([]);
  const [assinaturaServicesCatalog, setAssinaturaServicesCatalog] = useState([]);
  const [novoSocio, setNovoSocio] = useState({ nome: '', participacao: '', cpf: '', funcao: 'Socio' });
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [selectedCityFilter, setSelectedCityFilter] = useState('Todas as Cidades');
  const [clientListMode, setClientListMode] = useState('detalhado');
  const [newClientForm, setNewClientForm] = useState({
    nome_empresa: '',
    nome_fantasia: '',
    cnpj: '',
    tipo_regime: 'simples_nacional',
    status: 'ativo',
    cidade: 'Jacobina',
  });
  const [showPortalPassword, setShowPortalPassword] = useState(false);
  const canAccessClientesAvulso = hasModuleAccess('comercial') || hasModuleAccess('financeiro');
  const setupLoadedRef = useRef(false);
  const setupSyncTimerRef = useRef(null);

  useEffect(() => {
    loadClients();
    loadSetupMap();
    loadPortalUsers();
    loadFinancialClientsMap();
    loadAssinaturasSettings();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients?limit=1000');
      const apiClients = response.data?.clients || response.data || [];
      setClients(Array.isArray(apiClients) ? apiClients : []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setClients([]);
      toast.error('Não foi possível carregar clientes no backend.');
    } finally {
      setLoading(false);
    }
  };

  const loadSetupMap = async () => {
    try {
      const response = await api.get('/clients/setup-map');
      const setupMap = response.data?.setup_map || {};
      setClientSetupMap(setupMap && typeof setupMap === 'object' ? setupMap : {});
    } catch (error) {
      console.error('Erro ao carregar setup map do backend:', error);
      setClientSetupMap({});
    } finally {
      setupLoadedRef.current = true;
    }
  };

  const loadPortalUsers = async () => {
    try {
      const response = await api.get('/clients/portal-users');
      setPortalUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar usuários de portal dos clientes:', error);
      setPortalUsers([]);
    }
  };

  const loadFinancialClientsMap = async () => {
    try {
      const response = await api.get('/financial/clients?limit=5000');
      const list = Array.isArray(response.data) ? response.data : [];
      const map = {};
      list.forEach((item) => {
        const key = String(item.client_id || item.empresa_id || '');
        if (!key) return;
        map[key] = item;
      });
      setFinancialByClientId(map);
    } catch (error) {
      console.error('Erro ao carregar mapa financeiro dos clientes:', error);
      setFinancialByClientId({});
    }
  };

  const loadAssinaturasSettings = async () => {
    try {
      const [plansResponse, servicesResponse] = await Promise.all([
        api.get('/financial/settings/assinaturas/plans'),
        api.get('/financial/settings/assinaturas/services'),
      ]);
      const plans = Array.isArray(plansResponse.data?.items) ? plansResponse.data.items : [];
      const services = Array.isArray(servicesResponse.data?.items) ? servicesResponse.data.items : [];
      setAssinaturaPlans(
        plans.map((plan) => ({
          ...plan,
          nome: plan.nome || plan.name || '',
          services: Array.isArray(plan.services) ? plan.services : (Array.isArray(plan.selectedServices) ? plan.selectedServices : []),
        })),
      );
      setAssinaturaServicesCatalog(
        services.map((service) => ({
          ...service,
          nome: service.nome || service.name || '',
        })),
      );
    } catch (error) {
      console.error('Erro ao carregar configuracao de assinaturas:', error);
      setAssinaturaPlans([]);
      setAssinaturaServicesCatalog([]);
    }
  };

  const saveSetupMap = (nextValueOrFn) => {
    setClientSetupMap((current) => {
      const next = typeof nextValueOrFn === 'function' ? nextValueOrFn(current) : nextValueOrFn;
      return next;
    });
  };

  useEffect(() => {
    if (!setupLoadedRef.current) return;
    if (!selectedClient?.id) return;
    const clientId = String(selectedClient.id);
    const payload = clientSetupMap?.[clientId];
    if (!payload) return;
    if (setupSyncTimerRef.current) window.clearTimeout(setupSyncTimerRef.current);
    setupSyncTimerRef.current = window.setTimeout(async () => {
      try {
        await api.put(`/clients/setup/${clientId}`, { payload });
      } catch (error) {
        console.error('Erro ao salvar setup do cliente no backend:', error);
      }
    }, 500);
    return () => {
      if (setupSyncTimerRef.current) window.clearTimeout(setupSyncTimerRef.current);
    };
  }, [clientSetupMap, selectedClient?.id]);

  const getClientRegime = (client) => client?.tipo_regime || client?.regime || 'nao_definido';

  const allowedCitiesSet = useMemo(() => {
    if (user?.role === 'admin') return null;
    const cities = Array.isArray(user?.allowed_cities) ? user.allowed_cities : [];
    const normalized = cities.map(normalizeText);
    if (!normalized.length || normalized.includes('todas')) return null;
    return new Set(normalized);
  }, [user]);

  const clientsBaseFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let base = [...clients];

    if (allowedCitiesSet) {
      base = base.filter((client) => allowedCitiesSet.has(normalizeText(getClientCity(client))));
    }

    if (!term) return base;
    return base.filter((client) => (
      client.nome_empresa?.toLowerCase().includes(term) ||
      client.nome_fantasia?.toLowerCase().includes(term) ||
      client.cnpj?.toLowerCase().includes(term)
    ));
  }, [clients, search, allowedCitiesSet]);

  const filteredClients = useMemo(() => {
    if (selectedCityFilter === 'Todas as Cidades') return clientsBaseFiltered;
    return clientsBaseFiltered.filter((client) => canonicalCityKey(getClientCity(client)) === canonicalCityKey(selectedCityFilter));
  }, [clientsBaseFiltered, selectedCityFilter]);

  const cityCounts = useMemo(() => {
    const countMap = new Map();
    clientsBaseFiltered.forEach((client) => {
      const city = getClientCity(client);
      const cityKey = canonicalCityKey(city);
      if (!cityKey) return;
      const current = countMap.get(cityKey) || { city: canonicalCityLabel(city), count: 0 };
      current.count += 1;
      if (!current.city && city) current.city = canonicalCityLabel(city);
      countMap.set(cityKey, current);
    });
    const citiesOrdered = Array.from(countMap.keys()).sort((a, b) => {
      const ai = CITY_ORDER.findIndex((x) => canonicalCityKey(x) === canonicalCityKey(a));
      const bi = CITY_ORDER.findIndex((x) => canonicalCityKey(x) === canonicalCityKey(b));
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b, 'pt-BR');
    });
    return citiesOrdered.map((cityKey) => ({
      city: countMap.get(cityKey)?.city || canonicalCityLabel(cityKey),
      count: countMap.get(cityKey)?.count || 0,
    }));
  }, [clientsBaseFiltered]);

  const selectedSetup = useMemo(() => {
    if (!selectedClient) return null;
    const base = clientSetupMap[selectedClient.id] || createDefaultClientSetup(selectedClient);
    const portalUser = portalUsers.find((item) => String(item.clientRefId) === String(selectedClient.id));
    return {
      ...base,
      assinatura: {
        ...(base.assinatura || {}),
        planId: base.assinatura?.planId || '',
        nomePlano: base.assinatura?.nomePlano || '',
        servicos: Array.isArray(base.assinatura?.servicos) ? base.assinatura.servicos : [],
        observacoes: base.assinatura?.observacoes || '',
      },
      acessoCliente: {
        ...(base.acessoCliente || {}),
        nome: base.acessoCliente?.nome || portalUser?.nome || selectedClient.nome_fantasia || '',
        email: base.acessoCliente?.email || portalUser?.email || '',
        senha: base.acessoCliente?.senha || portalUser?.senha || '',
        clienteId: base.acessoCliente?.clienteId || portalUser?.clienteId || selectedClient.id,
        salvo: Boolean(base.acessoCliente?.salvo || portalUser),
        atualizadoEm: base.acessoCliente?.atualizadoEm || portalUser?.updatedAt || '',
      },
    };
  }, [clientSetupMap, selectedClient, portalUsers]);

  const selectedFinancialData = useMemo(() => {
    if (!selectedClient) return null;
    return financialByClientId[String(selectedClient.id)] || null;
  }, [selectedClient, financialByClientId]);

  const cityOptions = useMemo(() => {
    const base = new Set(['Jacobina', 'Ourolandia', 'Umburanas', 'Uberlandia']);
    clients.forEach((client) => {
      const city = getClientCity(client);
      if (city) base.add(city);
    });
    Object.values(clientSetupMap || {}).forEach((cfg) => {
      const city = cfg?.setupEmpresa?.enderecoCidade;
      if (city) base.add(canonicalCityLabel(city));
    });
    return Array.from(base).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [clients, clientSetupMap]);

  const setupTypeLabel = (client) => {
    const cfg = clientSetupMap[client.id] || createDefaultClientSetup(client);
    if (cfg.setupEmpresaSalvo && cfg.setupConfigSalvo) return 'Configurado';
    if (cfg.setupEmpresaSalvo) return 'Parcial';
    return 'Inicial';
  };

  const setupTypeClass = (label) => {
    if (label === 'Configurado') return 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/30';
    if (label === 'Parcial') return 'bg-amber-600/20 text-amber-300 border border-amber-600/30';
    return 'bg-zinc-600/20 text-zinc-300 border border-zinc-600/30';
  };

  const ensureClientSetup = (client) => {
    saveSetupMap((current) => {
      if (current[client.id]) return current;
      return { ...current, [client.id]: createDefaultClientSetup(client) };
    });
  };

  const openConfig = (client) => {
    setSelectedClient(client);
    ensureClientSetup(client);
    setNovoSocio({ nome: '', participacao: '', cpf: '', funcao: 'Socio' });
    setActiveSection('setup_empresa');
    setShowConfigModal(true);
  };

  const openClientData = (client) => {
    setSelectedClient(client);
    ensureClientSetup(client);
    setNovoSocio({ nome: '', participacao: '', cpf: '', funcao: 'Socio' });
    setActiveSection('dados_empresa');
    setShowConfigModal(true);
  };

  const deleteSelectedClient = async () => {
    if (!selectedClient?.id) return;
    if (user?.role !== 'admin') {
      toast.error('Apenas administradores podem excluir clientes.');
      return;
    }
    const confirmed = window.confirm(`Deseja realmente excluir o cliente "${selectedClient.nome_empresa}"?`);
    if (!confirmed) return;

    try {
      await api.delete(`/clients/${selectedClient.id}`);
    } catch (error) {
      console.warn('Falha ao excluir cliente no backend.', error);
      toast.error('Não foi possível excluir o cliente no backend.');
      return;
    }

    setClients((prev) => prev.filter((item) => String(item.id) !== String(selectedClient.id)));
    saveSetupMap((current) => {
      const next = { ...current };
      delete next[selectedClient.id];
      return next;
    });

    setShowConfigModal(false);
    setSelectedClient(null);
    toast.success('Cliente excluído com sucesso.');
  };

  const updateSetupEmpresa = (field, value) => {
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          setupEmpresa: { ...base.setupEmpresa, [field]: value },
        },
      };
    });
  };

  const toggleSetupEmpresaBoolean = (field, clearField) => {
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      const nextBoolean = !Boolean(base.setupEmpresa[field]);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          setupEmpresa: {
            ...base.setupEmpresa,
            [field]: nextBoolean,
            ...(clearField && !nextBoolean ? { [clearField]: '' } : {}),
          },
        },
      };
    });
  };

  const getSociosArray = () => {
    const socios = selectedSetup?.setupEmpresa?.socios;
    if (Array.isArray(socios)) return enforceSocioAdminRule(socios);
    if (typeof socios === 'string' && socios.trim()) {
      return [{ nome: socios.trim(), participacao: '', cpf: '', funcao: 'Socio Administrador' }];
    }
    return [];
  };

  const adicionarSocio = () => {
    if (!selectedClient) return;
    if (!novoSocio.nome.trim()) {
      toast.error('Informe ao menos o nome do socio para adicionar.');
      return;
    }
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      const sociosAtuais = Array.isArray(base.setupEmpresa.socios)
        ? base.setupEmpresa.socios
        : (typeof base.setupEmpresa.socios === 'string' && base.setupEmpresa.socios.trim()
          ? [{ nome: base.setupEmpresa.socios.trim(), participacao: '', cpf: '', funcao: '' }]
          : []);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          setupEmpresa: {
            ...base.setupEmpresa,
            socios: enforceSocioAdminRule([
              ...sociosAtuais,
              {
                nome: novoSocio.nome.trim(),
                participacao: novoSocio.participacao.trim(),
                cpf: novoSocio.cpf.trim(),
                funcao: novoSocio.funcao.trim() || 'Socio',
              },
            ]),
          },
        },
      };
    });
    setNovoSocio({ nome: '', participacao: '', cpf: '', funcao: 'Socio' });
  };

  const removerSocio = (index) => {
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      const sociosAtuais = Array.isArray(base.setupEmpresa.socios) ? base.setupEmpresa.socios : [];
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          setupEmpresa: {
            ...base.setupEmpresa,
            socios: enforceSocioAdminRule(sociosAtuais.filter((_, idx) => idx !== index)),
          },
        },
      };
    });
  };

  const definirSocioAdministrador = (indexAdministrador) => {
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      const sociosAtuais = Array.isArray(base.setupEmpresa.socios) ? base.setupEmpresa.socios : [];
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          setupEmpresa: {
            ...base.setupEmpresa,
            socios: enforceSocioAdminRule(
              sociosAtuais.map((socio, index) => ({
                ...socio,
                funcao: index === indexAdministrador ? 'Socio Administrador' : 'Socio',
              })),
            ),
          },
        },
      };
    });
  };

  const saveSetupEmpresa = () => {
    if (!selectedClient) return;
    const setup = selectedSetup?.setupEmpresa;
    if (!setup?.razaoSocial || !setup?.cnpj || !setup?.regimeTributario) {
      toast.error('Preencha os campos obrigatorios: razao social, CNPJ e regime tributario.');
      return;
    }
    if (setup?.informarInscricaoEstadual && !setup?.inscricaoEstadual) {
      toast.error('Marcou inscricao estadual. Preencha o campo antes de salvar.');
      return;
    }
    if (setup?.informarInscricaoMunicipal && !setup?.inscricaoMunicipal) {
      toast.error('Marcou inscricao municipal. Preencha o campo antes de salvar.');
      return;
    }
    if (setup?.informarNaturezaJuridica && !setup?.naturezaJuridica) {
      toast.error('Marcou natureza juridica. Selecione uma opcao antes de salvar.');
      return;
    }

    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          setupEmpresaSalvo: true,
          setupEmpresa: { ...base.setupEmpresa },
          setupConfig: {
            ...base.setupConfig,
            regime: base.setupEmpresa.regimeTributario,
          },
        },
      };
    });
    toast.success('Setup Empresa salvo. Setup Config liberado.');
  };

  const updateSetupConfig = (field, value) => {
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          setupConfig: { ...base.setupConfig, [field]: value },
        },
      };
    });
  };

  const saveSetupConfig = () => {
    if (!selectedClient) return;
    if (!selectedSetup?.setupEmpresaSalvo) {
      toast.error('Salve primeiro o Setup Empresa.');
      return;
    }
    if (!selectedSetup?.setupConfig?.tipoConfiguracao) {
      toast.error('Selecione o tipo de configuracao.');
      return;
    }
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          setupConfigSalvo: true,
          setupConfig: {
            ...base.setupConfig,
            regime: base.setupEmpresa.regimeTributario,
          },
        },
      };
    });
    toast.success('Setup Config salvo.');
  };

  const updateCustomToggle = (field) => {
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          setupConfig: {
            ...base.setupConfig,
            [field]: !base.setupConfig[field],
          },
        },
      };
    });
  };

  const toggleModulo = (modulo) => {
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      const exists = base.modulosLiberados.includes(modulo);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          modulosLiberados: exists
            ? base.modulosLiberados.filter((item) => item !== modulo)
            : [...base.modulosLiberados, modulo],
        },
      };
    });
  };

  const applySuggestedModules = () => {
    if (!selectedClient || !selectedSetup) return;
    const type = selectedSetup.setupConfig.tipoConfiguracao || 'simples';
    const suggested = suggestedModulesByConfigType[type] || suggestedModulesByConfigType.simples;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          modulosLiberados: [...suggested],
        },
      };
    });
    toast.success('Módulos sugeridos aplicados.');
  };

  const updateSetupAcessoCliente = (field, value) => {
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          acessoCliente: {
            ...base.acessoCliente,
            [field]: value,
          },
        },
      };
    });
  };

  const updateSetupSenha = (field, value) => {
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          senhas: {
            ...base.senhas,
            [field]: value,
          },
        },
      };
    });
  };

  const updateSetupAssinatura = (field, value) => {
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          assinatura: {
            ...(base.assinatura || {}),
            [field]: value,
          },
        },
      };
    });
  };

  const applyAssinaturaPlan = (planId) => {
    const plan = assinaturaPlans.find((item) => String(item.id) === String(planId));
    if (!plan) {
      updateSetupAssinatura('planId', '');
      updateSetupAssinatura('nomePlano', '');
      updateSetupAssinatura('servicos', []);
      return;
    }
    if (!selectedClient) return;
    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          assinatura: {
            ...(base.assinatura || {}),
            planId: plan.id,
            nomePlano: plan.nome || plan.name || '',
            servicos: Array.isArray(plan.services) ? plan.services : (Array.isArray(plan.selectedServices) ? plan.selectedServices : []),
          },
        },
      };
    });
  };

  const saveClientPortalLogin = async () => {
    if (!selectedClient || !selectedSetup) return;

    const nome = String(selectedSetup.acessoCliente?.nome || '').trim();
    const email = String(selectedSetup.acessoCliente?.email || '').trim().toLowerCase();
    const senha = String(selectedSetup.acessoCliente?.senha || '').trim();

    if (!nome || !email || !senha) {
      toast.error('Preencha nome, email e senha do login do cliente.');
      return;
    }

    try {
      await api.put(`/clients/portal-users/${selectedClient.id}`, {
        nome,
        email,
        senha,
        clienteId: selectedSetup.acessoCliente?.clienteId || selectedClient.id,
      });
      await loadPortalUsers();
    } catch (error) {
      console.error('Erro ao salvar login do cliente no backend:', error);
      toast.error('Não foi possível salvar login do cliente no backend.');
      return;
    }

    saveSetupMap((current) => {
      const base = current[selectedClient.id] || createDefaultClientSetup(selectedClient);
      return {
        ...current,
        [selectedClient.id]: {
          ...base,
          acessoCliente: {
            ...base.acessoCliente,
            nome,
            email,
            senha,
            salvo: true,
            atualizadoEm: new Date().toISOString(),
            clienteId: nextUser.clienteId,
          },
        },
      };
    });

    toast.success('Login do cliente salvo para o portal.');
  };

  const handleTabClick = (tabId) => {
    if (tabId === 'setup_config' && !selectedSetup?.setupEmpresaSalvo) {
      toast.error('Setup Config bloqueado. Salve primeiro o Setup Empresa.');
      return;
    }
    setActiveSection(tabId);
  };

  const handleCreateClient = async () => {
    if (!newClientForm.nome_empresa || !newClientForm.cnpj) {
      toast.error('Informe ao menos nome da empresa e CNPJ.');
      return;
    }
    try {
      await api.post('/clients', {
        nome_empresa: newClientForm.nome_empresa,
        nome_fantasia: newClientForm.nome_fantasia || newClientForm.nome_empresa,
        status_empresa: newClientForm.status || 'ativa',
        cidade_atendimento: newClientForm.cidade,
        telefone: '',
        whatsapp: '',
        email: '',
        responsavel_empresa: '',
        cnpj: newClientForm.cnpj,
        codigo_iob: '',
        novo_cliente: true,
        tipo_empresa: 'matriz',
        tipo_regime: newClientForm.tipo_regime,
        endereco: {
          logradouro: '-',
          numero: '',
          complemento: '',
          bairro: '-',
          distrito: '',
          cep: '00000-000',
          cidade: newClientForm.cidade,
          estado: 'BA',
        },
        forma_envio: 'email',
        empresa_grupo: '',
      });

      setShowNewClientModal(false);
      setNewClientForm({
        nome_empresa: '',
        nome_fantasia: '',
        cnpj: '',
        tipo_regime: 'simples_nacional',
        status: 'ativo',
        cidade: 'Jacobina',
      });
      await loadClients();
      toast.success('Cliente adicionado no backend.');
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      toast.error('Não foi possível criar cliente no backend.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center gap-2">
            <Building2 className="w-8 h-8 text-red-400" />
            Clientes
          </h1>
          <p className="text-gray-400 mt-2">Centro de configuracao do cliente no sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          {hasModuleAccess('financeiro') ? (
            <button
              type="button"
              onClick={() => navigate('/clientes-financeiro')}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-emerald-100 hover:bg-emerald-500/25"
            >
              Ir para Lista do Financeiro
            </button>
          ) : null}
          {canAccessClientesAvulso ? (
            <button
              type="button"
              onClick={() => navigate('/clientes-avulso')}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/35 bg-cyan-500/15 px-4 py-2 text-cyan-100 hover:bg-cyan-500/25"
            >
              Lista de Clientes Avulso
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowNewClientModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 border border-red-600/30 text-red-200 hover:bg-red-600/30"
          >
            <UploadCloud className="w-4 h-4" />
            Novo Cliente
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/30 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white"
            placeholder="Buscar por empresa, fantasia ou CNPJ..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
        <aside className="glass rounded-2xl p-4 h-fit">
          <h3 className="text-sm font-semibold text-white mb-3">Cidades</h3>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSelectedCityFilter('Todas as Cidades')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                selectedCityFilter === 'Todas as Cidades'
                  ? 'bg-red-500/15 border border-red-500/35 text-red-100'
                  : 'bg-black/20 border border-gray-700 text-gray-200 hover:bg-black/35'
              }`}
            >
              Todas as Cidades ({clientsBaseFiltered.length})
            </button>
            {cityCounts.map((item) => (
              <button
                key={item.city}
                type="button"
                onClick={() => setSelectedCityFilter(item.city)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  normalizeText(selectedCityFilter) === normalizeText(item.city)
                    ? 'bg-red-500/15 border border-red-500/35 text-red-100'
                    : 'bg-black/20 border border-gray-700 text-gray-200 hover:bg-black/35'
                }`}
              >
                {formatCityLabel(item.city)} ({item.count})
              </button>
            ))}
          </div>
        </aside>

        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-300">
              Lista de clientes: <span className="font-semibold text-white">{filteredClients.length}</span>
            </p>
            <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
              <button
                type="button"
                onClick={() => setClientListMode('detalhado')}
                className={`rounded-md px-2.5 py-1 ${clientListMode === 'detalhado' ? 'bg-white text-slate-900' : 'text-gray-300'}`}
              >
                Detalhado
              </button>
              <button
                type="button"
                onClick={() => setClientListMode('resumido')}
                className={`rounded-md px-2.5 py-1 ${clientListMode === 'resumido' ? 'bg-white text-slate-900' : 'text-gray-300'}`}
              >
                Resumido
              </button>
            </div>
          </div>
          {loading ? (
            <div className="rounded-xl border border-gray-700 bg-black/20 p-8 text-center text-gray-400">
              Carregando clientes...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="rounded-xl border border-gray-700 bg-black/20 p-8 text-center text-gray-400">
              Nenhum cliente encontrado.
            </div>
          ) : clientListMode === 'resumido' ? (
            <div className="space-y-2">
              {filteredClients.map((client) => (
                <article
                  key={client.id}
                  onClick={() => openClientData(client)}
                  className="group cursor-pointer rounded-xl border border-gray-700 bg-black/20 px-4 py-3 transition-colors hover:border-red-500/35 hover:bg-red-600/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white">{client.nome_empresa}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openConfig(client);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-600/30 bg-red-600/20 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-600/30"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Configurar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filteredClients.map((client) => {
                const setupLabel = setupTypeLabel(client);
                return (
                  <article
                    key={client.id}
                    onClick={() => openClientData(client)}
                    className="group cursor-pointer rounded-xl border border-gray-700 bg-black/20 p-4 transition-colors hover:border-red-500/35 hover:bg-red-600/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white">{client.nome_empresa}</h3>
                        {client.nome_fantasia ? (
                          <p className="truncate text-xs text-gray-400">{client.nome_fantasia}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openConfig(client);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-600/30 bg-red-600/20 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-600/30"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Configurar
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-gray-700 bg-black/20 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">CNPJ</p>
                        <p className="mt-1 font-mono text-xs text-gray-200">{client.cnpj || '-'}</p>
                      </div>
                      <div className="rounded-lg border border-gray-700 bg-black/20 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Cidade</p>
                        <p className="mt-1 text-xs text-gray-200">{getClientCity(client) ? formatCityLabel(getClientCity(client)) : '-'}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-blue-600/30 bg-blue-600/20 px-3 py-1 text-[11px] font-medium capitalize text-blue-300">
                        {getClientRegime(client).replaceAll('_', ' ')}
                      </span>
                      <span className="rounded-full border border-zinc-600/30 bg-zinc-600/20 px-3 py-1 text-[11px] font-medium capitalize text-zinc-300">
                        {client.status || 'ativo'}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${setupTypeClass(setupLabel)}`}>
                        {setupLabel}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showConfigModal && selectedClient && selectedSetup ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-6xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedClient.nome_fantasia || selectedClient.nome_empresa}</h2>
                <p className="text-sm text-gray-400">Centro de configuracao do cliente</p>
              </div>
              <div className="flex items-center gap-2">
                {user?.role === 'admin' ? (
                  <button
                    type="button"
                    onClick={deleteSelectedClient}
                    className="px-4 py-2 rounded-lg border border-red-500/40 bg-red-500/20 text-red-100 hover:bg-red-500/30"
                  >
                    Excluir cliente
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
              {sectionTabs
                .filter((tab) => {
                  if (tab.id === 'setup_config' && !selectedSetup.setupEmpresaSalvo) return false;
                  if (tab.id === 'financeiro') {
                    const userCanSee = user?.role === 'admin' || (user?.allowed_modules || []).includes('financeiro');
                    if (!userCanSee) return false;
                    if (!selectedSetup.modulosLiberados.includes('Financeiro')) return false;
                  }
                  return true;
                })
                .map((tab) => {
                const blocked = tab.id === 'setup_config' && !selectedSetup.setupEmpresaSalvo;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabClick(tab.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      activeSection === tab.id
                        ? 'border-red-500/40 bg-red-500/15 text-red-200'
                        : blocked
                          ? 'border-gray-800 bg-black/20 text-gray-500 cursor-not-allowed'
                          : 'border-gray-700 bg-black/30 text-gray-300 hover:bg-black/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeSection === 'setup_empresa' ? (
              <SectionCard title="Setup Empresa (Etapa 1)" icon={<Settings className="w-5 h-5 text-red-300" />}>
                <p className="text-sm text-gray-400 mb-4">Preencha e salve esta etapa para liberar o Setup Config.</p>
                {(() => {
                  const isMei = selectedSetup.setupEmpresa.regimeTributario === 'mei' || selectedSetup.setupEmpresa.tipoEmpresa === 'MEI';
                  const socios = getSociosArray();
                  return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InputField label="Razao social *" value={selectedSetup.setupEmpresa.razaoSocial} onChange={(v) => updateSetupEmpresa('razaoSocial', v)} />
                  <InputField label="Nome fantasia" value={selectedSetup.setupEmpresa.nomeFantasia} onChange={(v) => updateSetupEmpresa('nomeFantasia', v)} />
                  <InputField label="CNPJ *" value={selectedSetup.setupEmpresa.cnpj} onChange={(v) => updateSetupEmpresa('cnpj', v)} />

                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-gray-700 bg-black/20 p-3">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedSetup.setupEmpresa.informarInscricaoEstadual)}
                        onChange={() => toggleSetupEmpresaBoolean('informarInscricaoEstadual', 'inscricaoEstadual')}
                      />
                      Informar inscricao estadual
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedSetup.setupEmpresa.informarInscricaoMunicipal)}
                        onChange={() => toggleSetupEmpresaBoolean('informarInscricaoMunicipal', 'inscricaoMunicipal')}
                      />
                      Informar inscricao municipal
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedSetup.setupEmpresa.informarNaturezaJuridica)}
                        onChange={() => toggleSetupEmpresaBoolean('informarNaturezaJuridica', 'naturezaJuridica')}
                      />
                      Informar natureza juridica
                    </label>
                  </div>

                  {selectedSetup.setupEmpresa.informarInscricaoEstadual ? (
                    <InputField
                      label="Inscricao estadual"
                      value={selectedSetup.setupEmpresa.inscricaoEstadual}
                      onChange={(v) => updateSetupEmpresa('inscricaoEstadual', v)}
                    />
                  ) : <div />}
                  {selectedSetup.setupEmpresa.informarInscricaoMunicipal ? (
                    <InputField
                      label="Inscricao municipal"
                      value={selectedSetup.setupEmpresa.inscricaoMunicipal}
                      onChange={(v) => updateSetupEmpresa('inscricaoMunicipal', v)}
                    />
                  ) : <div />}
                  <div />
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Regime tributario *</label>
                    <select
                      value={selectedSetup.setupEmpresa.regimeTributario}
                      onChange={(e) => {
                        updateSetupEmpresa('regimeTributario', e.target.value);
                        if (e.target.value === 'mei') {
                          updateSetupEmpresa('tipoEmpresa', 'MEI');
                          updateSetupEmpresa('socios', []);
                        }
                      }}
                      className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    >
                      {regimeOptions.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Tipo de empresa</label>
                    <select
                      value={selectedSetup.setupEmpresa.tipoEmpresa}
                      onChange={(e) => updateSetupEmpresa('tipoEmpresa', e.target.value)}
                      className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    >
                      {tipoEmpresaOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  {selectedSetup.setupEmpresa.informarNaturezaJuridica ? (
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Natureza juridica</label>
                      <select
                        value={selectedSetup.setupEmpresa.naturezaJuridica}
                        onChange={(e) => updateSetupEmpresa('naturezaJuridica', e.target.value)}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      >
                        <option value="">Selecione...</option>
                        {naturezaJuridicaOptions.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>
                  ) : <div />}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Segmento principal</label>
                    <select
                      value={selectedSetup.setupEmpresa.segmentoPrincipal}
                      onChange={(e) => updateSetupEmpresa('segmentoPrincipal', e.target.value)}
                      className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="">Selecione...</option>
                      {segmentoPrincipalOptions.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>

                  {!isMei ? (
                    <div className="md:col-span-3 rounded-lg border border-gray-700 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-sm text-gray-200 font-medium">Socios</p>
                        <button
                          type="button"
                          onClick={adicionarSocio}
                          className="rounded-lg border border-red-500/35 bg-red-500/15 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/25"
                        >
                          {socios.length ? 'Adicionar socio' : 'Adicionar primeiro socio'}
                        </button>
                      </div>
                      {socios.length > 0 ? (
                        <div className="space-y-2 mb-3">
                          {socios.map((socio, index) => (
                            <div key={`${socio.nome}-${index}`} className="rounded-lg border border-gray-700 bg-black/30 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                              <div>
                                <p className="text-white text-sm font-medium">{socio.nome || '-'}</p>
                                <p className="text-xs text-gray-400">
                                  {socio.participacao ? `${socio.participacao}%` : 'Sem participacao'} {socio.cpf ? `• CPF ${socio.cpf}` : ''} {socio.funcao ? `• ${socio.funcao}` : ''}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {socios.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => definirSocioAdministrador(index)}
                                    className="rounded-lg border border-blue-500/35 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-100 hover:bg-blue-500/25"
                                  >
                                    Definir administrador
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => removerSocio(index)}
                                  className="rounded-lg border border-gray-600 bg-gray-700/40 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600/40"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <InputField
                          label="Nome do socio"
                          value={novoSocio.nome}
                          onChange={(v) => setNovoSocio((prev) => ({ ...prev, nome: v }))}
                        />
                        <InputField
                          label="Participacao (%)"
                          value={novoSocio.participacao}
                          onChange={(v) => setNovoSocio((prev) => ({ ...prev, participacao: v }))}
                        />
                        <InputField
                          label="CPF"
                          value={novoSocio.cpf}
                          onChange={(v) => setNovoSocio((prev) => ({ ...prev, cpf: v }))}
                        />
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">Funcao</label>
                          <select
                            value={novoSocio.funcao || 'Socio'}
                            onChange={(e) => setNovoSocio((prev) => ({ ...prev, funcao: e.target.value }))}
                            className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                          >
                            {socioFuncaoOptions.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <InputField label="CEP" value={selectedSetup.setupEmpresa.enderecoCep} onChange={(v) => updateSetupEmpresa('enderecoCep', formatCep(v))} />
                  <InputField label="Logradouro" value={selectedSetup.setupEmpresa.enderecoLogradouro} onChange={(v) => updateSetupEmpresa('enderecoLogradouro', v)} />
                  <InputField label="Numero" value={selectedSetup.setupEmpresa.enderecoNumero} onChange={(v) => updateSetupEmpresa('enderecoNumero', v)} />

                  <InputField label="Complemento" value={selectedSetup.setupEmpresa.enderecoComplemento} onChange={(v) => updateSetupEmpresa('enderecoComplemento', v)} />
                  <InputField label="Bairro" value={selectedSetup.setupEmpresa.enderecoBairro} onChange={(v) => updateSetupEmpresa('enderecoBairro', v)} />
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Cidade</label>
                    <select
                      value={selectedSetup.setupEmpresa.enderecoCidade}
                      onChange={(e) => updateSetupEmpresa('enderecoCidade', e.target.value)}
                      className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="">Selecione...</option>
                      {cityOptions.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Estado (UF)</label>
                    <select
                      value={selectedSetup.setupEmpresa.enderecoEstado}
                      onChange={(e) => updateSetupEmpresa('enderecoEstado', e.target.value)}
                      className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="">Selecione...</option>
                      {estadoOptions.map((estado) => (
                        <option key={estado.sigla} value={estado.sigla}>
                          {estado.nome} ({estado.sigla})
                        </option>
                      ))}
                    </select>
                  </div>
                  <InputField label="Email de contato" value={selectedSetup.setupEmpresa.contatoEmail} onChange={(v) => updateSetupEmpresa('contatoEmail', v)} />
                  <InputField label="Telefone" value={selectedSetup.setupEmpresa.contatoTelefone} onChange={(v) => updateSetupEmpresa('contatoTelefone', v)} />

                  <InputField label="WhatsApp" value={selectedSetup.setupEmpresa.contatoWhatsapp} onChange={(v) => updateSetupEmpresa('contatoWhatsapp', v)} />
                  <InputField label="URL da logo" value={selectedSetup.setupEmpresa.logoUrl} onChange={(v) => updateSetupEmpresa('logoUrl', v)} />
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Logo da empresa</label>
                    <label className="w-full inline-flex items-center gap-2 justify-center bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white cursor-pointer hover:bg-black/40">
                      <UploadCloud className="w-4 h-4" />
                      {selectedSetup.setupEmpresa.logoFileName || 'Selecionar arquivo'}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          updateSetupEmpresa('logoFileName', file ? file.name : '');
                        }}
                      />
                    </label>
                  </div>
                </div>
                  );
                })()}
                <div className="mt-5 flex items-center gap-3">
                  <button type="button" onClick={saveSetupEmpresa} className="btn-futuristic px-5 py-2 rounded-lg text-white font-medium">
                    Salvar Setup Empresa
                  </button>
                  <span className={`text-xs px-3 py-1 rounded-full border ${
                    selectedSetup.setupEmpresaSalvo
                      ? 'border-emerald-600/30 bg-emerald-600/20 text-emerald-300'
                      : 'border-zinc-600/30 bg-zinc-600/20 text-zinc-300'
                  }`}>
                    {selectedSetup.setupEmpresaSalvo ? 'Setup Empresa salvo' : 'Setup Empresa pendente'}
                  </span>
                </div>
              </SectionCard>
            ) : null}

            {activeSection === 'setup_config' ? (
              <SectionCard title="Setup Config" icon={<SlidersHorizontal className="w-5 h-5 text-red-300" />}>
                {!selectedSetup.setupEmpresaSalvo ? (
                  <div className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-4 text-amber-300">
                    Setup Config bloqueado. Salve primeiro o Setup Empresa.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField label="Regime (herdado do Setup Empresa)" value={formatRegimeLabel(selectedSetup.setupConfig.regime)} readOnly />
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Tipo de configuracao *</label>
                        <select
                          value={selectedSetup.setupConfig.tipoConfiguracao}
                          onChange={(e) => updateSetupConfig('tipoConfiguracao', e.target.value)}
                          className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                        >
                          {configTypeOptions.map((item) => (
                            <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {selectedSetup.setupConfig.tipoConfiguracao === 'simples' ? (
                      <div className="mt-4 rounded-lg border border-gray-700 bg-black/20 p-4">
                        <p className="text-sm text-gray-300 mb-3">Modo simples: foco em usabilidade básica e visual enxuto.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-300 mb-2">Tipo de serviço padrão</label>
                            <select
                              value={selectedSetup.setupConfig.simplesTipoServico}
                              onChange={(e) => updateSetupConfig('simplesTipoServico', e.target.value)}
                              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                            >
                              {setupTipoServicoOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-300 mb-2">Canal padrão</label>
                            <select
                              value={selectedSetup.setupConfig.canalEnvio}
                              onChange={(e) => updateSetupConfig('canalEnvio', e.target.value)}
                              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                            >
                              {canalOptions.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {selectedSetup.setupConfig.tipoConfiguracao === 'intermediario' ? (
                      <div className="mt-4 rounded-lg border border-gray-700 bg-black/20 p-4">
                        <p className="text-sm text-gray-300 mb-3">Modo intermediário: controles operacionais essenciais.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-300 mb-2">Tipo de serviço</label>
                            <select
                              value={selectedSetup.setupConfig.intermediarioTipoServico}
                              onChange={(e) => updateSetupConfig('intermediarioTipoServico', e.target.value)}
                              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                            >
                              <option value="">Selecione...</option>
                              {setupTipoServicoOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-300 mb-2">Forma de registrar entradas</label>
                            <select
                              value={selectedSetup.setupConfig.intermediarioRegistrarEntradas}
                              onChange={(e) => updateSetupConfig('intermediarioRegistrarEntradas', e.target.value)}
                              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                            >
                              <option value="">Selecione...</option>
                              {setupRegistrarEntradasOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-300 mb-2">Fluxo do serviço</label>
                            <select
                              value={selectedSetup.setupConfig.intermediarioFluxoServico}
                              onChange={(e) => updateSetupConfig('intermediarioFluxoServico', e.target.value)}
                              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                            >
                              <option value="">Selecione...</option>
                              {setupFluxoServicoOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </div>
                          <label className="flex items-center gap-2 rounded-lg border border-gray-700 bg-black/30 px-4 py-2 text-sm text-white">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedSetup.setupConfig.intermediarioExibicao)}
                              onChange={(e) => updateSetupConfig('intermediarioExibicao', e.target.checked)}
                            />
                            Opções básicas de exibição
                          </label>
                        </div>
                      </div>
                    ) : null}

                    {selectedSetup.setupConfig.tipoConfiguracao === 'completo' ? (
                      <div className="mt-4 rounded-lg border border-gray-700 bg-black/20 p-4">
                        <p className="text-sm text-gray-300 mb-3">Modo completo: maior controle financeiro e comercial.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-300 mb-2">Pagamentos e recebimentos</label>
                            <select
                              value={selectedSetup.setupConfig.completoPagamentosRecebimentos}
                              onChange={(e) => updateSetupConfig('completoPagamentosRecebimentos', e.target.value)}
                              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                            >
                              <option value="">Selecione...</option>
                              {setupPagamentosRecebimentosOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-300 mb-2">Tipo de venda</label>
                            <select
                              value={selectedSetup.setupConfig.completoTipoVenda}
                              onChange={(e) => updateSetupConfig('completoTipoVenda', e.target.value)}
                              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                            >
                              <option value="">Selecione...</option>
                              {setupTipoVendaOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-300 mb-2">Modo CPF</label>
                            <select
                              value={selectedSetup.setupConfig.completoModoCpf}
                              onChange={(e) => updateSetupConfig('completoModoCpf', e.target.value)}
                              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                            >
                              <option value="desativado">Desativado</option>
                              <option value="opcional">Opcional</option>
                              <option value="obrigatorio">Obrigatório</option>
                            </select>
                          </div>
                          <label className="flex items-center gap-2 rounded-lg border border-gray-700 bg-black/30 px-4 py-2 text-sm text-white">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedSetup.setupConfig.completoConfiguracoesDetalhadas)}
                              onChange={(e) => updateSetupConfig('completoConfiguracoesDetalhadas', e.target.checked)}
                            />
                            Configurações detalhadas
                          </label>
                        </div>
                      </div>
                    ) : null}

                    {selectedSetup.setupConfig.tipoConfiguracao === 'personalizado' ? (
                      <div className="mt-4 rounded-lg border border-gray-700 bg-black/20 p-4">
                        <p className="text-sm text-gray-300 mb-3">Modo personalizado: opções avançadas e comportamento sob medida.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {customToggleFields.map((item) => (
                            <label key={item.key} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-black/30 p-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedSetup.setupConfig[item.key])}
                                onChange={() => updateCustomToggle(item.key)}
                              />
                              <span className="text-white text-sm">{item.label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-4">
                          <label className="block text-sm text-gray-300 mb-2">Observações da configuração</label>
                          <textarea
                            value={selectedSetup.setupConfig.observacoesConfiguracao}
                            onChange={(e) => updateSetupConfig('observacoesConfiguracao', e.target.value)}
                            rows={3}
                            className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 rounded-lg border border-gray-700 bg-black/20 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">Canal padrão</label>
                          <select
                            value={selectedSetup.setupConfig.canalEnvio}
                            onChange={(e) => updateSetupConfig('canalEnvio', e.target.value)}
                            className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                          >
                            {canalOptions.map((item) => (
                              <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">Nível de monitoramento</label>
                          <select
                            value={selectedSetup.setupConfig.nivelMonitoramento}
                            onChange={(e) => updateSetupConfig('nivelMonitoramento', e.target.value)}
                            className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                          >
                            {monitoramentoOptions.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">SLA interno</label>
                          <select
                            value={selectedSetup.setupConfig.slaInterno}
                            onChange={(e) => updateSetupConfig('slaInterno', e.target.value)}
                            className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                          >
                            {setupSlaInternoOptions.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button type="button" onClick={saveSetupConfig} className="btn-futuristic px-5 py-2 rounded-lg text-white font-medium">
                        Salvar Setup Config
                      </button>
                    </div>
                  </>
                )}
              </SectionCard>
            ) : null}

            {activeSection === 'acesso_cliente' ? (
              <SectionCard title="Login do Cliente (Portal)" icon={<Settings className="w-5 h-5 text-red-300" />}>
                <p className="text-sm text-gray-400 mb-4">
                  Cadastre os dados de acesso do cliente para a view do portal ({`/cliente/:clienteId`}).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Nome do usuário"
                    value={selectedSetup?.acessoCliente?.nome || ''}
                    onChange={(v) => updateSetupAcessoCliente('nome', v)}
                  />
                  <InputField
                    label="Email de acesso"
                    value={selectedSetup?.acessoCliente?.email || ''}
                    onChange={(v) => updateSetupAcessoCliente('email', v)}
                  />
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Senha de acesso</label>
                    <div className="flex gap-2">
                      <input
                        type={showPortalPassword ? 'text' : 'password'}
                        value={selectedSetup?.acessoCliente?.senha || ''}
                        onChange={(e) => updateSetupAcessoCliente('senha', e.target.value)}
                        className="w-full border border-gray-700 rounded-lg px-4 py-2 bg-black/30 text-white"
                        placeholder="Digite a senha do cliente"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPortalPassword((prev) => !prev)}
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
                      >
                        {showPortalPassword ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                  </div>
                  <InputField
                    label="Cliente ID para rota"
                    value={selectedSetup?.acessoCliente?.clienteId || selectedClient?.id || ''}
                    onChange={(v) => updateSetupAcessoCliente('clienteId', v)}
                    placeholder="Ex.: c8f3d"
                  />
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={saveClientPortalLogin}
                    className="btn-futuristic px-5 py-2 rounded-lg text-white font-medium"
                  >
                    Salvar login do cliente
                  </button>
                  <span className="text-xs text-gray-400">
                    {selectedSetup?.acessoCliente?.salvo
                      ? `Ultima atualizacao: ${new Date(selectedSetup.acessoCliente.atualizadoEm || Date.now()).toLocaleString('pt-BR')}`
                      : 'Login ainda não salvo.'}
                  </span>
                </div>
              </SectionCard>
            ) : null}

            {activeSection === 'dados_empresa' ? (
              <SectionCard title="Dados da empresa" icon={<Building2 className="w-5 h-5 text-red-300" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoField label="Razao social" value={selectedClient.nome_empresa} />
                  <InfoField label="Nome fantasia" value={selectedClient.nome_fantasia || '-'} />
                  <InfoField label="CNPJ" value={selectedClient.cnpj || '-'} mono />
                  <InfoField label="Regime" value={getClientRegime(selectedClient).replaceAll('_', ' ')} />
                  <InfoField label="Status" value={selectedClient.status || 'ativo'} />
                  <InfoField label="Cidade" value={getClientCity(selectedClient) || '-'} />
                </div>
              </SectionCard>
            ) : null}

            {activeSection === 'assinatura' ? (
              <SectionCard title="Assinatura" icon={<Settings className="w-5 h-5 text-red-300" />}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <InfoField label="Empresa" value={selectedClient.nome_empresa || '-'} />
                  <InfoField label="CNPJ" value={selectedClient.cnpj || '-'} mono />
                  <InfoField label="Cidade" value={getClientCity(selectedClient) || '-'} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-gray-300">Plano de assinatura</label>
                    <select
                      value={selectedSetup?.assinatura?.planId || ''}
                      onChange={(event) => applyAssinaturaPlan(event.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-black/30 px-4 py-2 text-white"
                    >
                      <option value="">Selecione...</option>
                      {assinaturaPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.nome}</option>
                      ))}
                    </select>
                  </div>
                  <InputField
                    label="Nome do plano"
                    value={selectedSetup?.assinatura?.nomePlano || ''}
                    onChange={(value) => updateSetupAssinatura('nomePlano', value)}
                    placeholder="Ex.: Plano Essencial"
                  />
                </div>
                <div className="mt-4 rounded-lg border border-gray-700 bg-black/30 p-3">
                  <p className="text-sm font-semibold text-white">Serviços vinculados ao cliente nessa assinatura</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {(selectedSetup?.assinatura?.servicos || []).length ? (
                      (selectedSetup?.assinatura?.servicos || []).map((service) => (
                        <div key={service.id || service.nome} className="rounded-lg border border-gray-700 bg-black/30 px-3 py-2 text-sm text-gray-200">
                          {service.nome || '-'}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">Nenhum servico vinculado ao plano.</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-gray-700 bg-black/30 p-3">
                  <p className="text-sm font-semibold text-white">Catálogo de serviços (módulo Assinaturas)</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {assinaturaServicesCatalog.map((service) => (
                      <div key={service.id || service.nome} className="rounded-lg border border-gray-700 bg-black/30 px-3 py-2 text-sm text-gray-300">
                        {service.nome || '-'}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-2 block text-sm text-gray-300">Observacoes</label>
                  <textarea
                    value={selectedSetup?.assinatura?.observacoes || ''}
                    onChange={(event) => updateSetupAssinatura('observacoes', event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-700 bg-black/30 px-4 py-2 text-white"
                    placeholder="Informacoes adicionais da assinatura do cliente."
                  />
                </div>
              </SectionCard>
            ) : null}

            {activeSection === 'financeiro' ? (
              <SectionCard title="Financeiro" icon={<SlidersHorizontal className="w-5 h-5 text-red-300" />}>
                {!selectedFinancialData ? (
                  <p className="text-gray-400">Este cliente ainda não possui cadastro em Clientes Financeiro.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InfoField label="Valor boleto" value={Number(selectedFinancialData.valor_boleto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                    <InfoField label="Valor desconto" value={Number(selectedFinancialData.valor_desconto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                    <InfoField label="Valor com desconto" value={Number(selectedFinancialData.valor_com_desconto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                    <InfoField label="Data de vencimento" value={selectedFinancialData.data_vencimento || '-'} />
                    <InfoField label="Qtd. funcionarios" value={selectedFinancialData.quantidade_funcionarios ?? 0} />
                    <InfoField label="Status fiscal" value={selectedFinancialData.status_fiscal === 'com_movimento' ? 'Com movimento' : 'Sem movimento'} />
                    <InfoField label="Capacidade de pagamento" value={
                      selectedFinancialData.capacidade_pagamento === 'paga_em_dia'
                        ? 'Paga em Dia'
                        : selectedFinancialData.capacidade_pagamento === 'paga_no_mes'
                          ? 'Paga Dentro do Mes'
                          : selectedFinancialData.capacidade_pagamento === 'atraso_recorrente'
                            ? 'Atraso Recorrente'
                            : '-'
                    } />
                    <InfoField label="Responsavel financeiro" value={selectedFinancialData.responsavel_financeiro || '-'} />
                    <InfoField label="Tipo honorario" value={selectedFinancialData.tipo_honorario === 'grupo' ? 'Grupo de empresas' : 'Empresa individual'} />
                    <InfoField label="Pagamento especial" value={selectedFinancialData.forma_pagamento_especial ? (selectedFinancialData.tipo_pagamento_especial || 'Especial') : 'Padrao'} />
                  </div>
                )}
              </SectionCard>
            ) : null}

            {activeSection === 'modulos_liberados' ? (
              <SectionCard title="Módulos" icon={<Settings className="w-5 h-5 text-red-300" />}>
                <div className="mb-4 rounded-lg border border-gray-700 bg-black/20 p-3">
                  <p className="text-sm text-gray-300">
                    Tipo no Setup Config: <span className="font-semibold text-white capitalize">{selectedSetup.setupConfig.tipoConfiguracao}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Sugestão automática: {(suggestedModulesByConfigType[selectedSetup.setupConfig.tipoConfiguracao] || []).join(', ') || '-'}
                  </p>
                  <button
                    type="button"
                    onClick={applySuggestedModules}
                    className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10"
                  >
                    Aplicar módulos sugeridos
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modulosBase.map((modulo) => (
                    <label key={modulo} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-black/30 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSetup.modulosLiberados.includes(modulo)}
                        onChange={() => toggleModulo(modulo)}
                      />
                      <span className="text-white">{modulo}</span>
                    </label>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {activeSection === 'servicos_vinculados' ? (
              <SectionCard title="Serviços vinculados" icon={<Settings className="w-5 h-5 text-red-300" />}>
                {(() => {
                  const services = getMockInternalServices().filter((item) => item.empresa_id === selectedClient.id);
                  if (!services.length) return <p className="text-gray-400">Nenhum serviço vinculado.</p>;
                  return (
                    <div className="space-y-2">
                      {services.map((service) => (
                        <div key={service.id} className="rounded-lg border border-gray-700 bg-black/30 p-3">
                          <p className="text-white font-medium">{service.titulo}</p>
                          <p className="text-sm text-gray-400">{service.tipo_servico} • {service.status}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </SectionCard>
            ) : null}

            {activeSection === 'documentos' ? (
              <SectionCard title="Documentos" icon={<Settings className="w-5 h-5 text-red-300" />}>
                <div className="space-y-2">
                  {[
                    { id: 'd1', nome: 'Contrato social', status: 'Atualizado' },
                    { id: 'd2', nome: 'Cartao CNPJ', status: 'Atualizado' },
                    { id: 'd3', nome: 'Certificado digital', status: 'Pendente revisao' },
                  ].map((doc) => (
                    <div key={doc.id} className="rounded-lg border border-gray-700 bg-black/30 p-3 flex items-center justify-between">
                      <span className="text-white">{doc.nome}</span>
                      <span className="text-sm text-gray-300">{doc.status}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {activeSection === 'senhas' ? (
              <SectionCard title="Senhas" icon={<Settings className="w-5 h-5 text-red-300" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Certificado digital"
                    value={selectedSetup?.senhas?.certificadoDigital || ''}
                    onChange={(v) => updateSetupSenha('certificadoDigital', v)}
                    placeholder="Senha / observação"
                  />
                  <InputField
                    label="Senha gov"
                    value={selectedSetup?.senhas?.senhaGov || ''}
                    onChange={(v) => updateSetupSenha('senhaGov', v)}
                    placeholder="Senha / observação"
                  />
                  <InputField
                    label="Senha do simples nacional"
                    value={selectedSetup?.senhas?.senhaSimplesNacional || ''}
                    onChange={(v) => updateSetupSenha('senhaSimplesNacional', v)}
                    placeholder="Senha / observação"
                  />
                  <InputField
                    label="Senha portal prefeitura"
                    value={selectedSetup?.senhas?.senhaPortalPrefeitura || ''}
                    onChange={(v) => updateSetupSenha('senhaPortalPrefeitura', v)}
                    placeholder="Senha / observação"
                  />
                  <div className="md:col-span-2">
                    <InputField
                      label="Senha do emissor nacional (somente empresas de serviço)"
                      value={selectedSetup?.senhas?.senhaEmissorNacional || ''}
                      onChange={(v) => updateSetupSenha('senhaEmissorNacional', v)}
                      placeholder="Senha / observação"
                    />
                  </div>
                </div>
              </SectionCard>
            ) : null}
          </div>
        </div>
      ) : null}

      {showNewClientModal ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Novo Cliente</h2>
              <button type="button" onClick={() => setShowNewClientModal(false)} className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white">Fechar</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InputField label="Nome da empresa *" value={newClientForm.nome_empresa} onChange={(v) => setNewClientForm((p) => ({ ...p, nome_empresa: v }))} />
              <InputField label="Nome fantasia" value={newClientForm.nome_fantasia} onChange={(v) => setNewClientForm((p) => ({ ...p, nome_fantasia: v }))} />
              <InputField label="CNPJ *" value={newClientForm.cnpj} onChange={(v) => setNewClientForm((p) => ({ ...p, cnpj: v }))} />
              <InputField label="Cidade" value={newClientForm.cidade} onChange={(v) => setNewClientForm((p) => ({ ...p, cidade: v }))} />
              <div>
                <label className="block text-sm text-gray-300 mb-2">Regime</label>
                <select value={newClientForm.tipo_regime} onChange={(e) => setNewClientForm((p) => ({ ...p, tipo_regime: e.target.value }))} className="w-full rounded-lg border border-gray-700 bg-black/30 px-3 py-2 text-white">
                  {regimeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Status</label>
                <select value={newClientForm.status} onChange={(e) => setNewClientForm((p) => ({ ...p, status: e.target.value }))} className="w-full rounded-lg border border-gray-700 bg-black/30 px-3 py-2 text-white">
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={handleCreateClient} className="btn-futuristic px-5 py-2 rounded-lg text-white font-medium">
                Salvar cliente
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const SectionCard = ({ title, icon, children }) => (
  <div className="rounded-xl border border-gray-700 bg-black/20 p-4">
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
    </div>
    {children}
  </div>
);

const InfoField = ({ label, value, mono = false }) => (
  <div className="rounded-lg border border-gray-700 bg-black/30 p-3">
    <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
    <p className={`mt-1 text-white ${mono ? 'font-mono text-sm' : 'text-sm'}`}>{value || '-'}</p>
  </div>
);

const InputField = ({ label, value, onChange, readOnly = false, placeholder = '' }) => (
  <div>
    <label className="block text-sm text-gray-300 mb-2">{label}</label>
    <input
      value={value || ''}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-gray-700 rounded-lg px-4 py-2 ${
        readOnly ? 'bg-black/20 text-gray-300' : 'bg-black/30 text-white'
      }`}
    />
  </div>
);

function createDefaultClientSetup(client) {
  const regime = client?.tipo_regime || 'simples_nacional';
  const tipoEmpresa = regime === 'mei' ? 'MEI' : 'Microempresa';
  return {
    setupEmpresaSalvo: false,
    setupConfigSalvo: false,
    setupEmpresa: {
      razaoSocial: client?.nome_empresa || '',
      nomeFantasia: client?.nome_fantasia || '',
      cnpj: client?.cnpj || '',
      informarInscricaoEstadual: Boolean(client?.inscricao_estadual),
      informarInscricaoMunicipal: Boolean(client?.inscricao_municipal),
      informarNaturezaJuridica: true,
      inscricaoEstadual: client?.inscricao_estadual || '',
      inscricaoMunicipal: client?.inscricao_municipal || '',
      regimeTributario: regime,
      tipoEmpresa,
      naturezaJuridica: regime === 'mei' ? 'EI' : 'LTDA',
      segmentoPrincipal: '',
      enderecoCep: client?.cep || '',
      enderecoLogradouro: client?.logradouro || '',
      enderecoNumero: client?.numero || '',
      enderecoComplemento: client?.complemento || '',
      enderecoBairro: client?.bairro || '',
      enderecoCidade: client?.cidade || '',
      enderecoEstado: client?.estado || '',
      contatoEmail: client?.email || '',
      contatoTelefone: client?.telefone || '',
      contatoWhatsapp: client?.whatsapp || '',
      socios: [],
      logoUrl: '',
      logoFileName: '',
    },
    setupConfig: {
      regime,
      tipoConfiguracao: 'simples',
      canalEnvio: client?.forma_envio || 'email',
      nivelMonitoramento: 'padrao',
      slaInterno: '48h',
      simplesTipoServico: 'Contabil',
      intermediarioTipoServico: '',
      intermediarioRegistrarEntradas: '',
      intermediarioFluxoServico: '',
      intermediarioExibicao: false,
      completoPagamentosRecebimentos: '',
      completoTipoVenda: '',
      completoModoCpf: 'desativado',
      completoConfiguracoesDetalhadas: false,
      mostrarPix: true,
      mostrarContasBancarias: false,
      mostrarCategorias: false,
      mostrarFechamentos: false,
      mostrarValidadeSaldo: false,
      mostrarOrcamento: false,
      mostrarAssinatura: false,
      mostrarControle: false,
      mostrarCustoFixo: false,
      mostrarMetas: false,
      mostrarResumoSemanal: false,
      permitirCriarContas: false,
      permitirRegistrarPagamentos: false,
      permitirRegistrarRecebimentos: false,
      permitirSaidas: false,
      alertaVencimento: true,
      avisoAoRegistrar: false,
      travarEdicaoAposPago: true,
      ativarModoVendaAVenda: false,
      ativarModoCpf: false,
      observacoesConfiguracao: '',
    },
    acessoCliente: {
      nome: client?.nome_fantasia || client?.nome_empresa || '',
      email: '',
      senha: '',
      clienteId: client?.id || '',
      salvo: false,
      atualizadoEm: '',
    },
    senhas: {
      certificadoDigital: '',
      senhaGov: '',
      senhaSimplesNacional: '',
      senhaEmissorNacional: '',
      senhaPortalPrefeitura: '',
    },
    assinatura: {
      planId: '',
      nomePlano: '',
      servicos: [],
      observacoes: '',
    },
    modulosLiberados: [
      'Financeiro',
      'Fiscal',
      'Impostos',
      'Serviços',
      'Documentos',
      'Trabalhista',
      'Atendimento',
      'Relatórios',
      'Macedogram',
      'Clube de Benefícios',
      'Chat',
    ],
  };
}

export default ClientesExpandido;
