import {
  mockClients,
  mockFinancialContas,
  mockFiscalObrigacoes,
  mockFiscalNotasFiscais,
  mockTrabalhistaObrigacoes,
  mockTrabalhistaSolicitacoes,
} from './mockData';

const baseClientPortalMenu = [
  { label: 'Empresa', icon: 'Building2', path: 'empresa' },
  { label: 'Painel', icon: 'LayoutDashboard', path: '' },
];

const meiRegimeMenu = {
  label: 'Impostos',
  icon: 'Receipt',
  path: 'impostos',
};

const simplesRegimeMenu = {
  label: 'Impostos',
  icon: 'Receipt',
  path: 'impostos',
};

const commonClientPortalMenu = [
  {
    label: 'Gestão',
    icon: 'Building2',
    children: [
      { label: 'Clientes', path: 'gestao/clientes' },
      { label: 'Fornecedores', path: 'gestao/fornecedores' },
      { label: 'Produtos', path: 'gestao/produtos' },
      { label: 'Estoque', path: 'gestao/estoque' },
      { label: 'Agenda', path: 'gestao/agenda' },
      { label: 'Notas Fiscais - Emissão', path: 'notas-fiscais/emissao' },
      { label: 'Notas Fiscais - Histórico', path: 'notas-fiscais/historico' },
      { label: 'Documentos - Enviados/Recebidos', path: 'documentos/enviados-recebidos' },
      { label: 'Documentos - Importantes', path: 'documentos/importantes' },
      { label: 'Serviços', path: 'servicos' },
    ],
  },
  {
    label: 'Financeiro',
    icon: 'Wallet',
    children: [
      { label: 'Caixa', path: 'financeiro/caixa' },
      { label: 'Recibos', path: 'financeiro/recibos' },
      { label: 'Orçamentos', path: 'financeiro/orcamentos' },
      { label: 'Contas', path: 'financeiro/contas' },
      { label: 'Relatório de faturamento', path: 'relatorios/faturamento' },
      { label: 'Relatório de despesas', path: 'relatorios/despesas' },
    ],
  },
  { label: 'Meus Dados', icon: 'UserCircle2', path: 'meus-dados' },
  { label: 'Macedo Academy', icon: 'GraduationCap', path: 'academy' },
  { label: 'Chat', icon: 'MessageSquare', path: 'chat' },
  { label: 'Macedogram', icon: 'MessageSquare', path: 'macedogram' },
  { label: 'Clube de Benefícios', icon: 'Gift', path: 'clube-beneficios' },
];

export const ALL_CLIENTS_PORTAL_ID = 'todas';
export const clientPortalMenu = [...baseClientPortalMenu, simplesRegimeMenu, ...commonClientPortalMenu];
const MOCK_INTERNAL_SERVICES_KEY = 'mock_internal_services';
const CLIENT_SETUP_STORAGE_KEY = 'mock_admin_client_setup_center_v2';
const CLIENT_PORTAL_USERS_KEY = 'mock_client_portal_users_v1';

export function getClientPortalMenu(tipoEmpresa, clientRefId = null) {
  const enabledModules = getClientEnabledModulesByClientRefId(clientRefId);

  if (tipoEmpresa === 'mei') {
    return filterClientPortalMenuByModules([...baseClientPortalMenu, meiRegimeMenu, ...commonClientPortalMenu], enabledModules);
  }

  if (tipoEmpresa === 'simples') {
    return filterClientPortalMenuByModules([...baseClientPortalMenu, simplesRegimeMenu, ...commonClientPortalMenu], enabledModules);
  }

  return filterClientPortalMenuByModules([...baseClientPortalMenu], enabledModules);
}

export function getClientEnabledModulesByClientRefId(clientRefId) {
  const defaultModules = {
    impostos: true,
    financeiro: true,
    fiscal: true,
    trabalhista: true,
    servicos: true,
    documentos: true,
    atendimento: true,
    relatorios: true,
    chat: true,
    academy: true,
    macedogram: true,
    clube_beneficios: true,
  };

  if (!clientRefId) return defaultModules;

  try {
    const raw = localStorage.getItem(CLIENT_SETUP_STORAGE_KEY);
    if (!raw) return defaultModules;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultModules;
    const cfg = parsed[clientRefId];
    if (!cfg || !Array.isArray(cfg.modulosLiberados)) return defaultModules;

    const enabledSet = new Set(cfg.modulosLiberados.map((item) => normalizeModuleName(item)));

    return {
      impostos: enabledSet.has('impostos'),
      financeiro: enabledSet.has('financeiro'),
      fiscal: enabledSet.has('fiscal'),
      trabalhista: enabledSet.has('trabalhista'),
      servicos: enabledSet.has('servicos') || enabledSet.has('serviços'),
      documentos: enabledSet.has('documentos'),
      atendimento: enabledSet.has('atendimento'),
      relatorios: enabledSet.has('relatorios') || enabledSet.has('relatórios'),
      chat: enabledSet.has('chat'),
      academy: enabledSet.has('academy') || enabledSet.has('macedo academy'),
      macedogram: enabledSet.has('macedogram'),
      clube_beneficios: enabledSet.has('clube de beneficios') || enabledSet.has('clube de benefícios'),
    };
  } catch {
    return defaultModules;
  }
}

function filterClientPortalMenuByModules(menuItems, enabledModules) {
  return menuItems
    .map((item) => {
      if (!isMenuItemEnabled(item, enabledModules)) return null;

      if (item.children?.length) {
        const filteredChildren = item.children.filter((child) => isMenuChildEnabled(child, enabledModules));
        if (!filteredChildren.length) return null;
        return {
          ...item,
          children: filteredChildren,
        };
      }

      return item;
    })
    .filter(Boolean);
}

function isMenuItemEnabled(item, enabledModules) {
  if (item.label === 'Painel') return true;
  if (item.label === 'Empresa') return true;
  if (item.label === 'Impostos') return enabledModules.impostos;
  if (item.label === 'Financeiro') return enabledModules.financeiro;
  if (item.label === 'Chat') return enabledModules.chat;
  if (item.label === 'Macedo Academy') return enabledModules.academy;
  if (item.label === 'Macedogram') return enabledModules.macedogram;
  if (item.label === 'Clube de Benefícios') return enabledModules.clube_beneficios;
  return true;
}

function isMenuChildEnabled(child, enabledModules) {
  if (child.path.startsWith('notas-fiscais')) return enabledModules.fiscal;
  if (child.path === 'servicos') return enabledModules.servicos;
  if (child.path.startsWith('documentos')) return enabledModules.documentos;
  if (child.path.startsWith('financeiro')) return enabledModules.financeiro;
  if (child.path.startsWith('relatorios')) return enabledModules.relatorios;
  if (child.path.startsWith('gestao/agenda')) return enabledModules.atendimento;
  if (child.path.startsWith('gestao/') && child.path !== 'gestao/agenda') return enabledModules.atendimento;
  return true;
}

