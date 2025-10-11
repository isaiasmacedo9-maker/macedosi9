import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { 
  Calendar, Plus, Clock, User, Phone, Mail, 
  CheckCircle, XCircle, Edit, Trash2, Eye,
  AlertCircle, CalendarDays, Filter, Search, X
} from 'lucide-react';
import { toast } from 'sonner';

const AtendimentoAgendamento = () => {
  const { hasAccess, user } = useAuth();
  const [agendamentos, setAgendamentos] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('list'); // list, calendar
  const [clientes, setClientes] = useState([]);
  const [contadores, setContadores] = useState([]);
  
  const [formData, setFormData] = useState({
    empresa_id: '',
    cliente_nome: '',
    cliente_telefone: '',
    cliente_email: '',
    data_agendamento: new Date().toISOString().split('T')[0],
    hora_inicio: '09:00',
    hora_fim: '10:00',
    duracao_minutos: '60',
    tipo_atendimento: 'presencial',
    motivo_atendimento: '',
    setor_responsavel: 'atendimento',
    contador_id: '',
    observacoes: ''
  });

  const [filters, setFilters] = useState({
    data_inicio: '',
    data_fim: '',
    status: '',
    contador_id: ''
  });

  useEffect(() => {
    if (hasAccess([], ['atendimento'])) {
      loadAgendamentos();
      loadClientes();
      loadContadores();
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'calendar' && selectedDate) {
      loadCalendario(selectedDate);
    }
  }, [viewMode, selectedDate]);

  const loadAgendamentos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.data_inicio) params.append('data_inicio', filters.data_inicio);
      if (filters.data_fim) params.append('data_fim', filters.data_fim);
      if (filters.status) params.append('status', filters.status);
      if (filters.contador_id) params.append('contador_id', filters.contador_id);

      const response = await api.get(`/agendamentos/?${params}`);
      setAgendamentos(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      toast.error('Erro ao carregar agendamentos');
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendario = async (data) => {
    try {
      const response = await api.get(`/agendamentos/calendario?data=${data}`);
      setCalendario(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar calendário:', error);
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

  const loadContadores = async () => {
    try {
      const response = await api.get('/users-management/basic');
      const users = response.data || [];
      // Filtrar apenas contadores (você pode adicionar um campo específico)
      setContadores(users);
    } catch (error) {
      console.error('Erro ao carregar contadores:', error);
    }
  };

  const handleCreateAgendamento = async (e) => {
    e.preventDefault();
    try {
      await api.post('/agendamentos/', formData);
      toast.success('Agendamento criado com sucesso!');
      setShowModal(false);
      resetForm();
      loadAgendamentos();
    } catch (error) {
      toast.error('Erro ao criar agendamento: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const handleCancelar = async (id) => {
    if (!window.confirm('Deseja realmente cancelar este agendamento?')) return;
    
    try {
      await api.put(`/agendamentos/${id}`, { status: 'cancelado' });
      toast.success('Agendamento cancelado!');
      loadAgendamentos();
    } catch (error) {
      toast.error('Erro ao cancelar agendamento');
    }
  };

  const resetForm = () => {
    setFormData({
      empresa_id: '',
      cliente_nome: '',
      cliente_telefone: '',
      cliente_email: '',
      data_agendamento: new Date().toISOString().split('T')[0],
      hora_inicio: '09:00',
      hora_fim: '10:00',
      duracao_minutos: '60',
      tipo_atendimento: 'presencial',
      motivo_atendimento: '',
      setor_responsavel: 'atendimento',
      contador_id: '',
      observacoes: ''
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pendente': 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
      'confirmado': 'bg-green-600/20 text-green-400 border-green-600/30',
      'recusado': 'bg-red-600/20 text-red-400 border-red-600/30',
      'cancelado': 'bg-gray-600/20 text-gray-400 border-gray-600/30',
      'concluido': 'bg-blue-600/20 text-blue-400 border-blue-600/30'
    };
    return colors[status] || colors['pendente'];
  };

  const horariosDisponiveis = [];
  for (let h = 8; h <= 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hora = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      horariosDisponiveis.push(hora);
    }
  }

  if (!hasAccess([], ['atendimento'])) {
    return (
      <div className="glass p-8 rounded-2xl text-center">
        <Calendar className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-50" />
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
            <span className="mr-3">📅</span>
            Agendamentos
          </h1>
          <p className="text-gray-400 mt-2">Gestão de agendamentos de atendimento</p>
        </div>
        <div className="flex space-x-3">
          <div className="glass rounded-lg p-1 inline-flex">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'list' ? 'bg-red-600 text-white' : 'text-gray-400'
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'calendar' ? 'bg-red-600 text-white' : 'text-gray-400'
              }`}
            >
              Calendário
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-futuristic px-6 py-2 rounded-xl text-white font-semibold flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Data Início</label>
            <input
              type="date"
              value={filters.data_inicio}
              onChange={(e) => setFilters({...filters, data_inicio: e.target.value})}
              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Data Fim</label>
            <input
              type="date"
              value={filters.data_fim}
              onChange={(e) => setFilters({...filters, data_fim: e.target.value})}
              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="confirmado">Confirmado</option>
              <option value="recusado">Recusado</option>
              <option value="cancelado">Cancelado</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadAgendamentos}
              className="w-full btn-futuristic px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
            >
              <Search className="w-4 h-4" />
              <span>Buscar</span>
            </button>
          </div>
        </div>
      </div>

      {/* View: Lista */}
      {viewMode === 'list' && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-futuristic w-full">
              <thead>
                <tr className="border-b border-red-600/30">
                  <th className="text-left p-4 text-gray-300 font-semibold">Número</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Data</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Horário</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Cliente</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Contador</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Tipo</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                  <th className="text-left p-4 text-gray-300 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center p-8">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-gray-400">Carregando...</span>
                      </div>
                    </td>
                  </tr>
                ) : agendamentos.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center p-8">
                      <div className="text-gray-400">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Nenhum agendamento encontrado</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  agendamentos.map((agd) => (
                    <tr key={agd.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                      <td className="p-4 text-white font-mono text-sm">{agd.numero}</td>
                      <td className="p-4 text-white">
                        {new Date(agd.data_agendamento).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4 text-gray-300 font-medium">
                        {agd.hora_inicio} - {agd.hora_fim}
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{agd.cliente_nome}</p>
                          {agd.cliente_telefone && (
                            <p className="text-xs text-gray-400">{agd.cliente_telefone}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-gray-300">{agd.empresa_nome}</td>
                      <td className="p-4 text-gray-300">{agd.contador_nome || '-'}</td>
                      <td className="p-4 text-gray-300 capitalize">{agd.tipo_atendimento}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(agd.status)}`}>
                          {agd.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex space-x-2">
                          {agd.status === 'pendente' && (
                            <button
                              onClick={() => handleCancelar(agd.id)}
                              className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
                              title="Cancelar"
                            >
                              <XCircle className="w-4 h-4 text-red-400" />
                            </button>
                          )}
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

      {/* View: Calendário */}
      {viewMode === 'calendar' && (
        <div className="glass rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Calendário de Atendimentos</h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            {horariosDisponiveis.map((hora) => {
              const agendamentosHora = calendario.filter(
                (agd) => agd.hora_inicio === hora
              );
              
              return (
                <div key={hora} className="flex border-b border-gray-800/50">
                  <div className="w-20 p-3 text-gray-400 font-medium text-sm">
                    {hora}
                  </div>
                  <div className="flex-1 p-2">
                    {agendamentosHora.length > 0 ? (
                      <div className="space-y-2">
                        {agendamentosHora.map((agd) => (
                          <div
                            key={agd.id}
                            className={`p-3 rounded-lg border ${getStatusColor(agd.status)}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold">{agd.cliente_nome}</p>
                                <p className="text-sm">{agd.empresa_nome}</p>
                                <p className="text-xs">Contador: {agd.contador_nome || 'Não atribuído'}</p>
                              </div>
                              <span className="text-xs font-bold uppercase">{agd.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-600 text-sm py-2">Disponível</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Criar Agendamento */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Calendar className="w-6 h-6 mr-2 text-red-400" />
                Novo Agendamento
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleCreateAgendamento}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Empresa *</label>
                  <select
                    required
                    value={formData.empresa_id}
                    onChange={(e) => {
                      const cliente = clientes.find(c => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        empresa_id: e.target.value
                      });
                    }}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Selecione...</option>
                    {clientes.map(cliente => (
                      <option key={cliente.id} value={cliente.id}>{cliente.nome_empresa}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Cliente *</label>
                  <input
                    required
                    type="text"
                    value={formData.cliente_nome}
                    onChange={(e) => setFormData({...formData, cliente_nome: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Telefone</label>
                  <input
                    type="tel"
                    value={formData.cliente_telefone}
                    onChange={(e) => setFormData({...formData, cliente_telefone: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">E-mail</label>
                  <input
                    type="email"
                    value={formData.cliente_email}
                    onChange={(e) => setFormData({...formData, cliente_email: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Data *</label>
                  <input
                    required
                    type="date"
                    value={formData.data_agendamento}
                    onChange={(e) => setFormData({...formData, data_agendamento: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Hora Início *</label>
                  <select
                    required
                    value={formData.hora_inicio}
                    onChange={(e) => setFormData({...formData, hora_inicio: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    {horariosDisponiveis.map(hora => (
                      <option key={hora} value={hora}>{hora}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Hora Fim *</label>
                  <select
                    required
                    value={formData.hora_fim}
                    onChange={(e) => setFormData({...formData, hora_fim: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    {horariosDisponiveis.map(hora => (
                      <option key={hora} value={hora}>{hora}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo Atendimento *</label>
                  <select
                    required
                    value={formData.tipo_atendimento}
                    onChange={(e) => setFormData({...formData, tipo_atendimento: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="online">Online</option>
                    <option value="telefone">Telefone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Contador</label>
                  <select
                    value={formData.contador_id}
                    onChange={(e) => setFormData({...formData, contador_id: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">A definir</option>
                    {contadores.map(contador => (
                      <option key={contador.id} value={contador.id}>{contador.name}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Motivo do Atendimento *</label>
                  <textarea
                    required
                    value={formData.motivo_atendimento}
                    onChange={(e) => setFormData({...formData, motivo_atendimento: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    rows="3"
                    placeholder="Descreva o motivo do atendimento..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Observações</label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    rows="2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 btn-futuristic rounded-lg text-white font-medium"
                >
                  Criar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtendimentoAgendamento;
