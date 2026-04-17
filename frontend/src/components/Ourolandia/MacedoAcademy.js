import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ClipboardCheck, FolderKanban, Plus, Workflow } from 'lucide-react';
import { accountingServiceProcessModels } from '../../dev/accountingProcessTemplates';
import { useAuth } from '../../contexts/AuthContext';

const MODELS_KEY = 'mock_macedo_academy_process_models_v1';
const REAL_KEY = 'mock_macedo_academy_generated_processes_v2';
const SERVICES_KEY = 'mock_internal_services';
const NOTIFICATIONS_KEY = 'mock_internal_notifications_v1';

const TASK_STATUS = ['pendente', 'tarefa_aceita', 'em_andamento', 'concluido', 'transferido'];
const AREAS = ['processos', 'manuais'];
const DAY = 24 * 60 * 60 * 1000;

const mockClients = [
  { id: 'cli-001', nome: 'Macedo Comercio LTDA', cnpj: '12.345.678/0001-90' },
  { id: 'cli-002', nome: 'Loja Vila Centro', cnpj: '40.112.334/0001-21' },
  { id: 'cli-003', nome: 'Clinica Sao Miguel', cnpj: '77.001.992/0001-11' },
];

const collaboratorsBySector = {
  Atendimento: [
    { id: 'dev-user', nome: 'Desenvolvimento' },
    { id: 'colaborador@macedosi.com', nome: 'Aline Atendimento' },
  ],
  Financeiro: [
    { id: 'financeiro@macedosi.com', nome: 'Bruno Financeiro' },
    { id: 'dev-user', nome: 'Desenvolvimento' },
  ],
  Fiscal: [
    { id: 'fiscal@macedosi.com', nome: 'Carla Fiscal' },
    { id: 'dev-user', nome: 'Desenvolvimento' },
  ],
  Trabalhista: [
    { id: 'trabalhista@macedosi.com', nome: 'Diego Trabalhista' },
    { id: 'auxiliar@macedosi.com', nome: 'Auxiliar Trabalhista' },
  ],
  Societario: [
    { id: 'contadores@macedosi.com', nome: 'Equipe Societaria' },
    { id: 'dev-user', nome: 'Desenvolvimento' },
  ],
};

const uid = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const sortByOrder = (list = []) => [...list].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
const toISODate = (date) => new Date(date).toISOString().slice(0, 10);
const formatDate = (value) => new Date(value).toLocaleDateString('pt-BR');
const parseChecklist = (obs = '') =>
  obs.toLowerCase().includes('checklist:')
    ? obs.split('Checklist:').pop().split(';').map((x) => x.replace(/^-/, '').trim()).filter(Boolean)
    : [];
const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeSector = (raw = '') => {
  const v = String(raw).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (v.includes('trabalh')) return 'Trabalhista';
  if (v.includes('fiscal')) return 'Fiscal';
  if (v.includes('finance')) return 'Financeiro';
  if (v.includes('societ') || v.includes('contador')) return 'Societario';
  return 'Atendimento';
};

const mapSectorToModule = (sector = '') => {
  const normalized = normalizeSector(sector);
  if (normalized === 'Atendimento') return 'atendimento';
  if (normalized === 'Financeiro') return 'financeiro';
  if (normalized === 'Fiscal') return 'fiscal';
  if (normalized === 'Trabalhista') return 'trabalhista';
  if (normalized === 'Societario') return 'contadores';
  return 'atendimento';
};

const pushNotifications = (notifications) => {
  const current = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([...(Array.isArray(current) ? current : []), ...notifications]));
};

