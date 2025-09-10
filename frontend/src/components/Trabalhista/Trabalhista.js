import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { 
  FileText, Plus, Users, Filter, Calendar, CheckCircle, 
  Clock, AlertTriangle, User, Building, Eye, Edit, 
  Trash2, UserPlus, UserMinus, FileCheck, Download,
  BarChart3, TrendingUp, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const Trabalhista = () => {
  const { hasAccess, user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [obrigacoes, setObrigacoes] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('solicitacoes');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState({
    tipo: '',
    status: '',
    responsavel: '',
    search: '',
    data_inicio: '',
    data_fim: ''
  });

  useEffect(() => {
    if (hasAccess([], ['trabalhista'])) {
      loadData();
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'solicitacoes') {
        await loadSolicitacoes();
      } else if (activeTab === 'funcionarios') {
        await loadFuncionarios();
      } else if (activeTab === 'obrigacoes') {
        await loadObrigacoes();
      }
      
      await loadDashboardStats();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSolicitacoes = async () => {
    try {
      const response = await api.get('/trabalhista/solicitacoes', {
        params: filters
      });
      setSolicitacoes(response.data || []);
    } catch (error) {
      console.error('Error loading solicitacoes:', error);
      toast.error('Erro ao carregar solicitações');
      setSolicitacoes([]);
    }
  };

  const loadFuncionarios = async () => {
    try {
      const response = await api.get('/trabalhista/funcionarios');
      setFuncionarios(response.data || []);
    } catch (error) {
      console.error('Error loading funcionarios:', error);
      toast.error('Erro ao carregar funcionários');
      setFuncionarios([]);
    }
  };

  const loadObrigacoes = async () => {
    try {
      const response = await api.get('/trabalhista/obrigacoes');
      setObrigacoes(response.data || []);
    } catch (error) {
      console.error('Error loading obrigacoes:', error);
      toast.error('Erro ao carregar obrigações');
      setObrigacoes([]);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const response = await api.get('/trabalhista/dashboard-stats');
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const handleSearch = () => {
    loadData();
  };

  const handleCreateSolicitacao = async (formData) => {
    try {
      await api.post('/trabalhista/solicitacoes', formData);
      toast.success('Solicitação criada com sucesso!');
      setShowCreateModal(false);
      loadData();
    } catch (error) {
      toast.error('Erro ao criar solicitação: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const handleUpdateStatus = async (solicitacaoId, novoStatus) => {
    try {
      await api.put(`/trabalhista/solicitacoes/${solicitacaoId}`, {
        status: novoStatus
      });
      toast.success('Status atualizado com sucesso!');
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  // Computed values
  const statusColors = {
    'pendente': 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
    'em_andamento': 'bg-blue-600/20 text-blue-400 border-blue-600/30',
    'concluido': 'bg-green-600/20 text-green-400 border-green-600/30',
    'atrasado': 'bg-red-600/20 text-red-400 border-red-600/30',
    'cancelado': 'bg-gray-600/20 text-gray-400 border-gray-600/30',
    'aguardando_documentos': 'bg-purple-600/20 text-purple-400 border-purple-600/30'
  };

  const tipoIcons = {
    'admissao': <UserPlus className="w-4 h-4" />,
    'demissao': <UserMinus className="w-4 h-4" />,
    'folha': <FileCheck className="w-4 h-4" />,
    'afastamento': <Clock className="w-4 h-4" />,
    'reclamacao': <AlertTriangle className="w-4 h-4" />,
    'ferias': <Calendar className="w-4 h-4" />
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
      {/* Dashboard Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Solicitações Pendentes</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {dashboardStats.solicitacoes_por_status?.pendente || 0}
                </p>
                <p className="text-xs text-gray-500">Aguardando processamento</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Em Andamento</p>
                <p className="text-2xl font-bold text-blue-400">
                  {dashboardStats.solicitacoes_por_status?.em_andamento || 0}
                </p>
                <p className="text-xs text-gray-500">Sendo processadas</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Funcionários Ativos</p>
                <p className="text-2xl font-bold text-green-400">
                  {dashboardStats.funcionarios_ativos || 0}
                </p>
                <p className="text-xs text-gray-500">De {dashboardStats.funcionarios_total || 0} total</p>
              </div>
              <Users className="w-8 h-8 text-green-400 opacity-60" />
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Obrigações Vencendo</p>
                <p className="text-2xl font-bold text-red-400">
                  {dashboardStats.obrigacoes_vencendo || 0}
                </p>
                <p className="text-xs text-gray-500">Próximos 30 dias</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400 opacity-60" />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">👥</span>
            Módulo Trabalhista
          </h1>
          <p className="text-gray-400 mt-2">Gestão completa de demandas trabalhistas e funcionários</p>
        </div>
        <div className="flex space-x-3">
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
            <span>Nova Solicitação</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass rounded-xl p-1">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('solicitacoes')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'solicitacoes' 
                ? 'bg-red-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Solicitações</span>
          </button>
          <button
            onClick={() => setActiveTab('funcionarios')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'funcionarios' 
                ? 'bg-red-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Funcionários</span>
          </button>
          <button
            onClick={() => setActiveTab('obrigacoes')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'obrigacoes' 
                ? 'bg-red-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Obrigações</span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Buscar</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="Empresa, descrição..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Tipo</label>
              <select
                value={filters.tipo}
                onChange={(e) => setFilters({...filters, tipo: e.target.value})}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
              >
                <option value="">Todos</option>
                <option value="admissao">Admissão</option>
                <option value="demissao">Demissão</option>
                <option value="folha">Folha</option>
                <option value="afastamento">Afastamento</option>
                <option value="reclamacao">Reclamação</option>
                <option value="ferias">Férias</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
              >
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Responsável</label>
              <input
                type="text"
                value={filters.responsavel}
                onChange={(e) => setFilters({...filters, responsavel: e.target.value})}
                className="input-futuristic w-full px-3 py-2 rounded-lg"
                placeholder="Nome do responsável"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setFilters({tipo: '', status: '', responsavel: '', search: '', data_inicio: '', data_fim: ''})}
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

      {/* Content based on active tab */}
      {activeTab === 'solicitacoes' && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-futuristic w-full">
              <thead>
                <tr className="border-b border-red-600/30">
                  <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Tipo</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Título</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Responsável</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Prazo</th>
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
                ) : solicitacoes.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8">
                      <div className="text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Nenhuma solicitação encontrada</p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="btn-futuristic px-4 py-2 rounded-lg mt-3"
                        >
                          Criar primeira solicitação
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  solicitacoes.map((solicitacao) => (
                    <tr key={solicitacao.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{solicitacao.empresa}</p>
                          <p className="text-xs text-gray-400">{solicitacao.empresa_id}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          {tipoIcons[solicitacao.tipo] || <FileText className="w-4 h-4" />}
                          <span className="text-gray-300 capitalize">{solicitacao.tipo?.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{solicitacao.titulo}</p>
                          <p className="text-xs text-gray-400 truncate max-w-xs">{solicitacao.descricao}</p>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300">{solicitacao.responsavel}</td>
                      <td className="p-4">
                        <div>
                          <p className="text-white">{new Date(solicitacao.prazo).toLocaleDateString('pt-BR')}</p>
                          {new Date(solicitacao.prazo) < new Date() && solicitacao.status !== 'concluido' && (
                            <p className="text-xs text-red-400">Atrasado</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[solicitacao.status] || statusColors['pendente']}`}>
                          {solicitacao.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUpdateStatus(solicitacao.id, 'em_andamento')}
                            className="btn-secondary p-2 rounded-lg hover:bg-blue-600/20"
                            title="Iniciar"
                            disabled={solicitacao.status === 'concluido'}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(solicitacao.id, 'concluido')}
                            className="btn-success p-2 rounded-lg hover:bg-green-600/20"
                            title="Concluir"
                            disabled={solicitacao.status === 'concluido'}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            className="btn-secondary p-2 rounded-lg hover:bg-gray-600/20"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-4 h-4" />
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
      )}

      {/* Funcionários Tab */}
      {activeTab === 'funcionarios' && (
        <div className="glass rounded-2xl p-6">
          <div className="text-center text-gray-400">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Módulo Funcionários</h3>
            <p>Gestão de funcionários em desenvolvimento</p>
            <p className="text-sm mt-2">Total de funcionários: {funcionarios.length}</p>
          </div>
        </div>
      )}

      {/* Obrigações Tab */}
      {activeTab === 'obrigacoes' && (
        <div className="glass rounded-2xl p-6">
          <div className="text-center text-gray-400">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Obrigações Trabalhistas</h3>
            <p>Calendário de obrigações em desenvolvimento</p>
            <p className="text-sm mt-2">Obrigações cadastradas: {obrigacoes.length}</p>
          </div>
        </div>
      )}

      {/* Modals would go here */}
      {/* CreateSolicitacaoModal, etc. */}
      
    </div>
  );
};

export default Trabalhista;