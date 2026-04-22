export const INTERNAL_MODULES = [
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'comercial', label: 'Comercial' },
  { key: 'contadores', label: 'Contadores' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'fiscal', label: 'Fiscal' },
  { key: 'trabalhista', label: 'Trabalhista' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'configuracoes', label: 'Configurações' },
  { key: 'chat', label: 'Chat' },
  { key: 'dashboard', label: 'Dashboard' },
];

export const ALL_INTERNAL_MODULE_KEYS = INTERNAL_MODULES.map((item) => item.key);

const SECTOR_TO_MODULE = {
  atendimento: 'atendimento',
  comercial: 'comercial',
  contadores: 'contadores',
  contabil: 'contadores',
  financeiro: 'financeiro',
  fiscal: 'fiscal',
  trabalhista: 'trabalhista',
  ourolandia: 'ourolandia',
  clientes: 'clientes',
  servicos: 'servicos',
  servicosinternos: 'servicos',
  documentos: 'documentos',
  configuracoes: 'configuracoes',
  chat: 'chat',
};

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');

export const resolveModuleFromPath = (pathname = '') => {
  if (!pathname) return null;

  if (pathname.startsWith('/admin') || pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/atendimento')) return 'atendimento';
  if (pathname.startsWith('/comercial')) return 'comercial';
  if (pathname.startsWith('/contadores')) return 'contadores';
  if (
    pathname.startsWith('/financeiro') ||
    pathname.startsWith('/contas-receber') ||
    pathname.startsWith('/clientes-financeiro') ||
    pathname.startsWith('/metricas-financeiras') ||
    pathname.startsWith('/contas-pagar') ||
    pathname.startsWith('/servicos-avulsos')
  ) return 'financeiro';
  if (pathname.startsWith('/fiscal')) return 'fiscal';
  if (pathname.startsWith('/trabalhista')) return 'trabalhista';
  if (pathname.startsWith('/ourolandia')) return 'ourolandia';
  if (pathname.startsWith('/clientes')) return 'clientes';
  if (pathname.startsWith('/servicos')) return 'servicos';
  if (pathname.startsWith('/documentos')) return 'documentos';
  if (pathname.startsWith('/configuracoes')) return 'configuracoes';
  if (pathname.startsWith('/chat')) return 'chat';

  return null;
};

export const getEmailFromName = (name = '') =>
  `${name.toLowerCase().trim().replace(/\s+/g, '.')}@macedosi.com`;

export const deriveAllowedModules = (userData = {}) => {
  if (!userData) return ['dashboard'];
  if (userData.role === 'admin') return [...ALL_INTERNAL_MODULE_KEYS];

  const explicitModules = Array.isArray(userData.allowed_modules)
    ? userData.allowed_modules
    : Array.isArray(userData.modules_liberados)
      ? userData.modules_liberados
      : [];

  const normalizedExplicit = explicitModules
    .map((item) => normalize(item))
    .map((item) => SECTOR_TO_MODULE[item] || item)
    .filter((item) => ALL_INTERNAL_MODULE_KEYS.includes(item));

  const setorList = [
    ...(Array.isArray(userData.allowed_sectors) ? userData.allowed_sectors : []),
    ...((userData.permissoes || []).map((perm) => perm?.setor).filter(Boolean)),
  ];

  const derivedBySector = setorList
    .map((setor) => SECTOR_TO_MODULE[normalize(setor)])
    .filter(Boolean);

  const combined = [...new Set([...normalizedExplicit, ...derivedBySector])];

  if (!combined.includes('dashboard')) combined.unshift('dashboard');
  return combined.length ? combined : ['dashboard'];
};
