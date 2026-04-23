import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
  Minus,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { accountingServiceProcessModels } from '../../dev/accountingProcessTemplates';
import { createProcessModelFromDraft, hydrateProcessModel, hydrateProcessModels } from './processModelUtils';
import {
  createAcademyModel,
  generateProcessesBatch,
  listAcademyModels,
  updateAcademyModel,
} from './academyProcessService';
import api from '../../config/api';
import './MacedoAcademyDark.css';

const MODELS_KEY = 'mock_macedo_academy_process_models_v1';
const REAL_KEY = 'mock_macedo_academy_generated_processes_v2';

const REGIME_OPTIONS = [
  { id: 'simples_nacional', label: 'Simples Nacional', chip: 'SN' },
  { id: 'lucro_presumido', label: 'Lucro Presumido', chip: 'LP' },
  { id: 'lucro_real', label: 'Lucro Real', chip: 'LR' },
  { id: 'mei', label: 'Microempreendedor Individual', chip: 'MEI' },
  { id: 'produtor_rural', label: 'Produtor Rural', chip: 'PR' },
  { id: 'cpf', label: 'Pessoa Fisica', chip: 'CPF' },
];

const DEPARTMENT_META = {
  fiscal: { label: 'Fiscal', badge: 'F', color: 'bg-green-500' },
  pessoal: { label: 'Pessoal', badge: 'P', color: 'bg-amber-500' },
  legalizacao: { label: 'Legalização', badge: 'L', color: 'bg-cyan-500' },
  atendimento: { label: 'Atendimento', badge: 'A', color: 'bg-red-500' },
};

const RESPONSIBLE_OPTIONS = [
  { id: 'responsavel_cliente', label: 'Responsável do cliente' },
  { id: 'nao_atribuido', label: 'Não atribuído' },
  { id: 'sara_macedo', label: 'Sara Macedo' },
  { id: 'naiara', label: 'Naiara' },
  { id: 'gilvanilson', label: 'Gilvanilson' },
  { id: 'florivaldo', label: 'Florivaldo' },
];

const PRIORITY_OPTIONS = [
  { id: 'todos', label: 'Todos' },
  { id: 'urgente', label: 'Urgente' },
  { id: 'alta', label: 'Alta' },
  { id: 'normal', label: 'Normal' },
  { id: 'baixa', label: 'Baixa' },
];

const COMPETENCE_OPTIONS = [
  { id: 'mes_prazo', label: 'Mes do prazo' },
  { id: 'mes_anterior', label: 'Mes anterior' },
];

const RECURRENCES = [
  { id: 'unica', label: 'Apenas uma vez' },
  { id: 'mensal', label: 'Mensal' },
  { id: 'trimestral', label: 'Trimestral' },
];

const MOCK_CLIENTS = [
  { id: 'c1', nome: 'A. R. LOUREIRO FARMACIA', cnpj: '29.712.834/0001-01', regime: 'simples_nacional' },
  { id: 'c2', nome: 'ADI COMERCIO DE MARMORES E GRANITOS LTDA', cnpj: '53.062.700/0001-77', regime: 'simples_nacional' },
  { id: 'c3', nome: 'ADM MARMORES E GRANITOS LTDA', cnpj: '45.599.415/0001-61', regime: 'lucro_presumido' },
  { id: 'c4', nome: 'ADR CAR SERVICOS E COMERCIO AUTOMOTIVO', cnpj: '35.025.903/0001-38', regime: 'lucro_real' },
  { id: 'c5', nome: 'CLINICA VIDA INTEGRADA', cnpj: '18.102.334/0001-77', regime: 'simples_nacional' },
  { id: 'c6', nome: 'MERCADO SAO JOSE', cnpj: '20.995.211/0001-49', regime: 'mei' },
];

const uid = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeSectorKey = (value = '') => {
  const text = normalizeText(value);
  if (text.includes('fiscal')) return 'fiscal';
  if (text.includes('pessoal') || text.includes('trabalh')) return 'pessoal';
  if (text.includes('legal')) return 'legalizacao';
  if (text.includes('atend')) return 'atendimento';
  return 'fiscal';
};

const normalizeRegimeKey = (value = '') => {
  const text = normalizeText(value);
  if (text.includes('simples')) return 'simples_nacional';
  if (text.includes('presumido')) return 'lucro_presumido';
  if (text.includes('real')) return 'lucro_real';
  if (text.includes('mei')) return 'mei';
  if (text.includes('produtor')) return 'produtor_rural';
  if (text.includes('cpf')) return 'cpf';
  return text;
};

const getRegimeChip = (regimeId) => REGIME_OPTIONS.find((item) => item.id === regimeId)?.chip || regimeId;
const getResponsibleLabel = (id) => RESPONSIBLE_OPTIONS.find((item) => item.id === id)?.label || 'Responsavel do cliente';
const getPriorityLabel = (id) => PRIORITY_OPTIONS.find((item) => item.id === id)?.label || 'Todos';
const getExceptionItemId = (item) => (typeof item === 'string' ? item : item?.id);
const toIsoDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const toModelDraft = (model) => {
  const regimesSelected = Array.isArray(model?.regimesConfig?.selecionados) ? model.regimesConfig.selecionados : ['simples_nacional'];
  const etapas = Array.isArray(model?.etapas) ? model.etapas : [];

  const tasks = etapas.length
    ? etapas.map((step, index) => ({
        id: step.id || uid('task-card'),
        title: step.nome || `Tarefa ${index + 1}`,
        departmentKey: step.departmentKey || normalizeSectorKey(step.setorResponsavel),
        responsibleId: step.responsibleId || 'responsavel_cliente',
        estimateDays: step.estimateDays || '',
        priority: step.priority || 'todos',
        description: step.description || ((step.tarefas || [])[0]?.descricao || ''),
        documents: Array.isArray(step.documents) ? step.documents : [],
      }))
    : [
        {
          id: uid('task-card'),
          title: 'Sem titulo',
          departmentKey: 'fiscal',
          responsibleId: 'responsavel_cliente',
          estimateDays: '',
          priority: 'todos',
          description: '',
          documents: [],
        },
      ];

  return {
    id: model.id,
    title: model.nome || '',
    description: model.descricao || '',
    regimes: {
      allClients: !!model?.regimesConfig?.selecionarTodos,
      selected: regimesSelected,
      clientsAssociated: Number(model?.regimesConfig?.clientesAssociados || 0),
      clientsDisabled: Number(model?.regimesConfig?.clientesDesativados || 0),
    },
    clientsExceptions: {
      activeView: 'adicionados',
      search: '',
      added: Array.isArray(model?.clientesExcecoesConfig?.adicionados) ? model.clientesExcecoesConfig.adicionados : [],
      removed: Array.isArray(model?.clientesExcecoesConfig?.removidos) ? model.clientesExcecoesConfig.removidos : [],
    },
    deadline: {
      type: model?.prazoConfig?.tipo || 'data_mensal_fixa',
      fixedDay: Number(model?.prazoConfig?.diaFixo || 20),
      estimatedDays: Number(model?.prazoConfig?.tempoEstimadoDias || 5),
      competence: model?.prazoConfig?.competencia || 'mes_prazo',
      useGoal: !!model?.prazoConfig?.usarPrazoMeta,
      goalDays: Number(model?.prazoConfig?.diasAntecedencia || 5),
      delayedFine: !!model?.prazoConfig?.atrasoGeraMulta,
    },
    recurrence: {
      type: model?.recorrenciaConfig?.tipo || 'unica',
    },
    tasks,
  };
};