function normalizeModuleName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getMockInternalServices() {
  try {
    const raw = localStorage.getItem(MOCK_INTERNAL_SERVICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createMockCertificateServiceRequest(portalClient, company) {
  const now = new Date();
  const numero = `SVC-CERT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}-${String(now.getTime()).slice(-4)}`;

  const item = {
    id: `mock-cert-${now.getTime()}`,
    numero,
    titulo: `Renovacao de certificado digital - ${portalClient.nome_fantasia}`,
    descricao: 'Solicitacao criada automaticamente pelo portal do cliente para renovacao de certificado digital.',
    empresa_id: portalClient.clientRefId,
    empresa_nome: portalClient.nome_fantasia,
    tipo_servico: 'Certificado Digital',
    setor: 'Fiscal',
    cidade: company.cidade_atendimento || company.cidade || 'Jacobina',
    status: 'pendente',
    prioridade: 'alta',
    responsavel_id: '',
    responsavel_nome: null,
    data_prazo: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    observacoes: 'Item mock para desenvolvimento local.',
    created_at: now.toISOString(),
    mock_origin: 'portal_certificado',
  };

  const existing = getMockInternalServices();
  const dedup = existing.some(
    (svc) =>
      svc.mock_origin === 'portal_certificado' &&
      svc.empresa_id === portalClient.clientRefId &&
      svc.status !== 'concluido' &&
      svc.status !== 'cancelado',
  );

  if (!dedup) {
    localStorage.setItem(MOCK_INTERNAL_SERVICES_KEY, JSON.stringify([item, ...existing]));
    return { created: true, item };
  }

  return { created: false, item: existing.find((svc) => svc.empresa_id === portalClient.clientRefId) };
}

export const mockPortalUsers = [
  {
    id: 'portal-user-01',
    authUserId: 'dev-user',
    email: 'dev@macedosi.local',
    nome: 'Grupo Macedo Cliente',
    linkedClientIds: [
      'c8f3d',
      'ca18c',
    ],
  },
];

const getDynamicPortalUsers = () => {
  try {
    const raw = localStorage.getItem(CLIENT_PORTAL_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.email)
      .map((item) => ({
        id: item.id || `portal-${item.email}`,
        authUserId: item.authUserId || item.id || item.email,
        email: item.email,
        nome: item.nome || item.email,
        linkedClientIds: item.clienteId ? [item.clienteId] : [],
      }));
  } catch {
    return [];
  }
};

export const mockPortalClients = [
  {
    clienteId: 'c8f3d',
    clientRefId: 'client-1',
    nome_empresa: mockClients[0].nome_empresa,
    nome_fantasia: mockClients[0].nome_fantasia,
    cnpj: mockClients[0].cnpj,
    tipo_empresa: 'simples',
    atividade: 'comercio',
    regime_label: 'Simples Nacional',
    status_geral: 'pendente',
    responsavel_conta: 'Marina Costa',
    email_responsavel: 'marina@macedosi.local',
    telefone_suporte: '(74) 3333-5000',
    personalizacao: {
      tema: 'comercio',
      destaquePrimario: 'Operação comercial sob monitoramento',
      destaqueSecundario: 'Estoques, faturamento e DAS em um só lugar',
    },
    perfil_macedogram: {
      logo_sigla: 'AP',
      descricao:
        'Distribuidora de autopeças com foco em operação fiscal organizada e atendimento ágil para varejo e oficinas.',
      cidade: 'Jacobina, BA',
      tipo_atendimento: 'estadual',
    },
  },
  {
    clienteId: 'ca18c',
    clientRefId: 'client-4',
    nome_empresa: mockClients[3].nome_empresa,
    nome_fantasia: mockClients[3].nome_fantasia,
    cnpj: mockClients[3].cnpj,
    tipo_empresa: 'mei',
    atividade: 'misto',
    regime_label: 'MEI',
    status_geral: 'regular',
    responsavel_conta: 'Rafael Souza',
    email_responsavel: 'rafael@macedosi.local',
    telefone_suporte: '(74) 3333-5001',
    personalizacao: {
      tema: 'mei',
      destaquePrimario: 'Rotina simplificada para pequeno negócio',
      destaqueSecundario: 'Painel focado em DAS, recibos e agenda',
    },
    perfil_macedogram: {
      logo_sigla: 'MC',
      descricao:
        'Mercado de bairro com rotina MEI otimizada para controle financeiro, emissão de recibos e acompanhamento contábil.',
      cidade: 'Jacobina, BA',
      tipo_atendimento: 'municipal',
    },
  },
];

const pageTemplates = {
  'das/guias': {
    title: 'Guias DAS',
    description: 'Acompanhe emissão, vencimento e pagamento das guias mensais.',
    primaryMetricLabel: 'Guias disponíveis',
    secondaryMetricLabel: 'Próximo vencimento',
  },
  'das/divida-ativa': {
    title: 'Dívida ativa',
    description: 'Visualize pendências em cobrança e necessidade de regularização.',
    primaryMetricLabel: 'Pendências abertas',
    secondaryMetricLabel: 'Risco atual',
  },
  'das/parcelamento': {
    title: 'Parcelamento',
    description: 'Controle acordos ativos e próximas parcelas.',
    primaryMetricLabel: 'Parcelamentos ativos',
    secondaryMetricLabel: 'Parcela seguinte',
  },
  'notas-fiscais/emissao': {
    title: 'Emissão de notas',
    description: 'Central operacional para emissão assistida de notas fiscais.',
    primaryMetricLabel: 'Notas a emitir',
    secondaryMetricLabel: 'Última emissão',
  },
  'notas-fiscais/historico': {
    title: 'Histórico de notas',
    description: 'Consulte notas emitidas, canceladas e entradas registradas.',
    primaryMetricLabel: 'Notas no período',
    secondaryMetricLabel: 'Status dominante',
  },
  servicos: {
    title: 'Serviços',
    description: 'Solicitações contábeis, fiscais e trabalhistas em acompanhamento.',
    primaryMetricLabel: 'Demandas abertas',
    secondaryMetricLabel: 'SLA médio',
  },
  'documentos/enviados-recebidos': {
    title: 'Documentos enviados/recebidos',
    description: 'Acompanhe a troca de documentos com o escritório.',
    primaryMetricLabel: 'Movimentações',
    secondaryMetricLabel: 'Último envio',
  },
  'documentos/importantes': {
    title: 'Documentos importantes',
    description: 'Arquivos essenciais para auditoria e rotina fiscal.',
    primaryMetricLabel: 'Arquivos chave',
    secondaryMetricLabel: 'Atualização',
  },
  'gestao/clientes': {
    title: 'Clientes',
    description: 'Base de clientes para operações comerciais e relacionamento.',
    primaryMetricLabel: 'Cadastros ativos',
    secondaryMetricLabel: 'Novos no mês',
  },
  'gestao/fornecedores': {
    title: 'Fornecedores',
    description: 'Cadastro e relacionamento com parceiros e fornecedores.',
    primaryMetricLabel: 'Fornecedores ativos',
    secondaryMetricLabel: 'Pendências cadastrais',
  },
  'gestao/produtos': {
    title: 'Produtos',
    description: 'Visibilidade sobre catálogo, mix e itens com maior giro.',
    primaryMetricLabel: 'Itens cadastrados',
    secondaryMetricLabel: 'Categoria foco',
  },
  'gestao/estoque': {
    title: 'Estoque',
    description: 'Controle simplificado de saldo, ruptura e reposição.',
    primaryMetricLabel: 'Itens monitorados',
    secondaryMetricLabel: 'Itens críticos',
  },
  'gestao/agenda': {
    title: 'Agenda',
    description: 'Compromissos, entregas e vencimentos importantes do negócio.',
    primaryMetricLabel: 'Compromissos da semana',
    secondaryMetricLabel: 'Próxima agenda',
  },
  gestao: {
    title: 'Gestão',
    description: 'Central de gestão operacional, documentos e cadastro.',
    primaryMetricLabel: 'Pendências de gestão',
    secondaryMetricLabel: 'Processos em atualização',
  },
  'financeiro-hub': {
    title: 'Financeiro',
    description: 'Visão financeira consolidada com caixa, contas e relatórios.',
    primaryMetricLabel: 'Resumo financeiro',
    secondaryMetricLabel: 'Próximo fechamento',
  },
  'financeiro/caixa': {
    title: 'Caixa',
    description: 'Movimentação diária e saldo operacional.',
    primaryMetricLabel: 'Saldo projetado',
    secondaryMetricLabel: 'Último fechamento',
  },
  'financeiro/recibos': {
    title: 'Recibos',
    description: 'Emissão e consulta de comprovantes financeiros.',
    primaryMetricLabel: 'Recibos emitidos',
    secondaryMetricLabel: 'Último recibo',
  },
  'financeiro/orcamentos': {
    title: 'Orçamentos',
    description: 'Acompanhe propostas comerciais e conversão em vendas.',
    primaryMetricLabel: 'Orçamentos ativos',
    secondaryMetricLabel: 'Taxa de aprovação',
  },
  'financeiro/contas': {
    title: 'Contas',
    description: 'Contas a pagar e receber com visão executiva.',
    primaryMetricLabel: 'Contas abertas',
    secondaryMetricLabel: 'Maior vencimento',
  },
  'relatorios/faturamento': {
    title: 'Relatório de faturamento',
    description: 'Resumo de receita, crescimento e sazonalidade.',
    primaryMetricLabel: 'Receita mensal',
    secondaryMetricLabel: 'Variação',
  },
  'relatorios/despesas': {
    title: 'Relatório de despesas',
    description: 'Visão consolidada de gastos recorrentes e extraordinários.',
    primaryMetricLabel: 'Despesas do mês',
    secondaryMetricLabel: 'Maior centro de custo',
  },
  'meus-dados': {
    title: 'Meus dados',
    description: 'Dados de acesso, empresas vinculadas e configurações pessoais.',
    primaryMetricLabel: 'Empresas vinculadas',
    secondaryMetricLabel: 'Perfil atual',
  },
  chat: {
    title: 'Chat',
    description: 'Canal de comunicação com o escritório.',
    primaryMetricLabel: 'Conversas',
    secondaryMetricLabel: 'Última interação',
  },
  'clube-beneficios': {
    title: 'Clube de benefícios',
    description: 'Benefícios e parcerias disponíveis para o cliente.',
    primaryMetricLabel: 'Benefícios ativos',
    secondaryMetricLabel: 'Última atualização',
  },
};

const companySpecificHighlights = {
  mei: {
    heroTag: 'Portal MEI',
    emphasis: 'Foco em DAS, recibos e rotina simplificada.',
  },
  simples: {
    heroTag: 'Portal Simples Nacional',
    emphasis: 'Foco em obrigações fiscais, operação e acompanhamento financeiro.',
  },
};

const activitySpecificHighlights = {
  comercio: ['Estoque em dia', 'Monitoramento de faturamento', 'Documentos fiscais organizados'],
  servico: ['Agenda operacional ativa', 'Recibos e contratos centralizados', 'Demandas em SLA'],
  misto: ['Operação híbrida acompanhada', 'Financeiro com visão consolidada', 'Painel multirotina'],
};

export function getPortalUserByAuthUser(authUser) {
  if (!authUser) return null;
  const dynamicUsers = getDynamicPortalUsers();
  const allUsers = [...dynamicUsers, ...mockPortalUsers];
  return (
    allUsers.find((item) => item.authUserId === authUser.id) ||
    allUsers.find((item) => item.email === authUser.email) ||
    null
  );
}

export function getAccessiblePortalClients(authUser) {
  const portalUser = getPortalUserByAuthUser(authUser);
  if (!portalUser) return [];
  return mockPortalClients.filter((item) => portalUser.linkedClientIds.includes(item.clienteId));
}

export function getPortalMacedogramProfiles(authUser) {
  const accessibleClients = getAccessiblePortalClients(authUser);
  const uniqueProfiles = new Map();

  accessibleClients.forEach((item) => {
    if (uniqueProfiles.has(item.clienteId)) return;
    uniqueProfiles.set(item.clienteId, {
      clienteId: item.clienteId,
      nome_empresa: item.nome_empresa,
      nome_fantasia: item.nome_fantasia,
      logo_sigla: item.perfil_macedogram?.logo_sigla || item.nome_fantasia.slice(0, 2).toUpperCase(),
      descricao:
        item.perfil_macedogram?.descricao ||
        'Perfil empresarial no Macedogram para comunicação entre cliente e escritório.',
      cidade: item.perfil_macedogram?.cidade || 'Jacobina, BA',
      tipo_atendimento: item.perfil_macedogram?.tipo_atendimento || 'municipal',
    });
  });

  return Array.from(uniqueProfiles.values());
}

export function getPortalMacedogramFeed(authUser) {
  const profiles = getPortalMacedogramProfiles(authUser);
  if (!profiles.length) return [];

  return profiles.flatMap((profile, index) => [
    {
      id: `mcg-img-${profile.clienteId}`,
      clienteId: profile.clienteId,
      nome_empresa: profile.nome_fantasia,
      logo_sigla: profile.logo_sigla,
      data_publicacao: `2026-04-${String(10 + index).padStart(2, '0')}T09:30:00`,
      legenda: `Atualizacao operacional da ${profile.nome_fantasia}: documentos e fluxo fiscal alinhados com o escritorio.`,
      midia: {
        tipo: 'imagem',
        url: `https://picsum.photos/seed/${profile.clienteId}-img/960/720`,
      },
      metricas: {
        curtidas: 18 + index * 4,
        comentarios: 3 + index,
      },
      comentarios: [
        {
          id: `cmt-img-${profile.clienteId}-1`,
          autor: 'Equipe Macedo SI',
          texto: 'Recebido! Vamos seguir com os próximos passos.',
          data: '2026-04-15T10:15:00',
        },
      ],
    },
    {
      id: `mcg-video-${profile.clienteId}`,
      clienteId: profile.clienteId,
      nome_empresa: profile.nome_fantasia,
      logo_sigla: profile.logo_sigla,
      data_publicacao: `2026-04-${String(12 + index).padStart(2, '0')}T14:10:00`,
      legenda: `${profile.nome_fantasia} compartilhou um resumo em video com indicadores comerciais e proximos passos.`,
      midia: {
        tipo: 'video',
        url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        poster: `https://picsum.photos/seed/${profile.clienteId}-video/960/720`,
      },
      metricas: {
        curtidas: 25 + index * 5,
        comentarios: 5 + index,
      },
      comentarios: [],
    },
  ]);
}

export function getConsolidatedPortalOverview(authUser) {
  const accessibleClients = getAccessiblePortalClients(authUser);
  if (!accessibleClients.length) return null;

  const clientRefIds = accessibleClients.map((item) => item.clientRefId);
  const contas = mockFinancialContas.filter((item) => clientRefIds.includes(item.empresa_id));
  const obrigacoesFiscais = mockFiscalObrigacoes.filter((item) => clientRefIds.includes(item.empresa_id));
  const obrigacoesTrabalhistas = mockTrabalhistaObrigacoes.filter((item) => clientRefIds.includes(item.empresa_id));
  const solicitacoes = mockTrabalhistaSolicitacoes.filter((item) => clientRefIds.includes(item.empresa_id));

  const documentosPendentes = solicitacoes.filter(
    (item) => item.status === 'pendente' || item.status === 'em_andamento',
  );
  const alertas = [...obrigacoesFiscais, ...obrigacoesTrabalhistas]
    .sort((a, b) => new Date(a.proximo_vencimento) - new Date(b.proximo_vencimento))
    .slice(0, 6);

  const hasAtraso = contas.some((item) => item.situacao === 'atrasado');
  const hasPendente = contas.some((item) => item.situacao === 'em_aberto');

  return {
    accessibleClients,
    contas,
    obrigacoesFiscais,
    obrigacoesTrabalhistas,
    documentosPendentes,
    alertas,
    statusFinanceiro: hasAtraso ? 'atrasado' : hasPendente ? 'pendente' : 'regular',
    resumo: {
      totalEmpresas: accessibleClients.length,
      totalContas: contas.length,
      saldoMonitorado: contas.reduce((sum, item) => sum + (item.total_liquido || 0), 0),
      obrigacoesAtivas: [...obrigacoesFiscais, ...obrigacoesTrabalhistas].filter(
        (item) => item.status !== 'entregue',
      ).length,
      documentosPendentes: documentosPendentes.length,
    },
  };
}

export function getPortalClientById(clienteId) {
  return mockPortalClients.find((item) => item.clienteId === clienteId) || null;
}

export function userHasAccessToPortalClient(authUser, clienteId) {
  return getAccessiblePortalClients(authUser).some((item) => item.clienteId === clienteId);
}

export function getPortalOverviewData(clienteId) {
  const portalClient = getPortalClientById(clienteId);
  if (!portalClient) return null;

  const company = mockClients.find((item) => item.id === portalClient.clientRefId) || mockClients[0];
  const contas = mockFinancialContas.filter((item) => item.empresa_id === portalClient.clientRefId);
  const obrigacoesFiscais = mockFiscalObrigacoes.filter((item) => item.empresa_id === portalClient.clientRefId);
  const obrigacoesTrabalhistas = mockTrabalhistaObrigacoes.filter((item) => item.empresa_id === portalClient.clientRefId);
  const solicitacoes = mockTrabalhistaSolicitacoes.filter((item) => item.empresa_id === portalClient.clientRefId);

  const documentosPendentes = solicitacoes.filter(
    (item) => item.status === 'pendente' || item.status === 'em_andamento',
  );
  const alertas = [...obrigacoesFiscais, ...obrigacoesTrabalhistas]
    .sort((a, b) => new Date(a.proximo_vencimento) - new Date(b.proximo_vencimento))
    .slice(0, 4);
  const parcelamentos = buildMockParcelamentos(portalClient);
  const parcelamentosEmAberto = parcelamentos.filter((item) => item.status !== 'concluido');
  const impostosVencer = obrigacoesFiscais.filter(
    (item) => item.status === 'pendente' || item.status === 'em_andamento',
  );
  const impostosVencidos = obrigacoesFiscais.filter((item) => item.status === 'atrasado');

  return {
    portalClient,
    company,
    contas,
    obrigacoesFiscais,
    obrigacoesTrabalhistas,
    solicitacoes,
    documentosPendentes,
    alertas,
    statusFinanceiro: contas.some((item) => item.situacao === 'atrasado')
      ? 'atrasado'
      : contas.some((item) => item.situacao === 'em_aberto')
        ? 'pendente'
        : 'regular',
    resumoImpostos: {
      aVencer: {
        quantidade: impostosVencer.length,
        valorTotal: impostosVencer.reduce((sum, item) => sum + (item.valor || 0), 0),
      },
      vencidos: {
        quantidade: impostosVencidos.length,
        valorTotal: impostosVencidos.reduce((sum, item) => sum + (item.valor || 0), 0),
      },
      parcelamentosEmAberto: {
        quantidade: parcelamentosEmAberto.length,
        valorTotal: parcelamentosEmAberto.reduce((sum, item) => {
          const emAberto = (item.parcelas || [])
            .filter((parcela) => parcela.status !== 'pago')
            .reduce((subtotal, parcela) => subtotal + (parcela.valor || 0), 0);
          return sum + (emAberto || item.valor_parcela || 0);
        }, 0),
      },
    },
    companyHighlights: companySpecificHighlights[portalClient.tipo_empresa] || companySpecificHighlights.simples,
    activityHighlights: activitySpecificHighlights[portalClient.atividade] || activitySpecificHighlights.misto,
  };
}

export function getPortalPageDefinition(sectionKey, portalClient) {
  const base = pageTemplates[sectionKey] || {
    title: 'Modulo',
    description: 'Visão resumida do módulo selecionado.',
    primaryMetricLabel: 'Resumo',
    secondaryMetricLabel: 'Indicador',
  };

  const tipoEmpresa = portalClient?.tipo_empresa === 'mei' ? 'MEI' : 'Simples Nacional';
  const atividade = portalClient?.atividade || 'misto';
  const cards = {
    primaryMetric: sectionKey.includes('financeiro')
      ? 'R$ 18.420,00'
      : sectionKey.includes('relatorios')
        ? 'R$ 42.800,00'
        : sectionKey.includes('notas-fiscais')
          ? '18'
          : '6',
    secondaryMetric: sectionKey.includes('das')
      ? '20 abr'
      : sectionKey.includes('gestao/estoque')
        ? '3 itens críticos'
        : sectionKey.includes('meus-dados')
          ? `${getAccessiblePortalClients({ id: 'dev-user', email: 'dev@macedosi.local' }).length} empresas`
          : tipoEmpresa,
  };

  return {
    ...base,
    cards,
    bullets: [
      `Configurado para empresa do tipo ${tipoEmpresa}.`,
      `Atividade principal considerada: ${atividade}.`,
      'Estrutura pronta para conectar dados reais da API.',
    ],
  };
}

export function getPortalDasGuiasData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const inferImpostoTipo = (item, index) => {
    if (item.tipo === 'pgdas') return 'DAS';
    if (index % 3 === 0) return 'INSS';
    if (index % 3 === 1) return 'FGTS';
    return 'Outros';
  };

  const guias = overview.obrigacoesFiscais.map((item, index) => ({
    id: `guia-${item.id}`,
    competencia: `2026-${String(4 + index).padStart(2, '0')}`,
    descricao: item.nome,
    tipo: item.tipo.toUpperCase(),
    imposto_tipo: inferImpostoTipo(item, index),
    valor: item.valor || 0,
    vencimento: item.proximo_vencimento,
    status: item.status,
    codigo_barras: `34191.79001 01043.510047 91020.150008 ${index} ${String(1000000000 + index)}`,
    arquivo_nome: `${item.tipo}-${item.empresa.toLowerCase().replaceAll(' ', '-')}.pdf`,
  }));

  const parcelamentos = buildMockParcelamentos(overview.portalClient);

  const parcelamentosAtivos = parcelamentos.filter((item) => item.status !== 'concluido');

  return {
    ...overview,
    guias,
    parcelamentos,
    parcelamentosAtivos,
    resumo: {
      totalGuias: guias.length,
      totalEmAberto: guias.filter((item) => item.status !== 'entregue').reduce((sum, item) => sum + item.valor, 0),
      proximas: guias.filter((item) => item.status === 'pendente' || item.status === 'em_andamento').length,
      pagas: guias.filter((item) => item.status === 'entregue').length,
    },
  };
}

function buildMockParcelamentos(portalClient) {
  if (portalClient.tipo_empresa !== 'simples') return [];

  return [
    {
      id: `parc-${portalClient.clientRefId}-1`,
      numero: 'PARC-SN-2026-001',
      descricao: 'Parcelamento PGDAS em andamento',
      origem: 'Receita Federal',
      categoria: 'Simples Nacional',
      data_criacao: '2026-01-20',
      competencia_referencia: '2026-03',
      parcela_atual: 4,
      total_parcelas: 12,
      vencimento: '2026-04-25',
      valor_parcela: 486.35,
      status: 'em_dia',
      parcelas: [
        { numero: 4, vencimento: '2026-04-25', valor: 486.35, status: 'aberta' },
        { numero: 3, vencimento: '2026-03-25', valor: 486.35, status: 'paga' },
        { numero: 2, vencimento: '2026-02-25', valor: 486.35, status: 'paga' },
      ],
    },
    {
      id: `parc-${portalClient.clientRefId}-2`,
      numero: 'PARC-PREV-2026-014',
      descricao: 'Acordo previdenciário em regularização',
      origem: 'e-CAC',
      categoria: 'Previdenciário',
      data_criacao: '2025-12-10',
      competencia_referencia: '2026-02',
      parcela_atual: 2,
      total_parcelas: 10,
      vencimento: '2026-04-28',
      valor_parcela: 320.12,
      status: 'atrasado',
      parcelas: [
        { numero: 2, vencimento: '2026-04-10', valor: 320.12, status: 'atrasada' },
        { numero: 1, vencimento: '2026-03-10', valor: 320.12, status: 'paga' },
      ],
    },
    {
      id: `parc-${portalClient.clientRefId}-3`,
      numero: 'PARC-PGFN-SN-2025-003',
      descricao: 'PGFN - Simples Nacional',
      origem: 'PGFN',
      categoria: 'PGFN - Simples Nacional',
      data_criacao: '2025-11-05',
      competencia_referencia: '2025-12',
      parcela_atual: 1,
      total_parcelas: 6,
      vencimento: '2026-04-30',
      valor_parcela: 590.0,
      status: 'em_dia',
      parcelas: [{ numero: 1, vencimento: '2026-04-30', valor: 590.0, status: 'aberta' }],
    },
    {
      id: `parc-${portalClient.clientRefId}-4`,
      numero: 'PARC-PGFN-PREV-2025-007',
      descricao: 'PGFN - Previdenciário',
      origem: 'PGFN',
      categoria: 'PGFN - Previdenciário',
      data_criacao: '2025-07-14',
      competencia_referencia: '2025-09',
      parcela_atual: 8,
      total_parcelas: 8,
      vencimento: '2026-03-20',
      valor_parcela: 410.4,
      status: 'concluido',
      parcelas: [
        { numero: 8, vencimento: '2026-03-20', valor: 410.4, status: 'paga' },
        { numero: 7, vencimento: '2026-02-20', valor: 410.4, status: 'paga' },
      ],
    },
  ];
}

export function getPortalNotasHistoricoData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const notas = mockFiscalNotasFiscais
    .filter((item) => item.empresa_id === overview.portalClient.clientRefId)
    .map((item, index) => ({
      ...item,
      natureza: item.tipo === 'saida' ? 'Venda de mercadorias' : 'Compra para reposição',
      cliente_fornecedor: index % 2 === 0 ? 'Distribuidora Norte' : 'Fornecedor Regional',
    }));

  return {
    ...overview,
    notas,
    resumo: {
      totalNotas: notas.length,
      totalFaturado: notas.filter((item) => item.tipo === 'saida').reduce((sum, item) => sum + item.valor_total, 0),
      totalEntradas: notas.filter((item) => item.tipo === 'entrada').reduce((sum, item) => sum + item.valor_total, 0),
      pendentes: notas.filter((item) => item.status_conciliacao === 'pendente').length,
    },
  };
}

export function getPortalFinanceiroContasData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const contas = overview.contas.map((item) => ({
    ...item,
    categoria: item.centro_custo,
    origem: item.forma_pagamento === 'boleto' ? 'Cobrança automática' : 'Lançamento manual',
  }));

  return {
    ...overview,
    contas,
    resumo: {
      totalContas: contas.length,
      totalAberto: contas.filter((item) => item.situacao === 'em_aberto').reduce((sum, item) => sum + item.total_liquido, 0),
      totalAtrasado: contas.filter((item) => item.situacao === 'atrasado').reduce((sum, item) => sum + item.total_liquido, 0),
      totalPago: contas.filter((item) => item.situacao === 'pago').reduce((sum, item) => sum + item.total_liquido, 0),
    },
  };
}

