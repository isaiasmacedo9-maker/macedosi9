import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { 
  Wallet, Plus, Search, Filter, Download, MessageCircle, 
  Phone, Mail, Calendar, DollarSign, FileText, Eye, 
  Edit, Trash2, Copy, ChevronDown, AlertCircle, CheckCircle,
  Clock, TrendingUp, Upload, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const ContasReceber = () => {
  const { hasAccess, user } = useAuth();
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedConta, setSelectedConta] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  
  // Filters state
  const [filters, setFilters] = useState({
    empresa: '',
    situacao: [],
    cidade: '',
    data_vencimento_inicio: '',
    data_vencimento_fim: '',
    valor_minimo: '',
    valor_maximo: '',
    usuario_responsavel: ''
  });

  useEffect(() => {
    if (hasAccess([], ['financeiro'])) {
      loadContas();
      loadDashboardStats();
    }
  }, []);

  const loadContas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/financial/contas-receber', {
        params: {
          ...filters,
          situacao: filters.situacao.join(',') || undefined
        }
      });
      setContas(response.data || []);
    } catch (error) {
      console.error('Error loading contas:', error);
      toast.error('Erro ao carregar contas a receber');
      setContas([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const response = await api.get('/financial/dashboard-stats');
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const handleSearch = () => {
    loadContas();
  };

  const handleCreateConta = async (formData) => {
    try {
      await api.post('/financial/contas-receber', formData);
      toast.success('Conta criada com sucesso!');
      setShowCreateModal(false);
      loadContas();
      loadDashboardStats();
    } catch (error) {
      toast.error('Erro ao criar conta: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const handlePayment = async (contaId, paymentData) => {
    try {
      await api.put(`/financial/contas-receber/${contaId}/baixa`, paymentData);
      toast.success('Baixa realizada com sucesso!');
      setShowPaymentModal(false);
      setSelectedConta(null);
      loadContas();
      loadDashboardStats();
    } catch (error) {
      toast.error('Erro ao dar baixa: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const handleAddContact = async (contaId, contactData) => {
    try {
      await api.post(`/financial/contas-receber/${contaId}/contatos`, contactData);
      toast.success('Contato registrado com sucesso!');
      setShowContactModal(false);
      setSelectedConta(null);
      loadContas();
    } catch (error) {
      toast.error('Erro ao registrar contato: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const handleDuplicate = async (contaId) => {
    const novaData = prompt('Nova data de vencimento (YYYY-MM-DD):');
    if (!novaData) return;

    try {
      await api.post(`/financial/contas-receber/${contaId}/duplicate?nova_data_vencimento=${novaData}`);
      toast.success('Conta duplicada com sucesso!');
      loadContas();
    } catch (error) {
      toast.error('Erro ao duplicar conta: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const generateReminder = async (contaId, tipo) => {
    try {
      const response = await api.get(`/financial/cobranca/lembretes/${contaId}?tipo=${tipo}`);
      navigator.clipboard.writeText(response.data.mensagem);
      toast.success(`Lembrete de ${tipo} copiado para a área de transferência!`);
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
      } else {
        console.log(response.data);
      }
      toast.success(`Dados exportados em ${formato.toUpperCase()}`);
    } catch (error) {
      toast.error('Erro ao exportar dados');
    }
  };

  // Computed values
  const filteredContas = useMemo(() => {
    return contas.filter(conta => {
      if (filters.empresa && !conta.empresa.toLowerCase().includes(filters.empresa.toLowerCase())) return false;
      if (filters.situacao.length && !filters.situacao.includes(conta.situacao)) return false;
      if (filters.cidade && conta.cidade_atendimento !== filters.cidade) return false;
      return true;
    });
  }, [contas, filters]);

  const statusColors = {
    'em_aberto': 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
    'pago': 'bg-green-600/20 text-green-400 border-green-600/30',
    'atrasado': 'bg-red-600/20 text-red-400 border-red-600/30',
    'renegociado': 'bg-blue-600/20 text-blue-400 border-blue-600/30',
    'cancelado': 'bg-gray-600/20 text-gray-400 border-gray-600/30'
  };

  if (!hasAccess([], ['financeiro'])) {
    return (
      <div className="glass p-8 rounded-2xl text-center">
        <Wallet className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
        <p className="text-gray-400">Você não tem permissão para acessar este módulo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total em Aberto</p>
                <p className="text-2xl font-bold text-yellow-400">
                  R$ {dashboardStats.total_aberto?.valor?.toLocaleString('pt-BR') || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.total_aberto?.count || 0} títulos</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Atrasado</p>
                <p className="text-2xl font-bold text-red-400">
                  R$ {dashboardStats.total_atrasado?.valor?.toLocaleString('pt-BR') || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.total_atrasado?.count || 0} títulos</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Recebido no Mês</p>
                <p className="text-2xl font-bold text-green-400">
                  R$ {dashboardStats.total_recebido_mes?.valor?.toLocaleString('pt-BR') || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.total_recebido_mes?.count || 0} títulos</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">A Vencer</p>
                <p className="text-2xl font-bold text-blue-400">
                  R$ {dashboardStats.aging?.a_vencer?.valor?.toLocaleString('pt-BR') || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.aging?.a_vencer?.count || 0} títulos</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-400 opacity-60" />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">💸</span>
            Contas a Receber
          </h1>
          <p className="text-gray-400 mt-2">Gestão completa de contas a receber</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={() => setShowImportModal(true)}
            className="btn-secondary px-4 py-2 rounded-xl flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Import. Extrato</span>
          </button>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary px-4 py-2 rounded-xl flex items-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-futuristic px-6 py-2 rounded-xl text-white font-semibold flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Conta</span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Empresa</label>
              <input
                type="text"
                value={filters.empresa}
                onChange={(e) => setFilters({...filters, empresa: e.target.value})}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="Nome da empresa..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Situação</label>
              <select
                multiple
                value={filters.situacao}
                onChange={(e) => setFilters({...filters, situacao: Array.from(e.target.selectedOptions, option => option.value)})}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
              >
                <option value="em_aberto">Em Aberto</option>
                <option value="pago">Pago</option>
                <option value="atrasado">Atrasado</option>
                <option value="renegociado">Renegociado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Data Início</label>
              <input
                type="date"
                value={filters.data_vencimento_inicio}
                onChange={(e) => setFilters({...filters, data_vencimento_inicio: e.target.value})}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Data Fim</label>
              <input
                type="date"
                value={filters.data_vencimento_fim}
                onChange={(e) => setFilters({...filters, data_vencimento_fim: e.target.value})}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setFilters({empresa: '', situacao: [], cidade: '', data_vencimento_inicio: '', data_vencimento_fim: '', valor_minimo: '', valor_maximo: '', usuario_responsavel: ''})}
              className="btn-secondary px-4 py-2 rounded-lg"
            >
              Limpar
            </button>
            <button
              onClick={handleSearch}
              className="btn-futuristic px-4 py-2 rounded-lg"
            >
              Buscar
            </button>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => exportData('json')}
          className="btn-secondary px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>JSON</span>
        </button>
        <button
          onClick={() => exportData('csv')}
          className="btn-secondary px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>CSV</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-futuristic w-full">
            <thead>
              <tr className="border-b border-red-600/30">
                <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Descrição</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Documento</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Valor</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Vencimento</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center p-8">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full"></div>
                      <span className="text-gray-400">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredContas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-8">
                    <div className="text-gray-400">
                      <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhuma conta encontrada</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn-futuristic px-4 py-2 rounded-lg mt-3"
                      >
                        Criar primeira conta
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredContas.map((conta) => (
                  <tr key={conta.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{conta.empresa}</p>
                        <p className="text-xs text-gray-400">{conta.cidade_atendimento}</p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">{conta.descricao}</td>
                    <td className="p-4">
                      <div>
                        <p className="text-white font-mono text-sm">{conta.documento}</p>
                        <p className="text-xs text-gray-400">{conta.tipo_documento}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-green-400 font-semibold">R$ {conta.valor_original?.toLocaleString('pt-BR') || '0,00'}</p>
                        {conta.total_liquido !== conta.valor_original && (
                          <p className="text-xs text-gray-400">
                            Líquido: R$ {conta.total_liquido?.toLocaleString('pt-BR') || '0,00'}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-white">{new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}</p>
                        {conta.data_recebimento && (
                          <p className="text-xs text-green-400">
                            Pago: {new Date(conta.data_recebimento).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[conta.situacao] || statusColors['em_aberto']}`}>
                        {conta.situacao?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex space-x-2">
                        {conta.situacao !== 'pago' && (
                          <>
                            <button
                              onClick={() => {setSelectedConta(conta); setShowPaymentModal(true);}}
                              className="btn-success p-2 rounded-lg hover:bg-green-600/20"
                              title="Dar Baixa"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {setSelectedConta(conta); setShowContactModal(true);}}
                              className="btn-secondary p-2 rounded-lg hover:bg-blue-600/20"
                              title="Adicionar Contato"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => generateReminder(conta.id, 'whatsapp')}
                              className="btn-secondary p-2 rounded-lg hover:bg-green-600/20"
                              title="Lembrete WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => generateReminder(conta.id, 'email')}
                              className="btn-secondary p-2 rounded-lg hover:bg-blue-600/20"
                              title="Lembrete Email"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDuplicate(conta.id)}
                          className="btn-secondary p-2 rounded-lg hover:bg-yellow-600/20"
                          title="Duplicar"
                        >
                          <Copy className="w-4 h-4" />
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

      {/* Modals would go here - CreateModal, PaymentModal, ContactModal, ImportModal */}
      {/* Implementation of modals would be added in separate components */}
      
    </div>
  );
};

export default ContasReceber;