import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { Building2, Plus, Search, Filter } from 'lucide-react';

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const canonicalCityKey = (city = '') => {
  const normalized = normalizeText(city);
  if (!normalized) return '';
  if (normalized.startsWith('ouroland')) return 'ourolandia';
  if (normalized.startsWith('uberland')) return 'uberlandia';
  if (normalized.startsWith('jacobin')) return 'jacobina';
  if (normalized.startsWith('umburan')) return 'umburanas';
  return normalized;
};

const canonicalCityLabel = (city = '') => {
  const key = canonicalCityKey(city);
  if (key === 'ourolandia') return 'Ourolandia';
  if (key === 'uberlandia') return 'Uberlandia';
  if (key === 'jacobina') return 'Jacobina';
  if (key === 'umburanas') return 'Umburanas';
  if (!key) return '-';
  return String(city || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const ClientsList = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients');
      setClients(response.data.clients || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.nome_empresa?.toLowerCase().includes(search.toLowerCase()) ||
    client.nome_fantasia?.toLowerCase().includes(search.toLowerCase()) ||
    client.cnpj?.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">🏢</span>
            Clientes
          </h1>
          <p className="text-gray-400 mt-2">
            Gerenciamento de clientes cadastrados
          </p>
        </div>
        <button
          onClick={() => window.alert('Cadastro de novo cliente será liberado neste módulo.')}
          className="btn-futuristic px-6 py-3 rounded-xl text-white font-semibold flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="glass p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-futuristic w-full pl-10 pr-4 py-3 rounded-xl text-white placeholder-gray-400 focus:outline-none"
                placeholder="Buscar por nome, fantasia ou CNPJ..."
              />
            </div>
          </div>
          <button
            onClick={() => window.alert('Filtros avançados serão habilitados neste módulo.')}
            className="flex items-center space-x-2 px-4 py-3 rounded-xl border border-red-600/30 text-gray-300 hover:text-white hover:border-red-600/50 transition-colors"
          >
            <Filter className="w-5 h-5" />
            <span>Filtros</span>
          </button>
        </div>
      </div>

      {/* Clients Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-futuristic w-full">
            <thead>
              <tr className="border-b border-red-600/30">
                <th className="text-left p-4 text-gray-300 font-semibold">Empresa</th>
                <th className="text-left p-4 text-gray-300 font-semibold">CNPJ</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Cidade</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center p-8">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full"></div>
                      <span className="text-gray-400">Carregando clientes...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center p-8">
                    <div className="text-gray-400">
                      <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum cliente encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{client.nome_empresa}</p>
                        <p className="text-gray-400 text-sm">{client.nome_fantasia}</p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">{client.cnpj}</td>
                    <td className="p-4 text-gray-300">{canonicalCityLabel(client.cidade)}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        client.status === 'ativa' 
                          ? 'bg-green-600/20 text-green-400 border border-green-600/30' 
                          : 'bg-red-600/20 text-red-400 border border-red-600/30'
                      }`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300">{client.responsavel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-red-600/30 flex items-center justify-between">
          <span className="text-gray-400 text-sm">
            Mostrando {filteredClients.length} de {clients.length} clientes
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClientsList;
