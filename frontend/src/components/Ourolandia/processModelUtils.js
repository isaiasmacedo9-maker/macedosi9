const createId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const MODULE_BY_SECTOR = {
  Atendimento: 'atendimento',
  Financeiro: 'financeiro',
  Fiscal: 'fiscal',
  Trabalhista: 'trabalhista',
  Societario: 'contadores',
  Comercial: 'comercial',
};

const normalizeSectorLabel = (value = '') => {
  const normalized = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (normalized.includes('trabalh')) return 'Trabalhista';
  if (normalized.includes('fiscal')) return 'Fiscal';
  if (normalized.includes('finance')) return 'Financeiro';
  if (normalized.includes('societ') || normalized.includes('contador')) return 'Societario';
  if (normalized.includes('comercial')) return 'Comercial';
  return 'Atendimento';
};

const normalizeTaskList = (tasks = []) =>
  (Array.isArray(tasks) ? tasks : [])
    .map((task, index) => {
      const descricao = String(task?.descricao || '').trim();
      if (!descricao) return null;
      return {
        id: task?.id || createId('task-model'),
        descricao,
        ordem: Number(task?.ordem) > 0 ? Number(task.ordem) : index + 1,
        observacoes: String(task?.observacoes || '').trim(),
      };
    })
    .filter(Boolean);

const normalizeStepList = (steps = [], fallbackSector = 'Atendimento') =>
  (Array.isArray(steps) ? steps : [])
    .map((step, index) => {
      const tarefas = normalizeTaskList(step?.tarefas || []);
      if (!tarefas.length) return null;
      return {
        id: step?.id || createId('step-model'),
        nome: String(step?.nome || '').trim() || `Etapa ${index + 1}`,
        setorResponsavel: normalizeSectorLabel(step?.setorResponsavel || fallbackSector),
        moduloResponsavel: MODULE_BY_SECTOR[normalizeSectorLabel(step?.setorResponsavel || fallbackSector)] || 'atendimento',
        ordem: Number(step?.ordem) > 0 ? Number(step.ordem) : index + 1,
        tarefas,
      };
    })
    .filter(Boolean);

const buildDefaultSteps = (setorDestino = 'Atendimento') => [
  {
    nome: 'Triagem inicial do atendimento',
    setorResponsavel: 'Atendimento',
    tarefas: [
      { descricao: 'Registrar solicitacao do cliente e validar escopo' },
      { descricao: 'Solicitar documentacao obrigatoria do processo' },
    ],
  },
  {
    nome: 'Validacao financeira',
    setorResponsavel: 'Financeiro',
    tarefas: [{ descricao: 'Validar condicoes comerciais e aprovacao interna' }],
  },
  {
    nome: 'Aprovacao do cliente',
    setorResponsavel: 'Atendimento',
    tarefas: [{ descricao: 'Formalizar aprovacao do cliente para execucao' }],
  },
  {
    nome: `Execucao tecnica - ${setorDestino}`,
    setorResponsavel: setorDestino,
    tarefas: [{ descricao: 'Executar atividades tecnicas do processo' }],
  },
  {
    nome: 'Entrega e encerramento',
    setorResponsavel: 'Atendimento',
    tarefas: [{ descricao: 'Finalizar entrega, registrar aceite e encerrar processo' }],
  },
];

const uniqueSectorAllocations = (setorDestino) => {
  const sectors = Array.from(new Set(['Atendimento', 'Financeiro', normalizeSectorLabel(setorDestino)]));
  return sectors.map((sector) => ({
    setor: sector,
    modulo: MODULE_BY_SECTOR[sector] || 'atendimento',
    colaboradores: [],
  }));
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const ensureNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
const ensureBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
};

