import React, { useMemo, useState } from 'react';
import { FileText, Folder, UploadCloud } from 'lucide-react';

const SETORES = [
  'Atendimento',
  'Comercial',
  'Contadores',
  'Financeiro',
  'Fiscal',
  'Trabalhista',
  'Servicos',
];

const MOCK_DOCS = [
  { id: 'doc-1', nome: 'Contrato social atualizado.pdf', setor: 'Contadores', origem: 'contabilidade', data: '2026-04-12' },
  { id: 'doc-2', nome: 'Planilha de folha - abril.xlsx', setor: 'Trabalhista', origem: 'cliente', data: '2026-04-13' },
  { id: 'doc-3', nome: 'Guia DAS abril.pdf', setor: 'Fiscal', origem: 'contabilidade', data: '2026-04-14' },
  { id: 'doc-4', nome: 'Comprovante de pagamento.pdf', setor: 'Financeiro', origem: 'cliente', data: '2026-04-15' },
];

const DocumentsCenter = () => {
  const [activeFlow, setActiveFlow] = useState('contabilidade');

  const filtered = useMemo(
    () => MOCK_DOCS.filter((item) => (activeFlow === 'contabilidade' ? item.origem === 'contabilidade' : item.origem === 'cliente')),
    [activeFlow],
  );

  return (
    <div className="space-y-6">
      <section className="glass-intense rounded-2xl border border-white/10 p-5">
        <h1 className="text-2xl font-bold text-white">Central de documentos</h1>
        <p className="mt-2 text-sm text-gray-300">
          Area comum para toda a equipe com organizacao por setor e fluxo de troca documental.
        </p>
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
            onClick={() => setActiveFlow('cliente')}
            className={`rounded-xl border px-4 py-2 text-sm ${
              activeFlow === 'cliente'
                ? 'border-red-500/35 bg-red-500/15 text-red-100'
                : 'border-white/10 bg-white/5 text-gray-200'
            }`}
          >
            Enviado pelo Cliente
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SETORES.map((setor) => {
          const docs = filtered.filter((item) => item.setor === setor);
          return (
            <article key={setor} className="glass rounded-2xl border border-white/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-white">
                  <Folder className="h-4 w-4 text-red-300" />
                  <span className="text-sm font-semibold">{setor}</span>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-300">
                  {docs.length}
                </span>
              </div>
              <div className="space-y-2">
                {docs.length ? docs.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                    <div className="inline-flex items-center gap-2 text-xs text-gray-200">
                      <FileText className="h-3.5 w-3.5 text-blue-300" />
                      {item.nome}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">{new Date(`${item.data}T00:00:00`).toLocaleDateString('pt-BR')}</div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-3 text-xs text-gray-500">
                    Sem arquivos neste fluxo.
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="glass rounded-2xl border border-white/10 p-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25"
        >
          <UploadCloud className="h-4 w-4" />
          Enviar novo documento
        </button>
      </section>
    </div>
  );
};

export default DocumentsCenter;
