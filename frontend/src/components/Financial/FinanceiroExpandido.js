import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { mockFinancialContas, mockFinancialDashboardStats } from '../../dev/mockData';
import { 
  Wallet, Plus, Search, Filter, Download, MessageCircle, 
  Phone, Mail, Calendar, DollarSign, FileText, Eye, 
  Edit, Trash2, Copy, ChevronDown, AlertCircle, CheckCircle,
  Clock, TrendingUp, Upload, RefreshCw, Bell, AlertTriangle,
  X, FileUp
} from 'lucide-react';
import { toast } from 'sonner';
import CreateContaModal from './CreateContaModal';
import PaymentModal from './PaymentModal';

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const normalizeWhitespace = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const cityKey = (value = '') => normalizeText(normalizeWhitespace(value));

const FinanceiroExpandido = () => {
  const { hasAccess, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('todas'); // todas, inadimplentes, boletos
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUploadComprovanteModal, setShowUploadComprovanteModal] = useState(false);
  const [selectedConta, setSelectedConta] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [comprovanteFile, setComprovanteFile] = useState(null);
  
  // Contact Modal State
  const [contactForm, setContactForm] = useState({
    data_contato: new Date().toISOString().split('T')[0],
    tipo_contato: 'telefone',
    responsavel: '',
    resultado: '',
    observacoes: ''
  });

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
      
      // Atualizar dados a cada 5 minutos
      const interval = setInterval(() => {
        loadContas();
        loadDashboardStats();
      }, 300000);
      
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (activeTab) {
      loadContas();
    }
  }, [activeTab]);

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
      setContas(mockFinancialContas);
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
      setDashboardStats(mockFinancialDashboardStats);
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

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!selectedConta) return;

    try {
      await api.post(`/financial/contas-receber/${selectedConta.id}/contatos`, {
        ...contactForm,
        responsavel: contactForm.responsavel || user.name
      });
      toast.success('Contato registrado com sucesso!');
      setShowContactModal(false);
      setSelectedConta(null);
      setContactForm({
        data_contato: new Date().toISOString().split('T')[0],
        tipo_contato: 'telefone',
        responsavel: '',
        resultado: '',
        observacoes: ''
      });
      loadContas();
    } catch (error) {
      toast.error('Erro ao registrar contato: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const handleUploadComprovante = async (e) => {
    e.preventDefault();
    if (!comprovanteFile || !selectedConta) return;

    const formData = new FormData();
    formData.append('file', comprovanteFile);

    try {
      // Aqui você pode criar um endpoint específico para upload de comprovantes
      // Por enquanto, vamos salvar como anexo e fazer a baixa
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result.split(',')[1];
        
        await api.put(`/financial/contas-receber/${selectedConta.id}/baixa`, {
          data_recebimento: new Date().toISOString().split('T')[0],
          valor_pago: selectedConta.total_liquido,
          forma_pagamento: selectedConta.tipo_documento === 'boleto' ? 'boleto' : 'transferencia',
          comprovante_pagamento: base64,
          observacoes: 'Pagamento confirmado via comprovante'
        });
        
        toast.success('Comprovante enviado e baixa realizada!');
        setShowUploadComprovanteModal(false);
        setSelectedConta(null);
        setComprovanteFile(null);
        loadContas();
        loadDashboardStats();
      };
      reader.readAsDataURL(comprovanteFile);
    } catch (error) {
      toast.error('Erro ao enviar comprovante: ' + (error.response?.data?.detail || 'Erro desconhecido'));
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
      }
      toast.success(`Dados exportados em ${formato.toUpperCase()}`);
    } catch (error) {
      toast.error('Erro ao exportar dados');
    }
  };

  // Computed values
  const filteredContas = useMemo(() => {
    let filtered = contas.filter(conta => {
      if (filters.empresa && !conta.empresa.toLowerCase().includes(filters.empresa.toLowerCase())) return false;
      if (filters.situacao.length && !filters.situacao.includes(conta.situacao)) return false;
      if (filters.cidade && cityKey(conta.cidade_atendimento) !== cityKey(filters.cidade)) return false;
      return true;
    });

    // Aplicar filtro de aba
    if (activeTab === 'inadimplentes') {
      filtered = filtered.filter(c => c.situacao === 'atrasado');
    } else if (activeTab === 'boletos') {
      filtered = filtered.filter(c => c.tipo_documento === 'boleto');
    }

    return filtered;
  }, [contas, filters, activeTab]);

  // Calcular estatísticas de inadimplência
  const inadimplenciaStats = useMemo(() => {
    const inadimplentes = contas.filter(c => c.situacao === 'atrasado');
    const hoje = new Date();
    
    const por30dias = inadimplentes.filter(c => {
      const vencimento = new Date(c.data_vencimento);
      const diff = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));
      return diff > 0 && diff <= 30;
    });
    
    const por60dias = inadimplentes.filter(c => {
      const vencimento = new Date(c.data_vencimento);
      const diff = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));
      return diff > 30 && diff <= 60;
    });
    
    const mais60dias = inadimplentes.filter(c => {
      const vencimento = new Date(c.data_vencimento);
      const diff = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));
      return diff > 60;
    });

    return {
      total: inadimplentes.length,
      ate30dias: por30dias.length,
      ate60dias: por60dias.length,
      mais60dias: mais60dias.length,
      valor_total: inadimplentes.reduce((sum, c) => sum + (c.total_liquido || 0), 0)
    };
  }, [contas]);

  const statusColors = {
    'em_aberto': 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
    'pago': 'bg-green-600/20 text-green-400 border-green-600/30',
    'atrasado': 'bg-red-600/20 text-red-400 border-red-600/30',
    'renegociado': 'bg-blue-600/20 text-blue-400 border-blue-600/30',
    'cancelado': 'bg-gray-600/20 text-gray-400 border-gray-600/30'
  };

  const calcularDiasAtraso = (dataVencimento) => {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diff = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
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
      <div className="glass-intense rounded-2xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Contas a Receber</h1>
            <p className="mt-1 text-sm text-gray-300">Gestao de cobranca, vencimentos e recebimentos.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/financeiro')}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/10"
          >
            Voltar para Financeiro
          </button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass rounded-xl p-6 border border-yellow-600/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total em Aberto</p>
                <p className="text-2xl font-bold text-yellow-400">
                  R$ {dashboardStats.total_aberto?.valor?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.total_aberto?.count || 0} títulos</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6 border border-red-600/30 relative overflow-hidden">
            <div className="absolute top-2 right-2">
              <Bell className="w-5 h-5 text-red-400 animate-pulse" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Atrasado</p>
                <p className="text-2xl font-bold text-red-400">
                  R$ {dashboardStats.total_atrasado?.valor?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.total_atrasado?.count || 0} títulos</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6 border border-green-600/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Recebido no Mês</p>
                <p className="text-2xl font-bold text-green-400">
                  R$ {dashboardStats.total_recebido_mes?.valor?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.total_recebido_mes?.count || 0} títulos</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6 border border-blue-600/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">A Vencer</p>
                <p className="text-2xl font-bold text-blue-400">
                  R$ {dashboardStats.aging?.a_vencer?.valor?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}
                </p>
                <p className="text-xs text-gray-500">{dashboardStats.aging?.a_vencer?.count || 0} títulos</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-400 opacity-60" />
            </div>
          </div>
        </div>
      )}

      {/* Alertas de Inadimplência */}
      {inadimplenciaStats.total > 0 && (
        <div className="glass rounded-xl p-4 border-l-4 border-red-600">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-red-400 mr-3 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">Atenção: Inadimplência Detectada</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Total Inadimplentes</p>
                  <p className="text-xl font-bold text-red-400">{inadimplenciaStats.total}</p>
                </div>
                <div>
                  <p className="text-gray-400">Até 30 dias</p>
                  <p className="text-xl font-bold text-yellow-400">{inadimplenciaStats.ate30dias}</p>
                </div>
                <div>
                  <p className="text-gray-400">31-60 dias</p>
                  <p className="text-xl font-bold text-orange-400">{inadimplenciaStats.ate60dias}</p>
                </div>
                <div>
                  <p className="text-gray-400">Mais de 60 dias</p>
                  <p className="text-xl font-bold text-red-400">{inadimplenciaStats.mais60dias}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">💸</span>
            Financeiro
          </h1>
          <p className="text-gray-400 mt-2">Gestão completa de contas a receber, cobranças e boletos</p>
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

      {/* Tabs */}
      <div className="glass rounded-xl p-1 inline-flex">
        <button
          onClick={() => setActiveTab('todas')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'todas'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📊 Todas as Contas
        </button>
        <button
          onClick={() => setActiveTab('inadimplentes')}
          className={`px-6 py-3 rounded-lg font-medium transition-all relative ${
            activeTab === 'inadimplentes'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          ⚠️ Inadimplentes
          {inadimplenciaStats.total > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {inadimplenciaStats.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('boletos')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'boletos'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📄 Boletos
        </button>
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
                className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white"
                placeholder="Nome da empresa..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Situação</label>
              <select
                multiple
                value={filters.situacao}
                onChange={(e) => setFilters({...filters, situacao: Array.from(e.target.selectedOptions, option => option.value)})}
                className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white"
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
                className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Data Fim</label>
              <input
                type="date"
                value={filters.data_vencimento_fim}
                onChange={(e) => setFilters({...filters, data_vencimento_fim: e.target.value})}
                className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white"
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
                {activeTab === 'inadimplentes' && (
                  <th className="text-left p-4 text-gray-300 font-semibold">Dias Atraso</th>
                )}
                <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'inadimplentes' ? '8' : '7'} className="text-center p-8">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-gray-400">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredContas.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'inadimplentes' ? '8' : '7'} className="text-center p-8">
                    <div className="text-gray-400">
                      <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhuma conta encontrada</p>
                      {activeTab === 'todas' && (
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="btn-futuristic px-4 py-2 rounded-lg mt-3"
                        >
                          Criar primeira conta
                        </button>
                      )}
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
                        <p className="text-xs text-gray-400 capitalize">{conta.tipo_documento}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-green-400 font-semibold">
                          R$ {conta.valor_original?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}
                        </p>
                        {conta.total_liquido !== conta.valor_original && (
                          <p className="text-xs text-gray-400">
                            Líquido: R$ {conta.total_liquido?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className={`${conta.situacao === 'atrasado' ? 'text-red-400 font-bold' : 'text-white'}`}>
                          {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                        </p>
                        {conta.data_recebimento && (
                          <p className="text-xs text-green-400">
                            Pago: {new Date(conta.data_recebimento).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </td>
                    {activeTab === 'inadimplentes' && (
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          calcularDiasAtraso(conta.data_vencimento) > 60 
                            ? 'bg-red-600/30 text-red-300' 
                            : calcularDiasAtraso(conta.data_vencimento) > 30
                            ? 'bg-orange-600/30 text-orange-300'
                            : 'bg-yellow-600/30 text-yellow-300'
                        }`}>
                          {calcularDiasAtraso(conta.data_vencimento)} dias
                        </span>
                      </td>
                    )}
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
                            {conta.tipo_documento === 'boleto' && (
                              <button
                                onClick={() => {setSelectedConta(conta); setShowUploadComprovanteModal(true);}}
                                className="btn-secondary p-2 rounded-lg hover:bg-blue-600/20"
                                title="Upload Comprovante"
                              >
                                <FileUp className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {setSelectedConta(conta); setShowContactModal(true);}}
                              className="btn-secondary p-2 rounded-lg hover:bg-blue-600/20"
                              title="Registrar Contato"
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

      {/* Modals */}
      <CreateContaModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateConta}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {setShowPaymentModal(false); setSelectedConta(null);}}
        onSubmit={handlePayment}
        conta={selectedConta}
      />

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Phone className="w-6 h-6 mr-2 text-red-400" />
                Registrar Contato de Cobrança
              </h2>
              <button
                onClick={() => {setShowContactModal(false); setSelectedConta(null);}}
                className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {selectedConta && (
              <div className="mb-4 p-4 glass rounded-lg">
                <p className="text-gray-400 text-sm">Cliente</p>
                <p className="text-white font-bold">{selectedConta.empresa}</p>
                <p className="text-gray-400 text-sm mt-1">
                  Valor: R$ {selectedConta.total_liquido?.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | 
                  Vencimento: {new Date(selectedConta.data_vencimento).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}

            <form onSubmit={handleAddContact}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Data do Contato *</label>
                  <input
                    required
                    type="date"
                    value={contactForm.data_contato}
                    onChange={(e) => setContactForm({...contactForm, data_contato: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Contato *</label>
                  <select
                    required
                    value={contactForm.tipo_contato}
                    onChange={(e) => setContactForm({...contactForm, tipo_contato: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="telefone">Telefone</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="sms">SMS</option>
                    <option value="presencial">Presencial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Responsável</label>
                  <input
                    type="text"
                    value={contactForm.responsavel}
                    onChange={(e) => setContactForm({...contactForm, responsavel: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    placeholder={user.name}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Resultado *</label>
                  <select
                    required
                    value={contactForm.resultado}
                    onChange={(e) => setContactForm({...contactForm, resultado: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Selecione...</option>
                    <option value="promessa_pagamento">Promessa de Pagamento</option>
                    <option value="cliente_ausente">Cliente Ausente</option>
                    <option value="telefone_invalido">Telefone Inválido</option>
                    <option value="acordo_realizado">Acordo Realizado</option>
                    <option value="sem_sucesso">Sem Sucesso</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Observações *</label>
                  <textarea
                    required
                    value={contactForm.observacoes}
                    onChange={(e) => setContactForm({...contactForm, observacoes: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    rows="3"
                    placeholder="Detalhes do contato..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {setShowContactModal(false); setSelectedConta(null);}}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 btn-futuristic rounded-lg text-white font-medium"
                >
                  Registrar Contato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Comprovante Modal */}
      {showUploadComprovanteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <FileUp className="w-6 h-6 mr-2 text-red-400" />
                Upload Comprovante
              </h2>
              <button
                onClick={() => {setShowUploadComprovanteModal(false); setSelectedConta(null); setComprovanteFile(null);}}
                className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {selectedConta && (
              <div className="mb-4 p-4 glass rounded-lg">
                <p className="text-gray-400 text-sm">Boleto</p>
                <p className="text-white font-bold">{selectedConta.empresa}</p>
                <p className="text-gray-400 text-sm mt-1">
                  Documento: {selectedConta.documento} | 
                  Valor: R$ {selectedConta.total_liquido?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </p>
              </div>
            )}

            <form onSubmit={handleUploadComprovante}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Arquivo do Comprovante (PDF, JPG, PNG) *
                </label>
                <input
                  required
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setComprovanteFile(e.target.files[0])}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-400">
                  ℹ️ O upload do comprovante dará baixa automática no boleto com a data e valor do título.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {setShowUploadComprovanteModal(false); setSelectedConta(null); setComprovanteFile(null);}}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 btn-futuristic rounded-lg text-white font-medium"
                >
                  Enviar e Dar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default FinanceiroExpandido;
