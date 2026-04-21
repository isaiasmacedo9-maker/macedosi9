import React from 'react';
import { FilePenLine, FileSpreadsheet, PlusCircle, Receipt, SendHorizontal } from 'lucide-react';
import { getPortalNotasEmissaoData } from '../../../dev/clientPortalData';

const statusStyles = {
  rascunho: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  aguardando_documentos: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const ClientNotasEmissaoPage = ({ clienteId }) => {
  const moduleData = getPortalNotasEmissaoData(clienteId);
  if (!moduleData) return null;

  const { portalClient, rascunhos, resumo } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
              <FilePenLine className="mr-2 h-4 w-4" />
              Notas Fiscais &gt; Emissão
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Central de emissão</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Área preparada para emissão assistida, com rascunhos, validações e apoio operacional do escritório.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Empresa</div>
            <div className="mt-2 text-xl font-semibold text-white">{portalClient.nome_fantasia}</div>
            <div className="mt-1 text-sm text-gray-400">{portalClient.regime_label}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SummaryCard icon={FileSpreadsheet} title="Rascunhos" value={`${resumo.rascunhos}`} subtitle="Notas iniciadas" color="text-sky-300" />
        <SummaryCard icon={Receipt} title="Aguardando dados" value={`${resumo.aguardando}`} subtitle="Dependem de documentos" color="text-amber-300" />
        <SummaryCard icon={SendHorizontal} title="Valor potencial" value={formatCurrency(resumo.valorTotal)} subtitle="Base estimada dos rascunhos" color="text-emerald-300" />
        <SummaryCard icon={PlusCircle} title="Próximo passo" value="Emitir" subtitle="Fluxo pronto para integração" color="text-violet-300" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="glass rounded-[28px] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Rascunhos de emissão</h2>
              <p className="text-sm text-gray-400">Base visual para iniciar emissão com apoio do contador.</p>
            </div>
            <button
              onClick={() => window.alert('Novo rascunho criado em modo assistido.')}
              className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-100 hover:bg-sky-500/20"
            >
              Novo rascunho
            </button>
          </div>

          <div className="space-y-3">
            {rascunhos.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/8 bg-black/20 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{item.numero_sugerido}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[item.status] || statusStyles.rascunho}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-3">
                      <span>Tipo: {item.tipo}</span>
                      <span>Destinatário: {item.destinatario}</span>
                      <span>Natureza: {item.natureza_operacao}</span>
                    </div>
                    <div className="text-lg font-semibold text-white">{formatCurrency(item.valor_previsto)}</div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <button
                      onClick={() => window.alert(`Editando rascunho ${item.numero_sugerido}`)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                    >
                      Editar rascunho
                    </button>
                    <button
                      onClick={() => window.alert(`Rascunho ${item.numero_sugerido} enviado para conferencia.`)}
                      className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-100 hover:bg-sky-500/20"
                    >
                      Enviar para conferência
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-[28px] p-6">
            <h2 className="text-lg font-semibold text-white">O que este módulo prepara</h2>
            <div className="mt-5 space-y-3">
              {[
                'Rascunhos com dados fiscais mínimos para emissão.',
                'Conferência antes de emitir XML/PDF.',
                'Apoio a fluxo cliente + escritório no mesmo portal.',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-gray-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
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

export default ClientNotasEmissaoPage;
