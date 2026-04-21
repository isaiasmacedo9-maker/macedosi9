import React from 'react';
import { CalendarDays, CalendarRange, CircleAlert, Clock3, UsersRound } from 'lucide-react';
import { getPortalGestaoAgendaData } from '../../../dev/clientPortalData';

const statusStyles = {
  confirmado: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  pendente: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  planejado: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
};

const typeLabels = {
  reuniao: 'Reunião',
  entrega: 'Entrega',
  rotina: 'Rotina',
  fiscal: 'Fiscal',
};

const formatDateTime = (value) =>
  new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const ClientGestaoAgendaPage = ({ clienteId }) => {
  const moduleData = getPortalGestaoAgendaData(clienteId);
  if (!moduleData) return null;

  const { portalClient, agenda, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
              <CalendarDays className="mr-2 h-4 w-4" />
              Gestão &gt; Agenda
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Agenda da empresa</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Organize compromissos, entregas e checkpoints operacionais em uma visão única do portal.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Empresa</div>
            <div className="mt-2 text-xl font-semibold text-white">{portalClient.nome_fantasia}</div>
            <div className="mt-1 text-sm text-gray-400">{portalClient.atividade}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SummaryCard icon={CalendarRange} title="Eventos" value={`${resumo.total}`} subtitle="Itens na agenda" color="text-violet-300" />
        <SummaryCard icon={UsersRound} title="Confirmados" value={`${resumo.confirmados}`} subtitle="Compromissos firmes" color="text-emerald-300" />
        <SummaryCard icon={CircleAlert} title="Pendentes" value={`${resumo.pendentes}`} subtitle="Precisam de atenção" color="text-amber-300" />
        <SummaryCard icon={Clock3} title="Próximos dias" value={`${resumo.proximosSeteDias}`} subtitle="Janela imediata" color="text-sky-300" />
      </div>

      <div className="glass rounded-[28px] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Agenda operacional</h2>
            <p className="text-sm text-gray-400">Compromissos pensados para rotina cliente + escritório.</p>
          </div>
        </div>

        <div className="space-y-3">
          {agenda.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{item.titulo}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[item.status] || statusStyles.planejado}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-2">
                    <span>Tipo: {typeLabels[item.tipo] || item.tipo}</span>
                    <span>Quando: {formatDateTime(item.data)}</span>
                  </div>
                  <div className="text-sm text-gray-300">{item.descricao}</div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    onClick={() => window.alert(`Abrindo detalhes do evento: ${item.titulo}`)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                  >
                    Ver detalhes
                  </button>
                  <button
                    onClick={() => window.alert(`Ajuste de agenda iniciado para: ${item.titulo}`)}
                    className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-100 hover:bg-violet-500/20"
                  >
                    Ajustar agenda
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ icon: Icon, title, value, subtitle, color }) => (
  <div className="glass rounded-[24px] p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm text-gray-400">{title}</div>
        <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
        <div className="mt-2 text-sm text-gray-400">{subtitle}</div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <Icon className={`h-5 w-5 ${color || 'text-white'}`} />
      </div>
    </div>
  </div>
);

export default ClientGestaoAgendaPage;
