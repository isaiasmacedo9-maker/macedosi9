import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, ClipboardList, FolderKanban } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDashboardTasks } from './dashboardTaskData';

const setorTone = {
  atendimento: 'bg-rose-500/15 text-rose-200 border border-rose-500/30',
  comercial: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30',
  contadores: 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30',
  financeiro: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  fiscal: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  trabalhista: 'bg-sky-500/15 text-sky-200 border border-sky-500/30',
  servicos: 'bg-teal-500/15 text-teal-200 border border-teal-500/30',
  clientes: 'bg-violet-500/15 text-violet-200 border border-violet-500/30',
};

const setorLabel = {
  atendimento: 'Atendimento',
  comercial: 'Comercial',
  contadores: 'Contadores',
  financeiro: 'Financeiro',
  fiscal: 'Fiscal',
  trabalhista: 'Trabalhista',
  servicos: 'Serviços',
  clientes: 'Clientes',
};

const statusLabel = (status = '') => String(status || 'pendente').replace('_', ' ');

const DashboardTaskDetailView = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user, hasModuleAccess } = useAuth();
  const isAdmin = user?.role === 'admin';

  const task = useMemo(() => {
    const allTasks = getDashboardTasks({ user, isAdmin, hasModuleAccess });
    return allTasks.find((item) => String(item.id) === String(taskId)) || null;
  }, [user, isAdmin, hasModuleAccess, taskId]);

  if (!task) {
    return (
      <div className="space-y-5">
        <section className="glass-intense rounded-2xl border border-white/10 p-5">
          <h1 className="text-2xl font-semibold text-white">Detalhes da tarefa</h1>
          <p className="mt-2 text-sm text-gray-300">Tarefa não encontrada para este usuário.</p>
        </section>
        <button
          type="button"
          onClick={() => navigate('/dashboard/tarefas-gerais')}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para tarefas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="glass-intense rounded-2xl border border-white/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Detalhes da tarefa</h1>
            <p className="mt-2 text-sm text-gray-300">Visualização completa da tarefa atribuída ao usuário.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/tarefas-gerais')}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para tarefas
          </button>
        </div>
      </section>

      <section className="glass rounded-2xl border border-white/10 p-5">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs ${setorTone[task.moduleKey] || setorTone.servicos}`}>
              {setorLabel[task.moduleKey] || task.moduleKey}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-200">
              Status: {statusLabel(task.status)}
            </span>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Tarefa</p>
            <p className="mt-1 text-lg font-semibold text-white">{task.titulo}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="inline-flex items-center gap-2 text-xs text-gray-400">
                <CalendarClock className="h-3.5 w-3.5 text-amber-300" />
                Vencimento
              </div>
              <p className="mt-1 text-sm font-medium text-white">
                {task.vencimento ? new Date(`${task.vencimento}T00:00:00`).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="inline-flex items-center gap-2 text-xs text-gray-400">
                <ClipboardList className="h-3.5 w-3.5 text-blue-300" />
                Atribuida em
              </div>
              <p className="mt-1 text-sm font-medium text-white">
                {task.atribuidoEm ? new Date(`${task.atribuidoEm}T00:00:00`).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate(task.relatedServiceId ? `/servicos?servicoId=${task.relatedServiceId}` : '/servicos')}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/35 bg-red-500/15 px-4 py-2 text-sm text-red-100 hover:bg-red-500/25"
            >
              <FolderKanban className="h-4 w-4" />
              Abrir detalhes do servico
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardTaskDetailView;
