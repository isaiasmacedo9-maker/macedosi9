import React, { useState, useEffect } from 'react';
import { Plus, FileText, CheckCircle, Clock, Upload, Calendar, AlertCircle, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Comercial = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('servicos');
  const [servicos, setServicos] = useState([]);
  const [ordens, setOrdens] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [vencimentos, setVencimentos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('servico');
  
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [servicoForm, setServicoForm] = useState({
    empresa_id: '',
    tipo_servico: 'IRPF',
    descricao: '',
    valor_servico: 0,
    valor_desconto: 0,
    data_contratacao: '',
    data_inicio_previsto: '',
    data_conclusao_prevista: '',
    responsavel_id: '',
    observacoes: ''
  });

  const [contratoForm, setContratoForm] = useState({
    empresa_id: '',
    nome_contrato: '',
    tipo_servico: '',
    descricao: '',
    valor_mensal: 0,
    valor_total: 0,
    forma_pagamento: '',
    data_assinatura: '',
    data_inicio_vigencia: '',
    data_vencimento: '',
    renovacao_automatica: 'nao',
    responsavel_id: '',
    observacoes: '',
    clausulas_especiais: ''
  });

  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    loadClientes();
    loadUsuarios();
  }, []);

  useEffect(() => {
    if (activeTab === 'servicos') loadServicos();
    else if (activeTab === 'ordens') loadOrdens();
    else if (activeTab === 'contratos') {
      loadContratos();
      loadVencimentos();
    }
  }, [activeTab]);

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

  const loadServicos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/comercial/servicos`, {
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

  const loadOrdens = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/comercial/ordens-servico`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setOrdens(data);
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContratos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/comercial/contratos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setContratos(data);
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVencimentos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/comercial/contratos/vencimentos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setVencimentos(data);
    } catch (error) {
      console.error('Erro ao carregar vencimentos:', error);
    }
  };

  const handleCreateServico = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/comercial/servicos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(servicoForm)
      });

      if (response.ok) {
        await loadServicos();
        setShowForm(false);
        resetServicoForm();
        alert('Serviço criado com sucesso! Ordem de Serviço gerada automaticamente.');
      } else {
        const error = await response.json();
        alert(error.detail || 'Erro ao criar serviço');
      }
    } catch (error) {
      console.error('Erro ao criar serviço:', error);
      alert('Erro ao criar serviço');
    }
  };

  const handleCreateContrato = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/comercial/contratos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contratoForm)
      });

      if (response.ok) {
        await loadContratos();
        await loadVencimentos();
        setShowForm(false);
        resetContratoForm();
        alert('Contrato criado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.detail || 'Erro ao criar contrato');
      }
    } catch (error) {
      console.error('Erro ao criar contrato:', error);
      alert('Erro ao criar contrato');
    }
  };

  const handleIniciarOS = async (osId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/comercial/ordens-servico/${osId}/iniciar`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await loadOrdens();
        alert('O.S. iniciada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao iniciar O.S.:', error);
    }
  };

  const handleConcluirOS = async (osId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/comercial/ordens-servico/${osId}/concluir`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await loadOrdens();
        alert('O.S. concluída com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao concluir O.S.:', error);
    }
  };

  const handleUploadContrato = async (contratoId, file) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/comercial/contratos/${contratoId}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        await loadContratos();
        alert('Contrato enviado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao enviar contrato:', error);
    }
  };

  const resetServicoForm = () => {
    setServicoForm({
      empresa_id: '',
      tipo_servico: 'IRPF',
      descricao: '',
      valor_servico: 0,
      valor_desconto: 0,
      data_contratacao: '',
      data_inicio_previsto: '',
      data_conclusao_prevista: '',
      responsavel_id: '',
      observacoes: ''
    });
  };

  const resetContratoForm = () => {
    setContratoForm({
      empresa_id: '',
      nome_contrato: '',
      tipo_servico: '',
      descricao: '',
      valor_mensal: 0,
      valor_total: 0,
      forma_pagamento: '',
      data_assinatura: '',
      data_inicio_vigencia: '',
      data_vencimento: '',
      renovacao_automatica: 'nao',
      responsavel_id: '',
      observacoes: '',
      clausulas_especiais: ''
    });
  };

  const openForm = (type) => {
    setFormType(type);
    setShowForm(true);
  };

  const tiposServico = ['IRPF', 'IRPJ', 'MEI', 'ITR', 'Consultoria', 'Auditoria'];
  const statusBadges = {
    'contratado': 'bg-blue-900/50 text-blue-300',
    'em_andamento': 'bg-yellow-900/50 text-yellow-300',
    'concluido': 'bg-green-900/50 text-green-300',
    'cancelado': 'bg-gray-900/50 text-gray-300',
    'aberta': 'bg-blue-900/50 text-blue-300',
    'em_execucao': 'bg-yellow-900/50 text-yellow-300',
    'concluida': 'bg-green-900/50 text-green-300',
    'ativo': 'bg-green-900/50 text-green-300',
    'vencido': 'bg-red-900/50 text-red-300',
    'renovado': 'bg-purple-900/50 text-purple-300'
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>💼</span>
            Comercial
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestão de serviços, O.S. e contratos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-lg p-1 flex gap-1">
        <button
          onClick={() => setActiveTab('servicos')}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'servicos' 
              ? 'bg-red-600 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText size={18} className="inline mr-2" />
          Serviços
        </button>
        <button
          onClick={() => setActiveTab('ordens')}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'ordens' 
              ? 'bg-red-600 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <CheckCircle size={18} className="inline mr-2" />
          Ordens de Serviço
        </button>
        <button
          onClick={() => setActiveTab('contratos')}
          className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'contratos' 
              ? 'bg-red-600 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText size={18} className="inline mr-2" />
          Contratos
        </button>
      </div>

      {/* Contratos - Calendário de Vencimentos */}
      {activeTab === 'contratos' && vencimentos && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 p-6 rounded-lg border border-yellow-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-yellow-300 text-sm">Vencendo em 30 dias</span>
              <Calendar size={20} className="text-yellow-400" />
            </div>
            <p className="text-3xl font-bold text-white">{vencimentos.vencendo_30_dias}</p>
          </div>

          <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 p-6 rounded-lg border border-orange-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-orange-300 text-sm">Vencendo em 90 dias</span>
              <Calendar size={20} className="text-orange-400" />
            </div>
            <p className="text-3xl font-bold text-white">{vencimentos.vencendo_90_dias}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 p-6 rounded-lg border border-blue-700/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-300 text-sm">Vencendo em 180 dias</span>
              <Calendar size={20} className="text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">{vencimentos.vencendo_180_dias}</p>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="bg-gray-800 rounded-lg">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-white font-medium">
            {activeTab === 'servicos' && 'Lista de Serviços'}
            {activeTab === 'ordens' && 'Lista de Ordens de Serviço'}
            {activeTab === 'contratos' && 'Lista de Contratos'}
          </h2>
          <button
            onClick={() => openForm(activeTab === 'servicos' ? 'servico' : 'contrato')}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={18} />
            Novo {activeTab === 'servicos' ? 'Serviço' : activeTab === 'contratos' ? 'Contrato' : ''}
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            {/* Tabela de Serviços */}
            {activeTab === 'servicos' && (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Número</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Valor Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {servicos.map(servico => (
                    <tr key={servico.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <span className="text-blue-400 font-mono text-sm">{servico.numero}</span>
                      </td>
                      <td className="px-4 py-3 text-white">{servico.empresa_nome}</td>
                      <td className="px-4 py-3 text-gray-300">{servico.tipo_servico}</td>
                      <td className="px-4 py-3 text-white">
                        R$ {servico.valor_total?.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded ${statusBadges[servico.status]}`}>
                          {servico.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {new Date(servico.data_contratacao).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Tabela de Ordens */}
            {activeTab === 'ordens' && (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Número</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Executor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {ordens.map(ordem => (
                    <tr key={ordem.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <span className="text-blue-400 font-mono text-sm">{ordem.numero}</span>
                      </td>
                      <td className="px-4 py-3 text-white">{ordem.empresa_nome}</td>
                      <td className="px-4 py-3 text-gray-300">{ordem.tipo_servico}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded ${statusBadges[ordem.status]}`}>
                          {ordem.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{ordem.executor_nome || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        {ordem.status === 'aberta' && (
                          <button
                            onClick={() => handleIniciarOS(ordem.id)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Iniciar
                          </button>
                        )}
                        {ordem.status === 'em_execucao' && (
                          <button
                            onClick={() => handleConcluirOS(ordem.id)}
                            className="text-green-400 hover:text-green-300 text-sm"
                          >
                            Concluir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Tabela de Contratos */}
            {activeTab === 'contratos' && (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Número</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Empresa</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Vencimento</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {contratos.map(contrato => (
                    <tr key={contrato.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <span className="text-blue-400 font-mono text-sm">{contrato.numero}</span>
                      </td>
                      <td className="px-4 py-3 text-white">{contrato.nome_contrato}</td>
                      <td className="px-4 py-3 text-gray-300">{contrato.empresa_nome}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-gray-400" />
                          <span className="text-white text-sm">
                            {new Date(contrato.data_vencimento).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded ${statusBadges[contrato.status]}`}>
                          {contrato.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <label className="cursor-pointer text-blue-400 hover:text-blue-300 text-sm">
                          <Upload size={16} className="inline mr-1" />
                          Upload
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files[0]) {
                                handleUploadContrato(contrato.id, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">
              {formType === 'servico' ? 'Novo Serviço Comercial' : 'Novo Contrato'}
            </h2>

            {formType === 'servico' ? (
              <form onSubmit={handleCreateServico} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Empresa *</label>
                    <select
                      value={servicoForm.empresa_id}
                      onChange={(e) => setServicoForm({ ...servicoForm, empresa_id: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
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
                      value={servicoForm.tipo_servico}
                      onChange={(e) => setServicoForm({ ...servicoForm, tipo_servico: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    >
                      {tiposServico.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Descrição *</label>
                  <textarea
                    value={servicoForm.descricao}
                    onChange={(e) => setServicoForm({ ...servicoForm, descricao: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Valor Serviço *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={servicoForm.valor_servico}
                      onChange={(e) => setServicoForm({ ...servicoForm, valor_servico: parseFloat(e.target.value) })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Desconto</label>
                    <input
                      type="number"
                      step="0.01"
                      value={servicoForm.valor_desconto}
                      onChange={(e) => setServicoForm({ ...servicoForm, valor_desconto: parseFloat(e.target.value) })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Valor Total</label>
                    <input
                      type="text"
                      value={`R$ ${(servicoForm.valor_servico - servicoForm.valor_desconto).toFixed(2)}`}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg outline-none"
                      disabled
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Data Contratação *</label>
                    <input
                      type="date"
                      value={servicoForm.data_contratacao}
                      onChange={(e) => setServicoForm({ ...servicoForm, data_contratacao: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Início Previsto</label>
                    <input
                      type="date"
                      value={servicoForm.data_inicio_previsto}
                      onChange={(e) => setServicoForm({ ...servicoForm, data_inicio_previsto: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Conclusão Prevista</label>
                    <input
                      type="date"
                      value={servicoForm.data_conclusao_prevista}
                      onChange={(e) => setServicoForm({ ...servicoForm, data_conclusao_prevista: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Responsável</label>
                  <select
                    value={servicoForm.responsavel_id}
                    onChange={(e) => setServicoForm({ ...servicoForm, responsavel_id: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="">Não atribuído</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors"
                  >
                    Criar Serviço (+ O.S. automática)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateContrato} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Empresa *</label>
                    <select
                      value={contratoForm.empresa_id}
                      onChange={(e) => setContratoForm({ ...contratoForm, empresa_id: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    >
                      <option value="">Selecione...</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nome_empresa}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Contrato *</label>
                    <input
                      type="text"
                      value={contratoForm.nome_contrato}
                      onChange={(e) => setContratoForm({ ...contratoForm, nome_contrato: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Serviço *</label>
                  <input
                    type="text"
                    value={contratoForm.tipo_servico}
                    onChange={(e) => setContratoForm({ ...contratoForm, tipo_servico: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Data Assinatura *</label>
                    <input
                      type="date"
                      value={contratoForm.data_assinatura}
                      onChange={(e) => setContratoForm({ ...contratoForm, data_assinatura: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Início Vigência *</label>
                    <input
                      type="date"
                      value={contratoForm.data_inicio_vigencia}
                      onChange={(e) => setContratoForm({ ...contratoForm, data_inicio_vigencia: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Vencimento *</label>
                    <input
                      type="date"
                      value={contratoForm.data_vencimento}
                      onChange={(e) => setContratoForm({ ...contratoForm, data_vencimento: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Valor Mensal</label>
                    <input
                      type="number"
                      step="0.01"
                      value={contratoForm.valor_mensal}
                      onChange={(e) => setContratoForm({ ...contratoForm, valor_mensal: parseFloat(e.target.value) })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Renovação Automática</label>
                    <select
                      value={contratoForm.renovacao_automatica}
                      onChange={(e) => setContratoForm({ ...contratoForm, renovacao_automatica: e.target.value })}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    >
                      <option value="nao">Não</option>
                      <option value="sim">Sim</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors"
                  >
                    Criar Contrato
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Comercial;
