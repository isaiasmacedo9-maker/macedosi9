import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { 
  Users, Plus, FileText, Calendar, AlertCircle, CheckCircle,
  Clock, Filter, Search, Eye, Edit, Trash2, X, Upload,
  Calculator, UserPlus, UserMinus, TrendingUp, Download
} from 'lucide-react';
import { toast } from 'sonner';

const TrabalhistaExpandido = () => {
  const { hasAccess, user } = useAuth();
  const getTodayInputDate = () => new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, recalculos, admissoes, demissoes, solicitacoes, obrigacoes
  const [loading, setLoading] = useState(true);
  
  // Estados gerais
  const [dashboardStats, setDashboardStats] = useState(null);
  const [dashboardServicos, setDashboardServicos] = useState(null);
  
  // Recalculos
  const [recalculos, setRecalculos] = useState([]);
  const [showRecalculoModal, setShowRecalculoModal] = useState(false);
  const [recalculoForm, setRecalculoForm] = useState({
    empresa_id: '',
    empresa: '',
    tipo_recalculo: 'rescisao',
    funcionario_nome: '',
    periodo_referencia: getTodayInputDate(),
    valor_original: 0,
    motivo: '',
    responsavel: user?.name || '',
    observacoes: ''
  });
  
  // Admissões
  const [admissoes, setAdmissoes] = useState([]);
  const [showAdmissaoModal, setShowAdmissaoModal] = useState(false);
  const [admissaoForm, setAdmissaoForm] = useState({
    empresa_id: '',
    empresa: '',
    funcionario_nome: '',
    cpf: '',
    data_nascimento: getTodayInputDate(),
    cargo: '',
    salario: 0,
    data_admissao: getTodayInputDate(),
    tipo_contrato: 'clt',
    jornada_trabalho: '44h semanais',
    responsavel: user?.name || '',
    observacoes: ''
  });
  
  // Demissões
  const [demissoes, setDemissoes] = useState([]);
  const [showDemissaoModal, setShowDemissaoModal] = useState(false);
  const [demissaoForm, setDemissaoForm] = useState({
    empresa_id: '',
    empresa: '',
    funcionario_id: '',
    funcionario_nome: '',
    data_demissao: getTodayInputDate(),
    tipo_demissao: 'sem_justa_causa',
    aviso_previo: 'trabalhado',
    motivo: '',
    responsavel: user?.name || '',
    observacoes: ''
  });
  
  const [clientes, setClientes] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCalculoRescisaoModal, setShowCalculoRescisaoModal] = useState(false);
  
  // Cálculo de rescisão
  const [calculoRescisao, setCalculoRescisao] = useState({
    saldo_salario: 0,
    ferias_vencidas: 0,
    ferias_proporcionais: 0,
    decimo_terceiro: 0,
    multa_fgts: 0
  });

  useEffect(() => {
    if (hasAccess([], ['trabalhista'])) {
      loadDashboard();
      loadClientes();
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'recalculos') {
      loadRecalculos();
    } else if (activeTab === 'admissoes') {
      loadAdmissoes();
    } else if (activeTab === 'demissoes') {
      loadDemissoes();
    }
  }, [activeTab]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [statsResponse, servicosResponse] = await Promise.all([
        api.get('/trabalhista/dashboard-stats'),
        api.get('/trabalhista/servicos/dashboard-servicos')
      ]);
      setDashboardStats(statsResponse.data);
      setDashboardServicos(servicosResponse.data);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientes = async () => {
    try {
      const response = await api.get('/clients?limit=1000');
      setClientes(response.data.clients || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadRecalculos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/trabalhista/servicos/recalculos');
      setRecalculos(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar recalculos:', error);
      toast.error('Erro ao carregar recalculos');
    } finally {
      setLoading(false);
    }
  };

  const loadAdmissoes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/trabalhista/servicos/admissoes');
      setAdmissoes(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar admissões:', error);
      toast.error('Erro ao carregar admissões');
    } finally {
      setLoading(false);
    }
  };

  const loadDemissoes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/trabalhista/servicos/demissoes');
      setDemissoes(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar demissões:', error);
      toast.error('Erro ao carregar demissões');
    } finally {
      setLoading(false);
    }
  };

  // CRUD Recalculo
  const handleCreateRecalculo = async (e) => {
    e.preventDefault();
    try {
      await api.post('/trabalhista/servicos/recalculos', recalculoForm);
      toast.success('Recalculo solicitado com sucesso!');
      setShowRecalculoModal(false);
      resetRecalculoForm();
      loadRecalculos();
      loadDashboard();
    } catch (error) {
      toast.error('Erro ao criar recalculo');
    }
  };

  const handleUpdateRecalculo = async (recalculoId, valorRecalculado, status) => {
    try {
      await api.put(`/trabalhista/servicos/recalculos/${recalculoId}?valor_recalculado=${valorRecalculado}&status=${status}`);
      toast.success('Recalculo atualizado!');
      loadRecalculos();
      loadDashboard();
    } catch (error) {
      toast.error('Erro ao atualizar recalculo');
    }
  };

  // CRUD Admissão
  const handleCreateAdmissao = async (e) => {
    e.preventDefault();
    try {
      await api.post('/trabalhista/servicos/admissoes', admissaoForm);
      toast.success('Admissão registrada com sucesso!');
      setShowAdmissaoModal(false);
      resetAdmissaoForm();
      loadAdmissoes();
      loadDashboard();
    } catch (error) {
      toast.error('Erro ao criar admissão');
    }
  };

  const handleUpdateChecklistAdmissao = async (admissaoId, itemIndex, concluido) => {
    try {
      await api.put(`/trabalhista/servicos/admissoes/${admissaoId}/checklist/${itemIndex}?concluido=${concluido}`);
      toast.success('Checklist atualizado!');
      loadAdmissoes();
    } catch (error) {
      toast.error('Erro ao atualizar checklist');
    }
  };

  // CRUD Demissão
  const handleCreateDemissao = async (e) => {
    e.preventDefault();
    try {
      await api.post('/trabalhista/servicos/demissoes', demissaoForm);
      toast.success('Demissão registrada com sucesso!');
      setShowDemissaoModal(false);
      resetDemissaoForm();
      loadDemissoes();
      loadDashboard();
    } catch (error) {
      toast.error('Erro ao criar demissão');
    }
  };

  const handleCalcularRescisao = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    try {
      const response = await api.put(
        `/trabalhista/servicos/demissoes/${selectedItem.id}/calcular-rescisao`,
        null,
        {
          params: calculoRescisao
        }
      );
      toast.success(`Rescisão calculada: R$ ${response.data.valor_total.toFixed(2)}`);
      setShowCalculoRescisaoModal(false);
      loadDemissoes();
    } catch (error) {
      toast.error('Erro ao calcular rescisão');
    }
  };

  const handleHomologarDemissao = async (demissaoId) => {
    const dataHomologacao = new Date().toISOString();
    try {
      await api.put(`/trabalhista/servicos/demissoes/${demissaoId}/homologar?data_homologacao=${dataHomologacao}`);
      toast.success('Demissão homologada!');
      loadDemissoes();
    } catch (error) {
      toast.error('Erro ao homologar demissão');
    }
  };

  const resetRecalculoForm = () => {
    setRecalculoForm({
      empresa_id: '',
      empresa: '',
      tipo_recalculo: 'rescisao',
      funcionario_nome: '',
      periodo_referencia: getTodayInputDate(),
      valor_original: 0,
      motivo: '',
      responsavel: user?.name || '',
      observacoes: ''
    });
  };

  const resetAdmissaoForm = () => {
    setAdmissaoForm({
      empresa_id: '',
      empresa: '',
      funcionario_nome: '',
      cpf: '',
      data_nascimento: getTodayInputDate(),
      cargo: '',
      salario: 0,
      data_admissao: getTodayInputDate(),
      tipo_contrato: 'clt',
      jornada_trabalho: '44h semanais',
      responsavel: user?.name || '',
      observacoes: ''
    });
  };

  const resetDemissaoForm = () => {
    setDemissaoForm({
      empresa_id: '',
      empresa: '',
      funcionario_id: '',
      funcionario_nome: '',
      data_demissao: getTodayInputDate(),
      tipo_demissao: 'sem_justa_causa',
      aviso_previo: 'trabalhado',
      motivo: '',
      responsavel: user?.name || '',
      observacoes: ''
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pendente': 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
      'em_andamento': 'bg-blue-600/20 text-blue-400 border-blue-600/30',
      'documentacao_pendente': 'bg-orange-600/20 text-orange-400 border-orange-600/30',
      'concluido': 'bg-green-600/20 text-green-400 border-green-600/30',
      'cancelado': 'bg-gray-600/20 text-gray-400 border-gray-600/30',
      'aguardando_homologacao': 'bg-purple-600/20 text-purple-400 border-purple-600/30',
      'homologado': 'bg-green-600/20 text-green-400 border-green-600/30'
    };
    return colors[status] || colors['pendente'];
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  if (!hasAccess([], ['trabalhista'])) {
    return (
      <div className="glass p-8 rounded-2xl text-center">
        <Users className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
        <p className="text-gray-400">Você não tem permissão para acessar este módulo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">👥</span>
            Trabalhista
          </h1>
          <p className="text-gray-400 mt-2">Gestão completa de demandas trabalhistas</p>
        </div>
      </div>

      {/* Dashboard Stats */}
      {activeTab === 'dashboard' && dashboardServicos && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="glass p-6 rounded-xl border border-yellow-600/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm">Recalculos</p>
                <p className="text-3xl font-bold text-yellow-400">
                  {dashboardServicos.recalculos.pendentes}
                </p>
                <p className="text-xs text-gray-500">Pendentes</p>
              </div>
              <Calculator className="w-12 h-12 text-yellow-400 opacity-60" />
            </div>
            <div className="text-sm text-gray-400">
              Em andamento: {dashboardServicos.recalculos.em_andamento}
            </div>
          </div>

          <div className="glass p-6 rounded-xl border border-green-600/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm">Admissões</p>
                <p className="text-3xl font-bold text-green-400">
                  {dashboardServicos.admissoes.pendentes}
                </p>
                <p className="text-xs text-gray-500">Pendentes</p>
              </div>
              <UserPlus className="w-12 h-12 text-green-400 opacity-60" />
            </div>
            <div className="text-sm text-gray-400">
              Em andamento: {dashboardServicos.admissoes.em_andamento}
            </div>
          </div>

          <div className="glass p-6 rounded-xl border border-red-600/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm">Demissões</p>
                <p className="text-3xl font-bold text-red-400">
                  {dashboardServicos.demissoes.pendentes}
                </p>
                <p className="text-xs text-gray-500">Pendentes</p>
              </div>
              <UserMinus className="w-12 h-12 text-red-400 opacity-60" />
            </div>
            <div className="text-sm text-gray-400">
              Aguardando homologação: {dashboardServicos.demissoes.aguardando_homologacao}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="glass rounded-xl p-1 inline-flex flex-wrap">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'dashboard' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
          }`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab('recalculos')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'recalculos' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
          }`}
        >
          🧮 Recalculos
        </button>
        <button
          onClick={() => setActiveTab('admissoes')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'admissoes' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
          }`}
        >
          ➕ Admissões
        </button>
        <button
          onClick={() => setActiveTab('demissoes')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'demissoes' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
          }`}
        >
          ➖ Demissões
        </button>
      </div>

      {/* Content Recalculos */}
      {activeTab === 'recalculos' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowRecalculoModal(true)}
              className="btn-futuristic px-6 py-2 rounded-xl text-white font-semibold flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Recalculo</span>
            </button>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-futuristic w-full">
                <thead>
                  <tr className="border-b border-red-600/30">
                    <th className="text-left p-4 text-gray-300 font-semibold">Número</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Tipo</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Funcionário</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Valor Original</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Valor Recalculado</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center p-8">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-gray-400">Carregando...</span>
                        </div>
                      </td>
                    </tr>
                  ) : recalculos.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center p-8">
                        <div className="text-gray-400">
                          <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Nenhum recalculo encontrado</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recalculos.map((rec) => (
                      <tr key={rec.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                        <td className="p-4 text-white font-mono text-sm">{rec.numero}</td>
                        <td className="p-4 text-white">{rec.empresa}</td>
                        <td className="p-4 text-gray-300 capitalize">{rec.tipo_recalculo.replace('_', ' ')}</td>
                        <td className="p-4 text-gray-300">{rec.funcionario_nome || '-'}</td>
                        <td className="p-4 text-yellow-400 font-semibold">{formatCurrency(rec.valor_original)}</td>
                        <td className="p-4 text-green-400 font-semibold">
                          {rec.valor_recalculado ? formatCurrency(rec.valor_recalculado) : '-'}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(rec.status)}`}>
                            {rec.status.toUpperCase().replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {setSelectedItem(rec); setShowDetailsModal(true);}}
                              className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
                              title="Ver Detalhes"
                            >
                              <Eye className="w-4 h-4 text-blue-400" />
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
      )}

      {/* Content Admissões */}
      {activeTab === 'admissoes' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowAdmissaoModal(true)}
              className="btn-futuristic px-6 py-2 rounded-xl text-white font-semibold flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Admissão</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-3 text-center p-8">
                <div className="flex items-center justify-center space-x-2">
                  <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-400">Carregando...</span>
                </div>
              </div>
            ) : admissoes.length === 0 ? (
              <div className="col-span-3 text-center p-8 glass rounded-xl">
                <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-600 opacity-50" />
                <p className="text-gray-400">Nenhuma admissão encontrada</p>
              </div>
            ) : (
              admissoes.map((adm) => (
                <div key={adm.id} className="glass rounded-xl p-6 border border-green-600/20">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono text-gray-400">{adm.numero}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(adm.status)}`}>
                      {adm.status.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">{adm.funcionario_nome}</h3>
                  <p className="text-gray-400 text-sm mb-1">{adm.empresa}</p>
                  <p className="text-gray-400 text-sm mb-3">{adm.cargo}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Admissão:</span>
                      <span className="text-white">{new Date(adm.data_admissao).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Salário:</span>
                      <span className="text-green-400 font-semibold">{formatCurrency(adm.salario)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Contrato:</span>
                      <span className="text-white uppercase">{adm.tipo_contrato}</span>
                    </div>
                  </div>

                  {/* Checklist simplificado */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-2">Checklist ({adm.checklist.filter(c => c.concluido).length}/{adm.checklist.length})</p>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{width: `${(adm.checklist.filter(c => c.concluido).length / adm.checklist.length) * 100}%`}}
                      ></div>
                    </div>
                  </div>

                  <button
                    onClick={() => {setSelectedItem(adm); setShowDetailsModal(true);}}
                    className="w-full btn-secondary px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Ver Detalhes</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Content Demissões */}
      {activeTab === 'demissoes' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowDemissaoModal(true)}
              className="btn-futuristic px-6 py-2 rounded-xl text-white font-semibold flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Demissão</span>
            </button>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-futuristic w-full">
                <thead>
                  <tr className="border-b border-red-600/30">
                    <th className="text-left p-4 text-gray-300 font-semibold">Número</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Funcionário</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Data Demissão</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Tipo</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Valor Rescisão</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                    <th className="text-left p-4 text-gray-300 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center p-8">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-gray-400">Carregando...</span>
                        </div>
                      </td>
                    </tr>
                  ) : demissoes.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center p-8">
                        <div className="text-gray-400">
                          <UserMinus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Nenhuma demissão encontrada</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    demissoes.map((dem) => (
                      <tr key={dem.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                        <td className="p-4 text-white font-mono text-sm">{dem.numero}</td>
                        <td className="p-4 text-white font-medium">{dem.funcionario_nome}</td>
                        <td className="p-4 text-gray-300">{dem.empresa}</td>
                        <td className="p-4 text-gray-300">{new Date(dem.data_demissao).toLocaleDateString('pt-BR')}</td>
                        <td className="p-4 text-gray-300 capitalize">{dem.tipo_demissao.replace('_', ' ')}</td>
                        <td className="p-4 text-red-400 font-semibold">
                          {dem.valor_rescisao ? formatCurrency(dem.valor_rescisao) : '-'}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(dem.status)}`}>
                            {dem.status.toUpperCase().replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex space-x-2">
                            {dem.status === 'pendente' && (
                              <button
                                onClick={() => {setSelectedItem(dem); setShowCalculoRescisaoModal(true);}}
                                className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
                                title="Calcular Rescisão"
                              >
                                <Calculator className="w-4 h-4 text-blue-400" />
                              </button>
                            )}
                            {dem.status === 'aguardando_homologacao' && (
                              <button
                                onClick={() => handleHomologarDemissao(dem.id)}
                                className="p-2 hover:bg-green-600/20 rounded-lg transition-colors"
                                title="Homologar"
                              >
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              </button>
                            )}
                            <button
                              onClick={() => {setSelectedItem(dem); setShowDetailsModal(true);}}
                              className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
                              title="Ver Detalhes"
                            >
                              <Eye className="w-4 h-4 text-blue-400" />
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
      )}

      {/* Modal Recalculo */}
      {showRecalculoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Calculator className="w-6 h-6 mr-2 text-red-400" />
                Novo Recalculo
              </h2>
              <button onClick={() => setShowRecalculoModal(false)} className="p-2 hover:bg-red-600/20 rounded-lg">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateRecalculo}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Empresa *</label>
                  <select
                    required
                    value={recalculoForm.empresa_id}
                    onChange={(e) => {
                      const cliente = clientes.find(c => c.id === e.target.value);
                      setRecalculoForm({
                        ...recalculoForm,
                        empresa_id: e.target.value,
                        empresa: cliente ? cliente.nome_empresa : ''
                      });
                    }}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Selecione...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome_empresa}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo Recalculo *</label>
                  <select
                    required
                    value={recalculoForm.tipo_recalculo}
                    onChange={(e) => setRecalculoForm({...recalculoForm, tipo_recalculo: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="rescisao">Rescisão</option>
                    <option value="impostos">Impostos</option>
                    <option value="folha">Folha de Pagamento</option>
                    <option value="ferias">Férias</option>
                    <option value="13salario">13º Salário</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Funcionário</label>
                  <input
                    type="text"
                    value={recalculoForm.funcionario_nome}
                    onChange={(e) => setRecalculoForm({...recalculoForm, funcionario_nome: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Período Referência *</label>
                  <input
                    required
                    type="text"
                    value={recalculoForm.periodo_referencia}
                    onChange={(e) => setRecalculoForm({...recalculoForm, periodo_referencia: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    placeholder="Ex: 01/2025"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Valor Original *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={recalculoForm.valor_original}
                    onChange={(e) => setRecalculoForm({...recalculoForm, valor_original: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Motivo *</label>
                  <textarea
                    required
                    value={recalculoForm.motivo}
                    onChange={(e) => setRecalculoForm({...recalculoForm, motivo: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowRecalculoModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2 btn-futuristic rounded-lg text-white font-medium">
                  Criar Recalculo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admissão */}
      {showAdmissaoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <UserPlus className="w-6 h-6 mr-2 text-green-400" />
                Nova Admissão
              </h2>
              <button onClick={() => setShowAdmissaoModal(false)} className="p-2 hover:bg-red-600/20 rounded-lg">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmissao}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Empresa *</label>
                  <select
                    required
                    value={admissaoForm.empresa_id}
                    onChange={(e) => {
                      const cliente = clientes.find(c => c.id === e.target.value);
                      setAdmissaoForm({
                        ...admissaoForm,
                        empresa_id: e.target.value,
                        empresa: cliente ? cliente.nome_empresa : ''
                      });
                    }}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Selecione...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome_empresa}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome Funcionário *</label>
                  <input
                    required
                    type="text"
                    value={admissaoForm.funcionario_nome}
                    onChange={(e) => setAdmissaoForm({...admissaoForm, funcionario_nome: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">CPF *</label>
                  <input
                    required
                    type="text"
                    value={admissaoForm.cpf}
                    onChange={(e) => setAdmissaoForm({...admissaoForm, cpf: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Data Nascimento *</label>
                  <input
                    required
                    type="date"
                    value={admissaoForm.data_nascimento}
                    onChange={(e) => setAdmissaoForm({...admissaoForm, data_nascimento: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cargo *</label>
                  <input
                    required
                    type="text"
                    value={admissaoForm.cargo}
                    onChange={(e) => setAdmissaoForm({...admissaoForm, cargo: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Salário *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={admissaoForm.salario}
                    onChange={(e) => setAdmissaoForm({...admissaoForm, salario: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Data Admissão *</label>
                  <input
                    required
                    type="date"
                    value={admissaoForm.data_admissao}
                    onChange={(e) => setAdmissaoForm({...admissaoForm, data_admissao: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo Contrato *</label>
                  <select
                    required
                    value={admissaoForm.tipo_contrato}
                    onChange={(e) => setAdmissaoForm({...admissaoForm, tipo_contrato: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="clt">CLT</option>
                    <option value="pj">PJ</option>
                    <option value="estagio">Estágio</option>
                    <option value="temporario">Temporário</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Jornada de Trabalho</label>
                  <input
                    type="text"
                    value={admissaoForm.jornada_trabalho}
                    onChange={(e) => setAdmissaoForm({...admissaoForm, jornada_trabalho: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    placeholder="Ex: 44h semanais"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAdmissaoModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2 btn-futuristic rounded-lg text-white font-medium">
                  Criar Admissão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Demissão */}
      {showDemissaoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <UserMinus className="w-6 h-6 mr-2 text-red-400" />
                Nova Demissão
              </h2>
              <button onClick={() => setShowDemissaoModal(false)} className="p-2 hover:bg-red-600/20 rounded-lg">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateDemissao}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Empresa *</label>
                  <select
                    required
                    value={demissaoForm.empresa_id}
                    onChange={(e) => {
                      const cliente = clientes.find(c => c.id === e.target.value);
                      setDemissaoForm({
                        ...demissaoForm,
                        empresa_id: e.target.value,
                        empresa: cliente ? cliente.nome_empresa : ''
                      });
                    }}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Selecione...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome_empresa}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome Funcionário *</label>
                  <input
                    required
                    type="text"
                    value={demissaoForm.funcionario_nome}
                    onChange={(e) => setDemissaoForm({...demissaoForm, funcionario_nome: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Data Demissão *</label>
                  <input
                    required
                    type="date"
                    value={demissaoForm.data_demissao}
                    onChange={(e) => setDemissaoForm({...demissaoForm, data_demissao: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo Demissão *</label>
                  <select
                    required
                    value={demissaoForm.tipo_demissao}
                    onChange={(e) => setDemissaoForm({...demissaoForm, tipo_demissao: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="sem_justa_causa">Sem Justa Causa</option>
                    <option value="justa_causa">Justa Causa</option>
                    <option value="pedido_demissao">Pedido de Demissão</option>
                    <option value="acordo">Acordo</option>
                    <option value="termino_contrato">Término de Contrato</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Aviso Prévio *</label>
                  <select
                    required
                    value={demissaoForm.aviso_previo}
                    onChange={(e) => setDemissaoForm({...demissaoForm, aviso_previo: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="trabalhado">Trabalhado</option>
                    <option value="indenizado">Indenizado</option>
                    <option value="dispensado">Dispensado</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Motivo *</label>
                  <textarea
                    required
                    value={demissaoForm.motivo}
                    onChange={(e) => setDemissaoForm({...demissaoForm, motivo: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowDemissaoModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2 btn-futuristic rounded-lg text-white font-medium">
                  Registrar Demissão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cálculo Rescisão */}
      {showCalculoRescisaoModal && selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Calculator className="w-6 h-6 mr-2 text-blue-400" />
                Calcular Rescisão - {selectedItem.funcionario_nome}
              </h2>
              <button onClick={() => setShowCalculoRescisaoModal(false)} className="p-2 hover:bg-red-600/20 rounded-lg">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCalcularRescisao}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Saldo Salário *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={calculoRescisao.saldo_salario}
                    onChange={(e) => setCalculoRescisao({...calculoRescisao, saldo_salario: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Férias Vencidas</label>
                  <input
                    type="number"
                    step="0.01"
                    value={calculoRescisao.ferias_vencidas}
                    onChange={(e) => setCalculoRescisao({...calculoRescisao, ferias_vencidas: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Férias Proporcionais</label>
                  <input
                    type="number"
                    step="0.01"
                    value={calculoRescisao.ferias_proporcionais}
                    onChange={(e) => setCalculoRescisao({...calculoRescisao, ferias_proporcionais: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">13º Salário</label>
                  <input
                    type="number"
                    step="0.01"
                    value={calculoRescisao.decimo_terceiro}
                    onChange={(e) => setCalculoRescisao({...calculoRescisao, decimo_terceiro: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Multa FGTS (40%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={calculoRescisao.multa_fgts}
                    onChange={(e) => setCalculoRescisao({...calculoRescisao, multa_fgts: parseFloat(e.target.value)})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div className="md:col-span-2 bg-blue-600/10 border border-blue-600/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-medium">Valor Total Estimado:</span>
                    <span className="text-2xl font-bold text-blue-400">
                      {formatCurrency(
                        calculoRescisao.saldo_salario +
                        calculoRescisao.ferias_vencidas +
                        calculoRescisao.ferias_proporcionais +
                        calculoRescisao.decimo_terceiro +
                        calculoRescisao.multa_fgts
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCalculoRescisaoModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2 btn-futuristic rounded-lg text-white font-medium">
                  Calcular e Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrabalhistaExpandido;
