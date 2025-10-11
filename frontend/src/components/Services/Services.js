import React, { useState, useEffect } from 'react';
import { Plus, Filter, Send, MessageSquare, Clock, AlertCircle, CheckCircle, User, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Services = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedServico, setSelectedServico] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    setor: '',
    cidade: ''
  });

  const [formData, setFormData] = useState({
    empresa_id: '',
    tipo_servico: '',
    setor: '',
    cidade: '',
    titulo: '',
    descricao: '',
    prioridade: 'media',
    responsavel_id: '',
    data_prazo: '',
    observacoes: ''
  });

  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    loadDashboard();
    loadServicos();
    loadClientes();
    loadUsuarios();
  }, [filters]);

  const loadDashboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/services/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setDashboard(data);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    }
  };

  const loadServicos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.setor) params.append('setor', filters.setor);
      if (filters.cidade) params.append('cidade', filters.cidade);

      const response = await fetch(`${API_URL}/api/services/?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setServicos(data);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/clients?limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setClientes(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadUsuarios = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users-management/basic`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsuarios(data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = selectedServico 
        ? `${API_URL}/api/services/${selectedServico.id}`
        : `${API_URL}/api/services/`;
      
      const method = selectedServico ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadServicos();
        await loadDashboard();
        resetForm();
        alert(selectedServico ? 'Serviço atualizado!' : 'Serviço criado!');
      } else {
        const error = await response.json();
        alert(error.detail || 'Erro ao salvar serviço');
      }
    } catch (error) {
      console.error('Erro ao salvar serviço:', error);
      alert('Erro ao salvar serviço');
    }
  };

  const handleEdit = (servico) => {
    setSelectedServico(servico);
    setFormData({
      empresa_id: servico.empresa_id,
      tipo_servico: servico.tipo_servico,
      setor: servico.setor,
      cidade: servico.cidade,
      titulo: servico.titulo,
      descricao: servico.descricao,
      prioridade: servico.prioridade,
      responsavel_id: servico.responsavel_id || '',
      data_prazo: servico.data_prazo || '',
      observacoes: servico.observacoes || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      empresa_id: '',
      tipo_servico: '',
      setor: '',
      cidade: '',
      titulo: '',
      descricao: '',
      prioridade: 'media',
      responsavel_id: '',
      data_prazo: '',
      observacoes: ''
    });
    setSelectedServico(null);
    setShowForm(false);
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pendente': 'bg-yellow-900/50 text-yellow-300',
      'em_andamento': 'bg-blue-900/50 text-blue-300',
      'aguardando_cliente': 'bg-purple-900/50 text-purple-300',
      'concluido': 'bg-green-900/50 text-green-300',
      'cancelado': 'bg-gray-900/50 text-gray-300'
    };
    const labels = {
      'pendente': 'Pendente',
      'em_andamento': 'Em Andamento',
      'aguardando_cliente': 'Aguardando Cliente',
      'concluido': 'Concluído',
      'cancelado': 'Cancelado'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded ${badges[status] || badges.pendente}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPrioridadeBadge = (prioridade) => {
    const badges = {
      'baixa': 'bg-gray-900/50 text-gray-300',
      'media': 'bg-blue-900/50 text-blue-300',
      'alta': 'bg-orange-900/50 text-orange-300',
      'urgente': 'bg-red-900/50 text-red-300'
    };
    const labels = {
      'baixa': 'Baixa',
      'media': 'Média',
      'alta': 'Alta',
      'urgente': 'Urgente'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded ${badges[prioridade] || badges.media}`}>
        {labels[prioridade] || prioridade}
      </span>
    );
  };

  const tiposServico = ['IRPF', 'IRPJ', 'MEI', 'ITR', 'Consultoria', 'Auditoria', 'Contábil', 'Trabalhista', 'Fiscal', 'Outros'];
  const setores = ['Atendimento', 'Contadores', 'Comercial', 'Fiscal', 'Financeiro', 'Trabalhista'];
  const cidades = ['Jacobina', 'Ourolândia', 'Umburanas', 'Uberlândia'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>📋</span>
            Serviços
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestão de serviços e tarefas</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          Novo Serviço
        </button>
      </div>

      {/* Dashboard Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 p-6 rounded-lg border border-blue-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-300 text-sm">Novas Tarefas</span>
              <Clock size={20} className="text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">{dashboard.novas_tarefas}</p>
            <p className="text-xs text-blue-300 mt-1">Últimos 7 dias</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 p-6 rounded-lg border border-yellow-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-yellow-300 text-sm">Minhas Pendentes</span>
              <User size={20} className="text-yellow-400" />
            </div>
            <p className="text-3xl font-bold text-white">{dashboard.minhas_pendentes}</p>
            <p className="text-xs text-yellow-300 mt-1">Atribuídas a mim</p>
          </div>

          <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 p-6 rounded-lg border border-red-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-300 text-sm">Atrasadas</span>
              <AlertCircle size={20} className="text-red-400" />
            </div>
            <p className="text-3xl font-bold text-white">{dashboard.atrasadas}</p>
            <p className="text-xs text-red-300 mt-1">Prazo vencido</p>
          </div>

          <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 p-6 rounded-lg border border-green-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-300 text-sm">Concluídas</span>
              <CheckCircle size={20} className="text-green-400" />
            </div>
            <p className="text-3xl font-bold text-white">{dashboard.por_status?.concluido || 0}</p>
            <p className="text-xs text-green-300 mt-1">Finalizadas</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} className="text-gray-400" />
          <span className="text-white font-medium">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="bg-gray-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
          >
            <option value="">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="aguardando_cliente">Aguardando Cliente</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <select
            value={filters.setor}
            onChange={(e) => setFilters({ ...filters, setor: e.target.value })}
            className="bg-gray-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
          >
            <option value="">Todos os Setores</option>
            {setores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={filters.cidade}
            onChange={(e) => setFilters({ ...filters, cidade: e.target.value })}
            className="bg-gray-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
          >
            <option value="">Todas as Cidades</option>
            {cidades.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Lista de Serviços */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : servicos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum serviço encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Número</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Título</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Empresa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Prioridade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Responsável</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Prazo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {servicos.map(servico => (
                  <tr key={servico.id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-blue-400 font-mono text-sm">{servico.numero}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{servico.titulo}</p>
                      <p className="text-xs text-gray-400">{servico.setor}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm">{servico.empresa_nome}</p>
                      <p className="text-xs text-gray-400">{servico.cidade}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-300 text-sm">{servico.tipo_servico}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(servico.status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getPrioridadeBadge(servico.prioridade)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm">{servico.responsavel_nome || '-'}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {servico.data_prazo ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar size={14} className="text-gray-400" />
                          <span className="text-white">{new Date(servico.data_prazo).toLocaleDateString('pt-BR')}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleEdit(servico)}
                        className="text-blue-400 hover:text-blue-300 mr-2"
                        title="Editar"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">
              {selectedServico ? 'Editar Serviço' : 'Novo Serviço'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Empresa *</label>
                  <select
                    value={formData.empresa_id}
                    onChange={(e) => setFormData({ ...formData, empresa_id: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    required
                    disabled={selectedServico}
                  >
                    <option value="">Selecione...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome_empresa}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Serviço *</label>
                  <select
                    value={formData.tipo_servico}
                    onChange={(e) => setFormData({ ...formData, tipo_servico: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  >
                    <option value="">Selecione...</option>
                    {tiposServico.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Setor *</label>
                  <select
                    value={formData.setor}
                    onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  >
                    <option value="">Selecione...</option>
                    {setores.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cidade *</label>
                  <select
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  >
                    <option value="">Selecione...</option>
                    {cidades.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Título *</label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição *</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prioridade</label>
                  <select
                    value={formData.prioridade}
                    onChange={(e) => setFormData({ ...formData, prioridade: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Responsável</label>
                  <select
                    value={formData.responsavel_id}
                    onChange={(e) => setFormData({ ...formData, responsavel_id: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="">Não atribuído</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prazo</label>
                  <input
                    type="date"
                    value={formData.data_prazo}
                    onChange={(e) => setFormData({ ...formData, data_prazo: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>

              {selectedServico && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <select
                    value={formData.status || selectedServico.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="aguardando_cliente">Aguardando Cliente</option>
                    <option value="concluido">Concluído</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors"
                >
                  {selectedServico ? 'Atualizar' : 'Criar'} Serviço
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