const draftToModel = (draft, previousModel = null) => {
  const targetDept = DEPARTMENT_META[draft.tasks[0]?.departmentKey || 'fiscal']?.label || 'Fiscal';
  const base = createProcessModelFromDraft({
    nome: draft.title,
    descricao: draft.description,
    setorDestino: targetDept,
    steps: draft.tasks.map((task) => ({
      nome: task.title,
      setorResponsavel: DEPARTMENT_META[task.departmentKey]?.label || 'Fiscal',
      tarefas: [{ descricao: task.description || task.title }],
    })),
    idPrefix: previousModel?.id ? 'proc-model-edit' : 'proc-model',
  });
  if (!base) return null;

  const mappedSteps = draft.tasks.map((task, index) => ({
    id: previousModel?.etapas?.[index]?.id || uid('step'),
    nome: task.title,
    setorResponsavel: DEPARTMENT_META[task.departmentKey]?.label || 'Fiscal',
    ordem: index + 1,
    priority: task.priority,
    responsibleId: task.responsibleId,
    estimateDays: task.estimateDays,
    description: task.description,
    departmentKey: task.departmentKey,
    documents: task.documents || [],
    tarefas: [
      {
        id: uid('task'),
        descricao: task.description || task.title,
        ordem: 1,
        observacoes: '',
      },
    ],
  }));

  return {
    ...base,
    id: previousModel?.id || base.id,
    criado_em: previousModel?.criado_em || new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    regimesConfig: {
      selecionarTodos: draft.regimes.allClients,
      selecionados: draft.regimes.selected,
      clientesAssociados: draft.regimes.clientsAssociated,
      clientesDesativados: draft.regimes.clientsDisabled,
    },
    clientesExcecoesConfig: {
      adicionados: draft.clientsExceptions.added,
      removidos: draft.clientsExceptions.removed,
    },
    prazoConfig: {
      tipo: draft.deadline.type,
      diaFixo: draft.deadline.fixedDay,
      tempoEstimadoDias: Number(draft.deadline.estimatedDays || 0),
      competencia: draft.deadline.competence,
      usarPrazoMeta: draft.deadline.useGoal,
      diasAntecedencia: draft.deadline.goalDays,
      atrasoGeraMulta: draft.deadline.delayedFine,
    },
    recorrenciaConfig: {
      tipo: draft.recurrence.type,
    },
    etapas: mappedSteps,
  };
};

const EmptyState = ({ text }) => (
  <div className="rounded-xl border border-dashed border-slate-300/70 px-4 py-8 text-center text-sm text-slate-500">
    {text}
  </div>
);