export function getPortalDocumentosData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const documentos = [
    {
      id: 'doc-1',
      nome: 'Contrato social atualizado',
      categoria: 'Societário',
      direcao: 'recebido',
      data: '2026-04-08T10:30:00',
      status: 'validado',
      responsavel: overview.portalClient.responsavel_conta,
      origem: 'Escritório contábil',
    },
    {
      id: 'doc-2',
      nome: 'Extrato bancário de março',
      categoria: 'Financeiro',
      direcao: 'enviado',
      data: '2026-04-09T16:10:00',
      status: 'em_analise',
      responsavel: 'Cliente',
      origem: overview.portalClient.nome_fantasia,
    },
    {
      id: 'doc-3',
      nome: 'Comprovante DAS abril',
      categoria: 'Fiscal',
      direcao: 'enviado',
      data: '2026-04-10T09:15:00',
      status: 'validado',
      responsavel: 'Cliente',
      origem: overview.portalClient.nome_fantasia,
    },
    {
      id: 'doc-4',
      nome: 'Folha de ponto consolidada',
      categoria: 'Trabalhista',
      direcao: 'recebido',
      data: '2026-04-11T14:50:00',
      status: 'pendente',
      responsavel: overview.portalClient.responsavel_conta,
      origem: 'Escritório contábil',
    },
  ];

  return {
    ...overview,
    documentos,
    resumo: {
      total: documentos.length,
      enviados: documentos.filter((item) => item.direcao === 'enviado').length,
      recebidos: documentos.filter((item) => item.direcao === 'recebido').length,
      pendentes: documentos.filter((item) => item.status === 'pendente' || item.status === 'em_analise').length,
    },
  };
}

