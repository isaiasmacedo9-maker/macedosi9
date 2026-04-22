import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getDashboardTasks,
  getNewTasksForToday,
  getPendingTasks,
  markNewTasksAsViewedToday,
} from './dashboardTaskData';

const priorityTone = {
  alta: 'border-rose-500/30 bg-rose-500/15 text-rose-100',
  media: 'border-amber-500/30 bg-amber-500/15 text-amber-100',
  baixa: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100',
};

const statusTone = {
  pendente: 'border-amber-500/30 bg-amber-500/15 text-amber-100',
  tarefa_aceita: 'border-blue-500/30 bg-blue-500/15 text-blue-100',
  em_andamento: 'border-sky-500/30 bg-sky-500/15 text-sky-100',
  concluido: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100',
  concluida: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100',
  transferido: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-100',
};

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const SECTOR_TABS = [
  { key: 'atendimento', label: 'Atendimento', modules: ['atendimento'] },
  { key: 'comercial', label: 'Comercial', modules: ['comercial'] },
  { key: 'contadores', label: 'Contadores', modules: ['contadores', 'societario'] },
  { key: 'fiscal', label: 'Fiscal', modules: ['fiscal'] },
  { key: 'financeiro', label: 'Financeiro', modules: ['financeiro'] },
  { key: 'trabalhista', label: 'Trabalhista', modules: ['trabalhista'] },
  { key: 'servicos-avulsos', label: 'Serviços Avulsos', modules: ['servicos', 'servicos_avulsos', 'services'] },
];

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
};

const DashboardTaskListView = ({ viewType = 'pending' }) => {
  const { user, hasModuleAccess } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [activeSectorTab, setActiveSectorTab] = useState('todas');

  const tasks = useMemo(
    () => getDashboardTasks({ user, isAdmin, hasModuleAccess }),
    [user, isAdmin, hasModuleAccess],
  );

  const pendingTasks = useMemo(() => getPendingTasks(tasks), [tasks]);
  const newTasks = useMemo(
    () => getNewTasksForToday({ user, tasks, todayIso }),
    [user, tasks, todayIso],
  );

  useEffect(() => {
    if (viewType !== 'new') return;
    markNewTasksAsViewedToday({
      user,
      taskIds: newTasks.map((task) => task.id),
      todayIso,
    });
  }, [viewType, user, newTasks, todayIso]);

  const list = viewType === 'new' ? newTasks : pendingTasks;

  const availableSectorTabs = useMemo(() => {
    if (viewType !== 'pending') return [];
    return SECTOR_TABS.filter((tab) =>
      pendingTasks.some((task) => tab.modules.includes(normalizeText(task.moduleKey))),
    );
  }, [viewType, pendingTasks]);

  useEffect(() => {
    if (viewType !== 'pending') return;
    if (
      activeSectorTab !== 'todas' &&
      !availableSectorTabs.some((tab) => tab.key === activeSectorTab)
    ) {
      setActiveSectorTab('todas');
    }
  }, [viewType, activeSectorTab, availableSectorTabs]);

  const visibleList = useMemo(() => {
    if (viewType !== 'pending' || activeSectorTab === 'todas') return list;
    const selectedTab = SECTOR_TABS.find((tab) => tab.key === activeSectorTab);
    if (!selectedTab) return list;
    return list.filter((task) => selectedTab.modules.includes(normalizeText(task.moduleKey)));
  }, [viewType, activeSectorTab, list]);

  const title = viewType === 'new' ? 'Novas tarefas' : 'Tarefas pendentes';
  const subtitle = viewType === 'new'
    ? 'Tarefas novas ou recentemente atribuídas. Ficam aqui até o fim do dia em que você abriu esta view.'
    : 'Tarefas em aberto sob sua responsabilidade.';

  return (
    <div className="space-y-5">
      <section className="glass-intense rounded-2xl border border-white/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            <p className="mt-2 text-sm text-gray-300">{subtitle}</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao dashboard
          </button>
        </div>
      </section>

      <section className="glass rounded-2xl border border-white/10 p-5">
        {viewType === 'pending' ? (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveSectorTab('todas')}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                activeSectorTab === 'todas'
                  ? 'border-red-500/35 bg-red-500/15 text-red-100'
                  : 'border-white/15 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              Todas
            </button>
            {availableSectorTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSectorTab(tab.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  activeSectorTab === tab.key
                    ? 'border-red-500/35 bg-red-500/15 text-red-100'
                    : 'border-white/15 bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-300">Total de tarefas: <span className="font-semibold text-white">{visibleList.length}</span></p>
          <p className="text-xs text-gray-500">Atualizado em {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        <div className="space-y-3">
          {visibleList.length > 0 ? visibleList.map((task) => (
            <article key={task.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{task.titulo}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Modulo: <span className="text-gray-200">{task.moduleKey}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${priorityTone[task.prioridade] || priorityTone.media}`}>
                    Prioridade: {task.prioridade || 'media'}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusTone[task.status] || statusTone.pendente}`}>
                    {String(task.status || 'pendente').replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                  <CalendarClock className="h-3.5 w-3.5 text-amber-300" />
                  Vencimento: {formatDate(task.vencimento)}
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300">
                  <Clock3 className="h-3.5 w-3.5 text-blue-300" />
                  Atribuída em: {formatDate(task.atribuidoEm)}
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-xl border border-dashed border-white/20 bg-black/20 p-6 text-center text-sm text-gray-400">
              {viewType === 'new'
                ? 'Nenhuma nova tarefa disponivel no momento.'
                : 'Nenhuma tarefa pendente para este filtro/setor.'}
            </div>
          )}
        </div>
      </section>

      {viewType === 'new' ? (
        <section className="glass rounded-2xl border border-white/10 p-4">
          <div className="inline-flex items-start gap-2 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            As tarefas abertas aqui ficam em "Novas tarefas" ate o fim do dia e depois permanecem apenas em "Tarefas pendentes".
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default DashboardTaskListView;
