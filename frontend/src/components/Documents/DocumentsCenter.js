import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Folder, Search, UploadCloud, X } from 'lucide-react';
import api from '../../config/api';

const SETORES = [
  'Atendimento',
  'Comercial',
  'Contadores',
  'Financeiro',
  'Fiscal',
  'Trabalhista',
  'Serviços',
];


const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeSectorKey = (raw = '') => {
  const value = normalizeText(raw);
  if (value.includes('atend')) return 'Atendimento';
  if (value.includes('comercial')) return 'Comercial';
  if (value.includes('contador') || value.includes('societ')) return 'Contadores';
  if (value.includes('finance')) return 'Financeiro';
  if (value.includes('fiscal')) return 'Fiscal';
  if (value.includes('trabalh')) return 'Trabalhista';
  if (value.includes('servico')) return 'Serviços';
  return 'Serviços';
};

const DocumentsCenter = () => {
  const [activeFlow, setActiveFlow] = useState('contabilidade');
  const [documents, setDocuments] = useState([]);
  const [clients, setClients] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [sectorSearchOpen, setSectorSearchOpen] = useState({});
  const [sectorSearchText, setSectorSearchText] = useState({});
  const [draft, setDraft] = useState({
    origem: 'contabilidade',
    setor: 'Atendimento',
    empresa_id: '',
    empresa_nome: '',
    nome: '',
    arquivo_nome: '',
    tipo_documento: '',
    data: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [docsRes, typesRes, clientsRes] = await Promise.all([
          api.get('/documents'),
          api.get('/documents/types'),
          api.get('/clients?limit=2000'),
        ]);
        setDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
        setDocumentTypes(Array.isArray(typesRes.data?.types) ? typesRes.data.types : []);
        const apiClients = clientsRes.data?.clients || clientsRes.data || [];
        setClients(Array.isArray(apiClients) ? apiClients : []);
      } catch (error) {
        console.error('Erro ao carregar central de documentos:', error);
        setDocuments([]);
        setDocumentTypes([]);
        setClients([]);
      }
    };
    loadData();
  }, []);

  const companies = useMemo(() => {
    const map = new Map();
    clients.forEach((item) => {
      const id = item.id || item.client_id || item.empresa_id || item.cnpj;
      const name =
        item.nome_empresa ||
        item.nome_fantasia ||
        item.razao_social ||
        item.empresa_nome ||
        item.nome ||
        item.name ||
        '';
      if (!id || !name) return;
      if (!map.has(String(id))) {
        map.set(String(id), {
          id: String(id),
          nome: String(name).trim(),
          cnpj: item.cnpj || '',
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [clients]);

  const groupedBySectorAndCompany = useMemo(() => {
    const grouped = {};
    SETORES.forEach((setor) => {
      grouped[setor] = {};
      companies.forEach((company) => {
        grouped[setor][company.id] = [];
      });
    });

    documents
      .filter((doc) => doc.origem === activeFlow)
      .forEach((doc) => {
        const setor = normalizeSectorKey(doc.setor);
        if (!grouped[setor]) grouped[setor] = {};
        const companyId = String(doc.empresa_id || doc.empresa_nome || 'sem-empresa');
        if (!grouped[setor][companyId]) grouped[setor][companyId] = [];
        grouped[setor][companyId].push(doc);
      });

    return grouped;
  }, [documents, activeFlow, companies]);

  const openUploadModal = () => {
    setDraft((prev) => ({
      ...prev,
      origem: activeFlow,
      setor: prev.setor || 'Atendimento',
      empresa_id: '',
      empresa_nome: '',
      nome: '',
      arquivo_nome: '',
      tipo_documento: '',
      data: new Date().toISOString().slice(0, 10),
    }));
    setShowUploadModal(true);
  };

  const handleSaveDocument = async (e) => {
    e.preventDefault();
    const fileName = draft.arquivo_nome?.trim();
    const manualName = draft.nome.trim();
    if (!fileName && !manualName) return;
    if (!draft.setor || !draft.empresa_id || !draft.tipo_documento.trim()) return;
    const selectedCompany = companies.find((item) => item.id === draft.empresa_id);
    try {
      const response = await api.post('/documents', {
        nome: fileName || manualName,
        setor: draft.setor,
        origem: draft.origem,
        empresa_id: draft.empresa_id,
        empresa_nome: selectedCompany?.nome || draft.empresa_nome || 'Empresa',
        tipo_documento: draft.tipo_documento.trim(),
        data: draft.data || new Date().toISOString().slice(0, 10),
      });
      const created = response.data;
      setDocuments((prev) => [created, ...prev]);
      if (!documentTypes.includes(created.tipo_documento)) {
        setDocumentTypes((prev) => [...new Set([...prev, created.tipo_documento])].sort((a, b) => a.localeCompare(b, 'pt-BR')));
      }
      setShowUploadModal(false);
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
    }
  };

  return (
    <div className="space-y-6">
      <section className="glass-intense rounded-2xl border border-white/10 p-5">
        <h1 className="text-2xl font-bold text-white">Central de documentos</h1>
        <p className="mt-2 text-sm text-gray-300">
          Área comum para toda a equipe com organização por setor e fluxo de troca documental.
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
          const sectorFilterKey = `${activeFlow}|${setor}`;
          const sectorQuery = normalizeText(sectorSearchText[sectorFilterKey] || '');
          const sectorCompanies = companies.map((company) => {
            const docs = groupedBySectorAndCompany?.[setor]?.[company.id] || [];
            return { ...company, docs };
          });
          const visibleCompanies = sectorQuery
            ? sectorCompanies.filter((company) => normalizeText(company.nome).includes(sectorQuery))
            : sectorCompanies;
          const totalDocs = visibleCompanies.reduce((acc, company) => acc + company.docs.length, 0);

          return (
            <article key={setor} className="glass rounded-2xl border border-white/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-white">
                  <Folder className="h-4 w-4 text-red-300" />
                  <span className="text-sm font-semibold">{setor}</span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSectorSearchOpen((prev) => ({ ...prev, [sectorFilterKey]: !prev[sectorFilterKey] }))
                    }
                    className="rounded-md border border-white/10 bg-white/5 p-1.5 text-gray-200 hover:bg-white/10"
                    title="Buscar cliente nesta pasta"
                    aria-label={`Buscar cliente no setor ${setor}`}
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-300">
                    {totalDocs}
                  </span>
                </div>
              </div>

              {sectorSearchOpen[sectorFilterKey] ? (
                <div className="mb-3">
                  <input
                    value={sectorSearchText[sectorFilterKey] || ''}
                    onChange={(e) =>
                      setSectorSearchText((prev) => ({ ...prev, [sectorFilterKey]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-white placeholder:text-gray-500"
                    placeholder="Buscar por cliente nesta pasta..."
                  />
                </div>
              ) : null}

              <div className="max-h-[290px] space-y-2 overflow-y-auto pr-1">
                {visibleCompanies.map((company) => {
                  const folderKey = `${activeFlow}|${setor}|${company.id}`;
                  const isOpen = Boolean(expandedFolders[folderKey]);
                  const docsByTypeAndDate = company.docs.reduce((acc, doc) => {
                    const typeName = (doc?.tipo_documento || 'Sem tipo').trim() || 'Sem tipo';
                    const dateFolder = doc?.data || 'Sem data';
                    if (!acc[typeName]) acc[typeName] = {};
                    if (!acc[typeName][dateFolder]) acc[typeName][dateFolder] = [];
                    acc[typeName][dateFolder].push(doc);
                    return acc;
                  }, {});

                  return (
                    <div key={folderKey} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedFolders((prev) => ({
                            ...prev,
                            [folderKey]: !prev[folderKey],
                          }))
                        }
                        className="flex w-full items-center justify-between text-left"
                      >
                        <span className="inline-flex items-center gap-2 text-xs text-gray-100">
                          <Folder className="h-3.5 w-3.5 text-amber-300" />
                          {company.nome}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-300">
                          {company.docs.length}
                        </span>
                      </button>
                      {isOpen ? (
                        <div className="mt-2 space-y-2">
                          {company.docs.length ? (
                            Object.entries(docsByTypeAndDate).map(([typeName, dateGroups]) => (
                              <div key={`${folderKey}|${typeName}`} className="rounded-lg border border-white/10 bg-[#0b1020] p-2">
                                <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold text-cyan-200">
                                  <Folder className="h-3.5 w-3.5 text-cyan-300" />
                                  {typeName}
                                </div>
                                <div className="space-y-1">
                                  {Object.entries(dateGroups)
                                    .sort(([a], [b]) => String(b).localeCompare(String(a)))
                                    .map(([dateFolder, dateDocs]) => (
                                      <div key={`${folderKey}|${typeName}|${dateFolder}`} className="rounded-md border border-white/10 bg-black/20 p-2">
                                        <div className="mb-1 text-[11px] text-gray-400">
                                          Pasta: {/^\d{4}-\d{2}-\d{2}$/.test(String(dateFolder))
                                            ? new Date(`${dateFolder}T00:00:00`).toLocaleDateString('pt-BR')
                                            : String(dateFolder)}
                                        </div>
                                        <div className="space-y-1">
                                          {dateDocs.map((item) => (
                                            <div key={item.id} className="inline-flex items-center gap-2 text-xs text-gray-200">
                                              <FileText className="h-3.5 w-3.5 text-blue-300" />
                                              {item.nome}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-2 text-[11px] text-gray-500">
                              Sem arquivos nesta pasta.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>

      <section className="glass rounded-2xl border border-white/10 p-4">
        <button
          type="button"
          onClick={openUploadModal}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25"
        >
          <UploadCloud className="h-4 w-4" />
          Enviar novo documento
        </button>
      </section>

      {showUploadModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-zinc-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Enviar novo documento</h2>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="rounded-lg border border-white/15 bg-white/5 p-2 text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-300">Fluxo</label>
                <select
                  value={draft.origem}
                  onChange={(e) => setDraft((prev) => ({ ...prev, origem: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white"
                >
                  <option value="contabilidade">Enviado pela Contabilidade</option>
                  <option value="cliente">Enviado pelo Cliente</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-300">Setor</label>
                <select
                  value={draft.setor}
                  onChange={(e) => setDraft((prev) => ({ ...prev, setor: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white"
                >
                  {SETORES.map((setor) => (
                    <option key={setor} value={setor}>
                      {setor}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-300">Empresa</label>
                <select
                  value={draft.empresa_id}
                  onChange={(e) => setDraft((prev) => ({ ...prev, empresa_id: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white"
                  required
                  disabled={!companies.length}
                >
                  <option value="">{companies.length ? 'Selecione...' : 'Nenhuma empresa cadastrada na Lista de Clientes'}</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.nome}{company.cnpj ? ` - ${company.cnpj}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-300">Tipo de documento</label>
                <input
                  value={draft.tipo_documento}
                  onChange={(e) => setDraft((prev) => ({ ...prev, tipo_documento: e.target.value }))}
                  list="documents-type-options"
                  className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white"
                  placeholder="Ex.: Contrato social, Guia fiscal..."
                  required
                />
                <datalist id="documents-type-options">
                  {documentTypes.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
                <p className="mt-1 text-[11px] text-gray-400">
                  Digite um novo tipo ou selecione um existente.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-300">Arquivo do computador</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setDraft((prev) => ({
                      ...prev,
                      arquivo_nome: file.name,
                      nome: prev.nome || file.name,
                    }));
                  }}
                  className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500/20 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-emerald-100"
                />
                {draft.arquivo_nome ? (
                  <p className="mt-1 text-[11px] text-emerald-300">Arquivo selecionado: {draft.arquivo_nome}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-300">Nome do documento</label>
                <input
                  value={draft.nome}
                  onChange={(e) => setDraft((prev) => ({ ...prev, nome: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white"
                  placeholder="Ex.: Contrato social atualizado.pdf"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg border border-emerald-500/35 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100"
                >
                  Salvar documento
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DocumentsCenter;
