import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { 
  Plus, Edit, Trash2, Eye, X, Upload, Download, FileText,
  CheckCircle, Clock, AlertTriangle, Save
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pendente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  pago: 'bg-green-500/20 text-green-400 border-green-500/30',
  atrasado: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const STATUS_ICONS = {
  pendente: Clock,
  pago: CheckCircle,
  atrasado: AlertTriangle
};

const TIPOS_GUIA = [
  'DARF', 'DAS', 'GPS', 'FGTS', 'ICMS', 'ISS', 'IPTU', 'IPVA',
  'IRPJ', 'CSLL', 'PIS', 'COFINS', 'INSS', 'Alvará', 'Taxa', 'Outros'
];

const EMPTY_FORM = {
  empresa_id: '',
  empresa_nome: '',
  tipo_guia: 'DARF',
  competencia: '',
  valor: '',
  data_vencimento: '',
  data_pagamento: '',
  status: 'pendente',
  colaborador_responsavel: '',
  observacoes: ''
};

const GuiasFiscais = () => {
  const { user } = useAuth();
  const [guias, setGuias] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedGuia, setSelectedGuia] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const loadGuias = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/guias-fiscais/?${params.toString()}`);
      setGuias(res.data.guias || []);
    } catch (err) {
      console.error('Erro ao carregar guias:', err);
      toast.error('Erro ao carregar guias');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadStats = async () => {
    try {
      const res = await api.get('/guias-fiscais/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  const loadClients = async () => {
    try {
      const res = await api.get('/clients/?limit=1000');
      setClients(res.data.clients || []);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  };

  useEffect(() => {
    loadGuias();
    loadStats();
    loadClients();
  }, [loadGuias]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setModalMode('create');
    setSelectedGuia(null);
    setShowModal(true);
  };

  const openEdit = (guia) => {
    setForm({
      empresa_id: guia.empresa_id || '',
      empresa_nome: guia.empresa_nome || '',
      tipo_guia: guia.tipo_guia || 'DARF',
      competencia: guia.competencia || '',
      valor: guia.valor || '',
      data_vencimento: guia.data_vencimento ? guia.data_vencimento.split('T')[0] : '',
      data_pagamento: guia.data_pagamento ? guia.data_pagamento.split('T')[0] : '',
      status: guia.status || 'pendente',
      colaborador_responsavel: guia.colaborador_responsavel || '',
      observacoes: guia.observacoes || ''
    });
    setModalMode('edit');
    setSelectedGuia(guia);
    setShowModal(true);
  };

  const openView = (guia) => {
    setSelectedGuia(guia);
    setModalMode('view');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.empresa_nome || !form.tipo_guia || !form.competencia || !form.valor || !form.data_vencimento || !form.colaborador_responsavel) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        valor: parseFloat(form.valor),
        data_pagamento: form.data_pagamento || null
      };

      if (modalMode === 'create') {
        await api.post('/guias-fiscais/', payload);
        toast.success('Guia criada com sucesso');
      } else {
        await api.put(`/guias-fiscais/${selectedGuia.id}`, payload);
        toast.success('Guia atualizada com sucesso');
      }
      setShowModal(false);
      loadGuias();
      loadStats();
    } catch (err) {
      console.error('Erro ao salvar guia:', err);
      toast.error('Erro ao salvar guia');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (guia) => {
    if (!window.confirm(`Excluir guia ${guia.tipo_guia} - ${guia.empresa_nome}?`)) return;
    try {
      await api.delete(`/guias-fiscais/${guia.id}`);
      toast.success('Guia excluída');
      loadGuias();
      loadStats();
    } catch (err) {
      toast.error('Erro ao excluir guia');
    }
  };

  const handleStatusChange = async (guia, newStatus) => {
    try {
      const update = { status: newStatus };
      if (newStatus === 'pago' && !guia.data_pagamento) {
        update.data_pagamento = new Date().toISOString().split('T')[0];
      }
      await api.put(`/guias-fiscais/${guia.id}`, update);
      toast.success(`Status alterado para ${newStatus}`);
      loadGuias();
      loadStats();
    } catch (err) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleFileUpload = async (guia, type) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const endpoint = type === 'guia' 
          ? `/guias-fiscais/${guia.id}/upload-guia`
          : `/guias-fiscais/${guia.id}/upload-comprovante`;
        await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(`${type === 'guia' ? 'Guia' : 'Comprovante'} enviado com sucesso`);
        loadGuias();
      } catch (err) {
        toast.error(`Erro ao enviar ${type === 'guia' ? 'guia' : 'comprovante'}`);
      }
    };
    input.click();
  };

  const handleFileDownload = async (guia, type) => {
    try {
      const endpoint = type === 'guia'
        ? `/guias-fiscais/${guia.id}/download-guia`
        : `/guias-fiscais/${guia.id}/download-comprovante`;
      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}_${guia.tipo_guia}_${guia.competencia}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Arquivo não encontrado');
    }
  };

  const handleClientSelect = (e) => {
    const clientId = e.target.value;
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setForm(prev => ({ ...prev, empresa_id: client.id, empresa_nome: client.nome_empresa }));
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
      return d.toLocaleDateString('pt-BR');
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-6" data-testid="guias-fiscais-container">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass p-4 rounded-xl">
            <p className="text-gray-400 text-sm">Total de Guias</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-gray-400 text-sm">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pendentes}</p>
            <p className="text-xs text-gray-500">{formatCurrency(stats.valor_pendente)}</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-gray-400 text-sm">Atrasadas</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{stats.atrasadas}</p>
            <p className="text-xs text-gray-500">{formatCurrency(stats.valor_atrasado)}</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-gray-400 text-sm">Pagas</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{stats.pagas}</p>
          </div>
        </div>
      )}

      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            data-testid="guias-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
          </select>
        </div>
        <button
          data-testid="btn-nova-guia"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Guia
        </button>
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-futuristic w-full" data-testid="guias-table">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Competencia</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Vencimento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pagamento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Responsavel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Arquivos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-400">Carregando...</td></tr>
              ) : guias.length === 0 ? (
                <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-400">Nenhuma guia encontrada</td></tr>
              ) : (
                guias.map((guia) => {
                  const StatusIcon = STATUS_ICONS[guia.status] || Clock;
                  return (
                    <tr key={guia.id} className="border-t border-gray-800 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white text-sm">{guia.empresa_nome}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{guia.tipo_guia}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{guia.competencia}</td>
                      <td className="px-4 py-3 text-white text-sm font-medium">{formatCurrency(guia.valor)}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(guia.data_vencimento)}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(guia.data_pagamento)}</td>
                      <td className="px-4 py-3">
                        <select
                          data-testid={`guia-status-${guia.id}`}
                          value={guia.status}
                          onChange={(e) => handleStatusChange(guia, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[guia.status]} bg-transparent cursor-pointer`}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="pago">Pago</option>
                          <option value="atrasado">Atrasado</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{guia.colaborador_responsavel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            title="Upload Guia PDF"
                            onClick={() => handleFileUpload(guia, 'guia')}
                            className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          {guia.arquivo_guia && (
                            <button
                              title="Download Guia"
                              onClick={() => handleFileDownload(guia, 'guia')}
                              className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            title="Upload Comprovante"
                            onClick={() => handleFileUpload(guia, 'comprovante')}
                            className="p-1 text-gray-400 hover:text-green-400 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {guia.arquivo_comprovante && (
                            <button
                              title="Download Comprovante"
                              onClick={() => handleFileDownload(guia, 'comprovante')}
                              className="p-1 text-green-400 hover:text-green-300 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openView(guia)} className="p-1 text-gray-400 hover:text-white transition-colors" title="Visualizar">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(guia)} className="p-1 text-gray-400 hover:text-yellow-400 transition-colors" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(guia)} className="p-1 text-gray-400 hover:text-red-400 transition-colors" title="Excluir">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create/Edit */}
      {showModal && (modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white">
                {modalMode === 'create' ? 'Nova Guia Fiscal' : 'Editar Guia Fiscal'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Empresa */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Empresa *</label>
                <select
                  data-testid="guia-form-empresa"
                  value={form.empresa_id}
                  onChange={handleClientSelect}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Selecione a empresa</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_empresa}</option>
                  ))}
                </select>
              </div>

              {/* Tipo + Competencia */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tipo da Guia *</label>
                  <select
                    data-testid="guia-form-tipo"
                    value={form.tipo_guia}
                    onChange={e => setForm(p => ({ ...p, tipo_guia: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  >
                    {TIPOS_GUIA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Competencia *</label>
                  <input
                    data-testid="guia-form-competencia"
                    type="month"
                    value={form.competencia}
                    onChange={e => setForm(p => ({ ...p, competencia: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Valor + Vencimento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Valor (R$) *</label>
                  <input
                    data-testid="guia-form-valor"
                    type="number"
                    step="0.01"
                    value={form.valor}
                    onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                    placeholder="0,00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Vencimento *</label>
                  <input
                    data-testid="guia-form-vencimento"
                    type="date"
                    value={form.data_vencimento}
                    onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Data Pagamento + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Data de Pagamento</label>
                  <input
                    data-testid="guia-form-pagamento"
                    type="date"
                    value={form.data_pagamento}
                    onChange={e => setForm(p => ({ ...p, data_pagamento: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Status *</label>
                  <select
                    data-testid="guia-form-status"
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="atrasado">Atrasado</option>
                  </select>
                </div>
              </div>

              {/* Responsavel */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Colaborador Responsavel *</label>
                <input
                  data-testid="guia-form-responsavel"
                  type="text"
                  value={form.colaborador_responsavel}
                  onChange={e => setForm(p => ({ ...p, colaborador_responsavel: e.target.value }))}
                  placeholder="Nome do colaborador"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              {/* Observacoes */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Observacoes</label>
                <textarea
                  data-testid="guia-form-observacoes"
                  value={form.observacoes}
                  onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                  rows={3}
                  placeholder="Observacoes adicionais..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                data-testid="guia-form-submit"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal View */}
      {showModal && modalMode === 'view' && selectedGuia && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white">Detalhes da Guia</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between"><span className="text-gray-400">Empresa:</span><span className="text-white">{selectedGuia.empresa_nome}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Tipo:</span><span className="text-white">{selectedGuia.tipo_guia}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Competencia:</span><span className="text-white">{selectedGuia.competencia}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Valor:</span><span className="text-white font-bold">{formatCurrency(selectedGuia.valor)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Vencimento:</span><span className="text-white">{formatDate(selectedGuia.data_vencimento)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Pagamento:</span><span className="text-white">{formatDate(selectedGuia.data_pagamento)}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[selectedGuia.status]}`}>{selectedGuia.status}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-400">Responsavel:</span><span className="text-white">{selectedGuia.colaborador_responsavel}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Lancado por:</span><span className="text-white">{selectedGuia.colaborador_lancamento_nome}</span></div>
              {selectedGuia.observacoes && (
                <div className="pt-2 border-t border-gray-700">
                  <p className="text-gray-400 text-sm mb-1">Observacoes:</p>
                  <p className="text-white text-sm">{selectedGuia.observacoes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-3 border-t border-gray-700">
                {selectedGuia.arquivo_guia && (
                  <button onClick={() => handleFileDownload(selectedGuia, 'guia')} className="flex items-center gap-1 px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-lg text-sm hover:bg-blue-600/30">
                    <Download className="w-3 h-3" /> Guia PDF
                  </button>
                )}
                {selectedGuia.arquivo_comprovante && (
                  <button onClick={() => handleFileDownload(selectedGuia, 'comprovante')} className="flex items-center gap-1 px-3 py-1 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg text-sm hover:bg-green-600/30">
                    <Download className="w-3 h-3" /> Comprovante
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuiasFiscais;
