import React from 'react';
import { BadgeCheck, Building2, Clock3, Handshake } from 'lucide-react';
import { getPortalGestaoFornecedoresData } from '../../../dev/clientPortalData';

const statusStyles = {
  homologado: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  ativo: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  avaliacao: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const ClientGestaoFornecedoresPage = ({ clienteId }) => {
  const moduleData = getPortalGestaoFornecedoresData(clienteId);
  if (!moduleData) return null;

  const { portalClient, fornecedores, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
              <Handshake className="mr-2 h-4 w-4" />
              Gestão &gt; Fornecedores
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Rede de fornecedores</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Visualize parceiros ativos, estágio de homologação e ritmo operacional da cadeia de suprimentos.
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
        <SummaryCard icon={Building2} title="Total" value={`${resumo.total}`} subtitle="Fornecedores mapeados" color="text-violet-300" />
        <SummaryCard icon={BadgeCheck} title="Homologados" value={`${resumo.homologados}`} subtitle="Prontos para operação" color="text-emerald-300" />
        <SummaryCard icon={Handshake} title="Ativos" value={`${resumo.ativos}`} subtitle="Em relacionamento" color="text-sky-300" />
        <SummaryCard icon={Clock3} title="Em avaliação" value={`${resumo.avaliacao}`} subtitle="Exigem decisão" color="text-amber-300" />
      </div>

      <div className="glass rounded-[28px] p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">Parceiros operacionais</h2>
          <p className="text-sm text-gray-400">Base pronta para compras, cadastros e relacionamento estratégico.</p>
        </div>

        <div className="space-y-3">
          {fornecedores.map((item) => (
            <div key={item.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{item.nome}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[item.status] || statusStyles.ativo}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-3">
                    <span>Categoria: {item.categoria}</span>
                    <span>Cidade: {item.cidade}</span>
                    <span>Prazo médio: {item.prazoMedio}</span>
                  </div>
                  <div className="text-sm text-gray-300">Último pedido: {formatDate(item.ultimoPedido)}</div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10">
                    Ver cadastro
                  </button>
                  <button className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-100 hover:bg-violet-500/20">
                    Registrar contato
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

export default ClientGestaoFornecedoresPage;