const MacedoAcademy = () => {
  const { user } = useAuth();
  const [models, setModels] = useState(accountingServiceProcessModels);
  const [realProcesses, setRealProcesses] = useState([]);
  const [services, setServices] = useState([]);
  const [expandedId, setExpandedId] = useState('');
  const [activeArea, setActiveArea] = useState('processos');
  const [flowData, setFlowData] = useState({ setorBase: '', modeloId: '', clienteId: '' });
  const [selectedProcessSector, setSelectedProcessSector] = useState('');
  const [transferDraft, setTransferDraft] = useState({});
  const [showCreateProcess, setShowCreateProcess] = useState(false);
  const [showCreateManual, setShowCreateManual] = useState(false);
  const [showEditModel, setShowEditModel] = useState(false);
  const [newProcessDraft, setNewProcessDraft] = useState({ nome: '', descricao: '', setor: '' });
  const [newManualDraft, setNewManualDraft] = useState({ titulo: '', objetivo: '', setor: '', etapasTexto: '', checklistTexto: '' });
  const [editModelDraft, setEditModelDraft] = useState({ id: '', nome: '', descricao: '', setor: '' });
  const [flowSearch, setFlowSearch] = useState({ setor: '', modelo: '', cliente: '' });

  useEffect(() => {
    try {
      const m = JSON.parse(localStorage.getItem(MODELS_KEY) || 'null');
      if (Array.isArray(m) && m.length) setModels(m);
      const r = JSON.parse(localStorage.getItem(REAL_KEY) || '[]');
      if (Array.isArray(r)) setRealProcesses(r);
      const s = JSON.parse(localStorage.getItem(SERVICES_KEY) || '[]');
      if (Array.isArray(s)) setServices(s);
    } catch {}
  }, []);

  useEffect(() => localStorage.setItem(MODELS_KEY, JSON.stringify(models)), [models]);
  useEffect(() => localStorage.setItem(REAL_KEY, JSON.stringify(realProcesses)), [realProcesses]);

  const modelUsageMap = useMemo(() => {
    const byId = new Map();
    const byName = new Map();
    services.forEach((service) => {
      const modelId = service?.process_model_id || service?.modelo_id || service?.model_id;
      if (modelId) byId.set(String(modelId), (byId.get(String(modelId)) || 0) + 1);
      const serviceName = normalizeText(service?.tipo_servico || service?.titulo || service?.nome || '');
      if (serviceName) byName.set(serviceName, (byName.get(serviceName) || 0) + 1);
    });
    return { byId, byName };
  }, [services]);

  const getModelUsageCount = (model) => {
    const byIdCount = modelUsageMap.byId.get(String(model?.id || '')) || 0;
    if (byIdCount > 0) return byIdCount;
    return modelUsageMap.byName.get(normalizeText(model?.nome || '')) || 0;
  };

  const filteredModels = useMemo(() => {
    const base = !flowData.setorBase
      ? models
      : models.filter((m) => normalizeSector(m.setorDestino || m.setorInicial) === flowData.setorBase);

    const modelTerm = normalizeText(flowSearch.modelo);
    const searched = modelTerm
      ? base.filter((m) => normalizeText(m.nome).includes(modelTerm))
      : base;

    return [...searched].sort((a, b) => {
      const countDiff = getModelUsageCount(b) - getModelUsageCount(a);
      if (countDiff !== 0) return countDiff;
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
  }, [models, flowData.setorBase, flowSearch.modelo, modelUsageMap]);

  const selectedFlowModel = useMemo(
    () => filteredModels.find((m) => m.id === flowData.modeloId) || null,
    [filteredModels, flowData.modeloId],
  );
  const selectedClient = useMemo(() => mockClients.find((c) => c.id === flowData.clienteId) || null, [flowData.clienteId]);
  const filteredFlowClients = useMemo(() => {
    const term = normalizeText(flowSearch.cliente);
    if (!term) return mockClients;
    const startsWith = mockClients.filter((client) => normalizeText(client.nome).startsWith(term));
    const contains = mockClients.filter(
      (client) => !normalizeText(client.nome).startsWith(term) && normalizeText(client.nome).includes(term),
    );
    return [...startsWith, ...contains];
  }, [flowSearch.cliente]);

  const modelsBySector = useMemo(() => {
    const map = {};
    models.forEach((m) => {
      const s = normalizeSector(m.setorDestino || m.setorInicial);
      if (!map[s]) map[s] = [];
      map[s].push(m);
    });
    return map;
  }, [models]);

  const servicesBySector = useMemo(() => {
    const map = {};
    services.forEach((s) => {
      const sector = normalizeSector(s.setor || s.tipo_servico);
      if (!map[sector]) map[sector] = [];
      map[sector].push(s);
    });
    return map;
  }, [services]);

  const manualsBySector = useMemo(() => {
    const map = {};
    models.forEach((m) => {
      const sector = normalizeSector(m.setorDestino || m.setorInicial);
      if (!map[sector]) map[sector] = [];
      map[sector].push({
        id: m.id,
        titulo: m.nome,
        objetivo: m.descricao,
        etapas: sortByOrder(m.etapas || []).map((e) => e.nome),
        checklist: parseChecklist((m.etapas || []).flatMap((x) => x.tarefas || []).find((t) => t.observacoes)?.observacoes || ''),
      });
    });
    return map;
  }, [models]);

  const sectors = useMemo(
    () => Array.from(new Set([...Object.keys(modelsBySector), ...Object.keys(servicesBySector), ...Object.keys(manualsBySector)])).sort(),
    [modelsBySector, servicesBySector, manualsBySector],
  );

  const visibleSectors = useMemo(() => {
    if (user?.role === 'admin') return sectors;
    const allowedModules = new Set(user?.allowed_modules || []);
    return sectors.filter((sector) => allowedModules.has(mapSectorToModule(sector)));
  }, [sectors, user]);
  const filteredVisibleSectors = useMemo(() => {
    const term = normalizeText(flowSearch.setor);
    if (!term) return visibleSectors;
    const startsWith = visibleSectors.filter((sector) => normalizeText(sector).startsWith(term));
    const contains = visibleSectors.filter(
      (sector) => !normalizeText(sector).startsWith(term) && normalizeText(sector).includes(term),
    );
    return [...startsWith, ...contains];
  }, [visibleSectors, flowSearch.setor]);

  const processesBySelectedSector = useMemo(
    () =>
      realProcesses.filter((proc) => {
        if (!selectedProcessSector) return false;
        return (proc.etapas || []).some((step) => normalizeSector(step.setorResponsavel) === selectedProcessSector);
      }),
    [realProcesses, selectedProcessSector],
  );

  useEffect(() => {
    if (!visibleSectors.length) return;

    if (!selectedProcessSector || !visibleSectors.includes(selectedProcessSector)) {
      setSelectedProcessSector(visibleSectors[0]);
    }
  }, [visibleSectors, selectedProcessSector]);

  useEffect(() => {
    if (!selectedProcessSector) return;
    if (flowData.setorBase !== selectedProcessSector) {
      setFlowData((prev) => ({ ...prev, setorBase: selectedProcessSector, modeloId: '' }));
    }
  }, [selectedProcessSector]);

  useEffect(() => {
    if (flowData.modeloId && !filteredModels.some((m) => m.id === flowData.modeloId)) {
      setFlowData((prev) => ({ ...prev, modeloId: '' }));
    }
  }, [flowData.modeloId, filteredModels]);

  const createRealProcess = () => {
    if (!selectedFlowModel || !selectedClient) return;
    const baseDate = Date.now();
    const etapas = sortByOrder(selectedFlowModel.etapas || []).map((step, stepIndex) => {
      const assignedTo = stepIndex === 0 ? [user?.id || 'dev-user'] : [];
      const prazoInicio = toISODate(baseDate + stepIndex * DAY);
      const prazoFim = toISODate(baseDate + (stepIndex + 2) * DAY);
      return {
        id: uid('step'),
        nome: step.nome,
        setorResponsavel: normalizeSector(step.setorResponsavel),
        ordem: stepIndex + 1,
        status: stepIndex === 0 ? 'em_andamento' : 'pendente',
        assignedTo,
        prazoInicio,
        prazoFim,
        transferidoEm: null,
        tarefas: sortByOrder(step.tarefas || []).map((task, taskIndex) => ({
          id: uid('task'),
          descricao: task.descricao,
          ordem: taskIndex + 1,
          status: 'pendente',
          acceptedBy: null,
          acceptedAt: null,
          assignedTo,
          prazoInicio,
          prazoFim,
          checklist: [
            { id: uid('chk'), text: 'Conferir dados da tarefa', done: false },
            { id: uid('chk'), text: 'Validar qualidade da entrega', done: false },
          ],
          requiresDocs: false,
          documents: [],
          newDocName: '',
          requiresInfo: false,
          infoValue: '',
        })),
      };
    });

    const proc = {
      id: uid('real'),
      nome: selectedFlowModel.nome,
      clienteNome: selectedClient.nome,
      criadoEm: new Date().toISOString(),
      currentStepIndex: 0,
      etapas,
    };
    setRealProcesses((cur) => [proc, ...cur]);
    setExpandedId(proc.id);
  };

  const patchTask = (processId, stepId, taskId, fn) => {
    setRealProcesses((cur) =>
      cur.map((p) =>
        p.id !== processId
          ? p
          : {
              ...p,
              etapas: p.etapas.map((s) =>
                s.id !== stepId ? s : { ...s, tarefas: s.tarefas.map((t) => (t.id !== taskId ? t : fn(t))) },
              ),
            },
      ),
    );
  };

  const acceptTask = (processId, stepId, taskId) => {
    patchTask(processId, stepId, taskId, (t) => ({
      ...t,
      status: 'tarefa_aceita',
      acceptedBy: user?.id || user?.email || 'colaborador',
      acceptedAt: new Date().toISOString(),
    }));
  };

  const toggleChecklist = (processId, stepId, taskId, checklistId) => {
    patchTask(processId, stepId, taskId, (t) => ({
      ...t,
      checklist: (t.checklist || []).map((item) => (item.id === checklistId ? { ...item, done: !item.done } : item)),
    }));
  };

  const addChecklistItem = (processId, stepId, taskId) => {
    patchTask(processId, stepId, taskId, (t) => ({
      ...t,
      checklist: [...(t.checklist || []), { id: uid('chk'), text: 'Novo item', done: false }],
    }));
  };

  const updateTaskStatus = (processId, stepId, taskId, status) => {
    patchTask(processId, stepId, taskId, (t) => ({ ...t, status }));
  };

  const toggleDoneTask = (processId, stepId, taskId, done) => {
    patchTask(processId, stepId, taskId, (t) => ({ ...t, status: done ? 'concluido' : 'em_andamento' }));
  };

  const addDocToTask = (processId, stepId, taskId) => {
    patchTask(processId, stepId, taskId, (t) => {
      if (!(t.newDocName || '').trim()) return t;
      return { ...t, documents: [...(t.documents || []), { id: uid('doc'), nome: t.newDocName.trim() }], newDocName: '' };
    });
  };

  const updateTaskField = (processId, stepId, taskId, field, value) => {
    patchTask(processId, stepId, taskId, (t) => ({ ...t, [field]: value }));
  };

  const canTransferStep = (step) => (step.tarefas || []).every((t) => t.status === 'concluido');

  const transferToNextSector = (processId) => {
    setRealProcesses((cur) =>
      cur.map((p) => {
        if (p.id !== processId) return p;
        const currentIndex = p.currentStepIndex ?? 0;
        const current = p.etapas[currentIndex];
        const next = p.etapas[currentIndex + 1];
        if (!current || !next || !canTransferStep(current)) return p;

        const selected = transferDraft[processId]?.[next.id] || [];
        if (!selected.length) return p;
        const nowIso = new Date().toISOString();

        pushNotifications(
          selected.map((recipientId) => ({
            id: uid('ntf'),
            recipientId,
            processId,
            message: `Voce recebeu tarefas do processo "${p.nome}" no setor ${next.setorResponsavel}.`,
            createdAt: nowIso,
            read: false,
          })),
        );

        const nextUpdated = {
          ...next,
          status: 'em_andamento',
          assignedTo: selected,
          transferidoEm: nowIso,
          tarefas: next.tarefas.map((t) => ({ ...t, assignedTo: selected })),
        };
        const currentUpdated = {
          ...current,
          status: 'transferido',
          transferidoEm: nowIso,
          tarefas: current.tarefas.map((t) => ({ ...t, status: t.status === 'concluido' ? 'transferido' : t.status })),
        };

        return {
          ...p,
          currentStepIndex: currentIndex + 1,
          etapas: p.etapas.map((s, idx) => (idx === currentIndex ? currentUpdated : idx === currentIndex + 1 ? nextUpdated : s)),
        };
      }),
    );
  };

  const createProcessModel = () => {
    const nome = (newProcessDraft.nome || '').trim();
    const setor = normalizeSector(newProcessDraft.setor || selectedProcessSector || 'Atendimento');
    if (!nome) return;
    const model = {
      id: uid('model'),
      nome,
      descricao: (newProcessDraft.descricao || '').trim() || 'Processo criado manualmente na Macedo Academy.',
      setorInicial: setor,
      setorDestino: setor,
      etapas: [
        {
          id: uid('step-model'),
          nome: 'Execucao principal',
          setorResponsavel: setor,
          ordem: 1,
          tarefas: [
            { id: uid('task-model'), descricao: 'Executar tarefa principal do processo', ordem: 1, observacoes: '' },
          ],
        },
      ],
    };
    setModels((cur) => [model, ...cur]);
    setSelectedProcessSector(setor);
    setShowCreateProcess(false);
    setNewProcessDraft({ nome: '', descricao: '', setor: '' });
  };

  const createManualModel = () => {
    const titulo = (newManualDraft.titulo || '').trim();
    const setor = normalizeSector(newManualDraft.setor || selectedProcessSector || 'Atendimento');
    if (!titulo) return;
    const etapas = (newManualDraft.etapasTexto || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    const checklist = (newManualDraft.checklistTexto || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    const model = {
      id: uid('manual-model'),
      nome: titulo,
      descricao: (newManualDraft.objetivo || '').trim() || 'Manual setorial para padronizar execucao.',
      setorInicial: setor,
      setorDestino: setor,
      etapas: [
        {
          id: uid('manual-step'),
          nome: etapas[0] || 'Etapa principal',
          setorResponsavel: setor,
          ordem: 1,
          tarefas: [
            {
              id: uid('manual-task'),
              descricao: 'Aplicar orientacoes do manual',
              ordem: 1,
              observacoes: checklist.length ? `Checklist: ${checklist.map((item) => `- ${item}`).join('; ')}` : '',
            },
          ],
        },
      ],
    };
    setModels((cur) => [model, ...cur]);
    setSelectedProcessSector(setor);
    setShowCreateManual(false);
    setNewManualDraft({ titulo: '', objetivo: '', setor: '', etapasTexto: '', checklistTexto: '' });
  };

  const openEditModel = (model) => {
    if (!model) return;
    setEditModelDraft({
      id: model.id,
      nome: model.nome || '',
      descricao: model.descricao || '',
      setor: normalizeSector(model.setorDestino || model.setorInicial || 'Atendimento'),
    });
    setShowEditModel(true);
  };

  const saveEditModel = () => {
    if (!editModelDraft.id || !editModelDraft.nome.trim()) return;
    setModels((current) =>
      current.map((model) =>
        model.id !== editModelDraft.id
          ? model
          : {
              ...model,
              nome: editModelDraft.nome.trim(),
              descricao: (editModelDraft.descricao || '').trim() || model.descricao,
              setorInicial: editModelDraft.setor,
              setorDestino: editModelDraft.setor,
              etapas: (model.etapas || []).map((step) => ({
                ...step,
                setorResponsavel: step.ordem === 4 ? editModelDraft.setor : step.setorResponsavel,
              })),
            },
      ),
    );
    setShowEditModel(false);
  };

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-2xl border border-white/10 p-6">
        <h1 className="text-3xl font-bold text-white">Macedo Academy</h1>
        <p className="mt-2 text-sm text-gray-300">Fluxo operacional completo entre setores com rastreabilidade e responsabilidade.</p>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
          {AREAS.map((area) => (
            <button key={area} onClick={() => setActiveArea(area)} className={`rounded-xl border px-4 py-2 text-sm ${activeArea === area ? 'border-red-500/35 bg-red-500/15 text-red-100' : 'border-white/10 bg-white/5 text-gray-200'}`}>
              <span className="inline-flex items-center gap-2">{area === 'processos' ? <FolderKanban className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}{area === 'processos' ? 'Processos' : 'Manuais'}</span>
            </button>
          ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCreateProcess(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar novo Processo
            </button>
            <button
              onClick={() => setShowCreateManual(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-100 hover:bg-blue-500/25"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar novo Manual
            </button>
          </div>
        </div>
      </div>

      {showCreateProcess ? (
        <div className="glass rounded-2xl border border-white/10 p-5">
          <h3 className="text-base font-semibold text-white">Adicionar novo Processo</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={newProcessDraft.nome}
              onChange={(e) => setNewProcessDraft((prev) => ({ ...prev, nome: e.target.value }))}
              placeholder="Nome do processo"
              className="input-futuristic rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={newProcessDraft.setor}
              onChange={(e) => setNewProcessDraft((prev) => ({ ...prev, setor: e.target.value }))}
              className="input-futuristic rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Setor</option>
              {visibleSectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </div>
          <textarea
            rows={3}
            value={newProcessDraft.descricao}
            onChange={(e) => setNewProcessDraft((prev) => ({ ...prev, descricao: e.target.value }))}
            placeholder="Descricao resumida"
            className="input-futuristic mt-2 w-full rounded-lg px-3 py-2 text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={createProcessModel} className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100">Salvar processo</button>
            <button onClick={() => setShowCreateProcess(false)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-200">Cancelar</button>
          </div>
        </div>
      ) : null}

      {showCreateManual ? (
        <div className="glass rounded-2xl border border-white/10 p-5">
          <h3 className="text-base font-semibold text-white">Adicionar novo Manual</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={newManualDraft.titulo}
              onChange={(e) => setNewManualDraft((prev) => ({ ...prev, titulo: e.target.value }))}
              placeholder="Titulo do manual"
              className="input-futuristic rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={newManualDraft.setor}
              onChange={(e) => setNewManualDraft((prev) => ({ ...prev, setor: e.target.value }))}
              className="input-futuristic rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Setor</option>
              {visibleSectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </div>
          <textarea
            rows={2}
            value={newManualDraft.objetivo}
            onChange={(e) => setNewManualDraft((prev) => ({ ...prev, objetivo: e.target.value }))}
            placeholder="Objetivo do manual"
            className="input-futuristic mt-2 w-full rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            rows={3}
            value={newManualDraft.etapasTexto}
            onChange={(e) => setNewManualDraft((prev) => ({ ...prev, etapasTexto: e.target.value }))}
            placeholder="Etapas (uma por linha)"
            className="input-futuristic mt-2 w-full rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            rows={3}
            value={newManualDraft.checklistTexto}
            onChange={(e) => setNewManualDraft((prev) => ({ ...prev, checklistTexto: e.target.value }))}
            placeholder="Checklist (um item por linha)"
            className="input-futuristic mt-2 w-full rounded-lg px-3 py-2 text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={createManualModel} className="rounded-lg border border-blue-500/35 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-100">Salvar manual</button>
            <button onClick={() => setShowCreateManual(false)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-200">Cancelar</button>
          </div>
        </div>
      ) : null}

      {activeArea === 'processos' ? (
        <>
          <div className="glass rounded-2xl border border-white/10 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Base por setor (modelos + serviços cadastrados)</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleSectors.map((sector) => (
                <button
                  key={sector}
                  onClick={() => setSelectedProcessSector(sector)}
                  className={`rounded-xl border p-4 text-left ${
                    selectedProcessSector === sector
                      ? 'border-red-500/35 bg-red-500/15'
                      : 'border-white/10 bg-black/20 hover:bg-white/5'
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{sector}</p>
                  <p className="mt-2 text-xs text-gray-400">{modelsBySector[sector]?.length || 0} modelos · {servicesBySector[sector]?.length || 0} serviços</p>
                </button>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="mb-4 flex items-center gap-2"><Workflow className="h-5 w-5 text-red-300" /><h2 className="text-lg font-semibold text-white">Gerar processo real</h2></div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <input
                  value={flowSearch.setor}
                  onChange={(e) => setFlowSearch((prev) => ({ ...prev, setor: e.target.value }))}
                  placeholder="Buscar setor"
                  className="input-futuristic w-full rounded-lg px-3 py-2 text-sm"
                />
                <select value={flowData.setorBase} onChange={(e) => setSelectedProcessSector(e.target.value)} className="input-futuristic w-full rounded-lg px-3 py-2 text-sm">
                  <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Selecione o setor base</option>
                  {filteredVisibleSectors.map((s) => <option key={s} value={s} style={{ color: '#111827', backgroundColor: '#ffffff' }}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <input
                  value={flowSearch.modelo}
                  onChange={(e) => setFlowSearch((prev) => ({ ...prev, modelo: e.target.value }))}
                  placeholder="Buscar modelo"
                  className="input-futuristic w-full rounded-lg px-3 py-2 text-sm"
                />
                <select value={flowData.modeloId} onChange={(e) => setFlowData((p) => ({ ...p, modeloId: e.target.value }))} className="input-futuristic w-full rounded-lg px-3 py-2 text-sm">
                  <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Selecione um modelo</option>
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id} style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <input
                  value={flowSearch.cliente}
                  onChange={(e) => setFlowSearch((prev) => ({ ...prev, cliente: e.target.value }))}
                  placeholder="Buscar cliente"
                  className="input-futuristic w-full rounded-lg px-3 py-2 text-sm"
                />
                <select value={flowData.clienteId} onChange={(e) => setFlowData((p) => ({ ...p, clienteId: e.target.value }))} className="input-futuristic w-full rounded-lg px-3 py-2 text-sm">
                  <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Selecione o cliente</option>
                  {filteredFlowClients.map((c) => (
                    <option key={c.id} value={c.id} style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                      {c.nome} - {c.cnpj}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={createRealProcess} disabled={!selectedFlowModel || !selectedClient} className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40">
                <span className="inline-flex items-center gap-2"><Plus className="h-4 w-4" />Criar processo</span>
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => openEditModel(selectedFlowModel)}
                disabled={!selectedFlowModel}
                className="rounded-lg border border-blue-500/35 bg-blue-500/15 px-3 py-2 text-xs text-blue-100 hover:bg-blue-500/25 disabled:opacity-40"
              >
                Editar modelo selecionado
              </button>
            </div>
          </div>

          <div className="glass rounded-2xl border border-white/10 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Processos reais operacionais</h2>
            <div className="space-y-3">
              {processesBySelectedSector.map((proc) => (
                <div key={proc.id} className="rounded-xl border border-white/10 bg-black/20">
                  <button onClick={() => setExpandedId(expandedId === proc.id ? '' : proc.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                    <div>
                      <p className="text-sm font-semibold text-white">{proc.nome}</p>
                      <p className="text-xs text-gray-400">Cliente: {proc.clienteNome}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition ${expandedId === proc.id ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedId === proc.id ? (
                    <div className="space-y-3 border-t border-white/10 p-4">
                      {sortByOrder(proc.etapas || []).map((step, idx) => {
                        const isCurrent = (proc.currentStepIndex ?? 0) === idx;
                        const nextStep = proc.etapas[(proc.currentStepIndex ?? 0) + 1];
                        const nextCollabs = nextStep ? collaboratorsBySector[nextStep.setorResponsavel] || [] : [];
                        const selectedRecipients = transferDraft[proc.id]?.[nextStep?.id] || [];
                        return (
                          <div key={step.id} className={`rounded-lg border p-3 ${isCurrent ? 'border-red-500/35 bg-red-500/10' : 'border-white/10 bg-black/25'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-white">Etapa {step.ordem}: {step.nome}</p>
                              <span className="text-xs text-gray-300">{step.status}</span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">Setor: {step.setorResponsavel} · Prazo: {formatDate(step.prazoInicio)} até {formatDate(step.prazoFim)}</p>

                            <div className="mt-3 space-y-2">
                              {(step.tarefas || []).map((task) => (
                                <div key={task.id} className="rounded-md border border-white/10 bg-black/30 p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-semibold text-white">#{task.ordem} {task.descricao}</p>
                                    <label className="inline-flex items-center gap-1 text-xs text-emerald-200">
                                      <input type="checkbox" checked={task.status === 'concluido'} onChange={(e) => toggleDoneTask(proc.id, step.id, task.id, e.target.checked)} />
                                      Feita
                                    </label>
                                  </div>

                                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                                    <select value={task.status} onChange={(e) => updateTaskStatus(proc.id, step.id, task.id, e.target.value)} className="input-futuristic rounded-lg px-2 py-1.5 text-xs">
                                      {TASK_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <input type="date" value={task.prazoInicio} onChange={(e) => updateTaskField(proc.id, step.id, task.id, 'prazoInicio', e.target.value)} className="input-futuristic rounded-lg px-2 py-1.5 text-xs" />
                                    <input type="date" value={task.prazoFim} onChange={(e) => updateTaskField(proc.id, step.id, task.id, 'prazoFim', e.target.value)} className="input-futuristic rounded-lg px-2 py-1.5 text-xs" />
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button onClick={() => acceptTask(proc.id, step.id, task.id)} className="rounded-md border border-sky-500/35 bg-sky-500/15 px-2.5 py-1 text-xs text-sky-100">Aceitar tarefa</button>
                                    <button onClick={() => addChecklistItem(proc.id, step.id, task.id)} className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-gray-200">+ checklist</button>
                                  </div>
                                  <p className="mt-1 text-[11px] text-gray-400">{task.acceptedBy ? `Aceita por ${task.acceptedBy} em ${formatDate(task.acceptedAt)}` : 'Ainda não aceita'}</p>

                                  <div className="mt-2 space-y-1">
                                    {(task.checklist || []).map((chk) => (
                                      <label key={chk.id} className="flex items-center gap-2 text-xs text-gray-300">
                                        <input type="checkbox" checked={chk.done} onChange={() => toggleChecklist(proc.id, step.id, task.id, chk.id)} />
                                        {chk.text}
                                      </label>
                                    ))}
                                  </div>

                                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                    <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                                      <input type="checkbox" checked={!!task.requiresDocs} onChange={(e) => updateTaskField(proc.id, step.id, task.id, 'requiresDocs', e.target.checked)} />
                                      Exige documentos
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                                      <input type="checkbox" checked={!!task.requiresInfo} onChange={(e) => updateTaskField(proc.id, step.id, task.id, 'requiresInfo', e.target.checked)} />
                                      Exige informacao
                                    </label>
                                  </div>

                                  {task.requiresDocs ? (
                                    <div className="mt-2 rounded-md border border-white/10 bg-black/20 p-2">
                                      <div className="flex gap-2">
                                        <input value={task.newDocName || ''} onChange={(e) => updateTaskField(proc.id, step.id, task.id, 'newDocName', e.target.value)} placeholder="Nome do documento" className="input-futuristic w-full rounded-md px-2 py-1.5 text-xs" />
                                        <button onClick={() => addDocToTask(proc.id, step.id, task.id)} className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-gray-200">Anexar</button>
                                      </div>
                                      <div className="mt-1 space-y-1">
                                        {(task.documents || []).map((doc) => <p key={doc.id} className="text-xs text-gray-300">• {doc.nome}</p>)}
                                      </div>
                                    </div>
                                  ) : null}

                                  {task.requiresInfo ? (
                                    <textarea value={task.infoValue || ''} onChange={(e) => updateTaskField(proc.id, step.id, task.id, 'infoValue', e.target.value)} placeholder="Preencha a informacao necessaria..." rows={2} className="input-futuristic mt-2 w-full rounded-md px-2 py-1.5 text-xs" />
                                  ) : null}
                                </div>
                              ))}
                            </div>

                            {isCurrent && nextStep ? (
                              <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
                                <p className="text-xs font-medium text-white">Transferir para próximo setor: {nextStep.setorResponsavel}</p>
                                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                  {nextCollabs.map((collab) => (
                                    <label key={collab.id} className="inline-flex items-center gap-2 text-xs text-gray-300">
                                      <input
                                        type="checkbox"
                                        checked={selectedRecipients.includes(collab.id)}
                                        onChange={(e) =>
                                          setTransferDraft((prev) => {
                                            const procDraft = prev[proc.id] || {};
                                            const curr = procDraft[nextStep.id] || [];
                                            const nextList = e.target.checked ? [...new Set([...curr, collab.id])] : curr.filter((id) => id !== collab.id);
                                            return { ...prev, [proc.id]: { ...procDraft, [nextStep.id]: nextList } };
                                          })
                                        }
                                      />
                                      {collab.nome}
                                    </label>
                                  ))}
                                </div>
                                <button
                                  onClick={() => transferToNextSector(proc.id)}
                                  disabled={!canTransferStep(step) || !selectedRecipients.length}
                                  className="mt-3 rounded-md border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100 disabled:opacity-40"
                                >
                                  Transferir etapa para próximo setor
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
              {processesBySelectedSector.length === 0 ? <div className="rounded-xl border border-dashed border-white/15 bg-black/15 p-6 text-center text-sm text-gray-400">Nenhum processo real gerado para o setor selecionado.</div> : null}
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visibleSectors.map((sector) => (
            <section key={sector} className="glass rounded-2xl border border-white/10 p-5">
              <h2 className="text-lg font-semibold text-white">{sector}</h2>
              <p className="mt-1 text-xs text-gray-400">{manualsBySector[sector]?.length || 0} manuais derivados dos modelos</p>
              <div className="mt-4 space-y-3">
                {(manualsBySector[sector] || []).slice(0, 6).map((manual) => (
                  <article key={manual.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">{manual.titulo}</p>
                    <p className="mt-1 text-xs text-gray-400">{manual.objetivo || 'Manual setorial para padronizar execucao.'}</p>
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
                      <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-blue-200"><Workflow className="h-3.5 w-3.5" />Etapas</p>
                      {manual.etapas.slice(0, 4).map((e) => <p key={e} className="text-xs text-gray-300">• {e}</p>)}
                    </div>
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
                      <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-200"><ClipboardCheck className="h-3.5 w-3.5" />Checklist</p>
                      {(manual.checklist.length ? manual.checklist : ['Checklist não informado']).slice(0, 4).map((c) => <p key={c} className="text-xs text-gray-300">• {c}</p>)}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showEditModel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-zinc-900 p-6">
            <h3 className="text-lg font-semibold text-white">Editar modelo de processo</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={editModelDraft.nome}
                onChange={(e) => setEditModelDraft((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do modelo"
                className="input-futuristic rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={editModelDraft.setor}
                onChange={(e) => setEditModelDraft((prev) => ({ ...prev, setor: e.target.value }))}
                className="input-futuristic rounded-lg px-3 py-2 text-sm"
              >
                {visibleSectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
              </select>
              <textarea
                value={editModelDraft.descricao}
                onChange={(e) => setEditModelDraft((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descricao"
                rows={3}
                className="input-futuristic rounded-lg px-3 py-2 text-sm md:col-span-2"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={saveEditModel} className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100">
                Salvar alteracoes
              </button>
              <button onClick={() => setShowEditModel(false)} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MacedoAcademy;