export function getPortalDividaAtivaData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const dividas = [
    {
      id: 'div-1',
      origem: 'PGMEI',
      descricao: 'Competências em aberto do DAS',
      valor_original: 1840.32,
      valor_atualizado: 2015.48,
      status: 'negociacao',
      ultima_atualizacao: '2026-04-05',
      prazo_recomendado: '2026-04-20',
    },
    {
      id: 'div-2',
      origem: 'Receita Federal',
      descricao: 'Pendência de declaração associada ao período 2025-12',
      valor_original: 620.0,
      valor_atualizado: 731.6,
      status: 'alerta',
      ultima_atualizacao: '2026-04-03',
      prazo_recomendado: '2026-04-18',
    },
  ];

  return {
    ...overview,
    dividas,
    resumo: {
      totalCasos: dividas.length,
      valorAtualizado: dividas.reduce((sum, item) => sum + item.valor_atualizado, 0),
      urgentes: dividas.filter((item) => item.status === 'alerta').length,
      emNegociacao: dividas.filter((item) => item.status === 'negociacao').length,
    },
  };
}

export function getPortalMeusDadosData(clienteId, authUser) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const linkedCompanies = getAccessiblePortalClients(authUser).map((item) => ({
    clienteId: item.clienteId,
    nome_fantasia: item.nome_fantasia,
    regime_label: item.regime_label,
    atividade: item.atividade,
    status_geral: item.status_geral,
  }));

  return {
    ...overview,
    profile: {
      nome: authUser?.name || 'Usuário do portal',
      email: authUser?.email || 'cliente@macedosi.local',
      telefone: overview.portalClient.telefone_suporte,
      senha_definida_manualmente: true,
      ultimo_acesso: '2026-04-15T09:40:00',
    },
    linkedCompanies,
    preferencias: {
      notificacoes_email: true,
      notificacoes_whatsapp: false,
      recebimento_documentos: 'email',
    },
  };
}

