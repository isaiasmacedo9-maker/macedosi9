import React, { useMemo, useState } from 'react';
import { Folder, FolderOpen, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { getPortalDocumentosData } from '../../../dev/clientPortalData';

const SETORES = ['Atendimento', 'Comercial', 'Contadores', 'Financeiro', 'Fiscal', 'Trabalhista', 'Servicos'];

const statusStyles = {
  validado: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  em_analise: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  pendente: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const inferSetor = (categoria = '') => {
  const text = String(categoria).toLowerCase();
  if (text.includes('fiscal') || text.includes('imposto')) return 'Fiscal';
  if (text.includes('finance')) return 'Financeiro';
  if (text.includes('trabalh')) return 'Trabalhista';
  if (text.includes('conta') || text.includes('societ')) return 'Contadores';
  if (text.includes('atend')) return 'Atendimento';
  if (text.includes('comercial')) return 'Comercial';
  return 'Servicos';
};

const ClientDocumentosPage = ({ clienteId }) => {
  const moduleData = getPortalDocumentosData(clienteId);
  const [activeFlow, setActiveFlow] = useState('contabilidade');

  if (!moduleData) return null;

  const { portalClient, documentos, resumo } = moduleData;

  const filteredDocs = useMemo(
    () => documentos.filter((item) => (activeFlow === 'contabilidade' ? item.direcao !== 'enviado' : item.direcao === 'enviado')),
    [documentos, activeFlow],
  );

  return (
    <div className="space-y-6">
      <section className="glass-intense rounded-2xl border border-white/10 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
              <FolderOpen className="mr-2 h-4 w-4" />
              Documentos por setor
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Central de documentos</h1>
            <p className="mt-2 text-sm text-gray-300">
              Visualizacao organizada em pastas setoriais para facilitar o fluxo com a contabilidade.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Empresa</div>
            <div className="mt-2 text-lg font-semibold text-white">{portalClient.nome_fantasia}</div>
            <div className="text-sm text-gray-400">{portalClient.regime_label}</div>
          </div>
        </div>
      </section>

      <section className="glass rounded-2xl border border-white/10 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveFlow('contabilidade')}
            className={`rounded-xl border px-4 py-2 text-sm ${
              activeFlow === 'contabilidade'
                ? 'border-red-500/35 bg-red-500/15 text-red-100'
                : 'border-white/10 bg-white/5 text-gray-200'
            }`}
          >
            Enviado pela Contabilidade
          </button>
          <button
            type="button"
            onClick={() => setActiveFlow('voce')}
            className={`rounded-xl border px-4 py-2 text-sm ${
              activeFlow === 'voce'
                ? 'border-red-500/35 bg-red-500/15 text-red-100'
                : 'border-white/10 bg-white/5 text-gray-200'
            }`}
          >
            Enviado por Voce
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SETORES.map((setor) => {
          const docs = filteredDocs.filter((item) => inferSetor(item.categoria) === setor);
          return (
            <article key={setor} className="glass rounded-2xl border border-white/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <Folder className="h-4 w-4 text-red-300" />
                  {setor}
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-300">
                  {docs.length}
                </span>
              </div>
              <div className="space-y-2">
                {docs.length ? docs.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                    <div className="text-xs font-medium text-white">{item.nome}</div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400">
                      {item.direcao === 'enviado' ? <ArrowUpFromLine className="h-3 w-3" /> : <ArrowDownToLine className="h-3 w-3" />}
                      {new Date(item.data).toLocaleDateString('pt-BR')}
                    </div>
                    <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] ${statusStyles[item.status] || statusStyles.pendente}`}>
                      {item.status.replace('_', ' ')}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-3 text-xs text-gray-500">
                    Sem documentos neste setor.
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SummaryCard title="Total" value={`${resumo.total}`} subtitle="Arquivos monitorados" />
        <SummaryCard title="Enviados" value={`${resumo.enviados}`} subtitle="Arquivos enviados pelo cliente" />
        <SummaryCard title="Recebidos" value={`${resumo.recebidos}`} subtitle="Arquivos recebidos da contabilidade" />
        <SummaryCard title="Pendentes" value={`${resumo.pendentes}`} subtitle="Aguardando acao" />
      </section>
    </div>
  );
};

const SummaryCard = ({ title, value, subtitle }) => (
  <div className="glass rounded-2xl p-4">
    <p className="text-sm text-gray-400">{title}</p>
    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
  </div>
);

export default ClientDocumentosPage;
