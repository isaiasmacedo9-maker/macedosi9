import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Copy,
  DollarSign,
  Download,
  Filter,
  History,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import CreateContaModal from './CreateContaModal';
import PaymentModal from './PaymentModal';

const LOCAL_CONTAS_RECEBER_KEY = 'mock_financeiro_contas_receber_local_v1';

const readJson = (key, fallback) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const addMonthsIso = (dateIso, monthsToAdd) => {
  const base = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(base.getTime())) return dateIso;
  base.setMonth(base.getMonth() + monthsToAdd);
  return base.toISOString().slice(0, 10);
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const normalizeWhitespace = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const cityKey = (value = '') => normalizeText(normalizeWhitespace(value));

const simpleNameSimilarity = (a, b) => {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const ta = new Set(na.split(/\s+/).filter(Boolean));
  const tb = new Set(nb.split(/\s+/).filter(Boolean));
  const overlap = [...ta].filter((token) => tb.has(token)).length;
  return overlap / Math.max(ta.size, tb.size, 1);
};

const STATUS_ORDER = ['lancadas', 'nao_identificadas', 'ja_lancados', 'conflitos', 'ignoradas'];

const STATUS_LABEL = {
  lancadas: 'Lançadas',
  nao_identificadas: 'Não identificadas',
  ja_lancados: 'Já lançados',
  conflitos: 'Conflitos',
  ignoradas: 'Ignoradas',
};

const statusColors = {
  em_aberto: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  pago: 'bg-green-600/20 text-green-400 border-green-600/30',
  pago_com_juros: 'bg-orange-600/20 text-orange-300 border-orange-600/30',
  pago_com_desconto: 'bg-cyan-600/20 text-cyan-300 border-cyan-600/30',
  pago_parcial: 'bg-purple-600/20 text-purple-300 border-purple-600/30',
  atrasado: 'bg-red-600/20 text-red-400 border-red-600/30',
  renegociado: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  cancelado: 'bg-gray-600/20 text-gray-400 border-gray-600/30',
};

