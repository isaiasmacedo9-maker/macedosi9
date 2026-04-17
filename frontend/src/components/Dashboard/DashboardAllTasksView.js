import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDashboardTasks, getPendingTasks } from './dashboardTaskData';

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
  servicos: 'Servicos',
  clientes: 'Clientes',
};

const DashboardAllTasksView = () => {
  const { user, hasModuleAccess } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const tasks = useMemo(
    () => getPendingTasks(getDashboardTasks({ user, isAdmin, hasModuleAccess })),
    [user, isAdmin, hasModuleAccess],
  );

  return (
    <div className="space-y-5">
      <section className="glass-intense rounded-2xl border border-white/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Todas as tarefas</h1>
            <p className="mt-2 text-sm text-gray-300">
              Lista das tarefas do usuario com setor e acesso rapido ao detalhe do servico.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao dashboard
          </button>
        </div>
      </section>

      <section className="glass rounded-2xl border border-white/10 p-5">
        <div className="space-y-3">
          {tasks.length ? tasks.map((task) => (
            <article key={task.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{task.titulo}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${setorTone[task.moduleKey] || setorTone.servicos}`}>
                      {setorLabel[task.moduleKey] || task.moduleKey}
                    </span>
                    <span className="text-xs text-gray-400">
                      Vencimento: {new Date(`${task.vencimento}T00:00:00`).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/tarefas-gerais/${task.id}`)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/35 bg-red-500/15 px-3 py-2 text-xs text-red-100 hover:bg-red-500/25"
                >
                  <FolderKanban className="h-3.5 w-3.5" />
                  Ver detalhes da tarefa
                </button>
              </div>
            </article>
          )) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-center text-sm text-gray-400">
              Nenhuma tarefa pendente para este usuario.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardAllTasksView;
