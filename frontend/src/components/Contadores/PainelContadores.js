import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { 
  Users, CheckCircle, XCircle, Clock, Calendar,
  Phone, Mail, AlertCircle, FileText, Bell, Eye, Filter
} from 'lucide-react';
import { toast } from 'sonner';

const PainelContadores = () => {
  const { user } = useAuth();
  const [agendamentosPendentes, setAgendamentosPendentes] = useState([]);
  const [agendamentosConfirmados, setAgendamentosConfirmados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pendentes'); // pendentes, confirmados, todos
  const [selectedAgendamento, setSelectedAgendamento] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRecusaModal, setShowRecusaModal] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');

  useEffect(() => {
    loadAgendamentos();
    
    // Atualizar a cada 2 minutos
    const interval = setInterval(() => {
      loadAgendamentos();
    }, 120000);
    
    return () => clearInterval(interval);
  }, []);

  const loadAgendamentos = async () => {
    try {
      setLoading(true);
      
      // Carregar agendamentos pendentes (atribuídos ao contador logado ou sem contador)
      const responsePendentes = await api.get('/agendamentos/', {
        params: {
          status: 'pendente',
          contador_id: user.id
        }
      });
      setAgendamentosPendentes(responsePendentes.data || []);
      
      // Carregar agendamentos confirmados
      const responseConfirmados = await api.get('/agendamentos/', {
        params: {
          status: 'confirmado',
          contador_id: user.id
        }
      });
      setAgendamentosConfirmados(responseConfirmados.data || []);
      
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async (agendamentoId) => {
    try {
      await api.post(`/agendamentos/${agendamentoId}/confirmar`);
      toast.success('Agendamento confirmado!');
      loadAgendamentos();
    } catch (error) {
      toast.error('Erro ao confirmar agendamento: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const handleRecusar = async () => {
    if (!selectedAgendamento || !motivoRecusa.trim()) {
      toast.error('Por favor, informe o motivo da recusa');
      return;
    }

    try {
      await api.post(`/agendamentos/${selectedAgendamento.id}/recusar`, {
        motivo_recusa: motivoRecusa
      });
      toast.success('Agendamento recusado');
      setShowRecusaModal(false);
      setSelectedAgendamento(null);
      setMotivoRecusa('');
      loadAgendamentos();
    } catch (error) {
      toast.error('Erro ao recusar agendamento: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const openRecusaModal = (agendamento) => {
    setSelectedAgendamento(agendamento);
    setShowRecusaModal(true);
  };

  const openDetailsModal = (agendamento) => {
    setSelectedAgendamento(agendamento);
    setShowDetailsModal(true);
  };

  const getUrgencyColor = (dataAgendamento) => {
    const hoje = new Date();
    const agendamento = new Date(dataAgendamento);
    const diffDays = Math.ceil((agendamento - hoje) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) return 'border-red-600 bg-red-600/10';
    if (diffDays <= 3) return 'border-orange-600 bg-orange-600/10';
    return 'border-gray-600 bg-gray-600/10';
  };

  const agendamentosExibir = activeTab === 'pendentes' 
    ? agendamentosPendentes 
    : activeTab === 'confirmados' 
    ? agendamentosConfirmados 
    : [...agendamentosPendentes, ...agendamentosConfirmados];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">👨‍💼</span>
            Painel do Contador
          </h1>
          <p className="text-gray-400 mt-2">Gerencie seus agendamentos de atendimento</p>
        </div>
        <button
          onClick={loadAgendamentos}
          className="btn-secondary px-4 py-2 rounded-xl flex items-center space-x-2"
        >
          <Clock className="w-4 h-4 animate-spin" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass rounded-xl p-6 border border-yellow-600/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Aguardando Confirmação</p>
              <p className="text-3xl font-bold text-yellow-400 mt-2">
                {agendamentosPendentes.length}
              </p>
            </div>
            <Bell className="w-10 h-10 text-yellow-400 opacity-60 animate-pulse" />
          </div>
        </div>

        <div className="glass rounded-xl p-6 border border-green-600/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Confirmados</p>
              <p className="text-3xl font-bold text-green-400 mt-2">
                {agendamentosConfirmados.length}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-400 opacity-60" />
          </div>
        </div>

        <div className="glass rounded-xl p-6 border border-blue-600/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Próximo Atendimento</p>
              <p className="text-lg font-bold text-blue-400 mt-2">
                {agendamentosConfirmados.length > 0 
                  ? new Date(agendamentosConfirmados[0]?.data_agendamento).toLocaleDateString('pt-BR')
                  : 'Nenhum'
                }
              </p>
            </div>
            <Calendar className="w-10 h-10 text-blue-400 opacity-60" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass rounded-xl p-1 inline-flex">
        <button
          onClick={() => setActiveTab('pendentes')}
          className={`px-6 py-3 rounded-lg font-medium transition-all relative ${
            activeTab === 'pendentes'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          ⏳ Pendentes
          {agendamentosPendentes.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {agendamentosPendentes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('confirmados')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'confirmados'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          ✅ Confirmados
        </button>
        <button
          onClick={() => setActiveTab('todos')}
          className={`px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'todos'
              ? 'bg-red-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📋 Todos
        </button>
      </div>

      {/* Agendamentos List */}
      <div className="space-y-4">
        {loading ? (
          <div className="glass rounded-xl p-8 text-center">
            <div className="flex items-center justify-center space-x-2">
              <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-400">Carregando...</span>
            </div>
          </div>
        ) : agendamentosExibir.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-50" />
            <p className="text-gray-400">Nenhum agendamento encontrado</p>
          </div>
        ) : (
          agendamentosExibir.map((agd) => (
            <div
              key={agd.id}
              className={`glass rounded-xl p-6 border-l-4 ${getUrgencyColor(agd.data_agendamento)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-xs font-mono text-gray-400">{agd.numero}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      agd.status === 'pendente' 
                        ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
                        : 'bg-green-600/20 text-green-400 border border-green-600/30'
                    }`}>
                      {agd.status === 'pendente' ? 'AGUARDANDO CONFIRMAÇÃO' : 'CONFIRMADO'}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">{agd.cliente_nome}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center space-x-2 text-gray-300">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span>{new Date(agd.data_agendamento).toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-gray-300">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="font-bold">{agd.hora_inicio} - {agd.hora_fim}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-gray-300">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span>{agd.empresa_nome}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-gray-300">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="capitalize">{agd.tipo_atendimento}</span>
                    </div>

                    {agd.cliente_telefone && (
                      <div className="flex items-center space-x-2 text-gray-300">
                        <Phone className="w-4 h-4 text-blue-400" />
                        <span>{agd.cliente_telefone}</span>
                      </div>
                    )}

                    {agd.cliente_email && (
                      <div className="flex items-center space-x-2 text-gray-300">
                        <Mail className="w-4 h-4 text-blue-400" />
                        <span>{agd.cliente_email}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-black/20 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-400 mb-1">Motivo do Atendimento:</p>
                    <p className="text-white">{agd.motivo_atendimento}</p>
                  </div>

                  {agd.observacoes && (
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-sm text-gray-400 mb-1">Observações:</p>
                      <p className="text-white text-sm">{agd.observacoes}</p>
                    </div>
                  )}
                </div>

                <div className="ml-4 flex flex-col space-y-2">
                  <button
                    onClick={() => openDetailsModal(agd)}
                    className="p-3 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg transition-colors"
                    title="Ver Detalhes"
                  >
                    <Eye className="w-5 h-5 text-blue-400" />
                  </button>
                  
                  {agd.status === 'pendente' && (
                    <>
                      <button
                        onClick={() => handleConfirmar(agd.id)}
                        className="p-3 bg-green-600/20 hover:bg-green-600/30 rounded-lg transition-colors"
                        title="Confirmar"
                      >
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      </button>
                      
                      <button
                        onClick={() => openRecusaModal(agd)}
                        className="p-3 bg-red-600/20 hover:bg-red-600/30 rounded-lg transition-colors"
                        title="Recusar"
                      >
                        <XCircle className="w-5 h-5 text-red-400" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Recusa */}
      {showRecusaModal && selectedAgendamento && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-400 mr-3" />
              <h2 className="text-2xl font-bold text-white">Recusar Agendamento</h2>
            </div>

            <div className="mb-4 p-4 bg-red-600/10 border border-red-600/30 rounded-lg">
              <p className="text-white font-bold">{selectedAgendamento.cliente_nome}</p>
              <p className="text-sm text-gray-400">
                {new Date(selectedAgendamento.data_agendamento).toLocaleDateString('pt-BR')} às {selectedAgendamento.hora_inicio}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Motivo da Recusa *
              </label>
              <textarea
                required
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                rows="4"
                placeholder="Explique o motivo da recusa..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRecusaModal(false);
                  setSelectedAgendamento(null);
                  setMotivoRecusa('');
                }}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRecusar}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors"
              >
                Confirmar Recusa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {showDetailsModal && selectedAgendamento && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Detalhes do Agendamento</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedAgendamento(null);
                }}
                className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Número</p>
                  <p className="text-white font-mono">{selectedAgendamento.numero}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <p className="text-white font-bold uppercase">{selectedAgendamento.status}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400">Cliente</p>
                <p className="text-white font-bold text-lg">{selectedAgendamento.cliente_nome}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Empresa</p>
                <p className="text-white">{selectedAgendamento.empresa_nome}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Data</p>
                  <p className="text-white">
                    {new Date(selectedAgendamento.data_agendamento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Horário</p>
                  <p className="text-white font-bold">
                    {selectedAgendamento.hora_inicio} - {selectedAgendamento.hora_fim}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400">Tipo de Atendimento</p>
                <p className="text-white capitalize">{selectedAgendamento.tipo_atendimento}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Motivo</p>
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-white">{selectedAgendamento.motivo_atendimento}</p>
                </div>
              </div>

              {selectedAgendamento.observacoes && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Observações</p>
                  <div className="bg-black/30 rounded-lg p-3">
                    <p className="text-white">{selectedAgendamento.observacoes}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedAgendamento.cliente_telefone && (
                  <div>
                    <p className="text-sm text-gray-400">Telefone</p>
                    <p className="text-white">{selectedAgendamento.cliente_telefone}</p>
                  </div>
                )}
                {selectedAgendamento.cliente_email && (
                  <div>
                    <p className="text-sm text-gray-400">E-mail</p>
                    <p className="text-white">{selectedAgendamento.cliente_email}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PainelContadores;