export function getPortalNotasEmissaoData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const rascunhos = [
    {
      id: 'rascunho-1',
      numero_sugerido: 'NF-2026-118',
      tipo: 'saida',
      destinatario: 'Distribuidora Norte',
      valor_previsto: 3280.5,
      status: 'rascunho',
      natureza_operacao: 'Venda de mercadorias',
    },
    {
      id: 'rascunho-2',
      numero_sugerido: 'NF-2026-119',
      tipo: 'servico',
      destinatario: 'Clínica Integra',
      valor_previsto: 1450.0,
      status: 'aguardando_documentos',
      natureza_operacao: 'Prestação de serviços',
    },
  ];

  return {
    ...overview,
    rascunhos,
    resumo: {
      rascunhos: rascunhos.length,
      aguardando: rascunhos.filter((item) => item.status !== 'rascunho').length,
      valorTotal: rascunhos.reduce((sum, item) => sum + item.valor_previsto, 0),
    },
  };
}

export function getPortalDocumentosImportantesData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const documentosImportantes = [
    {
      id: 'imp-1',
      nome: 'Certificado digital A1',
      categoria: 'Acesso fiscal',
      validade: '2026-11-15',
      status: 'vigente',
      observacao: 'Usado para emissão e obrigações acessórias.',
    },
    {
      id: 'imp-2',
      nome: 'Contrato social consolidado',
      categoria: 'Societário',
      validade: null,
      status: 'arquivo_base',
      observacao: 'Documento de referência para bancos e fornecedores.',
    },
    {
      id: 'imp-3',
      nome: 'Alvará de funcionamento',
      categoria: 'Regulatório',
      validade: '2026-05-30',
      status: 'renovar_em_breve',
      observacao: 'Renovação recomendada antes do vencimento.',
    },
  ];

  return {
    ...overview,
    documentosImportantes,
    resumo: {
      total: documentosImportantes.length,
      renovacaoBreve: documentosImportantes.filter((item) => item.status === 'renovar_em_breve').length,
      permanentes: documentosImportantes.filter((item) => item.status === 'arquivo_base').length,
    },
  };
}