const ImportRowCard = ({
  row,
  status,
  onIgnore,
  onManualLink,
  onManualLinkAndConfirm,
  onPromptManualLink,
  onConfirmRow,
  onReopenRow,
}) => {
  const candidates = Array.isArray(row.candidatos) ? row.candidatos : [];
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs text-gray-400">Data</p>
          <p className="text-gray-200">{new Date(row.data_transacao).toLocaleDateString('pt-BR')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Pagador</p>
          <p className="text-gray-200">{row.nome_pagador || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Documento</p>
          <p className="text-gray-200">{row.documento_pagador || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Valor</p>
          <p className="font-semibold text-emerald-300">R$ {Number(row.valor || 0).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <div className="mb-2">
        <p className="text-xs text-gray-400">Memo original</p>
        <p className="text-sm text-gray-200">{row.memo_original || '-'}</p>
      </div>

      <div className="mb-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
        <div>
          <p className="text-xs text-gray-400">Tipo transação</p>
          <p className="text-gray-200">{row.tipo_transacao || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Título conciliado</p>
          <p className="text-gray-200">{row.titulo_id || '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Cliente identificado</p>
          <p className="text-gray-200">{row.cliente_id || '-'}</p>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
        <div>
          <p className="text-xs text-gray-400">Dias atraso</p>
          <p className="text-gray-200">{row.dias_atraso || 0}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Multa</p>
          <p className="text-gray-200">R$ {Number(row.multa || 0).toLocaleString('pt-BR')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Juros</p>
          <p className="text-gray-200">R$ {Number(row.juros || 0).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400">Motivo</p>
        <p className="text-sm text-gray-200">{row.motivo_resultado || '-'}</p>
      </div>

      {status === 'lancadas' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onConfirmRow(row.id)}
            className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/25"
          >
            Confirmar esta linha
          </button>
          <button
            type="button"
            onClick={() => onReopenRow(row.id)}
            className="rounded-lg border border-blue-500/35 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-100 hover:bg-blue-500/25"
          >
            Reabrir para revisão
          </button>
        </div>
      ) : null}

      {status === 'ja_lancados' || status === 'ignoradas' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onReopenRow(row.id)}
            className="rounded-lg border border-blue-500/35 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-100 hover:bg-blue-500/25"
          >
            Reabrir para revisão
          </button>
        </div>
      ) : null}

      {status === 'nao_identificadas' || status === 'conflitos' ? (
        <div className="mt-3 space-y-3">
          {candidates.length > 0 ? (
            <div>
              <p className="mb-1 text-xs text-gray-400">Candidatos sugeridos</p>
              <div className="flex flex-wrap gap-2">
                {candidates.slice(0, 4).map((candidate) => (
                  <div key={`${row.id}-${candidate.titulo_id}`} className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => onManualLink(row, candidate.titulo_id)}
                      className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-500/25"
                    >
                      Vincular {candidate.empresa || candidate.titulo_id} ({candidate.score})
                    </button>
                    <button
                      type="button"
                      onClick={() => onManualLinkAndConfirm(row, candidate.titulo_id)}
                      className="rounded-lg border border-lime-500/35 bg-lime-500/15 px-3 py-1 text-xs text-lime-100 hover:bg-lime-500/25"
                    >
                      Vincular + confirmar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPromptManualLink(row)}
              className="rounded-lg border border-sky-500/35 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 hover:bg-sky-500/25"
            >
              Vincular manual por ID
            </button>
            <button
              type="button"
              onClick={() => onIgnore(row.id)}
              className="rounded-lg border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/25"
            >
              Marcar como ignorada
            </button>
            <button
              type="button"
              onClick={() => onReopenRow(row.id)}
              className="rounded-lg border border-blue-500/35 bg-blue-500/15 px-3 py-1.5 text-xs text-blue-100 hover:bg-blue-500/25"
            >
              Reabrir para revisão
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const ContasReceber = () => {
  const { hasAccess } = useAuth();

  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedConta, setSelectedConta] = useState(null);
  const [manualLinkRow, setManualLinkRow] = useState(null);
  const [manualLinkSearch, setManualLinkSearch] = useState('');
  const [manualLinkConfirmNow, setManualLinkConfirmNow] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);

  const [activeTab, setActiveTab] = useState('contas');
  const [importBatches, setImportBatches] = useState([]);
  const [batchDetail, setBatchDetail] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [activeImportStatus, setActiveImportStatus] = useState('lancadas');
  const [importQuery, setImportQuery] = useState('');
  const [importRowQuery, setImportRowQuery] = useState('');
  const [ofxUploading, setOfxUploading] = useState(false);
  const [confirmingBatch, setConfirmingBatch] = useState(false);
  const [importedLinks, setImportedLinks] = useState([]);
  const [filterImportedOnly, setFilterImportedOnly] = useState(false);
  const [generatingDriveReport, setGeneratingDriveReport] = useState(false);

  const [filters, setFilters] = useState({
    empresa: '',
    situacao: [],
    cidade: '',
    data_vencimento_inicio: '',
    data_vencimento_fim: '',
    valor_minimo: '',
    valor_maximo: '',
    usuario_responsavel: '',
  });

  useEffect(() => {
    if (!hasAccess([], ['financeiro'])) return;
    loadContas();
    loadDashboardStats();
    loadImportBatches();
    loadImportLinks();
  }, []);

  const loadContas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/financial/contas-receber', {
        params: {
          ...filters,
          situacao: filters.situacao.join(',') || undefined,
        },
      });
      const localExtras = readJson(LOCAL_CONTAS_RECEBER_KEY, []);
      const backend = Array.isArray(response.data) ? response.data : [];
      setContas([...localExtras, ...backend]);
    } catch (error) {
      console.error('Erro ao carregar contas a receber:', error);
      toast.error('Erro ao carregar contas a receber');
      setContas(readJson(LOCAL_CONTAS_RECEBER_KEY, []));
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const response = await api.get('/financial/dashboard-stats');
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Erro ao carregar dashboard financeiro:', error);
    }
  };

  const loadImportBatches = async () => {
    try {
      const response = await api.get('/financial/contas-receber/importacoes');
      setImportBatches(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar lotes de importacao:', error);
      setImportBatches([]);
    }
  };

  const loadImportLinks = async () => {
    try {
      const response = await api.get('/financial/contas-receber/importacoes/links');
      setImportedLinks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar links de importacao:', error);
      setImportedLinks([]);
    }
  };

  const handleSearch = () => {
    loadContas();
  };

  const handleCreateConta = async (formData) => {
    const qtdAdicional = Math.max(0, Number(formData.gerar_mais_meses || 0));
    const repeticoes = Array.from({ length: qtdAdicional + 1 }, (_, index) => index);
    try {
      for (const index of repeticoes) {
        const payload = {
          ...formData,
          data_emissao: addMonthsIso(formData.data_emissao, index),
          data_vencimento: addMonthsIso(formData.data_vencimento, index),
          documento: index === 0 ? formData.documento : `${formData.documento}-${String(index + 1).padStart(2, '0')}`,
          gerar_mais_meses: 0,
        };
        await api.post('/financial/contas-receber', payload);
      }
      toast.success(qtdAdicional ? `Contas criadas para ${qtdAdicional + 1} meses.` : 'Conta criada com sucesso.');
      setShowCreateModal(false);
      loadContas();
      loadDashboardStats();
    } catch (error) {
      const localCurrent = readJson(LOCAL_CONTAS_RECEBER_KEY, []);
      const localGenerated = repeticoes.map((index) => ({
        id: `local-cr-${Date.now()}-${index}`,
        empresa_id: formData.empresa_id,
        empresa: formData.empresa,
        descricao: formData.descricao,
        documento: index === 0 ? formData.documento : `${formData.documento}-${String(index + 1).padStart(2, '0')}`,
        tipo_documento: formData.tipo_documento || 'boleto',
        valor_original: Number(formData.valor_original || 0),
        total_liquido: Number(formData.valor_original || 0),
        data_emissao: addMonthsIso(formData.data_emissao, index),
        data_vencimento: addMonthsIso(formData.data_vencimento, index),
        cidade_atendimento: formData.cidade_atendimento,
        usuario_responsavel: formData.usuario_responsavel,
        situacao: 'em_aberto',
        created_at: new Date().toISOString(),
        local: true,
      }));
      writeJson(LOCAL_CONTAS_RECEBER_KEY, [...localGenerated, ...localCurrent]);
      setContas((prev) => [...localGenerated, ...prev]);
      setShowCreateModal(false);
      toast.success(qtdAdicional ? `Contas locais criadas para ${qtdAdicional + 1} meses.` : 'Conta local criada.');
    }
  };

  const handlePayment = async (contaId, paymentData) => {
    try {
      await api.put(`/financial/contas-receber/${contaId}/baixa`, paymentData);
      toast.success('Baixa realizada com sucesso.');
      setShowPaymentModal(false);
      setSelectedConta(null);
      loadContas();
      loadDashboardStats();
      loadImportLinks();
    } catch (error) {
      toast.error(`Erro ao dar baixa: ${error.response?.data?.detail || 'erro desconhecido'}`);
    }
  };

  const handleDuplicate = async (contaId) => {
    const novaData = prompt('Nova data de vencimento (YYYY-MM-DD):');
    if (!novaData) return;
    try {
      await api.post(`/financial/contas-receber/${contaId}/duplicate?nova_data_vencimento=${novaData}`);
      toast.success('Conta duplicada com sucesso.');
      loadContas();
    } catch (error) {
      toast.error(`Erro ao duplicar conta: ${error.response?.data?.detail || 'erro desconhecido'}`);
    }
  };

  const importFromOfx = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.ofx')) {
      toast.error('Selecione um arquivo OFX válido.');
      return;
    }

    try {
      setOfxUploading(true);
      const formData = new FormData();
      formData.append('arquivo', file);

      const response = await api.post('/financial/contas-receber/importacoes/ofx/simular', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const payload = response.data || {};
      if (payload.arquivo_ja_importado) {
        toast.warning('Arquivo já importado anteriormente. Lote existente aberto para revisão.');
      } else {
        toast.success('OFX processado em modo simulação.');
      }

      await loadImportBatches();
      if (payload.batch?.id) {
        await openBatchDetail(payload.batch.id);
      }
      setActiveTab('importacoes');
      setShowImportModal(false);
    } catch (error) {
      console.error('Erro ao importar OFX:', error);
      toast.error(error?.response?.data?.detail || 'Falha ao processar OFX.');
    } finally {
      setOfxUploading(false);
    }
  };

  const openBatchDetail = async (batchId) => {
    try {
      const response = await api.get(`/financial/contas-receber/importacoes/${batchId}`);
      setBatchDetail(response.data || null);
      setSelectedBatchId(batchId);
      setActiveImportStatus('lancadas');
      setImportRowQuery('');
    } catch (error) {
      console.error('Erro ao carregar detalhe do lote:', error);
      toast.error('Não foi possível carregar o detalhe do lote.');
    }
  };

  const confirmBatch = async (batchId) => {
    if (!batchId) return;
    try {
      setConfirmingBatch(true);
      const response = await api.post(`/financial/contas-receber/importacoes/${batchId}/confirmar`);
      toast.success(`Confirmação finalizada: ${response.data?.aplicadas || 0} baixa(s) aplicada(s).`);
      await Promise.all([
        loadContas(),
        loadDashboardStats(),
        loadImportBatches(),
        loadImportLinks(),
        openBatchDetail(batchId),
      ]);
    } catch (error) {
      console.error('Erro ao confirmar lote:', error);
      toast.error(error?.response?.data?.detail || 'Falha ao confirmar lote.');
    } finally {
      setConfirmingBatch(false);
    }
  };

  const ignoreImportRow = async (rowId, motivo = 'Ignorada manualmente') => {
    if (!selectedBatchId) return;
    try {
      await api.put(`/financial/contas-receber/importacoes/${selectedBatchId}/rows/${rowId}/ignorar`, { motivo });
      toast.success('Linha marcada como ignorada.');
      await Promise.all([openBatchDetail(selectedBatchId), loadImportBatches()]);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Falha ao ignorar linha.');
    }
  };

  const manualLinkImportRow = async (row, tituloId) => {
    if (!selectedBatchId || !tituloId) return;
    try {
      await api.put(`/financial/contas-receber/importacoes/${selectedBatchId}/rows/${row.id}/vincular`, {
        titulo_id: tituloId,
        confirmar_agora: false,
      });
      toast.success('Linha vinculada manualmente.');
      await Promise.all([openBatchDetail(selectedBatchId), loadImportBatches()]);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Falha ao vincular linha.');
    }
  };

  const manualLinkAndConfirmImportRow = async (row, tituloId) => {
    if (!selectedBatchId || !tituloId) return;
    try {
      await api.put(`/financial/contas-receber/importacoes/${selectedBatchId}/rows/${row.id}/vincular`, {
        titulo_id: tituloId,
        confirmar_agora: true,
      });
      toast.success('Linha vinculada e confirmada.');
      await Promise.all([openBatchDetail(selectedBatchId), loadContas(), loadImportBatches(), loadImportLinks()]);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Falha ao vincular e confirmar linha.');
    }
  };

  const confirmImportRow = async (rowId) => {
    if (!selectedBatchId || !rowId) return;
    try {
      await api.post(`/financial/contas-receber/importacoes/${selectedBatchId}/rows/${rowId}/confirmar`);
      toast.success('Linha confirmada com sucesso.');
      await Promise.all([openBatchDetail(selectedBatchId), loadContas(), loadImportBatches(), loadImportLinks()]);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Falha ao confirmar linha.');
    }
  };

  const reopenImportRow = async (rowId) => {
    if (!selectedBatchId || !rowId) return;
    try {
      await api.put(`/financial/contas-receber/importacoes/${selectedBatchId}/rows/${rowId}/reabrir`, {
        motivo: 'Reaberta manualmente para nova revisão',
      });
      toast.success('Linha reaberta para revisão.');
      await Promise.all([openBatchDetail(selectedBatchId), loadImportBatches()]);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Falha ao reabrir linha.');
    }
  };

  const promptManualLinkImportRow = async (row) => {
    setManualLinkRow(row);
    setManualLinkSearch(row?.nome_pagador || '');
    setManualLinkConfirmNow(false);
  };

  const selectManualLinkCandidate = async (conta) => {
    if (!manualLinkRow || !conta?.id || !selectedBatchId) return;
    try {
      await api.put(`/financial/contas-receber/importacoes/${selectedBatchId}/rows/${manualLinkRow.id}/vincular`, {
        titulo_id: conta.id,
        confirmar_agora: manualLinkConfirmNow,
      });
      toast.success(manualLinkConfirmNow ? 'Linha vinculada e confirmada.' : 'Linha vinculada com sucesso.');
      setManualLinkRow(null);
      setManualLinkSearch('');
      setManualLinkConfirmNow(false);
      await Promise.all([openBatchDetail(selectedBatchId), loadContas(), loadImportBatches(), loadImportLinks()]);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Falha ao vincular manualmente.');
    }
  };

  const bulkIgnoreByStatus = async (statusAlvo) => {
    if (!selectedBatchId || !statusAlvo) return;
    const ok = window.confirm(`Ignorar todas as linhas da categoria "${STATUS_LABEL[statusAlvo] || statusAlvo}"?`);
    if (!ok) return;
    try {
      const response = await api.post(`/financial/contas-receber/importacoes/${selectedBatchId}/bulk/ignorar`, {
        status_alvo: statusAlvo,
        motivo: `Ignoração em lote da categoria ${statusAlvo}`,
      });
      toast.success(`${response.data?.total || 0} linhas ignoradas em lote.`);
      await Promise.all([openBatchDetail(selectedBatchId), loadImportBatches()]);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Falha ao ignorar em lote.');
    }
  };

  const generateReminder = async (contaId, tipo) => {
    try {
      const response = await api.get(`/financial/cobranca/lembretes/${contaId}?tipo=${tipo}`);
      navigator.clipboard.writeText(response.data.mensagem);
      toast.success(`Lembrete de ${tipo} copiado para a área de transferência.`);
    } catch (error) {
      toast.error('Erro ao gerar lembrete');
    }
  };

  const exportData = async (formato) => {
    try {
      const response = await api.get(`/financial/export/contas-receber?formato=${formato}`);
      if (formato === 'csv') {
        const blob = new Blob([response.data.content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.filename;
        a.click();
      }
      toast.success(`Dados exportados em ${formato.toUpperCase()}`);
    } catch (error) {
      toast.error('Erro ao exportar dados');
    }
  };

  const generateDriveReport = async ({ empresaId = '', empresaNome = '' } = {}) => {
    try {
      setGeneratingDriveReport(true);
      const payload = {
        cidade: filters.cidade || undefined,
        situacao: filters.situacao?.length === 1 ? filters.situacao[0] : undefined,
        data_inicio: filters.data_vencimento_inicio || undefined,
        data_fim: filters.data_vencimento_fim || undefined,
        empresa_id: empresaId || undefined,
      };
      const response = await api.post('/financial/contas-receber/reports/generate-drive-pdf', payload);
      const link = response?.data?.drive_pdf?.webViewLink || response?.data?.drive_document?.webViewLink;
      if (link) {
        window.open(link, '_blank', 'noopener,noreferrer');
      }
      toast.success(
        empresaId
          ? `Relatório do cliente ${empresaNome || ''} gerado no Google Drive.`
          : 'Relatório geral gerado no Google Drive.',
      );
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Falha ao gerar relatório no Google Drive.');
    } finally {
      setGeneratingDriveReport(false);
    }
  };

  const importedContaIdSet = useMemo(
    () => new Set(importedLinks.map((item) => String(item.conta_id))),
    [importedLinks],
  );

  const filteredContas = useMemo(() => {
    return contas.filter((conta) => {
      if (filters.empresa && !String(conta.empresa || '').toLowerCase().includes(filters.empresa.toLowerCase())) return false;
      if (filters.situacao.length && !filters.situacao.includes(conta.situacao)) return false;
      if (filters.cidade && cityKey(conta.cidade_atendimento) !== cityKey(filters.cidade)) return false;
      if (filterImportedOnly && !importedContaIdSet.has(String(conta.id))) return false;
      return true;
    });
  }, [contas, filters, filterImportedOnly, importedContaIdSet]);

  const manualLinkCandidates = useMemo(() => {
    const query = String(manualLinkSearch || '').toLowerCase().trim();
    const openStatuses = new Set(['em_aberto', 'atrasado', 'conflito_revisao']);
    const txValue = Number(manualLinkRow?.valor || 0);
    const txName = manualLinkRow?.nome_pagador || '';
    const txDate = manualLinkRow?.data_transacao ? new Date(manualLinkRow.data_transacao) : null;
    const txDoc = normalizeText(manualLinkRow?.documento_pagador || '');

    const candidates = contas
      .filter((conta) => openStatuses.has(String(conta.situacao || '')))
      .map((conta) => {
        let scoreManual = 0;
        const contaName = conta.empresa || '';
        const contaDoc = normalizeText(conta.cnpj || conta.documento || '');
        const contaValue = Number(conta.total_liquido || conta.valor_original || 0);
        const dueDate = conta.data_vencimento ? new Date(conta.data_vencimento) : null;

        const nameScore = simpleNameSimilarity(txName, contaName);
        if (nameScore >= 0.9) scoreManual += 30;
        else if (nameScore >= 0.75) scoreManual += 20;
        else if (nameScore >= 0.6) scoreManual += 10;

        if (txDoc && contaDoc && (txDoc.includes(contaDoc) || contaDoc.includes(txDoc))) {
          scoreManual += 35;
        }

        if (Math.abs(txValue - contaValue) <= 0.01) scoreManual += 30;
        else if (Math.abs(txValue - contaValue) <= 0.5) scoreManual += 20;
        else if (Math.abs(txValue - contaValue) <= 5) scoreManual += 8;

        if (txDate && dueDate) {
          const days = Math.abs(Math.floor((txDate - dueDate) / (1000 * 60 * 60 * 24)));
          if (days <= 3) scoreManual += 12;
          else if (days <= 10) scoreManual += 8;
          else if (days <= 30) scoreManual += 3;
        }

        return { ...conta, scoreManual };
      });

    const filtered = (!query
      ? candidates
      : candidates
      .filter((conta) => {
        const haystack = [
          conta.id,
          conta.empresa,
          conta.documento,
          conta.descricao,
          conta.cnpj,
          conta.cidade_atendimento,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      }));

    return filtered.sort((a, b) => (b.scoreManual || 0) - (a.scoreManual || 0)).slice(0, 80);
  }, [contas, manualLinkSearch, manualLinkRow]);

  const groupedBatches = useMemo(() => {
    const map = new Map();
    const normalizedQuery = String(importQuery || '').toLowerCase().trim();
    const filteredBatches = importBatches.filter((batch) => {
      if (!normalizedQuery) return true;
      const dateRef = new Date(batch.data_importacao || batch.created_at || Date.now()).toLocaleString('pt-BR');
      const haystack = [
        batch.nome_arquivo,
        batch.banco_origem,
        batch.conta_origem,
        batch.hash_arquivo,
        batch.usuario_nome,
        dateRef,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    filteredBatches.forEach((batch) => {
      const rawDate = batch.data_importacao ? new Date(batch.data_importacao) : new Date();
      const dateKey = rawDate.toLocaleDateString('pt-BR');
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey).push(batch);
    });

    return Array.from(map.entries()).map(([date, batches]) => ({
      date,
      batches: [...batches].sort(
        (a, b) =>
          new Date(b.data_importacao || b.created_at || 0).getTime() -
          new Date(a.data_importacao || a.created_at || 0).getTime(),
      ),
    }));
  }, [importBatches, importQuery]);

  const activeRows = useMemo(() => {
    if (!batchDetail?.grouped) return [];
    const rows = Array.isArray(batchDetail.grouped[activeImportStatus]) ? batchDetail.grouped[activeImportStatus] : [];
    const query = String(importRowQuery || '').toLowerCase().trim();
    if (!query) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.nome_pagador,
        row.documento_pagador,
        row.memo_original,
        row.tipo_transacao,
        row.titulo_id,
        row.cliente_id,
        row.motivo_resultado,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [batchDetail, activeImportStatus, importRowQuery]);

  if (!hasAccess([], ['financeiro'])) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <Wallet className="mx-auto mb-4 h-16 w-16 text-red-400 opacity-50" />
        <h2 className="mb-2 text-xl font-bold text-white">Acesso restrito</h2>
        <p className="text-gray-400">Você não tem permissão para acessar este módulo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dashboardStats ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total em aberto</p>
                <p className="text-2xl font-bold text-yellow-400">
                  R$ {dashboardStats.total_aberto?.valor?.toLocaleString('pt-BR') || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.total_aberto?.count || 0} títulos</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total atrasado</p>
                <p className="text-2xl font-bold text-red-400">
                  R$ {dashboardStats.total_atrasado?.valor?.toLocaleString('pt-BR') || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.total_atrasado?.count || 0} títulos</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Recebido no mês</p>
                <p className="text-2xl font-bold text-green-400">
                  R$ {dashboardStats.total_recebido_mes?.valor?.toLocaleString('pt-BR') || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.total_recebido_mes?.count || 0} títulos</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">A vencer</p>
                <p className="text-2xl font-bold text-blue-400">
                  R$ {dashboardStats.aging?.a_vencer?.valor?.toLocaleString('pt-BR') || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.aging?.a_vencer?.count || 0} títulos</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-400 opacity-60" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center text-3xl font-bold text-white">
            <span className="mr-3">💸</span>
            Contas a Receber
          </h1>
          <p className="mt-2 text-gray-400">Gestão e conciliação de recebimentos com importação OFX.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2"
          >
            <Upload className="h-4 w-4" />
            <span>Importar OFX</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadImportBatches();
              if (selectedBatchId) openBatchDetail(selectedBatchId);
            }}
            className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2"
          >
            <Filter className="h-4 w-4" />
            <span>Filtros</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-futuristic flex items-center gap-2 rounded-xl px-6 py-2 font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Conta</span>
          </button>

          <button
            type="button"
            onClick={() => generateDriveReport()}
            disabled={generatingDriveReport}
            className="btn-secondary flex items-center gap-2 rounded-xl px-4 py-2 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            <span>{generatingDriveReport ? 'Gerando no Drive...' : 'Relatório Drive'}</span>
          </button>
        </div>
      </div>

      <div className="flex w-full max-w-xl rounded-xl border border-white/15 bg-black/30 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('contas')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm ${
            activeTab === 'contas' ? 'bg-red-500/20 text-red-100' : 'text-gray-300'
          }`}
        >
          Contas a Receber
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('importacoes')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm ${
            activeTab === 'importacoes' ? 'bg-red-500/20 text-red-100' : 'text-gray-300'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <History className="h-4 w-4" />
            Importações
          </span>
        </button>
      </div>

      {activeTab === 'contas' ? (
        <>
          {showFilters ? (
            <div className="glass rounded-xl p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm text-gray-300">Empresa</label>
                  <input
                    type="text"
                    value={filters.empresa}
                    onChange={(e) => setFilters({ ...filters, empresa: e.target.value })}
                    className="input-futuristic w-full rounded-lg px-3 py-2"
                    placeholder="Nome da empresa..."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-gray-300">Situação</label>
                  <select
                    multiple
                    value={filters.situacao}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        situacao: Array.from(e.target.selectedOptions, (option) => option.value),
                      })
                    }
                    className="input-futuristic w-full rounded-lg px-3 py-2"
                  >
                    <option value="em_aberto">Em Aberto</option>
                    <option value="pago">Pago</option>
                    <option value="pago_com_juros">Pago com Juros</option>
                    <option value="pago_com_desconto">Pago com Desconto</option>
                    <option value="pago_parcial">Pago Parcial</option>
                    <option value="atrasado">Atrasado</option>
                    <option value="renegociado">Renegociado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-gray-300">Data início</label>
                  <input
                    type="date"
                    value={filters.data_vencimento_inicio}
                    onChange={(e) => setFilters({ ...filters, data_vencimento_inicio: e.target.value })}
                    className="input-futuristic w-full rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-gray-300">Data fim</label>
                  <input
                    type="date"
                    value={filters.data_vencimento_fim}
                    onChange={(e) => setFilters({ ...filters, data_vencimento_fim: e.target.value })}
                    className="input-futuristic w-full rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={filterImportedOnly}
                    onChange={(e) => setFilterImportedOnly(e.target.checked)}
                    className="h-4 w-4 rounded border border-gray-600 bg-black/30"
                  />
                  Baixado via importação
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFilters({
                        empresa: '',
                        situacao: [],
                        cidade: '',
                        data_vencimento_inicio: '',
                        data_vencimento_fim: '',
                        valor_minimo: '',
                        valor_maximo: '',
                        usuario_responsavel: '',
                      })
                    }
                    className="btn-secondary rounded-lg px-4 py-2"
                  >
                    Limpar
                  </button>
                  <button type="button" onClick={handleSearch} className="btn-futuristic rounded-lg px-4 py-2">
                    Buscar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => exportData('json')}
              className="btn-secondary flex items-center gap-2 rounded-lg px-4 py-2"
            >
              <Download className="h-4 w-4" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={() => exportData('csv')}
              className="btn-secondary flex items-center gap-2 rounded-lg px-4 py-2"
            >
              <Download className="h-4 w-4" />
              <span>CSV</span>
            </button>
          </div>

          <div className="glass overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="table-futuristic w-full">
                <thead>
                  <tr className="border-b border-red-600/30">
                    <th className="p-4 text-left font-semibold text-gray-300">Empresa</th>
                    <th className="p-4 text-left font-semibold text-gray-300">Descrição</th>
                    <th className="p-4 text-left font-semibold text-gray-300">Documento</th>
                    <th className="p-4 text-left font-semibold text-gray-300">Valor</th>
                    <th className="p-4 text-left font-semibold text-gray-300">Vencimento</th>
                    <th className="p-4 text-left font-semibold text-gray-300">Status</th>
                    <th className="p-4 text-left font-semibold text-gray-300">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="spinner h-6 w-6 rounded-full border-2 border-red-600 border-t-transparent" />
                          <span className="text-gray-400">Carregando...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredContas.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center">
                        <div className="text-gray-400">
                          <Wallet className="mx-auto mb-3 h-12 w-12 opacity-50" />
                          <p>Nenhuma conta encontrada</p>
                          <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="btn-futuristic mt-3 rounded-lg px-4 py-2"
                          >
                            Criar primeira conta
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredContas.map((conta) => (
                      <tr key={conta.id} className="border-b border-gray-800/50 transition-colors hover:bg-red-600/5">
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-white">{conta.empresa}</p>
                            <p className="text-xs text-gray-400">{conta.cidade_atendimento}</p>
                          </div>
                        </td>
                        <td className="p-4 text-gray-300">{conta.descricao}</td>
                        <td className="p-4">
                          <p className="font-mono text-sm text-white">{conta.documento}</p>
                          <p className="text-xs text-gray-400">{conta.tipo_documento}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-green-400">
                            R$ {Number(conta.valor_original || 0).toLocaleString('pt-BR')}
                          </p>
                          {conta.total_liquido !== conta.valor_original ? (
                            <p className="text-xs text-gray-400">
                              Líquido: R$ {Number(conta.total_liquido || 0).toLocaleString('pt-BR')}
                            </p>
                          ) : null}
                        </td>
                        <td className="p-4">
                          <p className="text-white">
                            {conta.data_vencimento ? new Date(conta.data_vencimento).toLocaleDateString('pt-BR') : '-'}
                          </p>
                          {conta.data_recebimento ? (
                            <p className="text-xs text-green-400">
                              Pago: {new Date(conta.data_recebimento).toLocaleDateString('pt-BR')}
                            </p>
                          ) : null}
                        </td>
                        <td className="p-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              statusColors[conta.situacao] || statusColors.em_aberto
                            }`}
                          >
                            {String(conta.situacao || 'em_aberto').replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {!String(conta.situacao || '').startsWith('pago') ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedConta(conta);
                                    setShowPaymentModal(true);
                                  }}
                                  className="btn-success rounded-lg p-2 hover:bg-green-600/20"
                                  title="Dar baixa"
                                >
                                  <DollarSign className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => generateReminder(conta.id, 'whatsapp')}
                                  className="btn-secondary rounded-lg p-2 hover:bg-green-600/20"
                                  title="Lembrete WhatsApp"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => generateReminder(conta.id, 'email')}
                                  className="btn-secondary rounded-lg p-2 hover:bg-blue-600/20"
                                  title="Lembrete Email"
                                >
                                  <Mail className="h-4 w-4" />
                                </button>
                              </>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleDuplicate(conta.id)}
                              className="btn-secondary rounded-lg p-2 hover:bg-yellow-600/20"
                              title="Duplicar"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => generateDriveReport({ empresaId: conta.empresa_id, empresaNome: conta.empresa })}
                              className="btn-secondary rounded-lg p-2 hover:bg-cyan-600/20"
                              title="Gerar relatório do cliente no Drive"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="glass rounded-2xl p-4 lg:col-span-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-100">Lotes de importação</h3>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={importQuery}
                onChange={(e) => setImportQuery(e.target.value)}
                placeholder="Buscar arquivo, hash, conta..."
                className="input-futuristic w-full rounded-lg py-2 pl-9 pr-3 text-sm"
              />
            </div>
            {groupedBatches.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma importação registrada.</p>
            ) : (
              <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
                {groupedBatches.map((group) => (
                  <div key={group.date}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{group.date}</p>
                    <div className="space-y-2">
                      {group.batches.map((batch) => {
                        const selected = selectedBatchId === batch.id;
                        const importDate = new Date(batch.data_importacao || batch.created_at || Date.now());
                        return (
                          <button
                            key={batch.id}
                            type="button"
                            onClick={() => openBatchDetail(batch.id)}
                            className={`w-full rounded-xl border p-3 text-left transition-colors ${
                              selected
                                ? 'border-red-400/50 bg-red-500/15'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <p className="text-sm font-semibold text-white">{batch.nome_arquivo || 'arquivo.ofx'}</p>
                            <p className="mt-1 text-xs text-gray-300">
                              {importDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                              {batch.banco_origem || 'Cora'} · conta {batch.conta_origem || '-'}
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                              <p>Total: {batch.total_transacoes || 0}</p>
                              <p>Elegíveis: {batch.total_elegiveis || 0}</p>
                              <p>Lançadas: {batch.total_lancadas || 0}</p>
                              <p>Conflitos: {batch.total_conflitos || 0}</p>
                              <p>Não id.: {batch.total_nao_identificadas || 0}</p>
                              <p>Ignoradas: {batch.total_ignoradas || 0}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-4 lg:col-span-8">
            {batchDetail?.batch ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{batchDetail.batch.nome_arquivo}</h3>
                    <p className="text-sm text-gray-300">
                      {batchDetail.batch.banco_origem || 'Cora'} · conta {batchDetail.batch.conta_origem || '-'} · hash{' '}
                      {batchDetail.batch.hash_arquivo}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(activeImportStatus === 'nao_identificadas' || activeImportStatus === 'conflitos') ? (
                      <button
                        type="button"
                        onClick={() => bulkIgnoreByStatus(activeImportStatus)}
                        className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-100"
                      >
                        Ignorar todos desta aba
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openBatchDetail(batchDetail.batch.id)}
                      className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-gray-100"
                    >
                      Atualizar detalhe
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmBatch(batchDetail.batch.id)}
                      disabled={confirmingBatch}
                      className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {confirmingBatch ? 'Confirmando...' : 'Confirmar lançadas do lote'}
                    </button>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
                  {STATUS_ORDER.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setActiveImportStatus(status)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs ${
                        activeImportStatus === status
                          ? 'border-red-400/60 bg-red-500/20 text-red-100'
                          : 'border-white/10 bg-white/5 text-gray-300'
                      }`}
                    >
                      <p className="font-semibold">{STATUS_LABEL[status]}</p>
                      <p>{(batchDetail.batch[`total_${status}`] || 0).toString()}</p>
                    </button>
                  ))}
                </div>

                <div className="relative mb-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={importRowQuery}
                    onChange={(e) => setImportRowQuery(e.target.value)}
                    placeholder="Buscar por pagador, documento, memo, título..."
                    className="input-futuristic w-full rounded-lg py-2 pl-9 pr-3 text-sm"
                  />
                </div>

                <div className="max-h-[65vh] space-y-3 overflow-auto pr-1">
                  {activeRows.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-400">
                      Nenhum registro nesta categoria.
                    </div>
                  ) : (
                    activeRows.map((row) => (
                      <ImportRowCard
                        key={row.id}
                        row={row}
                        status={activeImportStatus}
                        onIgnore={ignoreImportRow}
                        onManualLink={manualLinkImportRow}
                        onManualLinkAndConfirm={manualLinkAndConfirmImportRow}
                        onPromptManualLink={promptManualLinkImportRow}
                        onConfirmRow={confirmImportRow}
                        onReopenRow={reopenImportRow}
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400">
                Selecione um lote de importação para visualizar o detalhe.
              </div>
            )}
          </div>
        </div>
      )}

      <CreateContaModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSubmit={handleCreateConta} />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedConta(null);
        }}
        onSubmit={handlePayment}
        conta={selectedConta}
      />

      {manualLinkRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Vincular transação manualmente</h2>
                <p className="text-sm text-gray-300">
                  Pagador: <span className="text-white">{manualLinkRow.nome_pagador || '-'}</span> · Valor:{' '}
                  <span className="text-emerald-300">R$ {Number(manualLinkRow.valor || 0).toLocaleString('pt-BR')}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManualLinkRow(null);
                  setManualLinkSearch('');
                  setManualLinkConfirmNow(false);
                }}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-200"
              >
                Fechar
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[280px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={manualLinkSearch}
                  onChange={(e) => setManualLinkSearch(e.target.value)}
                  placeholder="Buscar por empresa, documento, descrição ou ID..."
                  className="input-futuristic w-full rounded-lg py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={manualLinkConfirmNow}
                  onChange={(e) => setManualLinkConfirmNow(e.target.checked)}
                  className="h-4 w-4 rounded border border-gray-600 bg-black/30"
                />
                Vincular e confirmar agora
              </label>
              {manualLinkCandidates.length > 0 ? (
                <button
                  type="button"
                  onClick={() => selectManualLinkCandidate(manualLinkCandidates[0])}
                  className="rounded-lg border border-lime-500/35 bg-lime-500/15 px-3 py-2 text-xs text-lime-100 hover:bg-lime-500/25"
                >
                  Sugerir melhor título
                </button>
              ) : null}
            </div>

            <div className="max-h-[50vh] space-y-2 overflow-auto pr-1">
              {manualLinkCandidates.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-400">
                  Nenhum título em aberto encontrado para este filtro.
                </div>
              ) : (
                manualLinkCandidates.map((conta) => (
                  <button
                    key={conta.id}
                    type="button"
                    onClick={() => selectManualLinkCandidate(conta)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-white/10 ${
                      conta.id === manualLinkCandidates[0]?.id
                        ? 'border-lime-500/45 bg-lime-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-5">
                      <div>
                        <p className="text-xs text-gray-400">Empresa</p>
                        <p className="font-medium text-white">
                          {conta.empresa || '-'}
                          {conta.id === manualLinkCandidates[0]?.id ? (
                            <span className="ml-2 rounded-full border border-lime-500/45 bg-lime-500/15 px-2 py-0.5 text-[10px] font-semibold text-lime-100">
                              Mais provável
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">ID título</p>
                        <p className="text-gray-200">{conta.id}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Documento</p>
                        <p className="text-gray-200">{conta.documento || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Valor</p>
                        <p className="text-emerald-300">R$ {Number(conta.total_liquido || conta.valor_original || 0).toLocaleString('pt-BR')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Score</p>
                        <p className="text-lime-300">{Number(conta.scoreManual || 0).toFixed(1)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showImportModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Importar extrato OFX (Cora)</h2>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-gray-200"
              >
                Fechar
              </button>
            </div>

            <label className="block rounded-xl border border-dashed border-white/20 bg-black/20 p-4 text-sm text-gray-300">
              Selecione o arquivo OFX
              <input
                type="file"
                accept=".ofx"
                className="mt-3 block w-full text-sm text-gray-200"
                disabled={ofxUploading}
                onChange={(e) => importFromOfx(e.target.files?.[0])}
              />
            </label>

            <p className="mt-3 text-xs text-gray-400">
              Fluxo: upload OFX → simulação com classificação (Lançadas / Não identificadas / Já lançados / Conflitos / Ignoradas)
              → revisão manual → confirmação da efetivação.
            </p>
            {ofxUploading ? <p className="mt-3 text-sm text-emerald-300">Processando OFX...</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ContasReceber;
