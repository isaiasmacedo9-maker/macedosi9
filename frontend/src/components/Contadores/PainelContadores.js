import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { Calendar, ChevronDown, Clock, Eye, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';

const MOCK_INTERNAL_SERVICES_KEY = 'mock_internal_services';
const MOCK_CONTADORES_AGENDAMENTOS_KEY = 'mock_contadores_agendamentos_v1';

const CONTADORES = [
  { key: 'sara', nome: 'Sara' },
  { key: 'florivaldo', nome: 'Florivaldo' },
];

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'concluido', label: 'Concluidos' },
  { value: 'remarcado', label: 'Remarcado' },
  { value: 'cliente_nao_compareceu', label: 'Cliente nao compareceu' },
];

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const sortByDateAsc = (a, b) =>
  new Date(`${a?.data_agendamento || '1970-01-01'}T00:00:00`) -
  new Date(`${b?.data_agendamento || '1970-01-01'}T00:00:00`);

const PainelContadores = () => {
  const { user, hasModuleAccess } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeArea, setActiveArea] = useState('agendamentos');
  const [viewContadorKey, setViewContadorKey] = useState('sara');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [agendamentos, setAgendamentos] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState(null);
  const [showNewAgendamentoModal, setShowNewAgendamentoModal] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [newAgendamentoForm, setNewAgendamentoForm] = useState({
    empresa_id: '',
    cliente_nome: '',
    cliente_telefone: '',
    cliente_email: '',
    data_agendamento: '',
    hora_inicio: '',
    hora_fim: '',
    duracao_minutos: '60',
    tipo_atendimento: 'consultoria',
    motivo_atendimento: '',
    setor_responsavel: 'contadores',
    contador_id: '',
    observacoes: '',
  });

  const getContadorVisualizacoes = (targetUser = user) => {
    const permissao = (targetUser?.permissoes || []).find(
      (item) => normalize(item?.setor) === 'contadores',
    );
    return permissao?.visualizacoes || [];
  };

  const hasSpecificContadorVisualization = useMemo(() => {
    const visualizacoes = getContadorVisualizacoes(user);
    return visualizacoes.some((item) => normalize(item).includes('sara') || normalize(item).includes('florivaldo'));
  }, [user]);

  const canSeeContadorAgendamentos = (contKey) => {
    if (isAdmin) return true;
    const visualizacoes = getContadorVisualizacoes(user).map(normalize);
    return visualizacoes.includes(`agendamentos ${contKey}`);
  };

  const canSeeContadorServicos = (contKey) => {
    if (isAdmin) return true;
    const visualizacoes = getContadorVisualizacoes(user).map(normalize);
    return visualizacoes.includes(`servicos ${contKey}`) || visualizacoes.includes(`servicos ${contKey}`);
  };

  const visibleContadoresForArea = (area) => {
    if (isAdmin) return CONTADORES;
    if (!hasSpecificContadorVisualization) return CONTADORES;
    const checker = area === 'agendamentos' ? canSeeContadorAgendamentos : canSeeContadorServicos;
    return CONTADORES.filter((contador) => checker(contador.key));
  };

  useEffect(() => {
    if (!hasModuleAccess('contadores')) return;
    loadClientes();
    loadAgendamentos();
    loadServices();

    const interval = setInterval(() => {
      loadAgendamentos();
      loadServices();
    }, 120000);

    return () => clearInterval(interval);
  }, [hasModuleAccess]);

  useEffect(() => {
    const available = visibleContadoresForArea(activeArea);
    if (!available.some((item) => item.key === viewContadorKey)) {
      setViewContadorKey(available[0]?.key || 'sara');
    }
  }, [activeArea, viewContadorKey, isAdmin, hasSpecificContadorVisualization, user]);

  const loadClientes = async () => {
    try {
      const response = await api.get('/clients?limit=1000');
      const payload = response.data?.clients || response.data || [];
      setClientes(Array.isArray(payload) ? payload : []);
    } catch {
      setClientes([]);
    }
  };

  const loadAgendamentos = async () => {
    let backendAgendamentos = [];
    try {
      setLoading(true);
      const response = await api.get('/agendamentos/');
      backendAgendamentos = Array.isArray(response.data) ? response.data : [];
    } catch {
      toast.error('Erro ao carregar agendamentos do backend. Exibindo base local.');
    } finally {
      const localAgendamentos = parseJson(localStorage.getItem(MOCK_CONTADORES_AGENDAMENTOS_KEY) || '[]', []);
      const merged = [...backendAgendamentos, ...(Array.isArray(localAgendamentos) ? localAgendamentos : [])];
      const uniqueById = Array.from(
        new Map(merged.map((item) => [String(item?.id || item?.numero || Math.random()), item])).values(),
      );
      setAgendamentos(uniqueById.sort(sortByDateAsc));
      setLoading(false);
    }
  };

  const loadServices = async () => {
    let backendServices = [];
    try {
      const response = await api.get('/services/');
      const payload = response.data || [];
      backendServices = Array.isArray(payload) ? payload : [];
    } catch {}

    const mockServices = parseJson(localStorage.getItem(MOCK_INTERNAL_SERVICES_KEY) || '[]', []);
    const merged = [...backendServices, ...(Array.isArray(mockServices) ? mockServices : [])];
    setServices(merged);
  };

  const getContadorByIdOrName = (value = '') => {
    const raw = normalize(value);
    if (raw.includes('sara')) return 'sara';
    if (raw.includes('florivaldo')) return 'florivaldo';
    return '';
  };

  const filteredAgendamentos = useMemo(() => {
    const isScopeByCreatorOnly = !isAdmin && !hasSpecificContadorVisualization;
    const selectedContador = CONTADORES.find((item) => item.key === viewContadorKey);

    const base = agendamentos.filter((agd) => {
      if (isScopeByCreatorOnly) {
        const isCreatedByMe =
          agd?.solicitante_id === user?.id ||
          normalize(agd?.solicitante_nome) === normalize(user?.name) ||
          normalize(agd?.created_by_email) === normalize(user?.email);
        if (!isCreatedByMe) return false;
      } else if (!canSeeContadorAgendamentos(viewContadorKey)) {
        return false;
      }

      if (selectedContador) {
        const agdContadorKey = getContadorByIdOrName(agd?.contador_nome || agd?.contador_id);
        if (agdContadorKey && agdContadorKey !== selectedContador.key) return false;
      }

      if (statusFilter !== 'todos' && normalize(agd?.status) !== normalize(statusFilter)) return false;
      return true;
    });

    return base.sort(sortByDateAsc);
  }, [agendamentos, statusFilter, viewContadorKey, isAdmin, hasSpecificContadorVisualization, user]);

  const filteredServices = useMemo(() => {
    const isScopeByCreatorOnly = !isAdmin && !hasSpecificContadorVisualization;
    if (!isScopeByCreatorOnly && !canSeeContadorServicos(viewContadorKey)) return [];

    return services
      .filter((item) => {
        if (isScopeByCreatorOnly) {
          const viewerIdentity = [user?.id, user?.email, user?.name].map(normalize);
          const assigned = Array.isArray(item?.assignedTo) ? item.assignedTo.map(normalize) : [];
          const isMine =
            normalize(item?.created_by_id) === normalize(user?.id) ||
            normalize(item?.created_by_email) === normalize(user?.email) ||
            viewerIdentity.some((identity) => assigned.includes(identity));
          if (!isMine) return false;
        }

        const contadoresTexto = [
          item?.contador_nome,
          item?.responsavel_nome,
          item?.executor_nome,
          item?.setor,
          item?.tipo_servico,
          ...(Array.isArray(item?.assignedTo) ? item.assignedTo : []),
        ]
          .map(normalize)
          .join(' ');
        return contadoresTexto.includes(viewContadorKey);
      })
      .sort((a, b) => new Date(b.created_at || b.data_criacao || 0) - new Date(a.created_at || a.data_criacao || 0));
  }, [services, viewContadorKey, user, isAdmin, hasSpecificContadorVisualization]);

  const currentContador = CONTADORES.find((item) => item.key === viewContadorKey) || CONTADORES[0];
  const statusLabel = STATUS_OPTIONS.find((item) => item.value === statusFilter)?.label || 'Todos';
  const availableContadores = visibleContadoresForArea(activeArea);

  const toggleContadorView = () => {
    if (availableContadores.length < 2) return;
    setViewContadorKey((prev) =>
      prev === availableContadores[0].key ? availableContadores[1].key : availableContadores[0].key,
    );
  };

  const openDetailsModal = (agendamento) => {
    setSelectedAgendamento(agendamento);
    setShowDetailsModal(true);
  };

  const resetNewAgendamentoForm = () => {
    setNewAgendamentoForm({
      empresa_id: '',
      cliente_nome: '',
      cliente_telefone: '',
      cliente_email: '',
      data_agendamento: '',
      hora_inicio: '',
      hora_fim: '',
      duracao_minutos: '60',
      tipo_atendimento: 'consultoria',
      motivo_atendimento: '',
      setor_responsavel: 'contadores',
      contador_id: '',
      observacoes: '',
    });
  };

  const handleCreateAgendamento = async (e) => {
    e.preventDefault();
    if (
      !newAgendamentoForm.empresa_id ||
      !newAgendamentoForm.cliente_nome ||
      !newAgendamentoForm.data_agendamento ||
      !newAgendamentoForm.hora_inicio ||
      !newAgendamentoForm.hora_fim ||
      !newAgendamentoForm.contador_id
    ) {
      toast.error('Preencha os campos obrigatorios do agendamento.');
      return;
    }

    try {
      await api.post('/agendamentos/', newAgendamentoForm);
      toast.success('Novo agendamento criado com sucesso.');
    } catch {
      const localList = parseJson(localStorage.getItem(MOCK_CONTADORES_AGENDAMENTOS_KEY) || '[]', []);
      const selectedEmpresa = clientes.find((item) => String(item.id) === String(newAgendamentoForm.empresa_id));
      const selectedContador = CONTADORES.find((item) => item.key === newAgendamentoForm.contador_id);
      const now = new Date();
      const fallbackItem = {
        id: `mock-agd-${now.getTime()}`,
        numero: `AGD-${now.getTime().toString().slice(-6)}`,
        empresa_id: newAgendamentoForm.empresa_id,
        empresa_nome: selectedEmpresa?.nome_empresa || selectedEmpresa?.nome_fantasia || 'Empresa',
        cliente_nome: newAgendamentoForm.cliente_nome,
        cliente_telefone: newAgendamentoForm.cliente_telefone,
        cliente_email: newAgendamentoForm.cliente_email,
        data_agendamento: newAgendamentoForm.data_agendamento,
        hora_inicio: newAgendamentoForm.hora_inicio,
        hora_fim: newAgendamentoForm.hora_fim,
        duracao_minutos: Number(newAgendamentoForm.duracao_minutos) || 60,
        tipo_atendimento: newAgendamentoForm.tipo_atendimento,
        motivo_atendimento: newAgendamentoForm.motivo_atendimento,
        setor_responsavel: 'contadores',
        contador_id: newAgendamentoForm.contador_id,
        contador_nome: selectedContador?.nome || newAgendamentoForm.contador_id,
        observacoes: newAgendamentoForm.observacoes,
        status: 'confirmado',
        solicitante_id: user?.id,
        solicitante_nome: user?.name,
        created_by_email: user?.email,
      };

      localStorage.setItem(
        MOCK_CONTADORES_AGENDAMENTOS_KEY,
        JSON.stringify([fallbackItem, ...(Array.isArray(localList) ? localList : [])]),
      );
      toast.success('Agendamento salvo em modo local (fallback).');
    }

    setShowNewAgendamentoModal(false);
    resetNewAgendamentoForm();
    await loadAgendamentos();
  };

  const onSelectEmpresa = (empresaId) => {
    const empresa = clientes.find((item) => String(item.id) === String(empresaId));
    setNewAgendamentoForm((prev) => ({
      ...prev,
      empresa_id: empresaId,
      cliente_nome: empresa?.nome_fantasia || empresa?.nome_empresa || prev.cliente_nome,
      cliente_email: empresa?.email || prev.cliente_email,
      cliente_telefone: empresa?.telefone || prev.cliente_telefone,
    }));
  };

  if (!hasModuleAccess('contadores')) {
    return (
      <div className="glass rounded-xl p-6">
        <p className="text-gray-300">Voce nao tem acesso ao modulo Contadores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-red-400" />
            Contadores
          </h1>
          <p className="text-gray-400 mt-2">
            {activeArea === 'servicos'
              ? `Area atual: Servicos ${currentContador?.nome || 'Sara'}`
              : `Area atual: Agendamentos ${currentContador?.nome || 'Sara'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewAgendamentoModal(true)}
            className="btn-futuristic px-4 py-2 rounded-xl flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Novo agendamento</span>
          </button>
          <button
            onClick={activeArea === 'agendamentos' ? loadAgendamentos : loadServices}
            className="btn-secondary px-4 py-2 rounded-xl flex items-center space-x-2"
          >
            <Clock className="w-4 h-4" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveArea('agendamentos')}
          className={`px-4 py-2 rounded-lg ${activeArea === 'agendamentos' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
        >
          Agendamentos
        </button>
        <button
          type="button"
          onClick={() => setActiveArea('servicos')}
          className={`px-4 py-2 rounded-lg ${activeArea === 'servicos' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
        >
          Servicos
        </button>

        {(isAdmin || hasSpecificContadorVisualization) && availableContadores.length > 1 ? (
          <button
            type="button"
            onClick={toggleContadorView}
            className="ml-2 inline-flex items-center gap-2 rounded-lg border border-blue-500/35 bg-blue-500/15 px-3 py-2 text-sm text-blue-100"
          >
            Visualizacao: {currentContador?.nome || 'Sara'}
            <ChevronDown className="w-4 h-4" />
          </button>
        ) : null}

        {activeArea === 'agendamentos' ? (
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setStatusDropdownOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            >
              {statusLabel}
              <ChevronDown className="w-4 h-4" />
            </button>
            {statusDropdownOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-gray-700 bg-gray-900 p-1.5">
                {STATUS_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(item.value);
                      setStatusDropdownOpen(false);
                    }}
                    className="w-full rounded px-2 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {activeArea === 'agendamentos' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="glass rounded-xl p-8 text-center text-gray-400">Carregando...</div>
          ) : filteredAgendamentos.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-gray-400">
              Nenhum agendamento encontrado para este filtro.
            </div>
          ) : (
            filteredAgendamentos.map((agd) => (
              <div key={agd.id} className="glass rounded-xl p-5 border border-gray-700/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400">{agd.numero || '-'}</p>
                    <h3 className="text-lg font-semibold text-white mt-1">{agd.cliente_nome}</h3>
                    <p className="text-sm text-gray-400 mt-1">{agd.empresa_nome}</p>
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-300">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        {new Date(agd.data_agendamento).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-4 h-4 text-blue-400" />
                        {agd.hora_inicio} - {agd.hora_fim}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white capitalize">
                      {agd.status || 'pendente'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openDetailsModal(agd)}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-500/35 bg-blue-500/15 px-2.5 py-1.5 text-xs text-blue-100"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Detalhes
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredServices.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-gray-400">
              Nenhum servico encontrado para {currentContador?.nome}.
            </div>
          ) : (
            filteredServices.map((item) => (
              <div key={item.id} className="glass rounded-xl p-5 border border-gray-700/50">
                <p className="text-xs text-gray-400">{item.numero || '-'}</p>
                <h3 className="text-lg font-semibold text-white mt-1">
                  {item.tipo_servico || item.titulo || 'Servico'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">{item.empresa_nome || item.cliente || '-'}</p>
                <p className="text-sm text-gray-300 mt-2 capitalize">Status: {item.status || 'pendente'}</p>
              </div>
            ))
          )}
        </div>
      )}

      {showDetailsModal && selectedAgendamento ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Detalhes do agendamento</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedAgendamento(null);
                }}
                className="px-3 py-2 bg-gray-700 rounded-lg text-white"
              >
                Fechar
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-gray-400">
                Numero: <span className="text-white">{selectedAgendamento.numero}</span>
              </p>
              <p className="text-gray-400">
                Cliente: <span className="text-white">{selectedAgendamento.cliente_nome}</span>
              </p>
              <p className="text-gray-400">
                Empresa: <span className="text-white">{selectedAgendamento.empresa_nome}</span>
              </p>
              <p className="text-gray-400">
                Data:{' '}
                <span className="text-white">
                  {new Date(selectedAgendamento.data_agendamento).toLocaleDateString('pt-BR')}
                </span>
              </p>
              <p className="text-gray-400">
                Horario: <span className="text-white">{selectedAgendamento.hora_inicio} - {selectedAgendamento.hora_fim}</span>
              </p>
              <p className="text-gray-400">
                Motivo: <span className="text-white">{selectedAgendamento.motivo_atendimento}</span>
              </p>
              {selectedAgendamento.observacoes ? (
                <p className="text-gray-400">
                  Observacoes: <span className="text-white">{selectedAgendamento.observacoes}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showNewAgendamentoModal ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Novo agendamento</h2>
              <button
                onClick={() => setShowNewAgendamentoModal(false)}
                className="px-3 py-2 bg-gray-700 rounded-lg text-white"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleCreateAgendamento} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Empresa *</label>
                  <select
                    value={newAgendamentoForm.empresa_id}
                    onChange={(e) => onSelectEmpresa(e.target.value)}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    required
                  >
                    <option value="">Selecione...</option>
                    {clientes.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.nome_empresa || client.nome_fantasia}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Cliente *</label>
                  <input
                    value={newAgendamentoForm.cliente_nome}
                    onChange={(e) => setNewAgendamentoForm((prev) => ({ ...prev, cliente_nome: e.target.value }))}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Data *</label>
                  <input
                    type="date"
                    value={newAgendamentoForm.data_agendamento}
                    onChange={(e) => setNewAgendamentoForm((prev) => ({ ...prev, data_agendamento: e.target.value }))}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Hora inicio *</label>
                  <input
                    type="time"
                    value={newAgendamentoForm.hora_inicio}
                    onChange={(e) => setNewAgendamentoForm((prev) => ({ ...prev, hora_inicio: e.target.value }))}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Hora fim *</label>
                  <input
                    type="time"
                    value={newAgendamentoForm.hora_fim}
                    onChange={(e) => setNewAgendamentoForm((prev) => ({ ...prev, hora_fim: e.target.value }))}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Contador *</label>
                  <select
                    value={newAgendamentoForm.contador_id}
                    onChange={(e) => setNewAgendamentoForm((prev) => ({ ...prev, contador_id: e.target.value }))}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    required
                  >
                    <option value="">Selecione...</option>
                    {CONTADORES.map((contador) => (
                      <option key={contador.key} value={contador.key}>
                        {contador.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Tipo atendimento</label>
                  <input
                    value={newAgendamentoForm.tipo_atendimento}
                    onChange={(e) => setNewAgendamentoForm((prev) => ({ ...prev, tipo_atendimento: e.target.value }))}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Motivo atendimento *</label>
                <textarea
                  value={newAgendamentoForm.motivo_atendimento}
                  onChange={(e) => setNewAgendamentoForm((prev) => ({ ...prev, motivo_atendimento: e.target.value }))}
                  rows={3}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button type="submit" className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                  Salvar agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PainelContadores;

