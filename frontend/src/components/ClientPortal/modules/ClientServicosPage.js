import React from 'react';
import { Briefcase, CircleCheck, Clock3, ListTodo, UserRoundCog } from 'lucide-react';
import { getPortalServicosData } from '../../../dev/clientPortalData';

const statusStyles = {
  pendente: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  em_andamento: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  entregue: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  concluido: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const ClientServicosPage = ({ clienteId }) => {
  const moduleData = getPortalServicosData(clienteId);
  if (!moduleData) return null;

  const { portalClient, servicos, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
              <Briefcase className="mr-2 h-4 w-4" />
              Serviços
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Solicitações e rotinas</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Acompanhe demandas abertas com o escritório, prazos e o responsável por cada entrega.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Empresa</div>
            <div className="mt-2 text-xl font-semibold text-white">{portalClient.nome_fantasia}</div>
            <div className="mt-1 text-sm text-gray-400">{portalClient.responsavel_conta}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SummaryCard icon={ListTodo} title="Total" value={`${resumo.total}`} subtitle="Itens monitorados" color="text-sky-300" />
        <SummaryCard icon={Clock3} title="Pendentes" value={`${resumo.pendentes}`} subtitle="Aguardam ação" color="text-amber-300" />
        <SummaryCard icon={UserRoundCog} title="Em andamento" value={`${resumo.emAndamento}`} subtitle="Com time responsável" color="text-cyan-300" />
        <SummaryCard icon={CircleCheck} title="Concluídos" value={`${resumo.concluidos}`} subtitle="Finalizados no portal" color="text-emerald-300" />
      </div>

      <div className="glass rounded-[28px] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Fila operacional</h2>
            <p className="text-sm text-gray-400">Leitura simples para o cliente entender o que está acontecendo agora.</p>
          </div>
        </div>

        <div className="space-y-3">
          {servicos.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{item.titulo}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[item.status] || statusStyles.pendente}`}>
                      {item.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-3">
                    <span>Categoria: {item.categoria}</span>
                    <span>Prazo: {formatDate(item.prazo)}</span>
                    <span>Origem: {item.origem}</span>
                  </div>
                  <div className="text-sm text-gray-300">Responsável: {item.responsavel}</div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    onClick={() => window.alert(`Abrindo detalhes do servico: ${item.titulo}`)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                  >
                    Ver detalhes
                  </button>
                  <button
                    onClick={() => window.alert(`Abrindo contato com responsavel: ${item.responsavel}`)}
                    className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-100 hover:bg-sky-500/20"
                  >
                    Falar com responsável
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

export default ClientServicosPage;
