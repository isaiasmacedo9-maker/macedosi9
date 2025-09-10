import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { DollarSign, Plus, Search } from 'lucide-react';

const FinancialClients = () => {
  const { user, hasAccess } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasAccess([], ['financeiro'])) {
      loadFinancialClients();
    }
  }, []);

  const loadFinancialClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/financial/clients');
      setClients(response.data || []);
    } catch (error) {
      console.error('Error loading financial clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess([], ['financeiro'])) {
    return (
      <div className="glass p-8 rounded-2xl text-center">
        <DollarSign className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-50" />
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
            <span className="mr-3">💰</span>
            Clientes Financeiro
          </h1>
          <p className="text-gray-400 mt-2">
            Gerenciamento financeiro de clientes
          </p>
        </div>
        <button className="btn-futuristic px-6 py-3 rounded-xl text-white font-semibold flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Content */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-futuristic w-full">
            <thead>
              <tr className="border-b border-red-600/30">
                <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Valor com Desconto</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Valor Boleto</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Vencimento</th>
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
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center p-8">
                    <div className="text-gray-400">
                      <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum cliente financeiro encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                    <td className="p-4 text-white font-medium">{client.empresa}</td>
                    <td className="p-4 text-green-400">R$ {client.valor_com_desconto?.toLocaleString('pt-BR') || '0,00'}</td>
                    <td className="p-4 text-gray-300">R$ {client.valor_boleto?.toLocaleString('pt-BR') || '0,00'}</td>
                    <td className="p-4 text-gray-300">Dia {client.dia_vencimento}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        client.status_pagamento === 'em_dia' 
                          ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
                          : 'bg-red-600/20 text-red-400 border border-red-600/30'
                      }`}>
                        {client.status_pagamento?.replace('_', ' ')}
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

export default FinancialClients;