const MacedoAcademy = ({ sectorFilter = '' }) => {
  const [models, setModels] = useState(() => hydrateProcessModels(accountingServiceProcessModels));
  const [allClientsCatalog, setAllClientsCatalog] = useState(MOCK_CLIENTS);
  const [realProcesses, setRealProcesses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('regimes');
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [isHeaderActionsOpen, setIsHeaderActionsOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreviewId, setImportPreviewId] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmExpandedTasks, setConfirmExpandedTasks] = useState({});
  const [expandedModelRows, setExpandedModelRows] = useState({});
  const [search, setSearch] = useState('');
  const [regimeFilter, setRegimeFilter] = useState('any');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [draft, setDraft] = useState(null);

  const getModelSteps = (model) => (Array.isArray(model?.etapas) ? model.etapas : []);

  useEffect(() => {
    let mounted = true;
    const loadInitial = async () => {
      try {
        const backendModels = await listAcademyModels();
        if (mounted && Array.isArray(backendModels) && backendModels.length) {
          setModels(hydrateProcessModels(backendModels));
        }
      } catch {}

      try {
        const storedModels = JSON.parse(localStorage.getItem(MODELS_KEY) || '[]');
        if (mounted && Array.isArray(storedModels) && storedModels.length) {
          setModels(hydrateProcessModels(storedModels));
        }
        const storedProcesses = JSON.parse(localStorage.getItem(REAL_KEY) || '[]');
        if (mounted && Array.isArray(storedProcesses)) setRealProcesses(storedProcesses);
      } catch {}
    };
    loadInitial();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadClients = async () => {
      try {
        const response = await api.get('/clients', { params: { limit: 5000 } });
        const rows = Array.isArray(response.data?.clients)
          ? response.data.clients
          : Array.isArray(response.data?.items)
            ? response.data.items
            : Array.isArray(response.data)
              ? response.data
              : [];
        const normalized = [...rows, ...MOCK_CLIENTS]
          .map((item, index) => ({
            id: item.id || item.client_id || `client-${index}`,
            nome: item.nome || item.name || item.razao_social || item.fantasy_name || '',
            cnpj: item.cnpj || item.documento || '',
            regime: item.regime || 'simples_nacional',
          }))
          .filter((item) => item.nome);
        if (mounted && normalized.length) {
          const deduped = [];
          const seen = new Set();
          normalized.forEach((item) => {
            const key = String(item.id || `${item.nome}-${item.cnpj}` || '').trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            deduped.push({ ...item, id: key });
          });
          setAllClientsCatalog(deduped);
        }
      } catch {
        if (mounted) setAllClientsCatalog(MOCK_CLIENTS);
      }
    };

    loadClients();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(MODELS_KEY, JSON.stringify(models));
  }, [models]);

  useEffect(() => {
    localStorage.setItem(REAL_KEY, JSON.stringify(realProcesses));
  }, [realProcesses]);

  const importableTemplates = useMemo(() => {
    const currentNames = new Set(models.map((item) => normalizeText(item.nome)));
    return accountingServiceProcessModels.filter((item) => !currentNames.has(normalizeText(item.nome)));
  }, [models]);

  const filteredModels = useMemo(() => {
    const normalizedSectorFilter = normalizeSectorKey(sectorFilter || '');
    return models.filter((model) => {
      const searchMatches = !search || normalizeText(model.nome).includes(normalizeText(search));
      const regimes = model?.regimesConfig?.selecionados || [];
      const regimeMatches = regimeFilter === 'any' || regimes.includes(regimeFilter);
      const departments = Array.from(new Set(getModelSteps(model).map((step) => normalizeSectorKey(step.setorResponsavel))));
      const departmentMatches = departmentFilter === 'all' || departments.includes(departmentFilter);
      if (normalizedSectorFilter) {
        const direct = normalizeSectorKey(model?.setorDestino || model?.setorInicial || '');
        const hasSector = direct === normalizedSectorFilter || departments.includes(normalizedSectorFilter);
        if (!hasSector) return false;
      }
      return searchMatches && regimeMatches && departmentMatches;
    });
  }, [models, search, regimeFilter, departmentFilter, sectorFilter]);

  const sortedFilteredModels = useMemo(() => {
    return [...filteredModels].sort((a, b) => {
      const aDept = normalizeSectorKey(getModelSteps(a)[0]?.setorResponsavel || a?.setorDestino || 'fiscal');
      const bDept = normalizeSectorKey(getModelSteps(b)[0]?.setorResponsavel || b?.setorDestino || 'fiscal');
      const aDeptLabel = DEPARTMENT_META[aDept]?.label || aDept;
      const bDeptLabel = DEPARTMENT_META[bDept]?.label || bDept;
      const deptOrder = aDeptLabel.localeCompare(bDeptLabel, 'pt-BR');
      if (deptOrder !== 0) return deptOrder;
      return String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR');
    });
  }, [filteredModels]);

  const normalizeExceptionEntry = (entry) => {
    if (!entry) return null;
    if (typeof entry === 'string') {
      const found = allClientsCatalog.find((client) => String(client.id) === String(entry));
      return found || { id: entry, nome: entry, cnpj: '' };
    }
    if (!entry.id) return null;
    const found = allClientsCatalog.find((client) => String(client.id) === String(entry.id));
    return found || {
      id: entry.id,
      nome: entry.nome || entry.name || entry.id,
      cnpj: entry.cnpj || '',
      regime: entry.regime || 'simples_nacional',
    };
  };

  const normalizeDraftExceptions = (incomingDraft) => {
    if (!incomingDraft) return incomingDraft;
    const added = Array.isArray(incomingDraft?.clientsExceptions?.added)
      ? incomingDraft.clientsExceptions.added.map(normalizeExceptionEntry).filter(Boolean)
      : [];
    const removed = Array.isArray(incomingDraft?.clientsExceptions?.removed)
      ? incomingDraft.clientsExceptions.removed
          .map(normalizeExceptionEntry)
          .filter((item) => item && !added.some((addedItem) => addedItem.id === item.id))
      : [];

    return {
      ...incomingDraft,
      clientsExceptions: {
        ...(incomingDraft.clientsExceptions || {}),
        added,
        removed,
      },
    };
  };

  const recalculateDraftRegimeSummary = (incomingDraft) => {
    if (!incomingDraft) return incomingDraft;
    const selectedRegimes = new Set((incomingDraft.regimes?.selected || []).map((item) => normalizeRegimeKey(item)));
    const baseClients = incomingDraft.regimes?.allClients
      ? allClientsCatalog
      : allClientsCatalog.filter((client) => selectedRegimes.has(normalizeRegimeKey(client.regime)));

    const removedIds = new Set((incomingDraft.clientsExceptions?.removed || []).map((item) => getExceptionItemId(item)));
    const added = (incomingDraft.clientsExceptions?.added || []).filter(Boolean);
    const finalClients = [...baseClients.filter((item) => !removedIds.has(item.id)), ...added].reduce((acc, item) => {
      if (!item?.id) return acc;
      if (!acc.some((exists) => exists.id === item.id)) acc.push(item);
      return acc;
    }, []);

    return {
      ...incomingDraft,
      regimes: {
        ...incomingDraft.regimes,
        clientsAssociated: finalClients.length,
        clientsDisabled: Math.max(0, allClientsCatalog.length - finalClients.length),
      },
    };
  };

  const openEditor = (model) => {
    setSelectedId(model.id);
    setIsCreateMode(false);
    setDraft(recalculateDraftRegimeSummary(normalizeDraftExceptions(toModelDraft(model))));
    setDrawerTab('regimes');
    setIsHeaderActionsOpen(false);
    setIsDrawerOpen(true);
  };

  const openCreateDrawer = () => {
    const draftModel = {
      id: '',
      nome: '',
      descricao: '',
      etapas: [],
      regimesConfig: {
        selecionarTodos: true,
        selecionados: ['simples_nacional'],
        clientesAssociados: allClientsCatalog.length,
        clientesDesativados: 0,
      },
      clientesExcecoesConfig: { adicionados: [], removidos: [] },
      prazoConfig: {
        tipo: 'data_mensal_fixa',
        diaFixo: 20,
        competencia: 'mes_prazo',
        usarPrazoMeta: false,
        diasAntecedencia: 5,
        atrasoGeraMulta: false,
      },
      recorrenciaConfig: { tipo: 'unica' },
    };
    setSelectedId('');
    setIsCreateMode(true);
    setDraft(recalculateDraftRegimeSummary(normalizeDraftExceptions(toModelDraft(draftModel))));
    setDrawerTab('regimes');
    setIsHeaderActionsOpen(false);
    setIsDrawerOpen(true);
  };

  const saveDraftModel = async (options = {}) => {
    const closeDrawer = options.closeDrawer !== false;
    if (!draft || !String(draft.title || '').trim()) return;
    const previous = models.find((item) => item.id === selectedId) || null;
    const nextModel = draftToModel(draft, previous);
    if (!nextModel) return;

    if (isCreateMode || !previous) {
      let persistedModel = nextModel;
      try {
        const response = await createAcademyModel({
          id: nextModel.id,
          nome: nextModel.nome,
          descricao: nextModel.descricao,
          setorDestino: nextModel.setorDestino,
          regimesConfig: nextModel.regimesConfig,
          clientesExcecoesConfig: nextModel.clientesExcecoesConfig,
          prazoConfig: nextModel.prazoConfig,
          recorrenciaConfig: nextModel.recorrenciaConfig,
          etapas: nextModel.etapas,
          metadata: nextModel.metadata || {},
        });
        persistedModel = hydrateProcessModel({
          ...nextModel,
          ...response,
        }) || nextModel;
      } catch {}
      setModels((current) => hydrateProcessModels([persistedModel, ...current]));
      setSelectedId(persistedModel.id || nextModel.id);
      setIsCreateMode(false);
      if (closeDrawer) {
        setIsDrawerOpen(false);
        setDraft(null);
      }
      return persistedModel.id || nextModel.id;
    } else {
      let persistedModel = nextModel;
      try {
        const response = await updateAcademyModel(previous.id, {
          id: previous.id,
          nome: nextModel.nome,
          descricao: nextModel.descricao,
          setorDestino: nextModel.setorDestino,
          regimesConfig: nextModel.regimesConfig,
          clientesExcecoesConfig: nextModel.clientesExcecoesConfig,
          prazoConfig: nextModel.prazoConfig,
          recorrenciaConfig: nextModel.recorrenciaConfig,
          etapas: nextModel.etapas,
          metadata: nextModel.metadata || {},
        });
        persistedModel = hydrateProcessModel({
          ...nextModel,
          ...response,
        }) || nextModel;
      } catch {}
      setModels((current) =>
        hydrateProcessModels(current.map((item) => (item.id === previous.id ? persistedModel : item))),
      );
      if (closeDrawer) {
        setIsDrawerOpen(false);
        setDraft(null);
      }
      return previous.id;
    }
  };

  const toggleRegime = (regimeId) => {
    setDraft((current) => {
      if (!current) return current;
      const selected = new Set(current.regimes.selected);
      if (selected.has(regimeId)) selected.delete(regimeId);
      else selected.add(regimeId);
      return recalculateDraftRegimeSummary({
        ...current,
        regimes: {
          ...current.regimes,
          selected: Array.from(selected),
        },
      });
    });
  };

  const addClientException = (client, targetView = 'adicionados') => {
    setDraft((current) => {
      if (!current) return current;
      const sourceList = Array.isArray(current.clientsExceptions[targetView]) ? current.clientsExceptions[targetView] : [];
      const clientId = String(client?.id || '');
      const exists = sourceList.some((item) => String(getExceptionItemId(item)) === clientId);
      if (exists) return current;
      const oppositeView = targetView === 'adicionados' ? 'removidos' : 'adicionados';
      return recalculateDraftRegimeSummary({
        ...current,
        clientsExceptions: {
          ...current.clientsExceptions,
          [targetView]: [...sourceList, { ...client, id: clientId }],
          [oppositeView]: (current.clientsExceptions[oppositeView] || []).filter((item) => String(getExceptionItemId(item)) !== clientId),
        },
      });
    });
  };

  const removeClientException = (clientId, source) => {
    setDraft((current) => {
      if (!current) return current;
      return recalculateDraftRegimeSummary({
        ...current,
        clientsExceptions: {
          ...current.clientsExceptions,
          [source]: (current.clientsExceptions[source] || []).filter((item) => String(getExceptionItemId(item)) !== String(clientId)),
        },
      });
    });
  };

  const updateTask = (taskId, field, value) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, [field]: value } : task)),
      };
    });
  };

  const addTask = () => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        tasks: [
          ...current.tasks,
          {
            id: uid('task-card'),
            title: 'Sem titulo',
            departmentKey: 'fiscal',
            responsibleId: 'responsavel_cliente',
            estimateDays: '',
            priority: 'todos',
            description: '',
            documents: [],
          },
        ],
      };
    });
  };

  const removeTask = (taskId) => {
    setDraft((current) => {
      if (!current || current.tasks.length <= 1) return current;
      return {
        ...current,
        tasks: current.tasks.filter((task) => task.id !== taskId),
      };
    });
  };

  const addTaskDocument = (taskId) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.id !== taskId
            ? task
            : {
                ...task,
                documents: [
                  ...(task.documents || []),
                  {
                    id: uid('doc'),
                    title: 'Relatorio Analitico',
                    required: true,
                    sendToClient: true,
                  },
                ],
              },
        ),
      };
    });
  };

  const removeTaskDocument = (taskId, docId) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.id !== taskId
            ? task
            : {
                ...task,
                documents: (task.documents || []).filter((doc) => doc.id !== docId),
              },
        ),
      };
    });
  };

  const updateTaskDocument = (taskId, docId, field, value) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.id !== taskId
            ? task
            : {
                ...task,
                documents: (task.documents || []).map((doc) => (doc.id === docId ? { ...doc, [field]: value } : doc)),
              },
        ),
      };
    });
  };

  const importSelectedModel = async () => {
    const source = importableTemplates.find((item) => item.id === importPreviewId);
    if (!source) return;
    const normalized = draftToModel(
      {
        ...toModelDraft(source),
        title: source.nome,
        description: source.descricao || '',
      },
      null,
    );
    if (!normalized) return;
    let persistedModel = normalized;
    try {
      const response = await createAcademyModel({
        id: normalized.id,
        nome: normalized.nome,
        descricao: normalized.descricao,
        setorDestino: normalized.setorDestino,
        regimesConfig: normalized.regimesConfig,
        clientesExcecoesConfig: normalized.clientesExcecoesConfig,
        prazoConfig: normalized.prazoConfig,
        recorrenciaConfig: normalized.recorrenciaConfig,
        etapas: normalized.etapas,
        metadata: normalized.metadata || {},
      });
      persistedModel = hydrateProcessModel({ ...normalized, ...response }) || normalized;
    } catch {}
    setModels((current) => hydrateProcessModels([persistedModel, ...current]));
    setImportPreviewId('');
    setIsImportModalOpen(false);
  };

  const reviewImportInDrawer = (sourceModel) => {
    if (!sourceModel) return;
    setSelectedId('');
    setIsCreateMode(true);
    setDraft(recalculateDraftRegimeSummary(
      toModelDraft({
        ...sourceModel,
        id: '',
      }),
    ));
    setDrawerTab('regimes');
    setIsImportModalOpen(false);
    setIsDrawerOpen(true);
  };

  const handleOpenConfirm = async () => {
    if (
      !draft ||
      !String(draft.title || '').trim() ||
      (!draft.regimes.allClients && !(draft.regimes.selected || []).length) ||
      !(draft.tasks || []).length
    ) {
      return;
    }
    await saveDraftModel({ closeDrawer: false });
    setConfirmExpandedTasks({});
    setIsConfirmModalOpen(true);
  };

  // Regra de dominio Macedo Academy:
  // - Modelos da tela equivalem a Processos (template)
  // - "Gerar processos" na UI cria Servicos reais para os clientes
  const generateServicesFromModel = async () => {
    if (!draft) return;
    const selectedRegimes = new Set((draft.regimes.selected || []).map((item) => normalizeRegimeKey(item)));
    const baseClients = draft.regimes.allClients
      ? allClientsCatalog
      : allClientsCatalog.filter((item) => selectedRegimes.has(normalizeRegimeKey(item.regime)));
    const removedIds = new Set((draft.clientsExceptions.removed || []).map((item) => item.id));
    const added = draft.clientsExceptions.added || [];

    const finalClients = [...baseClients.filter((item) => !removedIds.has(item.id)), ...added]
      .reduce((acc, item) => {
        if (!acc.some((exists) => exists.id === item.id)) acc.push(item);
        return acc;
      }, []);

    const now = new Date();
    const targetDueDate = toIsoDate(new Date(now.getFullYear(), now.getMonth(), draft.deadline.fixedDay || 20).toISOString());

    const created = finalClients.map((client) => ({
      id: uid('generated'),
      tipoRegistro: 'servico',
      origemModeloId: selectedId || null,
      nome: draft.title,
      clienteNome: client.nome,
      clienteCnpj: client.cnpj,
      criadoEm: new Date().toISOString(),
      dataVencimento: targetDueDate,
      status: 'pendente',
      prazoConfig: draft.deadline,
      recorrenciaConfig: draft.recurrence,
      tarefas: draft.tasks.map((task, index) => ({
        id: uid('task'),
        ordem: index + 1,
        titulo: task.title,
        prioridade: task.priority,
        prazoDias: task.estimateDays,
        responsavel: task.responsibleId,
      })),
    }));
    let finalCreated = created;
    try {
      const response = await generateProcessesBatch(
        created.map((item) => ({
          // Campos atuais do backend
          model_id: selectedId || null,
          model_nome: item.nome,
          cliente_nome: item.clienteNome,
          cliente_cnpj: item.clienteCnpj,
          status: item.status,
          data_vencimento: item.dataVencimento || null,
          // Alias sem quebrar compatibilidade para camada de servicos
          service_type: item.tipoRegistro,
          service_nome: item.nome,
          source_model_id: item.origemModeloId,
          payload: {
            prazoConfig: item.prazoConfig,
            recorrenciaConfig: item.recorrenciaConfig,
            tarefas: item.tarefas,
          },
        })),
      );
      if (response?.created && Array.isArray(response.items) && response.items.length === created.length) {
        finalCreated = response.items.map((item, index) => ({
          id: item.id || created[index].id,
          tipoRegistro: 'servico',
          origemModeloId: item.model_id || created[index].origemModeloId,
          nome: item.model_nome || created[index].nome,
          clienteNome: item.cliente_nome || created[index].clienteNome,
          clienteCnpj: item.cliente_cnpj || created[index].clienteCnpj,
          criadoEm: item.created_at || created[index].criadoEm,
          dataVencimento: item.data_vencimento || created[index].dataVencimento,
          status: item.status || created[index].status,
          prazoConfig: item.payload?.prazoConfig || created[index].prazoConfig,
          recorrenciaConfig: item.payload?.recorrenciaConfig || created[index].recorrenciaConfig,
          tarefas: Array.isArray(item.payload?.tarefas) ? item.payload.tarefas : created[index].tarefas,
        }));
      }
    } catch {}
    setRealProcesses((current) => [...finalCreated, ...current]);
    setIsConfirmModalOpen(false);
    setConfirmExpandedTasks({});
    setIsDrawerOpen(false);
  };

  const selectedImportPreview = importableTemplates.find((item) => item.id === importPreviewId) || null;
  const safeClientsExceptions =
    draft && draft.clientsExceptions
      ? draft.clientsExceptions
      : {
          activeView: 'adicionados',
          search: '',
          added: [],
          removed: [],
        };

  const clientsForExceptionSearch = useMemo(() => {
    const term = normalizeText(safeClientsExceptions.search || '');
    const base = [...allClientsCatalog].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
    if (!term) return base;
    return base.filter((item) => normalizeText(item.nome).includes(term) || normalizeText(item.cnpj).includes(term));
  }, [safeClientsExceptions.search, allClientsCatalog]);

  const activeExceptionIds = useMemo(() => {
    const activeView = safeClientsExceptions.activeView;
    const sourceList = activeView ? safeClientsExceptions[activeView] : [];
    const list = Array.isArray(sourceList) ? sourceList : [];
    return new Set(list.map((item) => String(getExceptionItemId(item))).filter(Boolean));
  }, [safeClientsExceptions]);

  const canGenerateModel =
    !!draft &&
    !!String(draft.title || '').trim() &&
    (draft.regimes.allClients || (draft.regimes.selected || []).length > 0) &&
    (draft.tasks || []).length > 0;

  const tabButton = (tabId, label) => (
    <button
      type="button"
      onClick={() => setDrawerTab(tabId)}
      className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
        drawerTab === tabId
          ? 'border-slate-800 bg-slate-700 text-white'
          : 'border-transparent bg-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="macedo-academy-dark space-y-5 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-bold">Meus modelos</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-700 px-4 py-2 text-sm font-semibold text-white"
          >
            <FileText className="h-4 w-4" />
            Importar modelo
          </button>
          <button
            type="button"
            onClick={openCreateDrawer}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Criar manualmente
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-100/80 p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="space-y-1 text-sm font-semibold text-slate-600">
              Buscar
              <div className="flex items-center rounded-lg border border-slate-300 bg-white px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-transparent px-2 py-2.5 text-sm outline-none"
                />
              </div>
            </label>
            <label className="space-y-1 text-sm font-semibold text-slate-600">
              Regime
              <div className="relative">
                <select
                  value={regimeFilter}
                  onChange={(event) => setRegimeFilter(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="any">Qualquer regime</option>
                  {REGIME_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
              </div>
            </label>
            <label className="space-y-1 text-sm font-semibold text-slate-600">
              Departamentos
              <div className="relative">
                <select
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="all">Todos</option>
                  {Object.entries(DEPARTMENT_META).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
              </div>
            </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-sm text-slate-500">
                <th className="px-4 py-3 font-semibold">Título</th>
                <th className="px-4 py-3 font-semibold">Regimes</th>
                <th className="px-4 py-3 font-semibold">Departamentos</th>
                <th className="px-4 py-3 font-semibold">Clientes associados</th>
                <th className="px-4 py-3 font-semibold">Recorrência</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredModels.map((model, modelIndex) => {
                const isSelected = selectedId === model.id;
                const isExpanded = !!expandedModelRows[model.id];
                const modelRegimes = model?.regimesConfig?.selecionados || [];
                const departments = Array.from(new Set(getModelSteps(model).map((step) => normalizeSectorKey(step.setorResponsavel))));
                const primaryDepartment = departments[0] || normalizeSectorKey(model?.setorDestino || 'fiscal');
                const previousModel = modelIndex > 0 ? sortedFilteredModels[modelIndex - 1] : null;
                const previousDepartments = previousModel
                  ? Array.from(new Set(getModelSteps(previousModel).map((step) => normalizeSectorKey(step.setorResponsavel))))
                  : [];
                const previousPrimaryDepartment = previousDepartments[0] || normalizeSectorKey(previousModel?.setorDestino || 'fiscal');
                const showDepartmentHeader = modelIndex === 0 || previousPrimaryDepartment !== primaryDepartment;
                return (
                  <React.Fragment key={model.id}>
                    {showDepartmentHeader ? (
                      <tr className="bg-slate-100/80">
                        <td colSpan={5} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                          Setor: {DEPARTMENT_META[primaryDepartment]?.label || primaryDepartment}
                        </td>
                      </tr>
                    ) : null}
                    <tr
                      className={`border-b border-slate-100 text-sm ${isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                      style={isSelected ? { boxShadow: 'inset 0 0 0 1px rgba(16, 185, 129, 0.45)' } : undefined}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedModelRows((current) => ({ ...current, [model.id]: !current[model.id] }));
                          }}
                          className="mr-2 inline-flex h-5 w-5 items-center justify-center"
                        >
                          <ChevronRight className={`h-3 w-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        <button type="button" onClick={() => openEditor(model)} className="font-semibold text-slate-700">
                          {model.nome}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {modelRegimes.length ? (
                            modelRegimes.map((regime) => (
                              <span key={regime} className="rounded-full border border-emerald-500 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                {getRegimeChip(regime)}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full border border-emerald-500 px-2 py-0.5 text-xs font-semibold text-emerald-700">TODOS</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {departments.map((dept) => (
                            <span
                              key={dept}
                              className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-bold text-white ${DEPARTMENT_META[dept]?.color || 'bg-slate-500'}`}
                            >
                              {DEPARTMENT_META[dept]?.badge || dept.slice(0, 1).toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-600">
                        {model?.regimesConfig?.clientesAssociados || 0}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 text-xs text-slate-500">
                          {model?.recorrenciaConfig?.tipo === 'unica' ? <Minus className="h-3 w-3" /> : <RefreshCcw className="h-3 w-3" />}
                        </span>
                      </td>
                    </tr>
                    {isExpanded ? (
                      getModelSteps(model).map((step, index) => (
                        <tr key={`${model.id}-step-${step.id || index}`} className="border-b border-slate-100 bg-slate-50/80 text-sm">
                          <td className="px-10 py-2 text-slate-700">
                            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-xs font-semibold text-slate-600">{index + 1}</span>
                            {step.nome}
                            <div className="mt-1 text-xs text-slate-500">
                              {(step.tarefas || []).map((task, taskIndex) => (
                                <div key={`${step.id || index}-task-${taskIndex}`}>{task.descricao}</div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2">
                            <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-bold text-white ${DEPARTMENT_META[normalizeSectorKey(step.setorResponsavel)]?.color || 'bg-slate-500'}`}>
                              {DEPARTMENT_META[normalizeSectorKey(step.setorResponsavel)]?.badge || 'F'}
                            </span>
                          </td>
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2" />
                        </tr>
                      ))
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {!sortedFilteredModels.length ? <EmptyState text="Nenhum modelo encontrado para os filtros selecionados." /> : null}
        </div>
      </div>

      {false ? (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute right-0 top-0 h-full w-full max-w-[860px] overflow-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-full">
                  <h2 className="text-4xl font-bold">{createStep === 1 ? 'Crie um modelo' : 'Criando novo modelo'}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-full border border-slate-300 p-2 text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-8 px-6 py-6">
              {createStep === 1 ? (
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-600">
                    Nome do processo
                    <input
                      value={draft.title}
                      onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Insira o nome do processo"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-600">
                    Descrição
                    <textarea
                      value={draft.description}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Insira uma descrição"
                      rows={8}
                      className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg"
                    />
                  </label>
                </div>
              ) : null}

              {createStep === 2 ? (
                <div className="space-y-6">
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg"
                  />

                  <div className="space-y-4 border-t border-slate-200 pt-6">
                    <h3 className="text-4xl font-bold">Escolha um tipo de prazo</h3>
                    <label className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="create-deadline-type"
                        checked={draft.deadline.type === 'data_mensal_fixa'}
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            deadline: { ...current.deadline, type: 'data_mensal_fixa' },
                          }))
                        }
                      />
                      <div>
                        <div className="text-2xl font-semibold">Data mensal fixa</div>
                        <div className="text-slate-500">Ideal para obrigações mensais.</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="create-deadline-type"
                        checked={draft.deadline.type === 'tempo_estimado_execucao'}
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            deadline: { ...current.deadline, type: 'tempo_estimado_execucao' },
                          }))
                        }
                      />
                      <div>
                        <div className="text-2xl font-semibold">Tempo estimado para execução</div>
                        <div className="text-slate-500">Ideal para tarefas rápidas.</div>
                      </div>
                    </label>
                  </div>

                  {draft.deadline.type === 'data_mensal_fixa' ? (
                    <div className="space-y-4 border-t border-slate-200 pt-6">
                      <h4 className="text-4xl font-bold">Configure a data mensal fixa</h4>
                      <label className="block text-sm font-semibold text-slate-600">
                        Data mensal fixa
                        <div className="relative mt-1">
                          <select
                            value={draft.deadline.fixedDay}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                deadline: { ...current.deadline, fixedDay: Number(event.target.value) },
                              }))
                            }
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg"
                          >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                              <option key={day} value={day}>{`Dia ${day}`}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                        </div>
                      </label>

                      <label className="block text-sm font-semibold text-slate-600">
                        Competência
                        <div className="relative mt-1">
                          <select
                            value={draft.deadline.competence}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                deadline: { ...current.deadline, competence: event.target.value },
                              }))
                            }
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg"
                          >
                            {COMPETENCE_OPTIONS.map((item) => (
                              <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                        </div>
                      </label>

                      <label className="inline-flex items-center gap-2 text-2xl font-semibold">
                        <input
                          type="checkbox"
                          checked={draft.deadline.useGoal}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              deadline: { ...current.deadline, useGoal: event.target.checked },
                            }))
                          }
                        />
                        Usar prazo-meta
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4 border-t border-slate-200 pt-6">
                      <h4 className="text-4xl font-bold">Configure o prazo estimado</h4>
                      <label className="block text-sm font-semibold text-slate-600">
                        Tempo estimado de execução
                        <div className="relative mt-1">
                          <select
                            value={draft.deadline.goalDays}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                deadline: { ...current.deadline, goalDays: Number(event.target.value) },
                              }))
                            }
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg"
                          >
                            <option value="">Selecione um tempo estimado</option>
                            {[1, 2, 3, 4, 5, 6, 7, 10, 15].map((day) => (
                              <option key={day} value={day}>{`${day} dias`}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="space-y-3 border-t border-slate-200 pt-6">
                    <h4 className="text-3xl font-bold">Esta tarefa gera multa se atrasar?</h4>
                    <div className="text-slate-500">Ative para ser notificado antes do vencimento.</div>
                    <label className="inline-flex items-center gap-2 text-2xl font-semibold">
                      <input
                        type="checkbox"
                        checked={draft.deadline.delayedFine}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            deadline: { ...current.deadline, delayedFine: event.target.checked },
                          }))
                        }
                      />
                      Atraso gera multa
                    </label>
                  </div>
                </div>
              ) : null}

              {createStep === 3 ? (
                <div className="space-y-6">
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg"
                  />

                  <div className="space-y-2 border-t border-slate-200 pt-6">
                    <h3 className="text-4xl font-bold">Adicione tarefas</h3>
                    <p className="text-lg text-slate-600">Monte seu checklist para facilitar o trabalho.</p>
                  </div>

                  <div className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-base text-slate-700">
                    <Info className="mr-2 inline h-4 w-4" />
                    {draft.deadline.type === 'tempo_estimado_execucao'
                      ? 'O prazo das tarefas será baseado em tempo estimado de execução (dias a partir da criação do processo).'
                      : 'O prazo das tarefas será baseado em data mensal fixa.'}
                  </div>

                  <div className="space-y-4">
                    {draft.tasks.map((task, index) => (
                      <div key={task.id} className="rounded-lg border border-slate-200 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="text-2xl font-bold">
                            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-sm">{index + 1}</span>
                            <input
                              value={task.title}
                              onChange={(event) => updateTask(task.id, 'title', event.target.value)}
                              className="rounded-md border border-transparent px-2 py-1 outline-none focus:border-slate-300"
                            />
                          </div>
                          {draft.tasks.length > 1 ? (
                            <button type="button" onClick={() => removeTask(task.id)} className="rounded-md border border-slate-300 p-1.5 text-slate-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>

                        <div className="rounded-lg bg-slate-100 p-3">
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <div className="relative">
                              <select
                                value={task.departmentKey}
                                onChange={(event) => updateTask(task.id, 'departmentKey', event.target.value)}
                                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              >
                                {Object.entries(DEPARTMENT_META).map(([key, meta]) => (
                                  <option key={key} value={key}>{meta.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                            </div>
                            <div className="relative">
                              <select
                                value={task.responsibleId}
                                onChange={(event) => updateTask(task.id, 'responsibleId', event.target.value)}
                                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              >
                                {RESPONSIBLE_OPTIONS.map((item) => (
                                  <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-3">
                          <label className="block text-sm font-semibold text-slate-600">
                            Tempo estimado (dias)
                            <div className="relative mt-1">
                              <select
                                value={task.estimateDays}
                                onChange={(event) => updateTask(task.id, 'estimateDays', event.target.value)}
                                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              >
                                <option value="">Selecione o tempo estimado</option>
                                {[1, 2, 3, 4, 5, 7, 10, 15].map((day) => (
                                  <option key={day} value={day}>{`${day} dias`}</option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                            </div>
                          </label>
                        </div>

                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => addTaskDocument(task.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-400 bg-white px-4 py-2 text-xl text-slate-700"
                          >
                            <Plus className="h-4 w-4" />
                            Documento
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addTask}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-lg font-semibold text-white"
                    >
                      + Tarefa padrão
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                {createStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCreateStep((current) => Math.max(1, current - 1))}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xl font-semibold text-slate-700"
                  >
                    Voltar
                  </button>
                ) : <span />}

                {createStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setCreateStep((current) => Math.min(3, current + 1))}
                    disabled={createStep === 1 && !String(draft.title || '').trim()}
                    className="rounded-lg border border-slate-700 bg-slate-700 px-5 py-2.5 text-xl font-semibold text-white disabled:opacity-40"
                  >
                    Continuar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => saveDraftModel({ closeAfterCreate: true })}
                    className="rounded-lg border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-xl font-semibold text-white"
                  >
                    Salvar modelo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isDrawerOpen && draft ? (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute right-0 top-0 h-full w-full max-w-[860px] overflow-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white">
              <div className="px-6 py-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="PGDAS"
                    className="w-full bg-transparent text-4xl font-bold outline-none"
                  />
                  <div className="relative flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsHeaderActionsOpen((current) => !current)}
                      className="rounded-lg border border-slate-300 bg-white p-2 text-slate-500"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {isHeaderActionsOpen ? (
                      <div className="absolute right-11 top-0 z-20 min-w-[160px] rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                        <button
                          type="button"
                          onClick={async () => {
                            await saveDraftModel({ closeDrawer: false });
                            setIsHeaderActionsOpen(false);
                          }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Salvar alteracoes
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setIsHeaderActionsOpen(false);
                        setIsDrawerOpen(false);
                      }}
                      className="rounded-full border border-slate-300 p-2 text-slate-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mb-4 text-sm text-slate-500">Descrição</div>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="mb-5 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base outline-none"
                />
                <div className="flex gap-2 overflow-auto">
                  {tabButton('regimes', 'Regimes')}
                  {tabButton('clientes_excecoes', 'Clientes e Exceções')}
                  {tabButton('prazo', 'Prazo')}
                  {tabButton('tarefas', 'Tarefas')}
                  {tabButton('recorrencia', 'Recorrência')}
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {drawerTab === 'regimes' ? (
                <>
                  <h3 className="text-3xl font-bold">Escolha os regimes que receberao este serviço</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={draft.regimes.allClients}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            regimes: { ...current.regimes, allClients: event.target.checked },
                          }))
                        }
                      />
                      <span className="rounded-full border border-emerald-500 px-2 py-0.5 text-xs font-semibold text-emerald-700">TODOS</span>
                      <span className="font-semibold">Todos os clientes</span>
                    </label>
                    {REGIME_OPTIONS.map((regime) => (
                      <label key={regime.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={draft.regimes.selected.includes(regime.id)}
                          onChange={() => toggleRegime(regime.id)}
                        />
                        <span className="rounded-full border border-emerald-500 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          {regime.chip}
                        </span>
                        <span className="font-semibold">{regime.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-emerald-400 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700">
                      ✓ {draft.regimes.clientsAssociated} clientes associados
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 font-semibold text-slate-600">
                      i {draft.regimes.clientsDisabled} clientes desativados
                    </div>
                  </div>
                </>
              ) : null}

              {drawerTab === 'clientes_excecoes' ? (
                <>
                  <h3 className="text-3xl font-bold">Gerencie clientes e excecoes</h3>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            clientsExceptions: { ...current.clientsExceptions, activeView: 'adicionados' },
                          }))
                        }
                        className={`rounded-md px-4 py-2 text-sm font-semibold ${
                          draft.clientsExceptions.activeView === 'adicionados' ? 'bg-slate-700 text-white' : 'text-slate-500'
                        }`}
                      >
                        Adicionados
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            clientsExceptions: { ...current.clientsExceptions, activeView: 'removidos' },
                          }))
                        }
                        className={`rounded-md px-4 py-2 text-sm font-semibold ${
                          draft.clientsExceptions.activeView === 'removidos' ? 'bg-slate-700 text-white' : 'text-slate-500'
                        }`}
                      >
                        Removidos
                      </button>
                    </div>
                    <div className="rounded-lg border border-emerald-400 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                      ✓ {draft.regimes.clientsAssociated} clientes
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="flex flex-1 items-center rounded-lg border border-slate-300 bg-white px-3">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        value={draft.clientsExceptions.search}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            clientsExceptions: { ...current.clientsExceptions, search: event.target.value },
                          }))
                        }
                        placeholder="Filtre por nome ou CNPJ"
                        className="w-full bg-transparent px-2 py-2.5 text-sm outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          clientsExceptions: {
                            ...current.clientsExceptions,
                            [current.clientsExceptions.activeView]: [],
                          },
                        }))
                      }
                      className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500"
                    >
                      Remover todos
                    </button>
                  </div>

                  <div className="max-h-[360px] space-y-2 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {clientsForExceptionSearch.map((client) => (
                      <div key={client.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <div>
                          <div className="font-semibold">{client.nome}</div>
                          <div className="text-sm text-slate-500">{client.cnpj}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => addClientException(client, draft.clientsExceptions.activeView)}
                            disabled={activeExceptionIds.has(client.id)}
                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                              activeExceptionIds.has(client.id)
                                ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400'
                                : 'border-emerald-400 bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            Adicionar a {draft.clientsExceptions.activeView === 'adicionados' ? 'adicionados' : 'removidos'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeClientException(client.id, draft.clientsExceptions.activeView)}
                            disabled={!activeExceptionIds.has(client.id)}
                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                              !activeExceptionIds.has(client.id)
                                ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400'
                                : 'border-rose-400 bg-rose-50 text-rose-700'
                            }`}
                          >
                            Remover da lista
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {drawerTab === 'prazo' ? (
                <>
                  <h3 className="text-3xl font-bold">Escolha um tipo de prazo</h3>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="deadline-type"
                        checked={draft.deadline.type === 'data_mensal_fixa'}
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            deadline: { ...current.deadline, type: 'data_mensal_fixa' },
                          }))
                        }
                      />
                      <div>
                        <div className="text-2xl font-semibold">Data mensal fixa</div>
                        <div className="text-slate-500">Ideal para obrigacoes mensais.</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="deadline-type"
                        checked={draft.deadline.type === 'tempo_estimado_execucao'}
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            deadline: { ...current.deadline, type: 'tempo_estimado_execucao' },
                          }))
                        }
                      />
                      <div>
                        <div className="text-2xl font-semibold">Tempo estimado para execucao</div>
                        <div className="text-slate-500">Ideal para tarefas eventuais.</div>
                      </div>
                    </label>
                  </div>

                  {draft.deadline.type === 'data_mensal_fixa' ? (
                    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                      <h4 className="text-2xl font-bold">Configure a data mensal fixa</h4>
                      <label className="block text-sm font-semibold text-slate-600">
                        Data mensal fixa
                        <div className="relative mt-1">
                          <select
                            value={draft.deadline.fixedDay}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                deadline: { ...current.deadline, fixedDay: Number(event.target.value) },
                              }))
                            }
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                          >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                              <option key={day} value={day}>{`Dia ${day}`}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                        </div>
                      </label>

                      <label className="block text-sm font-semibold text-slate-600">
                        Competencia
                        <div className="relative mt-1">
                          <select
                            value={draft.deadline.competence}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                deadline: { ...current.deadline, competence: event.target.value },
                              }))
                            }
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                          >
                            {COMPETENCE_OPTIONS.map((item) => (
                              <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                      <h4 className="text-2xl font-bold">Configure o prazo estimado</h4>
                      <label className="block text-sm font-semibold text-slate-600">
                        Tempo estimado de execucao
                        <div className="relative mt-1">
                          <select
                            value={draft.deadline.estimatedDays}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                deadline: { ...current.deadline, estimatedDays: Number(event.target.value) },
                              }))
                            }
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                          >
                            {Array.from({ length: 60 }, (_, i) => i + 1).map((day) => (
                              <option key={day} value={day}>{`${day} dias`}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                    <h4 className="text-2xl font-bold">Quer estabelecer um prazo-meta?</h4>
                    <label className="inline-flex items-center gap-2 text-lg font-semibold">
                      <input
                        type="checkbox"
                        checked={draft.deadline.useGoal}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            deadline: { ...current.deadline, useGoal: event.target.checked },
                          }))
                        }
                      />
                      Usar prazo-meta
                    </label>
                    {draft.deadline.useGoal ? (
                      <label className="block text-sm font-semibold text-slate-600">
                        Dias de antecedencia
                        <div className="relative mt-1">
                          <select
                            value={draft.deadline.goalDays}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                deadline: { ...current.deadline, goalDays: Number(event.target.value) },
                              }))
                            }
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                          >
                            {[1, 2, 3, 5, 7, 10].map((day) => (
                              <option key={day} value={day}>{`${day} dias de antecedencia`}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                        </div>
                      </label>
                    ) : null}
                  </div>

                  <div className="space-y-2 rounded-lg border border-slate-200 p-4">
                    <h4 className="text-2xl font-bold">Esta tarefa gera multa se atrasar?</h4>
                    <label className="inline-flex items-center gap-2 text-lg font-semibold">
                      <input
                        type="checkbox"
                        checked={draft.deadline.delayedFine}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            deadline: { ...current.deadline, delayedFine: event.target.checked },
                          }))
                        }
                      />
                      Atraso gera multa
                    </label>
                  </div>
                </>
              ) : null}

              {drawerTab === 'tarefas' ? (
                <>
                  <div className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
                    <Info className="mr-2 inline h-4 w-4" />
                    O prazo das tarefas sera baseado em{' '}
                    <b>{draft.deadline.type === 'tempo_estimado_execucao' ? 'tempo estimado de execucao' : 'data mensal fixa'}</b>.
                  </div>
                  <div className="space-y-4">
                    {draft.tasks.map((task, index) => (
                      <div key={task.id} className="rounded-lg border border-slate-200 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="text-2xl font-bold">
                            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-sm">{index + 1}</span>
                            <input
                              value={task.title}
                              onChange={(event) => updateTask(task.id, 'title', event.target.value)}
                              className="rounded-md border border-transparent px-2 py-1 outline-none focus:border-slate-300"
                            />
                          </div>
                          <button type="button" onClick={() => removeTask(task.id)} className="rounded-md border border-slate-300 p-1.5 text-slate-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="rounded-lg bg-slate-100 p-3">
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <div className="relative">
                              <select
                                value={task.departmentKey}
                                onChange={(event) => updateTask(task.id, 'departmentKey', event.target.value)}
                                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              >
                                {Object.entries(DEPARTMENT_META).map(([key, meta]) => (
                                  <option key={key} value={key}>{meta.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                            </div>
                            <div className="relative">
                              <select
                                value={task.responsibleId}
                                onChange={(event) => updateTask(task.id, 'responsibleId', event.target.value)}
                                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              >
                                {RESPONSIBLE_OPTIONS.map((item) => (
                                  <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 space-y-3">
                          <label className="block text-sm font-semibold text-slate-600">
                            Tempo estimado (dias)
                            <div className="relative mt-1">
                              <select
                                value={task.estimateDays}
                                onChange={(event) => updateTask(task.id, 'estimateDays', event.target.value)}
                                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              >
                                <option value="">Selecione o tempo estimado</option>
                                {[1, 2, 3, 4, 5, 7, 10, 15].map((day) => (
                                  <option key={day} value={day}>{`${day} dias`}</option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                            </div>
                          </label>
                          <label className="block text-sm font-semibold text-slate-600">
                            Prioridade
                            <div className="relative mt-1">
                              <select
                                value={task.priority}
                                onChange={(event) => updateTask(task.id, 'priority', event.target.value)}
                                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                              >
                                {PRIORITY_OPTIONS.map((item) => (
                                  <option key={item.id} value={item.id}>{item.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                            </div>
                          </label>
                          <label className="block text-sm font-semibold text-slate-600">
                            Descricao
                            <textarea
                              value={task.description}
                              onChange={(event) => updateTask(task.id, 'description', event.target.value)}
                              rows={3}
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                            />
                          </label>
                        </div>

                        {(task.documents || []).map((doc) => (
                          <div key={doc.id} className="mt-3 rounded-lg border border-slate-200 bg-slate-100 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-2xl font-bold">Ordem de documento</div>
                              <button
                                type="button"
                                onClick={() => removeTaskDocument(task.id, doc.id)}
                                className="rounded-md border border-slate-300 p-1.5 text-slate-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <label className="block text-sm font-semibold text-slate-600">
                              Titulo do documento
                              <input
                                value={doc.title}
                                onChange={(event) => updateTaskDocument(task.id, doc.id, 'title', event.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </label>
                            <div className="mt-3 space-y-2">
                              <label className="inline-flex items-center gap-2 text-base font-semibold">
                                <input
                                  type="checkbox"
                                  checked={doc.required}
                                  onChange={(event) => updateTaskDocument(task.id, doc.id, 'required', event.target.checked)}
                                />
                                Documento obrigatorio
                              </label>
                              <label className="inline-flex items-center gap-2 text-base font-semibold">
                                <input
                                  type="checkbox"
                                  checked={doc.sendToClient}
                                  onChange={(event) => updateTaskDocument(task.id, doc.id, 'sendToClient', event.target.checked)}
                                />
                                Enviar para o cliente ao concluir
                              </label>
                            </div>
                          </div>
                        ))}

                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => addTaskDocument(task.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-400 bg-white px-4 py-2 text-xl text-slate-700"
                          >
                            <Plus className="h-4 w-4" />
                            Documento
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addTask}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-lg font-semibold text-white"
                    >
                      + Tarefa padrao
                    </button>
                  </div>
                </>
              ) : null}

              {drawerTab === 'recorrencia' ? (
                <div className="space-y-4">
                  <h3 className="text-3xl font-bold">Recorrencia</h3>
                  <label className="block text-sm font-semibold text-slate-600">
                    Tipo de recorrencia
                    <div className="relative mt-1">
                      <select
                        value={draft.recurrence.type}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            recurrence: { ...current.recurrence, type: event.target.value },
                          }))
                        }
                        className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      >
                        {RECURRENCES.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                    </div>
                  </label>
                  <div className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
                    {draft.recurrence.type === 'unica'
                      ? 'O serviço sera gerado apenas uma vez.'
                      : `O serviço sera gerado em recorrencia ${draft.recurrence.type}.`}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={handleOpenConfirm}
                disabled={!canGenerateModel}
                className="w-full rounded-lg border border-emerald-600 bg-emerald-600 px-6 py-2.5 text-2xl font-semibold text-white disabled:opacity-40"
              >
                Gerar processos
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isImportModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-3xl font-bold">Importar modelo</h2>
              <button type="button" onClick={() => setIsImportModalOpen(false)} className="rounded-full border border-slate-300 p-1.5 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!importableTemplates.length ? (
              <EmptyState text="Não existem novos modelos para importar." />
            ) : (
              <>
                <label className="block text-sm font-semibold text-slate-600">
                  Selecione o modelo
                  <div className="relative mt-1">
                    <select
                      value={importPreviewId}
                      onChange={(event) => setImportPreviewId(event.target.value)}
                      className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="">Selecione</option>
                      {importableTemplates.map((template) => (
                        <option key={template.id} value={template.id}>{template.nome}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                  </div>
                </label>

                {selectedImportPreview ? (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-2xl font-bold">{selectedImportPreview.nome}</div>
                    <p className="mt-1 text-sm text-slate-600">{selectedImportPreview.descricao}</p>
                    <div className="mt-3 space-y-2">
                      {getModelSteps(selectedImportPreview).map((step, index) => (
                        <div key={step.id || `${selectedImportPreview.id}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="font-semibold">{`${index + 1}. ${step.nome}`}</div>
                          <div className="text-sm text-slate-500">{((step.tarefas || [])[0]?.descricao || 'Sem descricao')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => reviewImportInDrawer(selectedImportPreview)}
                    disabled={!importPreviewId}
                    className="rounded-lg border border-slate-300 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40"
                  >
                    Revisar no painel
                  </button>
                  <button
                    type="button"
                    onClick={importSelectedModel}
                    disabled={!importPreviewId}
                    className="rounded-lg border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Importar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {isConfirmModalOpen && draft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-[920px] rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-4xl font-bold">Confirme suas acoes</h2>
              <button type="button" onClick={() => setIsConfirmModalOpen(false)} className="rounded-full border border-slate-300 p-1.5 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold">{draft.title}</div>
                  <div className="text-sm text-slate-500">{draft.regimes.clientsAssociated} clientes associados</div>
                </div>
                <span className="rounded-full border border-emerald-500 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {draft.regimes.selected.length ? getRegimeChip(draft.regimes.selected[0]) : 'TODOS'}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="mb-2 text-xl font-bold">Tarefas</h3>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                {draft.tasks.map((task, index) => (
                  <div key={task.id} className="border-b border-slate-200 py-2 last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmExpandedTasks((current) => ({
                            ...current,
                            [task.id]: !current[task.id],
                          }))
                        }
                        className="inline-flex items-center gap-2 text-left font-semibold text-slate-800"
                      >
                        <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${confirmExpandedTasks[task.id] ? 'rotate-90' : ''}`} />
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-xs">{index + 1}</span>
                        {task.title}
                      </button>
                      <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-bold text-white ${DEPARTMENT_META[task.departmentKey]?.color || 'bg-slate-500'}`}>
                        {DEPARTMENT_META[task.departmentKey]?.badge || 'F'}
                      </span>
                    </div>
                    {confirmExpandedTasks[task.id] ? (
                      <div className="ml-8 mt-2 text-sm text-slate-600">
                        {task.description || 'Sem descrição da etapa.'}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xl font-bold">Prazo</div>
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <Info className="mr-1 inline h-4 w-4" />
                  {draft.deadline.delayedFine ? 'Esse serviço gera multa, caso atrase.' : 'Esse serviço não gera multa por atraso.'}
                </div>
                <div className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  Tipo: {draft.deadline.type === 'data_mensal_fixa' ? 'Mensal Fixo' : 'Tempo estimado'}
                  <br />
                  Data: Dia {draft.deadline.fixedDay}
                  <br />
                  Prazo-meta: {draft.deadline.useGoal ? `${draft.deadline.goalDays} dias de antecedência` : 'Não definido'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xl font-bold">Recorrencia</div>
                <div className="mt-2 text-sm text-slate-500">
                  {draft.recurrence.type === 'unica'
                    ? 'O serviço sera gerado apenas uma vez.'
                    : `O serviço sera gerado com recorrencia ${draft.recurrence.type}.`}
                </div>
                <div className="mt-3 rounded-md bg-slate-100 px-3 py-4 text-xl font-bold text-slate-700">
                  Data de vencimento: {new Date().toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-slate-100 px-5 py-2.5 text-lg font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={generateServicesFromModel}
                className="rounded-lg border border-slate-700 bg-slate-700 px-5 py-2.5 text-lg font-semibold text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MacedoAcademy;