export function getPortalFinanceiroRecibosData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const recibos = overview.contas.map((conta, index) => ({
    id: `rec-${conta.id}`,
    numero: `REC-${2026}${String(index + 1).padStart(3, '0')}`,
    descricao: conta.descricao,
    beneficiario: overview.portalClient.nome_fantasia,
    valor: conta.total_liquido,
    emissao: conta.data_emissao,
    status: conta.situacao === 'pago' ? 'emitido' : 'disponivel',
    forma_pagamento: conta.forma_pagamento,
  }));

  return {
    ...overview,
    recibos,
    resumo: {
      total: recibos.length,
      emitidos: recibos.filter((item) => item.status === 'emitido').length,
      disponiveis: recibos.filter((item) => item.status === 'disponivel').length,
      valorTotal: recibos.reduce((sum, item) => sum + item.valor, 0),
    },
  };
}

export function getPortalServicosData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const servicos = [
    ...overview.solicitacoes.map((item) => ({
      id: `svc-${item.id}`,
      titulo: item.titulo,
      categoria: item.tipo,
      responsavel: item.responsavel,
      prazo: item.prazo,
      status: item.status,
      origem: 'Solicitação do cliente',
    })),
    ...overview.obrigacoesTrabalhistas.map((item) => ({
      id: `svc-${item.id}`,
      titulo: item.nome,
      categoria: 'trabalhista',
      responsavel: item.responsavel,
      prazo: item.proximo_vencimento,
      status: item.status,
      origem: 'Rotina recorrente',
    })),
  ].sort((a, b) => new Date(a.prazo) - new Date(b.prazo));

  return {
    ...overview,
    servicos,
    resumo: {
      total: servicos.length,
      pendentes: servicos.filter((item) => item.status === 'pendente').length,
      emAndamento: servicos.filter((item) => item.status === 'em_andamento').length,
      concluidos: servicos.filter((item) => item.status === 'entregue' || item.status === 'concluido').length,
    },
  };
}

