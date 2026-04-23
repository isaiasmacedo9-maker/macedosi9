const ACADEMY_REAL_KEY = 'mock_macedo_academy_generated_processes_v2';
const TASK_VIEW_TRACK_KEY = 'mock_dashboard_new_tasks_viewed_v1';
const SERVICES_KEY = 'mock_internal_services';

export const DASHBOARD_MOCK_TASKS = [
  { id: 'tsk-1', titulo: 'Conferir DAS abril', moduleKey: 'fiscal', status: 'pendente', prioridade: 'alta', vencimento: '2026-04-20', atribuidoEm: '2026-04-14', assignedTo: ['dev-user', 'dev@macedosi.local'], relatedServiceId: 'srv-1' },
  { id: 'tsk-2', titulo: 'Atualizar cadastro de clientes', moduleKey: 'clientes', status: 'em_andamento', prioridade: 'media', vencimento: '2026-04-23', atribuidoEm: '2026-04-15', assignedTo: ['colaborador@macedosi.com'], relatedServiceId: 'srv-2' },
  { id: 'tsk-3', titulo: 'Retorno de atendimento prioritário', moduleKey: 'atendimento', status: 'pendente', prioridade: 'alta', vencimento: '2026-04-18', atribuidoEm: '2026-04-13', assignedTo: ['dev-user', 'colaborador@macedosi.com'], relatedServiceId: 'srv-1' },
  { id: 'tsk-4', titulo: 'Conferência de folha mensal', moduleKey: 'trabalhista', status: 'concluida', prioridade: 'media', vencimento: '2026-04-15', atribuidoEm: '2026-04-10', assignedTo: ['auxiliar@macedosi.com'], relatedServiceId: 'srv-3' },
];

const normalizeIdentity = (value = '') => String(value).trim().toLowerCase();

const getUserStorageKey = (user) =>
  normalizeIdentity(user?.email || user?.id || user?.name || 'anonymous');

const mapSectorToModule = (sector = '') => {
  const raw = String(sector).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (raw.includes('fiscal')) return 'fiscal';
  if (raw.includes('trabalh')) return 'trabalhista';
  if (raw.includes('finance')) return 'financeiro';
  if (raw.includes('atendimento')) return 'atendimento';
  if (raw.includes('societ')) return 'contadores';
  return 'servicos';
};

const mapServiceStatusToTaskStatus = (status = '', fallback = '') => {
  const raw = String(status || fallback || '').toLowerCase();
  if (raw === 'concluido' || raw === 'concluida') return 'concluido';
  if (raw === 'em_andamento' || raw === 'aguardando_cliente') return 'em_andamento';
  if (raw === 'cancelado' || raw === 'dispensada') return 'transferido';
  return 'pendente';
};

const getAcademyTasks = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACADEMY_REAL_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((proc) =>
      (proc.etapas || []).flatMap((step) =>
        (step.tarefas || []).map((task) => ({
          id: `academy-${task.id}`,
          titulo: task.descricao || 'Tarefa academy',
          moduleKey: mapSectorToModule(step.setorResponsavel),
          status: task.status || 'pendente',
          prioridade: 'media',
          vencimento: task.prazoFim || step.prazoFim || new Date().toISOString().slice(0, 10),
          atribuidoEm: task.prazoInicio || step.prazoInicio || new Date().toISOString().slice(0, 10),
          assignedTo: Array.isArray(task.assignedTo) && task.assignedTo.length ? task.assignedTo : (step.assignedTo || []),
        })),
      ),
    );
  } catch {
    return [];
  }
};

const getServiceTasks = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SERVICES_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, index) => {
      const assignedTo = [
        item?.responsavel_id,
        item?.responsavel_email,
        item?.responsavel_nome,
        ...(Array.isArray(item?.assigned_to) ? item.assigned_to : []),
        ...(Array.isArray(item?.assignedTo) ? item.assignedTo : []),
      ].filter(Boolean);
      const due = String(item?.data_prazo || item?.prazo || item?.created_at || new Date().toISOString()).slice(0, 10);
      const start = String(item?.data_inicio || item?.created_at || due).slice(0, 10);
      return {
        id: `service-${item?.id || index}`,
        titulo: item?.tipo_servico || item?.titulo || 'Tarefa de serviço',
        moduleKey: 'servicos',
        status: mapServiceStatusToTaskStatus(item?.status_ui, item?.status),
        prioridade: item?.urgencia || item?.prioridade || 'media',
        vencimento: due,
        atribuidoEm: start,
        assignedTo,
        relatedServiceId: item?.id || null,
      };
    });
  } catch {
    return [];
  }
};

export const getViewerIdentityList = (user) =>
  [user?.id, user?.email, user?.name].filter(Boolean).map(normalizeIdentity);

export const isTaskAssignedToViewer = (task, user, isAdmin = false) => {
  if (isAdmin) return true;
  const viewerIdentities = getViewerIdentityList(user);
  if (!Array.isArray(task?.assignedTo) || task.assignedTo.length === 0) return false;
  const assigned = task.assignedTo.map(normalizeIdentity);
  return viewerIdentities.some((identity) => assigned.includes(identity));
};

export const getDashboardTasks = ({ user, isAdmin, hasModuleAccess }) =>
  [...DASHBOARD_MOCK_TASKS, ...getAcademyTasks(), ...getServiceTasks()].filter(
    (task) => isTaskAssignedToViewer(task, user, isAdmin) && hasModuleAccess(task.moduleKey),
  );

export const getPendingTasks = (tasks = []) =>
  tasks.filter((item) => item.status !== 'concluida' && item.status !== 'concluido' && item.status !== 'transferido');

const readViewedMap = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(TASK_VIEW_TRACK_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const getNewTasksForToday = ({ user, tasks = [], todayIso }) => {
  const userKey = getUserStorageKey(user);
  const viewedMap = readViewedMap();
  const userViews = viewedMap[userKey] || {};
  return getPendingTasks(tasks).filter((task) => {
    const firstViewedDate = userViews[task.id];
    if (!firstViewedDate) return true;
    return firstViewedDate === todayIso;
  });
};

export const markNewTasksAsViewedToday = ({ user, taskIds = [], todayIso }) => {
  if (!taskIds.length) return;
  const userKey = getUserStorageKey(user);
  const viewedMap = readViewedMap();
  const userViews = { ...(viewedMap[userKey] || {}) };
  taskIds.forEach((taskId) => {
    if (!userViews[taskId]) {
      userViews[taskId] = todayIso;
    }
  });
  viewedMap[userKey] = userViews;
  localStorage.setItem(TASK_VIEW_TRACK_KEY, JSON.stringify(viewedMap));
};
