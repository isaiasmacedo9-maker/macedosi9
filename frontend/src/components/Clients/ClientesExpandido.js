import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { 
  Building2, Plus, Search, Filter, Edit, Trash2, Eye, 
  Phone, Mail, MapPin, FileText, Download, Upload,
  X, CheckCircle, AlertCircle, User, Briefcase
} from 'lucide-react';
import { toast } from 'sonner';

const ClientesExpandido = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // create, edit
  const [selectedClient, setSelectedClient] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    search: '',
    cidade: '',
    setor: '',
    status: ''
  });

  const [formData, setFormData] = useState({
    nome_empresa: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    inscricao_municipal: '',
    email: '',
    telefone: '',
    celular: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    setor: 'contabilidade',
    status: 'ativo',
    responsavel: '',
    data_inicio_contrato: '',
    observacoes: ''
  });

  const [setores] = useState([
    'contabilidade',
    'fiscal',
    'trabalhista',
    'financeiro',
    'societario',
    'consultoria'
  ]);

  const [cidades] = useState([
    'São Paulo',
    'Rio de Janeiro',
    'Belo Horizonte',
    'Brasília',
    'Salvador',
    'Fortaleza',
    'Curitiba',
    'Recife',
    'Porto Alegre',
    'Manaus'
  ]);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients?limit=1000');
      setClients(response.data.clients || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Erro ao carregar clientes');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await api.post('/clients', formData);
      toast.success('Cliente criado com sucesso!');
      
      // Notificar sobre envio automático para financeiro
      if (formData.cidade) {
        toast.info(`📨 Notificação automática enviada para o setor Financeiro de ${formData.cidade}`, {
          duration: 5000
        });
      }
      
      setShowModal(false);
      resetForm();
      loadClients();
    } catch (error) {
      toast.error('Erro ao criar cliente: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/clients/${selectedClient.id}`, formData);
      toast.success('Cliente atualizado com sucesso!');
      setShowModal(false);
      resetForm();
      loadClients();
    } catch (error) {
      toast.error('Erro ao atualizar cliente: ' + (error.response?.data?.detail || 'Erro desconhecido'));
    }
  };

  const handleDeleteClient = async (id, nome) => {
    if (!window.confirm(`Tem certeza que deseja excluir o cliente "${nome}"?`)) return;
    
    try {
      await api.delete(`/clients/${id}`);
      toast.success('Cliente excluído com sucesso!');
      loadClients();
    } catch (error) {
      toast.error('Erro ao excluir cliente');
    }
  };

  const handleBuscarCEP = async () => {
    if (formData.cep.length < 8) return;
    
    try {
      const cep = formData.cep.replace(/\D/g, '');
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }
      
      setFormData({
        ...formData,
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf
      });
      
      toast.success('Endereço preenchido automaticamente');
    } catch (error) {
      toast.error('Erro ao buscar CEP');
    }
  };

  const resetForm = () => {
    setFormData({
      nome_empresa: '',
      nome_fantasia: '',
      cnpj: '',
      inscricao_estadual: '',
      inscricao_municipal: '',
      email: '',
      telefone: '',
      celular: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      setor: 'contabilidade',
      status: 'ativo',
      responsavel: '',
      data_inicio_contrato: '',
      observacoes: ''
    });
    setSelectedClient(null);
  };

  const openCreateModal = () => {
    setModalType('create');
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (client) => {
    setModalType('edit');
    setSelectedClient(client);
    setFormData({
      nome_empresa: client.nome_empresa || '',
      nome_fantasia: client.nome_fantasia || '',
      cnpj: client.cnpj || '',
      inscricao_estadual: client.inscricao_estadual || '',
      inscricao_municipal: client.inscricao_municipal || '',
      email: client.email || '',
      telefone: client.telefone || '',
      celular: client.celular || '',
      cep: client.cep || '',
      logradouro: client.logradouro || '',
      numero: client.numero || '',
      complemento: client.complemento || '',
      bairro: client.bairro || '',
      cidade: client.cidade || '',
      estado: client.estado || '',
      setor: client.setor || 'contabilidade',
      status: client.status || 'ativo',
      responsavel: client.responsavel || '',
      data_inicio_contrato: client.data_inicio_contrato || '',
      observacoes: client.observacoes || ''
    });
    setShowModal(true);
  };

  const openDetailsModal = (client) => {
    setSelectedClient(client);
    setShowDetailsModal(true);
  };

  const exportData = async (formato) => {
    try {
      const response = await api.get(`/clients/export?formato=${formato}`);
      
      if (formato === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
      }
      
      toast.success(`Dados exportados em ${formato.toUpperCase()}`);
    } catch (error) {
      toast.error('Erro ao exportar dados');
    }
  };

  const filteredClients = clients.filter(client => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchSearch = 
        client.nome_empresa?.toLowerCase().includes(search) ||
        client.nome_fantasia?.toLowerCase().includes(search) ||
        client.cnpj?.includes(search) ||
        client.email?.toLowerCase().includes(search);
      if (!matchSearch) return false;
    }
    
    if (filters.cidade && client.cidade !== filters.cidade) return false;
    if (filters.setor && client.setor !== filters.setor) return false;
    if (filters.status && client.status !== filters.status) return false;
    
    return true;
  });

  const getStatusColor = (status) => {
    const colors = {
      'ativo': 'bg-green-600/20 text-green-400 border-green-600/30',
      'inativo': 'bg-gray-600/20 text-gray-400 border-gray-600/30',
      'suspenso': 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
      'inadimplente': 'bg-red-600/20 text-red-400 border-red-600/30'
    };
    return colors[status] || colors['ativo'];
  };

  const formatCNPJ = (cnpj) => {
    if (!cnpj) return '-';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (phone) => {
    if (!phone) return '-';
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">🏢</span>
            Clientes
          </h1>
          <p className="text-gray-400 mt-2">Base única de clientes - usada por todos os setores</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => exportData('csv')}
            className="btn-secondary px-4 py-2 rounded-xl flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Exportar</span>
          </button>
          <button
            onClick={openCreateModal}
            className="btn-futuristic px-6 py-2 rounded-xl text-white font-semibold flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl border border-blue-600/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Clientes</p>
              <p className="text-2xl font-bold text-blue-400">{clients.length}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-400 opacity-60" />
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-green-600/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Ativos</p>
              <p className="text-2xl font-bold text-green-400">
                {clients.filter(c => c.status === 'ativo').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400 opacity-60" />
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-yellow-600/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Inativos</p>
              <p className="text-2xl font-bold text-yellow-400">
                {clients.filter(c => c.status === 'inativo').length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-400 opacity-60" />
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-purple-600/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Setores</p>
              <p className="text-2xl font-bold text-purple-400">{setores.length}</p>
            </div>
            <Briefcase className="w-8 h-8 text-purple-400 opacity-60" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="w-full bg-black/30 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white"
                placeholder="Buscar por nome, fantasia, CNPJ ou email..."
              />
            </div>
          </div>

          <div>
            <select
              value={filters.cidade}
              onChange={(e) => setFilters({...filters, cidade: e.target.value})}
              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="">Todas as Cidades</option>
              {cidades.map(cidade => (
                <option key={cidade} value={cidade}>{cidade}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filters.setor}
              onChange={(e) => setFilters({...filters, setor: e.target.value})}
              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="">Todos os Setores</option>
              {setores.map(setor => (
                <option key={setor} value={setor} className="capitalize">{setor}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="suspenso">Suspenso</option>
              <option value="inadimplente">Inadimplente</option>
            </select>
          </div>
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
                <th className="text-left p-4 text-gray-300 font-semibold">Contato</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Cidade</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Setor</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Status</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center p-8">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-gray-400">Carregando clientes...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-8">
                    <div className="text-gray-400">
                      <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum cliente encontrado</p>
                      <button
                        onClick={openCreateModal}
                        className="btn-futuristic px-4 py-2 rounded-lg mt-3"
                      >
                        Adicionar primeiro cliente
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-gray-800/50 hover:bg-red-600/5 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-bold">{client.nome_empresa}</p>
                        {client.nome_fantasia && (
                          <p className="text-xs text-gray-400">{client.nome_fantasia}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-300 font-mono text-sm">
                      {formatCNPJ(client.cnpj)}
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {client.email && (
                          <div className="flex items-center space-x-1 text-xs text-gray-300">
                            <Mail className="w-3 h-3" />
                            <span>{client.email}</span>
                          </div>
                        )}
                        {client.telefone && (
                          <div className="flex items-center space-x-1 text-xs text-gray-300">
                            <Phone className="w-3 h-3" />
                            <span>{formatPhone(client.telefone)}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">
                      {client.cidade && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4 text-blue-400" />
                          <span>{client.cidade}/{client.estado}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-600/30 capitalize">
                        {client.setor}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(client.status)} capitalize`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openDetailsModal(client)}
                          className="p-2 hover:bg-blue-600/20 rounded-lg transition-colors"
                          title="Ver Detalhes"
                        >
                          <Eye className="w-4 h-4 text-blue-400" />
                        </button>
                        <button
                          onClick={() => openEditModal(client)}
                          className="p-2 hover:bg-green-600/20 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4 text-green-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id, client.nome_empresa)}
                          className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
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

      {/* Modal Criar/Editar Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Building2 className="w-6 h-6 mr-2 text-red-400" />
                {modalType === 'create' ? 'Novo Cliente' : 'Editar Cliente'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={modalType === 'create' ? handleCreateClient : handleUpdateClient}>
              <div className="space-y-6">
                {/* Dados da Empresa */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Building2 className="w-5 h-5 mr-2 text-red-400" />
                    Dados da Empresa
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Razão Social *</label>
                      <input
                        required
                        type="text"
                        value={formData.nome_empresa}
                        onChange={(e) => setFormData({...formData, nome_empresa: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Nome Fantasia</label>
                      <input
                        type="text"
                        value={formData.nome_fantasia}
                        onChange={(e) => setFormData({...formData, nome_fantasia: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">CNPJ *</label>
                      <input
                        required
                        type="text"
                        value={formData.cnpj}
                        onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono"
                        placeholder="00.000.000/0000-00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Inscrição Estadual</label>
                      <input
                        type="text"
                        value={formData.inscricao_estadual}
                        onChange={(e) => setFormData({...formData, inscricao_estadual: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Inscrição Municipal</label>
                      <input
                        type="text"
                        value={formData.inscricao_municipal}
                        onChange={(e) => setFormData({...formData, inscricao_municipal: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Contato */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <Phone className="w-5 h-5 mr-2 text-red-400" />
                    Contato
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">E-mail *</label>
                      <input
                        required
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Telefone</label>
                      <input
                        type="tel"
                        value={formData.telefone}
                        onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                        placeholder="(00) 0000-0000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Celular</label>
                      <input
                        type="tel"
                        value={formData.celular}
                        onChange={(e) => setFormData({...formData, celular: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-red-400" />
                    Endereço
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">CEP</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={formData.cep}
                          onChange={(e) => setFormData({...formData, cep: e.target.value})}
                          className="flex-1 bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                          placeholder="00000-000"
                        />
                        <button
                          type="button"
                          onClick={handleBuscarCEP}
                          className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg text-blue-400 transition-colors"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Logradouro</label>
                      <input
                        type="text"
                        value={formData.logradouro}
                        onChange={(e) => setFormData({...formData, logradouro: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Número</label>
                      <input
                        type="text"
                        value={formData.numero}
                        onChange={(e) => setFormData({...formData, numero: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Complemento</label>
                      <input
                        type="text"
                        value={formData.complemento}
                        onChange={(e) => setFormData({...formData, complemento: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Bairro</label>
                      <input
                        type="text"
                        value={formData.bairro}
                        onChange={(e) => setFormData({...formData, bairro: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Cidade</label>
                      <input
                        type="text"
                        value={formData.cidade}
                        onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Estado</label>
                      <input
                        type="text"
                        value={formData.estado}
                        onChange={(e) => setFormData({...formData, estado: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                        maxLength="2"
                        placeholder="UF"
                      />
                    </div>
                  </div>
                </div>

                {/* Informações Adicionais */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-red-400" />
                    Informações Adicionais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Setor *</label>
                      <select
                        required
                        value={formData.setor}
                        onChange={(e) => setFormData({...formData, setor: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      >
                        {setores.map(setor => (
                          <option key={setor} value={setor} className="capitalize">{setor}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Status *</label>
                      <select
                        required
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      >
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                        <option value="suspenso">Suspenso</option>
                        <option value="inadimplente">Inadimplente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Responsável</label>
                      <input
                        type="text"
                        value={formData.responsavel}
                        onChange={(e) => setFormData({...formData, responsavel: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Observações</label>
                      <textarea
                        value={formData.observacoes}
                        onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                        className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 text-white"
                        rows="3"
                      />
                    </div>
                  </div>
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
                  {modalType === 'create' ? 'Criar Cliente' : 'Atualizar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {showDetailsModal && selectedClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Detalhes do Cliente</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-red-600/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Empresa */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Dados da Empresa</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Razão Social</p>
                    <p className="text-white font-bold">{selectedClient.nome_empresa}</p>
                  </div>
                  {selectedClient.nome_fantasia && (
                    <div>
                      <p className="text-sm text-gray-400">Nome Fantasia</p>
                      <p className="text-white">{selectedClient.nome_fantasia}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-400">CNPJ</p>
                    <p className="text-white font-mono">{formatCNPJ(selectedClient.cnpj)}</p>
                  </div>
                  {selectedClient.inscricao_estadual && (
                    <div>
                      <p className="text-sm text-gray-400">Inscrição Estadual</p>
                      <p className="text-white">{selectedClient.inscricao_estadual}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contato */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Contato</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">E-mail</p>
                    <p className="text-white">{selectedClient.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Telefone</p>
                    <p className="text-white">{formatPhone(selectedClient.telefone)}</p>
                  </div>
                </div>
              </div>

              {/* Endereço */}
              {selectedClient.logradouro && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Endereço</h3>
                  <p className="text-white">
                    {selectedClient.logradouro}, {selectedClient.numero}
                    {selectedClient.complemento && ` - ${selectedClient.complemento}`}
                  </p>
                  <p className="text-white">
                    {selectedClient.bairro} - {selectedClient.cidade}/{selectedClient.estado}
                  </p>
                  {selectedClient.cep && (
                    <p className="text-gray-400 text-sm">CEP: {selectedClient.cep}</p>
                  )}
                </div>
              )}

              {/* Informações Adicionais */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Informações Adicionais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Setor</p>
                    <p className="text-white capitalize">{selectedClient.setor}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Status</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedClient.status)} capitalize`}>
                      {selectedClient.status}
                    </span>
                  </div>
                  {selectedClient.responsavel && (
                    <div>
                      <p className="text-sm text-gray-400">Responsável</p>
                      <p className="text-white">{selectedClient.responsavel}</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedClient.observacoes && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Observações</h3>
                  <div className="bg-black/30 rounded-lg p-4">
                    <p className="text-white">{selectedClient.observacoes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientesExpandido;