export function getPortalFinanceiroCaixaData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const movimentacoes = [
    {
      id: 'cx-1',
      data: '2026-04-10',
      descricao: 'Recebimento de vendas no balcão',
      tipo: 'entrada',
      categoria: 'Faturamento',
      valor: 4850.0,
      status: 'confirmado',
      canal: 'Caixa',
    },
    {
      id: 'cx-2',
      data: '2026-04-11',
      descricao: 'Pagamento de fornecedor estratégico',
      tipo: 'saida',
      categoria: 'Fornecedores',
      valor: 1720.45,
      status: 'confirmado',
      canal: 'Transferência',
    },
    {
      id: 'cx-3',
      data: '2026-04-13',
      descricao: 'Recebimento via Pix de cliente recorrente',
      tipo: 'entrada',
      categoria: 'Recebimentos',
      valor: 2390.0,
      status: 'conciliando',
      canal: 'Pix',
    },
    {
      id: 'cx-4',
      data: '2026-04-14',
      descricao: 'Despesa operacional com logística',
      tipo: 'saida',
      categoria: 'Operacional',
      valor: 640.0,
      status: 'previsto',
      canal: 'Cartão corporativo',
    },
  ];

  const entradas = movimentacoes
    .filter((item) => item.tipo === 'entrada')
    .reduce((sum, item) => sum + item.valor, 0);
  const saidas = movimentacoes
    .filter((item) => item.tipo === 'saida')
    .reduce((sum, item) => sum + item.valor, 0);

  return {
    ...overview,
    movimentacoes,
    resumo: {
      entradas,
      saidas,
      saldoProjetado: entradas - saidas,
      conciliando: movimentacoes.filter((item) => item.status === 'conciliando').length,
    },
  };
}

export function getPortalGestaoAgendaData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const agenda = [
    {
      id: 'ag-1',
      titulo: 'Reunião mensal com o contador',
      tipo: 'reuniao',
      data: '2026-04-18T09:00:00',
      status: 'confirmado',
      descricao: 'Alinhamento sobre desempenho fiscal e próximos vencimentos.',
    },
    {
      id: 'ag-2',
      titulo: 'Envio de documentos financeiros',
      tipo: 'entrega',
      data: '2026-04-19T15:00:00',
      status: 'pendente',
      descricao: 'Prazo interno para anexar extratos e comprovantes do período.',
    },
    {
      id: 'ag-3',
      titulo: 'Fechamento de caixa da semana',
      tipo: 'rotina',
      data: '2026-04-20T18:00:00',
      status: 'planejado',
      descricao: 'Conferência das movimentações para apoiar o escritório.',
    },
    {
      id: 'ag-4',
      titulo: 'Validação de notas emitidas',
      tipo: 'fiscal',
      data: '2026-04-22T10:30:00',
      status: 'confirmado',
      descricao: 'Revisão das emissões antes do fechamento do mês.',
    },
  ].sort((a, b) => new Date(a.data) - new Date(b.data));

  return {
    ...overview,
    agenda,
    resumo: {
      total: agenda.length,
      confirmados: agenda.filter((item) => item.status === 'confirmado').length,
      pendentes: agenda.filter((item) => item.status === 'pendente').length,
      proximosSeteDias: agenda.filter((item) => new Date(item.data) <= new Date('2026-04-22T23:59:59')).length,
    },
  };
}

export function getPortalFinanceiroOrcamentosData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const orcamentos = [
    {
      id: 'orc-1',
      titulo: 'Proposta de assessoria fiscal mensal',
      cliente: 'Distribuidora Norte',
      valor: 2400.0,
      emissao: '2026-04-08',
      validade: '2026-04-20',
      status: 'em_analise',
      origem: 'Oportunidade recorrente',
    },
    {
      id: 'orc-2',
      titulo: 'Pacote de regularização cadastral',
      cliente: 'Clínica Integra',
      valor: 1850.0,
      emissao: '2026-04-10',
      validade: '2026-04-18',
      status: 'aprovado',
      origem: 'Indicação do escritório',
    },
    {
      id: 'orc-3',
      titulo: 'Serviço de emissão e conferência de notas',
      cliente: 'Mercado Avenida',
      valor: 1260.0,
      emissao: '2026-04-12',
      validade: '2026-04-24',
      status: 'enviado',
      origem: 'Expansão comercial',
    },
  ];

  return {
    ...overview,
    orcamentos,
    resumo: {
      total: orcamentos.length,
      valorTotal: orcamentos.reduce((sum, item) => sum + item.valor, 0),
      aprovados: orcamentos.filter((item) => item.status === 'aprovado').length,
      emAnalise: orcamentos.filter((item) => item.status === 'em_analise').length,
    },
  };
}

export function getPortalGestaoClientesData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const clientes = [
    {
      id: 'gc-1',
      nome: 'Distribuidora Norte',
      categoria: 'Atacado',
      cidade: 'Jacobina',
      status: 'ativo',
      faturamentoMensal: 18450.0,
      ultimoContato: '2026-04-11',
    },
    {
      id: 'gc-2',
      nome: 'Clínica Integra',
      categoria: 'Serviços médicos',
      cidade: 'Ourolândia',
      status: 'ativo',
      faturamentoMensal: 9260.0,
      ultimoContato: '2026-04-09',
    },
    {
      id: 'gc-3',
      nome: 'Mercado Avenida',
      categoria: 'Varejo',
      cidade: 'Capim Grosso',
      status: 'reativacao',
      faturamentoMensal: 4120.0,
      ultimoContato: '2026-04-03',
    },
  ];

  return {
    ...overview,
    clientes,
    resumo: {
      total: clientes.length,
      ativos: clientes.filter((item) => item.status === 'ativo').length,
      faturamentoMensal: clientes.reduce((sum, item) => sum + item.faturamentoMensal, 0),
      reativacao: clientes.filter((item) => item.status === 'reativação').length,
    },
  };
}

export function getPortalRelatorioFaturamentoData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const serieMensal = [
    { mes: 'Jan', valor: 18450.0 },
    { mes: 'Fev', valor: 19680.0 },
    { mes: 'Mar', valor: 21420.0 },
    { mes: 'Abr', valor: 23890.0 },
  ];

  const maiorValor = Math.max(...serieMensal.map((item) => item.valor));
  const faturamentoAtual = serieMensal[serieMensal.length - 1].valor;
  const faturamentoAnterior = serieMensal[serieMensal.length - 2].valor;

  return {
    ...overview,
    serieMensal,
    resumo: {
      faturamentoAtual,
      faturamentoAnterior,
      crescimentoPercentual: ((faturamentoAtual - faturamentoAnterior) / faturamentoAnterior) * 100,
      ticketMedio: faturamentoAtual / 18,
      maiorValor,
    },
  };
}

