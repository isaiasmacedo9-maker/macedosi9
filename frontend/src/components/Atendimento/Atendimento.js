import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { Headphones, Plus, Phone } from 'lucide-react';

const Atendimento = () => {
  const { hasAccess } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasAccess([], ['atendimento'])) {
      loadTickets();
    }
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/atendimento');
      setTickets(response.data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess([], ['atendimento'])) {
    return (
      <div className="glass p-8 rounded-2xl text-center">
        <Phone className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
        <p className="text-gray-400">Você não tem permissão para acessar este módulo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">📞</span>
            Atendimento
          </h1>
          <p className="text-gray-400 mt-2">Central de atendimento ao cliente</p>
        </div>
        <button
          onClick={() => window.alert('Abertura de novo ticket sera disponibilizada nesta tela.')}
          className="btn-futuristic px-6 py-3 rounded-xl text-white font-semibold flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Ticket</span>
        </button>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-futuristic w-full">
            <thead>
              <tr className="border-b border-red-600/30">
                <th className="text-left p-4 text-gray-300 font-semibold">Ticket</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Título</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Prioridade</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center p-8">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full"></div>
                      <span className="text-gray-400">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center p-8">
                    <div className="text-gray-400">
                      <Headphones className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum ticket encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                    <td className="p-4 text-gray-300">#{ticket.id.substring(0, 8)}</td>
                    <td className="p-4 text-white font-medium">{ticket.empresa}</td>
                    <td className="p-4 text-gray-300">{ticket.titulo}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        ticket.prioridade === 'urgente' 
                          ? 'bg-red-600/20 text-red-400 border border-red-600/30' 
                          : ticket.prioridade === 'alta'
                          ? 'bg-orange-600/20 text-orange-400 border border-orange-600/30'
                          : ticket.prioridade === 'media'
                          ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
                          : 'bg-green-600/20 text-green-400 border border-green-600/30'
                      }`}>
                        {ticket.prioridade}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        ticket.status === 'resolvido' 
                          ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
                          : ticket.status === 'fechado'
                          ? 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
                          : 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                      }`}>
                        {ticket.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Atendimento;
