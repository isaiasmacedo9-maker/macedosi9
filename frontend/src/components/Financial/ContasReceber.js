import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { Wallet, Plus, Search } from 'lucide-react';

const ContasReceber = () => {
  const { hasAccess } = useAuth();
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasAccess([], ['financeiro'])) {
      loadContas();
    }
  }, []);

  const loadContas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/financial/contas-receber');
      setContas(response.data || []);
    } catch (error) {
      console.error('Error loading contas:', error);
      setContas([]);
    } finally {
      setLoading(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">💸</span>
            Contas a Receber
          </h1>
          <p className="text-gray-400 mt-2">Gestão de contas a receber</p>
        </div>
        <button className="btn-futuristic px-6 py-3 rounded-xl text-white font-semibold flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Nova Conta</span>
        </button>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-futuristic w-full">
            <thead>
              <tr className="border-b border-red-600/30">
                <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Descrição</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Valor</th>
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
              ) : contas.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center p-8">
                    <div className="text-gray-400">
                      <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhuma conta encontrada</p>
                    </div>
                  </td>
                </tr>
              ) : (
                contas.map((conta) => (
                  <tr key={conta.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                    <td className="p-4 text-white font-medium">{conta.empresa}</td>
                    <td className="p-4 text-gray-300">{conta.descricao}</td>
                    <td className="p-4 text-green-400">R$ {conta.valor_original?.toLocaleString('pt-BR') || '0,00'}</td>
                    <td className="p-4 text-gray-300">{new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        conta.situacao === 'pago' 
                          ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
                          : conta.situacao === 'atrasado'
                          ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                          : 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
                      }`}>
                        {conta.situacao?.replace('_', ' ')}
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

export default ContasReceber;