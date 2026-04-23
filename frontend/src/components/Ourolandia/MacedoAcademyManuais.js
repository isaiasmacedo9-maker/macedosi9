import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { accountingServiceProcessModels } from '../../dev/accountingProcessTemplates';
import { listAcademyModels } from './academyProcessService';

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const SETOR_ORDER = [
  'administrativo',
  'comercial',
  'contabil',
  'fiscal',
  'legalizacao',
  'pessoal',
  'rh',
  'financeiro',
  'atendimento',
  'trabalhista',
  'outros',
];
const SETOR_LABELS = {
  administrativo: 'Administrativo',
  comercial: 'Comercial',
  contabil: 'Contábil',
  fiscal: 'Fiscal',
  pessoal: 'Pessoal',
  legalizacao: 'Legalização',
  atendimento: 'Atendimento',
  trabalhista: 'Trabalhista',
  rh: 'RH',
  financeiro: 'Financeiro',
  outros: 'Outros',
};

const getSetorKey = (manual = {}) => {
  const firstStep = Array.isArray(manual.etapas) ? manual.etapas[0] : null;
  const source = normalizeText(firstStep?.setorResponsavel || manual.setorDestino || '');
  if (source.includes('admin')) return 'administrativo';
  if (source === 'rh' || source.includes('recursos humanos')) return 'rh';
  if (source.includes('fiscal')) return 'fiscal';
  if (source.includes('pessoal') || source.includes('trabalh')) return source.includes('trabalh') ? 'trabalhista' : 'pessoal';
  if (source.includes('legal')) return 'legalizacao';
  if (source.includes('atend')) return 'atendimento';
  if (source.includes('comercial')) return 'comercial';
  if (source.includes('contab')) return 'contabil';
  if (source.includes('finance')) return 'financeiro';
  return 'outros';
};

const MacedoAcademyManuais = () => {
  const [search, setSearch] = useState('');
  const [sourceModels, setSourceModels] = useState(accountingServiceProcessModels);

  useEffect(() => {
    let mounted = true;
    const loadModels = async () => {
      try {
        const rows = await listAcademyModels();
        if (mounted && Array.isArray(rows) && rows.length) {
          setSourceModels(rows);
        }
      } catch {}
    };
    loadModels();
    return () => {
      mounted = false;
    };
  }, []);

  const manuals = useMemo(() => {
    const term = normalizeText(search);
    if (!term) return sourceModels;
    return sourceModels.filter((item) => {
      const text = `${item.nome || ''} ${item.descricao || ''}`;
      return normalizeText(text).includes(term);
    });
  }, [search, sourceModels]);

  const manualsBySetor = useMemo(() => {
    const grouped = manuals.reduce((acc, manual) => {
      const setor = getSetorKey(manual);
      if (!acc[setor]) acc[setor] = [];
      acc[setor].push(manual);
      return acc;
    }, {});

    return SETOR_ORDER
      .filter((setor) => Array.isArray(grouped[setor]) && grouped[setor].length)
      .map((setor) => ({
        setor,
        label: SETOR_LABELS[setor] || 'Outros',
        items: grouped[setor],
      }));
  }, [manuals]);

  return (
    <div className="space-y-5 text-white">
      <div className="glass-intense rounded-[24px] border border-white/10 p-5">
        <h1 className="text-2xl font-semibold">Macedo Academy</h1>
        <p className="mt-1 text-sm text-gray-400">Base de manuais e orientações internas.</p>
      </div>

      <div className="glass rounded-[24px] border border-white/10 p-4">
        <div className="mb-4 inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            disabled
            className="rounded-md px-4 py-1.5 text-sm font-semibold text-gray-500"
          >
            Processos
          </button>
          <button
            type="button"
            onClick={() => setSearch('')}
            className="rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-slate-900"
          >
            Manuais
          </button>
        </div>

        <div className="flex items-center rounded-xl border border-white/15 bg-zinc-900 px-3 py-2">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar manual..."
            className="w-full bg-transparent px-2 text-sm text-white outline-none placeholder:text-gray-500"
          />
        </div>
      </div>

      <div className="space-y-5">
        {!manualsBySetor.length ? (
          <div className="glass rounded-[20px] border border-white/10 p-6 text-sm text-gray-400">
            Nenhum manual encontrado para os filtros atuais.
          </div>
        ) : null}
        {manualsBySetor.map((group) => (
          <section key={group.setor} className="space-y-3">
            <div className="glass rounded-xl border border-white/10 px-4 py-2.5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-200">Setor: {group.label}</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {group.items.map((manual) => (
                <article key={manual.id} className="glass rounded-[20px] border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{manual.nome}</h2>
                      <p className="mt-1 text-sm text-gray-400">{manual.descricao || 'Manual interno.'}</p>
                    </div>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5">
                      <BookOpen className="h-4 w-4 text-gray-300" />
                    </span>
                  </div>

                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 text-xs uppercase tracking-wide text-gray-400">Etapas do manual</div>
                    <ol className="space-y-1.5 text-sm text-gray-200">
                      {(manual.etapas || []).slice(0, 5).map((step, index) => (
                        <li key={step.id || `${manual.id}-${index}`} className="flex gap-2">
                          <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 text-xs">
                            {index + 1}
                          </span>
                          <span>{step.nome || 'Etapa'}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default MacedoAcademyManuais;
