import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [config, setConfig] = useState({ cidades: [], setores: {} });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    role: 'colaborador',
    allowed_cities: [],
    permissoes: []
  });

  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    loadUsers();
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users-management/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users-management/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const url = editingUser 
        ? `${API_URL}/api/users-management/${editingUser.id}`
        : `${API_URL}/api/users-management/`;
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadUsers();
        resetForm();
        alert(editingUser ? 'Usuário atualizado!' : 'Usuário criado!');
      } else {
        const error = await response.json();
        alert(error.detail || 'Erro ao salvar usuário');
      }
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      alert('Erro ao salvar usuário');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Tem certeza que deseja deletar este usuário?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users-management/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await loadUsers();
        alert('Usuário deletado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.detail || 'Erro ao deletar usuário');
      }
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      password: '',
      role: user.role,
      allowed_cities: user.allowed_cities,
      permissoes: user.permissoes || []
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      password: '',
      role: 'colaborador',
      allowed_cities: [],
      permissoes: []
    });
    setEditingUser(null);
    setShowForm(false);
  };

  const toggleCity = (city) => {
    if (city === 'Todas') {
      setFormData(prev => ({
        ...prev,
        allowed_cities: prev.allowed_cities.includes('Todas') ? [] : ['Todas']
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        allowed_cities: prev.allowed_cities.includes(city)
          ? prev.allowed_cities.filter(c => c !== city)
          : [...prev.allowed_cities.filter(c => c !== 'Todas'), city]
      }));
    }
  };

  const toggleSetor = (setor) => {
    setFormData(prev => {
      const exists = prev.permissoes.find(p => p.setor === setor);
      if (exists) {
        return {
          ...prev,
          permissoes: prev.permissoes.filter(p => p.setor !== setor)
        };
      } else {
        return {
          ...prev,
          permissoes: [...prev.permissoes, { setor, visualizacoes: [] }]
        };
      }
    });
  };

  const toggleVisualizacao = (setor, vis) => {
    setFormData(prev => ({
      ...prev,
      permissoes: prev.permissoes.map(p => {
        if (p.setor === setor) {
          const hasVis = p.visualizacoes.includes(vis);
          return {
            ...p,
            visualizacoes: hasVis
              ? p.visualizacoes.filter(v => v !== vis)
              : [...p.visualizacoes, vis]
          };
        }
        return p;
      })
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Gerenciar Usuários</h1>
          <p className="text-gray-400 text-sm mt-1">
            Gerencie usuários, permissões e acessos do sistema
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          Novo Usuário
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Email será: {formData.name ? formData.name.toLowerCase().replace(/\s+/g, '.') + '@macedosi.com' : 'nome.completo@macedosi.com'}
                </p>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Senha {editingUser && '(deixe em branco para não alterar)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  required={!editingUser}
                  minLength={6}
                />
              </div>

              {/* Tipo de Usuário */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de Usuário
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="admin"
                      checked={formData.role === 'admin'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-white">Administrador</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="colaborador"
                      checked={formData.role === 'colaborador'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="text-white">Colaborador</span>
                  </label>
                </div>
              </div>

              {/* Cidades */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cidades de Visualização
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {config.cidades.map(city => (
                    <label key={city} className="flex items-center gap-2 cursor-pointer bg-gray-700 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={formData.allowed_cities.includes(city)}
                        onChange={() => toggleCity(city)}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <span className="text-white text-sm">{city}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Setores e Visualizações */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Setores e Visualizações
                </label>
                <div className="space-y-4">
                  {Object.keys(config.setores).map(setor => {
                    const permissao = formData.permissoes.find(p => p.setor === setor);
                    const isSetorSelected = !!permissao;

                    return (
                      <div key={setor} className="bg-gray-700 p-4 rounded-lg">
                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                          <input
                            type="checkbox"
                            checked={isSetorSelected}
                            onChange={() => toggleSetor(setor)}
                            className="text-red-600 focus:ring-red-500"
                          />
                          <span className="text-white font-medium">{setor}</span>
                        </label>
                        
                        {isSetorSelected && (
                          <div className="ml-6 grid grid-cols-2 gap-2">
                            {config.setores[setor].map(vis => (
                              <label key={vis} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={permissao.visualizacoes.includes(vis)}
                                  onChange={() => toggleVisualizacao(setor, vis)}
                                  className="text-red-600 focus:ring-red-500"
                                />
                                <span className="text-gray-300 text-sm">{vis}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {editingUser ? 'Atualizar' : 'Criar'} Usuário
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

      {/* Users List */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Cidades</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Setores</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${user.is_online ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span className="text-white">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded ${
                      user.role === 'admin' 
                        ? 'bg-red-900/50 text-red-300' 
                        : 'bg-blue-900/50 text-blue-300'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'Colaborador'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-300">
                      {user.allowed_cities.join(', ')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-300">
                      {user.permissoes?.map(p => p.setor).join(', ') || 'Nenhum'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded ${
                      user.is_active 
                        ? 'bg-green-900/50 text-green-300' 
                        : 'bg-gray-900/50 text-gray-300'
                    }`}>
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-400 hover:text-blue-300"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-400 hover:text-red-300"
                        title="Deletar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;
