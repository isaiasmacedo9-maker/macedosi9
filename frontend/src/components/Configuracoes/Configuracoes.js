import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { Settings, Save, User, Shield, Users as UsersIcon } from 'lucide-react';

const Configuracoes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/configuracoes');
      setConfigurations(response.data || []);
    } catch (error) {
      console.error('Error loading configurations:', error);
      setConfigurations([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">⚙️</span>
            Configurações
          </h1>
          <p className="text-gray-400 mt-2">Configurações do sistema</p>
        </div>
      </div>

      {/* Menu de Navegação */}
      {user?.role === 'admin' && (
        <div className="glass p-4 rounded-2xl">
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/configuracoes/usuarios')}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <UsersIcon size={20} />
              Gerenciar Usuários
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Profile */}
        <div className="glass p-6 rounded-2xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <User className="w-6 h-6 mr-3" />
            Perfil do Usuário
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
              <input
                type="text"
                value={user?.name || ''}
                className="input-futuristic w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 focus:outline-none"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                className="input-futuristic w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 focus:outline-none"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Função</label>
              <input
                type="text"
                value={user?.role || ''}
                className="input-futuristic w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 focus:outline-none capitalize"
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Access Permissions */}
        <div className="glass p-6 rounded-2xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Shield className="w-6 h-6 mr-3" />
            Permissões de Acesso
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cidades Permitidas</label>
              <div className="flex flex-wrap gap-2">
                {user?.allowed_cities?.map((city) => (
                  <span
                    key={city}
                    className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full text-sm capitalize"
                  >
                    {city}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Setores Permitidos</label>
              <div className="flex flex-wrap gap-2">
                {user?.allowed_sectors?.map((sector) => (
                  <span
                    key={sector}
                    className="px-3 py-1 bg-green-600/20 text-green-400 border border-green-600/30 rounded-full text-sm capitalize"
                  >
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="glass p-6 rounded-2xl lg:col-span-2">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Settings className="w-6 h-6 mr-3" />
            Informações do Sistema
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-3 h-3 status-online rounded-full mx-auto mb-2"></div>
              <p className="text-white font-medium">Sistema Online</p>
              <p className="text-gray-400 text-sm">Operacional</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-blue-600 rounded-full mx-auto mb-2"></div>
              <p className="text-white font-medium">Banco de Dados</p>
              <p className="text-gray-400 text-sm">SQLite Conectado</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-green-600 rounded-full mx-auto mb-2"></div>
              <p className="text-white font-medium">API Backend</p>
              <p className="text-gray-400 text-sm">FastAPI Ativo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;