export function getPortalGestaoFornecedoresData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const fornecedores = [
    {
      id: 'forn-1',
      nome: 'Atacado Bahia Distribuição',
      categoria: 'Mercadorias',
      cidade: 'Feira de Santana',
      status: 'homologado',
      prazoMedio: '14 dias',
      ultimoPedido: '2026-04-09',
    },
    {
      id: 'forn-2',
      nome: 'ServLog Transportes',
      categoria: 'Logística',
      cidade: 'Salvador',
      status: 'ativo',
      prazoMedio: '7 dias',
      ultimoPedido: '2026-04-11',
    },
    {
      id: 'forn-3',
      nome: 'Papelaria Central Office',
      categoria: 'Suprimentos',
      cidade: 'Jacobina',
      status: 'avaliacao',
      prazoMedio: '5 dias',
      ultimoPedido: '2026-03-28',
    },
  ];

  return {
    ...overview,
    fornecedores,
    resumo: {
      total: fornecedores.length,
      homologados: fornecedores.filter((item) => item.status === 'homologado').length,
      ativos: fornecedores.filter((item) => item.status === 'ativo').length,
      avaliacao: fornecedores.filter((item) => item.status === 'avaliacao').length,
    },
  };
}

export function getPortalGestaoProdutosData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const produtos = [
    {
      id: 'prod-1',
      nome: 'Kit de peças automotivas premium',
      categoria: 'Autopeças',
      sku: 'ALF-KIT-001',
      status: 'alto_giro',
      preco: 389.9,
      estoque: 42,
    },
    {
      id: 'prod-2',
      nome: 'Óleo lubrificante sintético',
      categoria: 'Lubrificantes',
      sku: 'ALF-OLEO-014',
      status: 'regular',
      preco: 62.5,
      estoque: 118,
    },
    {
      id: 'prod-3',
      nome: 'Filtro de ar esportivo',
      categoria: 'Acessórios',
      sku: 'ALF-FILT-021',
      status: 'reposicao',
      preco: 94.0,
      estoque: 9,
    },
  ];

  return {
    ...overview,
    produtos,
    resumo: {
      total: produtos.length,
      altoGiro: produtos.filter((item) => item.status === 'alto_giro').length,
      reposicao: produtos.filter((item) => item.status === 'reposicao').length,
      valorCatalogo: produtos.reduce((sum, item) => sum + item.preco * item.estoque, 0),
    },
  };
}

export function getPortalGestaoEstoqueData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const estoque = [
    {
      id: 'est-1',
      item: 'Kit de peças automotivas premium',
      categoria: 'Autopeças',
      saldo: 42,
      minimo: 20,
      status: 'saudavel',
      cobertura: '24 dias',
    },
    {
      id: 'est-2',
      item: 'Filtro de ar esportivo',
      categoria: 'Acessórios',
      saldo: 9,
      minimo: 18,
      status: 'critico',
      cobertura: '5 dias',
    },
    {
      id: 'est-3',
      item: 'Óleo lubrificante sintético',
      categoria: 'Lubrificantes',
      saldo: 118,
      minimo: 40,
      status: 'saudavel',
      cobertura: '32 dias',
    },
  ];

  return {
    ...overview,
    estoque,
    resumo: {
      total: estoque.length,
      criticos: estoque.filter((item) => item.status === 'critico').length,
      saudaveis: estoque.filter((item) => item.status === 'saudavel').length,
      coberturaMediaDias: 20,
    },
  };
}

export function getPortalRelatorioDespesasData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const despesas = [
    { categoria: 'Folha e equipe', valor: 8420.0, participacao: 36 },
    { categoria: 'Fornecedores', valor: 6180.0, participacao: 27 },
    { categoria: 'Operacional', valor: 3920.0, participacao: 17 },
    { categoria: 'Tributos e taxas', valor: 2810.0, participacao: 12 },
    { categoria: 'Outros', valor: 1940.0, participacao: 8 },
  ];

  const total = despesas.reduce((sum, item) => sum + item.valor, 0);

  return {
    ...overview,
    despesas,
    resumo: {
      total,
      maiorCentroCusto: despesas[0].categoria,
      mediaMensal: total / despesas.length,
      categorias: despesas.length,
    },
  };
}

export function getPortalEmpresaData(clienteId) {
  const overview = getPortalOverviewData(clienteId);
  if (!overview) return null;

  const { company, portalClient } = overview;

  const socios = [
    {
      id: 'soc-1',
      nome: company.responsavel_empresa || 'Socio Administrador',
      participacao: portalClient.tipo_empresa === 'mei' ? '100%' : '60%',
      funcao: 'Administrador',
    },
    ...(portalClient.tipo_empresa === 'simples'
      ? [
          {
            id: 'soc-2',
            nome: 'Patricia Almeida',
            participacao: '40%',
            funcao: 'Socia',
          },
        ]
      : []),
  ];

  const documentoConstitutivo =
    portalClient.tipo_empresa === 'mei'
      ? {
          id: 'emp-doc-1',
          nome: 'CCMEI',
          status: 'atualizado',
          ultimaAtualizacao: '2026-03-10',
        }
      : {
          id: 'emp-doc-1',
          nome: 'Contrato social consolidado',
          status: 'atualizado',
          ultimaAtualizacao: '2026-03-10',
        };

  const documentos = [
    documentoConstitutivo,
    {
      id: 'emp-doc-2',
      nome: 'Cartao CNPJ',
      status: 'atualizado',
      ultimaAtualizacao: '2026-02-18',
    },
    {
      id: 'emp-doc-3',
      nome: 'Inscricao municipal',
      status: 'pendente_revisao',
      ultimaAtualizacao: '2026-01-28',
    },
  ];

  const certificadoDigital = {
    cadastrado: portalClient.tipo_empresa !== 'mei',
    arquivoNome:
      portalClient.tipo_empresa !== 'mei'
        ? `certificado-${portalClient.nome_fantasia.toLowerCase().replaceAll(' ', '-')}.pfx`
        : null,
    status: portalClient.tipo_empresa === 'mei' ? 'vigente' : 'renovar_em_breve',
    emissor: 'Autoridade Certificadora Brasil',
    validadeInicio: '2025-11-16',
    validadeFim: portalClient.tipo_empresa === 'mei' ? '2026-11-15' : '2026-05-30',
    senha: '••••••••',
  };

  return {
    ...overview,
    socios,
    documentos,
    certificadoDigital,
    contato: {
      email: company.email,
      telefone: company.telefone,
      whatsapp: company.whatsapp,
    },
    endereco: {
      cidade: company.cidade,
      cidadeAtendimento: company.cidade_atendimento,
      descricao: `Centro - ${company.cidade}`,
    },
  };
}