const ensureExtendedStructure = (model) => ({
  ...model,
  metadata: {
    version: 2,
    ...(model?.metadata || {}),
  },
  regimesConfig: {
    selecionarTodos: ensureBoolean(model?.regimesConfig?.selecionarTodos, true),
    selecionados: ensureArray(model?.regimesConfig?.selecionados),
    clientesAssociados: ensureNumber(model?.regimesConfig?.clientesAssociados, 0),
    clientesDesativados: ensureNumber(model?.regimesConfig?.clientesDesativados, 0),
    ...(model?.regimesConfig || {}),
  },
  clientesExcecoesConfig: {
    adicionados: ensureArray(model?.clientesExcecoesConfig?.adicionados),
    removidos: ensureArray(model?.clientesExcecoesConfig?.removidos),
    ...(model?.clientesExcecoesConfig || {}),
  },
  prazoConfig: {
    tipo: 'data_mensal_fixa',
    diaFixo: ensureNumber(model?.prazoConfig?.diaFixo, 20),
    competencia: 'mes_prazo',
    usarPrazoMeta: ensureBoolean(model?.prazoConfig?.usarPrazoMeta, false),
    diasAntecedencia: ensureNumber(model?.prazoConfig?.diasAntecedencia, 5),
    atrasoGeraMulta: ensureBoolean(model?.prazoConfig?.atrasoGeraMulta, false),
    ...(model?.prazoConfig || {}),
  },
  recorrenciaConfig: {
    tipo: 'unica',
    intervalo: null,
    ...(model?.recorrenciaConfig || {}),
  },
});

export const createProcessModelFromDraft = ({
  nome,
  descricao = '',
  setorDestino = 'Atendimento',
  steps = [],
  idPrefix = 'proc-model',
}) => {
  const cleanedName = String(nome || '').trim();
  if (!cleanedName) return null;

  const normalizedSetor = normalizeSectorLabel(setorDestino);
  const normalizedSteps = normalizeStepList(steps, normalizedSetor);
  const finalSteps = normalizedSteps.length
    ? normalizedSteps
    : normalizeStepList(buildDefaultSteps(normalizedSetor), normalizedSetor);

  const model = {
    id: createId(idPrefix),
    nome: cleanedName,
    descricao: String(descricao || '').trim() || `Modelo personalizado para ${cleanedName.toLowerCase()}.`,
    setorInicial: 'Atendimento',
    setorDestino: normalizedSetor,
    alocacaoColaboradores: uniqueSectorAllocations(normalizedSetor),
    etapas: finalSteps,
    criado_manual: true,
    criado_em: new Date().toISOString(),
  };

  return ensureExtendedStructure(model);
};

export const hydrateProcessModel = (model) => {
  if (!model || typeof model !== 'object') return null;
  const setorDestino = normalizeSectorLabel(model?.setorDestino || model?.setorInicial || 'Atendimento');
  const fallbackSteps = normalizeStepList(model?.etapas || [], setorDestino);

  const hydrated = {
    ...model,
    setorInicial: model?.setorInicial || 'Atendimento',
    setorDestino,
    alocacaoColaboradores: Array.isArray(model?.alocacaoColaboradores) && model.alocacaoColaboradores.length
      ? model.alocacaoColaboradores
      : uniqueSectorAllocations(setorDestino),
    etapas: fallbackSteps.length ? fallbackSteps : normalizeStepList(buildDefaultSteps(setorDestino), setorDestino),
  };

  const withStructure = ensureExtendedStructure(hydrated);

  return {
    ...withStructure,
    regimesConfig: {
      ...withStructure.regimesConfig,
      selecionados: ensureArray(withStructure.regimesConfig?.selecionados),
    },
    clientesExcecoesConfig: {
      ...withStructure.clientesExcecoesConfig,
      adicionados: ensureArray(withStructure.clientesExcecoesConfig?.adicionados),
      removidos: ensureArray(withStructure.clientesExcecoesConfig?.removidos),
    },
  };
};

export const hydrateProcessModels = (models = []) =>
  (Array.isArray(models) ? models : [])
    .map((item) => hydrateProcessModel(item))
    .filter(Boolean);
