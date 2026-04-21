import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_DEPARTMENTS = [
  { id: 'adm', name: 'Administrativo', color: '#d14d4d', locked: true, group: 'padrao' },
  { id: 'com', name: 'Comercial', color: '#cf9448', locked: true, group: 'padrao' },
  { id: 'con', name: 'Contábil', color: '#4b8ed8', locked: true, group: 'padrao' },
  { id: 'fis', name: 'Fiscal', color: '#4ac349', locked: true, group: 'padrao' },
  { id: 'leg', name: 'Legalização', color: '#4dc3c0', locked: true, group: 'padrao' },
  { id: 'pes', name: 'Pessoal', color: '#d3be4f', locked: true, group: 'padrao' },
  { id: 'rh', name: 'RH', color: '#b84bd8', locked: true, group: 'padrao' },
  { id: 'fin', name: 'Financeiro', color: '#7d56d9', locked: false, group: 'meus' },
  { id: 'ate', name: 'Atendimento', color: '#d59d4a', locked: false, group: 'meus' },
];

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getInitials = (name = '') => {
  const parts = String(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return '--';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const ServicesSettingsPanel = ({ allUsers = [], allClients = [], currentUser }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
  const [tab, setTab] = useState('departamentos');
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [membersByDepartment, setMembersByDepartment] = useState({});
  const [assignmentsByDepartment, setAssignmentsByDepartment] = useState({});
  const [activityLogs, setActivityLogs] = useState([]);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState(() => (DEFAULT_DEPARTMENTS[0]?.id || null));
  const [allUsersSelection, setAllUsersSelection] = useState([]);
  const [deptUsersSelection, setDeptUsersSelection] = useState([]);
  const [allClientsSelection, setAllClientsSelection] = useState([]);
  const [assignedClientsSelection, setAssignedClientsSelection] = useState([]);
  const [managerSearch, setManagerSearch] = useState('');
  const [assignedSearch, setAssignedSearch] = useState('');
  const [regimeFilter, setRegimeFilter] = useState('todos');
  const [logOrigin, setLogOrigin] = useState('Modelos');
  const [logSearch, setLogSearch] = useState('');
  const [logAction, setLogAction] = useState('Todos');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [syncingConfig, setSyncingConfig] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState('');
  const hasLoadedRemoteConfigRef = useRef(false);
  const pendingAutoSyncRef = useRef(null);

  const selectedDepartment = useMemo(
    () => departments.find((item) => item.id === selectedDepartmentId) || departments[0] || null,
    [departments, selectedDepartmentId],
  );

  const usersNormalized = useMemo(
    () =>
      allUsers.map((user, index) => ({
        id: user.id || user.email || `usr-${index}`,
        name: user.name || user.email || 'Usuário',
      })),
    [allUsers],
  );

  const clientsNormalized = useMemo(
    () =>
      allClients.map((client, index) => ({
        id: String(client.id || client.clientRefId || client.cnpj || `cli-${index}`),
        name: client.nome_empresa || client.nome_fantasia || client.empresa_nome || 'Cliente',
        cnpj: client.cnpj || '',
        regime: client.tipo_regime || client.regime || 'todos',
      })),
    [allClients],
  );

  const currentDeptMemberIds = useMemo(
    () => membersByDepartment[selectedDepartment?.id] || [],
    [membersByDepartment, selectedDepartment?.id],
  );

  const currentDeptMembers = useMemo(
    () => usersNormalized.filter((item) => currentDeptMemberIds.includes(item.id)),
    [usersNormalized, currentDeptMemberIds],
  );

  const currentDeptManagerId = assignmentsByDepartment[selectedDepartment?.id]?.managerId || '';
  const currentDeptClientIds = assignmentsByDepartment[selectedDepartment?.id]?.clientIds || [];

  const currentDeptClients = useMemo(
    () => clientsNormalized.filter((item) => currentDeptClientIds.includes(item.id)),
    [clientsNormalized, currentDeptClientIds],
  );

  const managerClientsFiltered = useMemo(() => {
    const term = normalize(managerSearch);
    return clientsNormalized.filter((client) => {
      const regimeOk = regimeFilter === 'todos' || normalize(client.regime) === normalize(regimeFilter);
      if (!regimeOk) return false;
      if (!term) return true;
      return normalize(client.name).includes(term) || normalize(client.cnpj).includes(term);
    });
  }, [clientsNormalized, managerSearch, regimeFilter]);

  const assignedClientsFiltered = useMemo(() => {
    const term = normalize(assignedSearch);
    return currentDeptClients.filter((client) => {
      if (!term) return true;
      return normalize(client.name).includes(term) || normalize(client.cnpj).includes(term);
    });
  }, [currentDeptClients, assignedSearch]);

  useEffect(() => {
    if (!selectedDepartmentId && departments.length) setSelectedDepartmentId(departments[0].id);
  }, [departments, selectedDepartmentId]);

  useEffect(() => {
    const loadRemoteConfig = async () => {
      try {
        setLoadingConfig(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/services/configuration`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Falha ao carregar configuração');
        const payload = await response.json();
        if (Array.isArray(payload?.departments) && payload.departments.length) {
          setDepartments(payload.departments);
        }
        if (payload?.membersByDepartment && typeof payload.membersByDepartment === 'object') {
          setMembersByDepartment(payload.membersByDepartment);
        }
        if (payload?.assignmentsByDepartment && typeof payload.assignmentsByDepartment === 'object') {
          setAssignmentsByDepartment(payload.assignmentsByDepartment);
        }
        if (Array.isArray(payload?.activityLogs)) {
          setActivityLogs(payload.activityLogs);
        }
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.warn('Sem configuração remota de serviços, mantendo padrão em memória.', error);
      } finally {
        hasLoadedRemoteConfigRef.current = true;
        setLoadingConfig(false);
      }
    };
    loadRemoteConfig();
  }, [API_URL]);

  const pushLog = (origin, action, details) => {
    const actor = currentUser?.name || currentUser?.email || 'Usuário';
    setActivityLogs((prev) => [
      {
        id: `log-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        origin,
        action,
        details,
        actor,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const persistRemoteConfig = async (showToast = false) => {
    try {
      setSyncingConfig(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/services/configuration`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          departments,
          membersByDepartment,
          assignmentsByDepartment,
          activityLogs,
        }),
      });
      if (!response.ok) throw new Error('Falha ao salvar configuração');
      setLastSyncAt(new Date().toISOString());
      if (showToast) toast.success('Configurações de serviços salvas.');
    } catch (error) {
      console.warn('Falha ao persistir configuração de serviços no backend.', error);
      if (showToast) toast.error('Não foi possível salvar no backend.');
    } finally {
      setSyncingConfig(false);
    }
  };

  useEffect(() => {
    if (!hasLoadedRemoteConfigRef.current) return;
    if (loadingConfig) return;
    if (pendingAutoSyncRef.current) window.clearTimeout(pendingAutoSyncRef.current);
    pendingAutoSyncRef.current = window.setTimeout(() => {
      persistRemoteConfig(false);
    }, 700);
    return () => {
      if (pendingAutoSyncRef.current) window.clearTimeout(pendingAutoSyncRef.current);
    };
  }, [departments, membersByDepartment, assignmentsByDepartment, activityLogs, loadingConfig]);

  const saveDepartmentMeta = () => {
    if (!selectedDepartment) return;
    pushLog('Configurações', 'update', `Atualizou metadados do departamento ${selectedDepartment.name}.`);
    setTimeout(() => persistRemoteConfig(), 0);
  };

  const addDepartment = () => {
    const nextId = `dep-${Date.now()}`;
    const nextName = `Novo departamento ${departments.length + 1}`;
    const nextDepartment = {
      id: nextId,
      name: nextName,
      color: '#4f46e5',
      locked: false,
      group: 'meus',
    };
    setDepartments((prev) => [...prev, nextDepartment]);
    setSelectedDepartmentId(nextId);
    pushLog('Configurações', 'add', `Criou o departamento ${nextName}.`);
    setTimeout(() => persistRemoteConfig(), 0);
  };

  const addUsersToDepartment = () => {
    if (!selectedDepartment || !allUsersSelection.length) return;
    setMembersByDepartment((prev) => ({
      ...prev,
      [selectedDepartment.id]: [...new Set([...(prev[selectedDepartment.id] || []), ...allUsersSelection])],
    }));
    pushLog('Configurações', 'add', `Adicionou ${allUsersSelection.length} membro(s) em ${selectedDepartment.name}.`);
    setAllUsersSelection([]);
    setTimeout(() => persistRemoteConfig(), 0);
  };

  const removeUsersFromDepartment = () => {
    if (!selectedDepartment || !deptUsersSelection.length) return;
    setMembersByDepartment((prev) => ({
      ...prev,
      [selectedDepartment.id]: (prev[selectedDepartment.id] || []).filter((id) => !deptUsersSelection.includes(id)),
    }));
    pushLog('Configurações', 'remove', `Removeu ${deptUsersSelection.length} membro(s) de ${selectedDepartment.name}.`);
    setDeptUsersSelection([]);
    setTimeout(() => persistRemoteConfig(), 0);
  };

  const saveClientAssignments = () => {
    if (!selectedDepartment) return;
    pushLog('Configurações', 'update', `Salvou responsáveis/clientes de ${selectedDepartment.name}.`);
    setTimeout(() => persistRemoteConfig(), 0);
  };

  const addSelectedClients = () => {
    if (!selectedDepartment || !allClientsSelection.length) return;
    setAssignmentsByDepartment((prev) => {
      const current = prev[selectedDepartment.id] || { managerId: currentDeptManagerId, clientIds: [] };
      return {
        ...prev,
        [selectedDepartment.id]: {
          managerId: current.managerId,
          clientIds: [...new Set([...(current.clientIds || []), ...allClientsSelection])],
        },
      };
    });
    pushLog('Configurações', 'add', `Vinculou ${allClientsSelection.length} cliente(s) ao responsável do departamento ${selectedDepartment.name}.`);
    setAllClientsSelection([]);
    setTimeout(() => persistRemoteConfig(), 0);
  };

  const addAllFilteredClients = () => {
    if (!selectedDepartment || !managerClientsFiltered.length) return;
    const ids = managerClientsFiltered.map((item) => item.id);
    setAssignmentsByDepartment((prev) => {
      const current = prev[selectedDepartment.id] || { managerId: currentDeptManagerId, clientIds: [] };
      return {
        ...prev,
        [selectedDepartment.id]: {
          managerId: current.managerId,
          clientIds: [...new Set([...(current.clientIds || []), ...ids])],
        },
      };
    });
    pushLog('Configurações', 'add', `Vinculou todos os clientes filtrados em ${selectedDepartment.name}.`);
    setTimeout(() => persistRemoteConfig(), 0);
  };

  const removeSelectedClients = () => {
    if (!selectedDepartment || !assignedClientsSelection.length) return;
    setAssignmentsByDepartment((prev) => {
      const current = prev[selectedDepartment.id] || { managerId: currentDeptManagerId, clientIds: [] };
      return {
        ...prev,
        [selectedDepartment.id]: {
          managerId: current.managerId,
          clientIds: (current.clientIds || []).filter((id) => !assignedClientsSelection.includes(id)),
        },
      };
    });
    pushLog('Configurações', 'remove', `Removeu ${assignedClientsSelection.length} cliente(s) do responsável em ${selectedDepartment.name}.`);
    setAssignedClientsSelection([]);
    setTimeout(() => persistRemoteConfig(), 0);
  };

  const removeAllAssignedClients = () => {
    if (!selectedDepartment) return;
    setAssignmentsByDepartment((prev) => {
      const current = prev[selectedDepartment.id] || { managerId: currentDeptManagerId, clientIds: [] };
      return {
        ...prev,
        [selectedDepartment.id]: { ...current, clientIds: [] },
      };
    });
    pushLog('Configurações', 'remove', `Removeu todos os clientes vinculados em ${selectedDepartment.name}.`);
    setAssignedClientsSelection([]);
    setTimeout(() => persistRemoteConfig(), 0);
  };

  const setDepartmentManager = (managerId) => {
    if (!selectedDepartment) return;
    setAssignmentsByDepartment((prev) => ({
      ...prev,
      [selectedDepartment.id]: {
        managerId,
        clientIds: prev[selectedDepartment.id]?.clientIds || [],
      },
    }));
  };

  const filteredLogs = useMemo(() => {
    const term = normalize(logSearch);
    return activityLogs.filter((log) => {
      if (logOrigin !== 'Todos' && log.origin !== logOrigin) return false;
      if (logAction !== 'Todos' && normalize(log.action) !== normalize(logAction)) return false;
      if (!term) return true;
      return normalize(log.details).includes(term) || normalize(log.actor).includes(term);
    });
  }, [activityLogs, logOrigin, logSearch, logAction]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
          {[
            ['departamentos', 'Departamentos'],
            ['responsaveis', 'Responsáveis dos Clientes'],
            ['historico', 'Histórico de ações'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-slate-200 text-slate-900' : 'text-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs text-gray-400">
        {loadingConfig
          ? 'Sincronizando configurações...'
          : syncingConfig
            ? 'Salvando alterações no backend...'
            : (lastSyncAt ? `Última sincronização: ${new Date(lastSyncAt).toLocaleString('pt-BR')}` : 'Aguardando primeira sincronização automática.')}
      </div>

      {tab === 'departamentos' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-xl border border-white/10 bg-black/20">
            <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-gray-300">Departamentos padrão</div>
            <div className="max-h-[460px] overflow-auto">
              {departments.map((dep) => (
                <button
                  key={dep.id}
                  type="button"
                  onClick={() => setSelectedDepartmentId(dep.id)}
                  className={`flex w-full items-center justify-between border-b border-white/10 px-4 py-3 text-left ${selectedDepartmentId === dep.id ? 'bg-emerald-600/20 text-white' : 'text-gray-200 hover:bg-white/5'}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white" style={{ backgroundColor: dep.color }}>
                      {getInitials(dep.name).slice(0, 1)}
                    </span>
                    {dep.name}
                  </span>
                  <span className="text-xs text-gray-500">{dep.locked ? '🔒' : ''}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-white/10 p-3">
              <button
                type="button"
                onClick={addDepartment}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-left text-sm font-semibold text-gray-200 hover:bg-white/10"
              >
                + Novo departamento
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20">
            <div className="grid grid-cols-1 gap-3 border-b border-white/10 p-4 lg:grid-cols-3">
              <label className="text-sm text-gray-300">
                Nome do departamento
                <input
                  value={selectedDepartment?.name || ''}
                  onChange={(e) =>
                    setDepartments((prev) =>
                      prev.map((dep) => (dep.id === selectedDepartment?.id ? { ...dep, name: e.target.value } : dep)),
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="text-sm text-gray-300">
                Cor do departamento
                <input
                  type="color"
                  value={selectedDepartment?.color || '#22c55e'}
                  onChange={(e) =>
                    setDepartments((prev) =>
                      prev.map((dep) => (dep.id === selectedDepartment?.id ? { ...dep, color: e.target.value } : dep)),
                    )
                  }
                  className="mt-1 h-[42px] w-full rounded-lg border border-white/20 bg-[#1f2736] p-1"
                />
              </label>
              <label className="text-sm text-gray-300">
                Gestor
                <select
                  value={currentDeptManagerId}
                  onChange={(e) => setDepartmentManager(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none"
                >
                  <option value="">Selecione</option>
                  {usersNormalized.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-2xl font-semibold text-white">Todos os usuários</div>
                <div className="max-h-[260px] overflow-auto rounded-lg border border-white/10">
                  {usersNormalized.map((u) => (
                    <label key={u.id} className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm text-gray-200">
                      <span>{u.name}</span>
                      <input
                        type="checkbox"
                        checked={allUsersSelection.includes(u.id)}
                        onChange={(e) =>
                          setAllUsersSelection((prev) =>
                            e.target.checked ? [...new Set([...prev, u.id])] : prev.filter((id) => id !== u.id),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <button type="button" onClick={addUsersToDepartment} className="mt-2 w-full rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200">
                  Adicionar ao departamento
                </button>
              </div>

              <div>
                <div className="mb-2 text-2xl font-semibold text-white">Membros de {selectedDepartment?.name || '-'}</div>
                <div className="max-h-[260px] overflow-auto rounded-lg border border-white/10">
                  {currentDeptMembers.map((u) => (
                    <label key={u.id} className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm text-gray-200">
                      <span>{u.name}</span>
                      <input
                        type="checkbox"
                        checked={deptUsersSelection.includes(u.id)}
                        onChange={(e) =>
                          setDeptUsersSelection((prev) =>
                            e.target.checked ? [...new Set([...prev, u.id])] : prev.filter((id) => id !== u.id),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <button type="button" onClick={removeUsersFromDepartment} className="mt-2 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-semibold text-gray-200">
                  Remover do departamento
                </button>
              </div>
            </div>

            <div className="border-t border-white/10 p-4 text-right">
              <button type="button" onClick={saveDepartmentMeta} className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200">
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'responsaveis' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-xl border border-white/10 bg-black/20">
            <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-gray-300">Meus departamentos</div>
            <div className="max-h-[520px] overflow-auto">
              {departments.map((dep) => (
                <button
                  key={dep.id}
                  type="button"
                  onClick={() => setSelectedDepartmentId(dep.id)}
                  className={`flex w-full items-center gap-2 border-b border-white/10 px-4 py-3 text-left ${selectedDepartmentId === dep.id ? 'bg-emerald-600/20 text-white' : 'text-gray-200 hover:bg-white/5'}`}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white" style={{ backgroundColor: dep.color }}>
                    {getInitials(dep.name).slice(0, 1)}
                  </span>
                  {dep.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20">
            <div className="grid grid-cols-1 gap-3 border-b border-white/10 p-4 lg:grid-cols-2">
              <label className="text-sm text-gray-300">
                Departamento selecionado
                <input value={selectedDepartment?.name || ''} readOnly className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none" />
              </label>
              <label className="text-sm text-gray-300">
                Escolha o responsável
                <select value={currentDeptManagerId} onChange={(e) => setDepartmentManager(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none">
                  <option value="">Selecione</option>
                  {usersNormalized.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-2xl font-semibold text-white">Todos os clientes</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select value={regimeFilter} onChange={(e) => setRegimeFilter(e.target.value)} className="rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none">
                    <option value="todos">Todos</option>
                    <option value="simples_nacional">Simples Nacional</option>
                    <option value="lucro_presumido">Lucro Presumido</option>
                    <option value="lucro_real">Lucro Real</option>
                    <option value="mei">MEI</option>
                  </select>
                  <div className="flex items-center rounded-lg border border-white/20 bg-[#1f2736] px-3">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input value={managerSearch} onChange={(e) => setManagerSearch(e.target.value)} placeholder="Filtre por nome ou CNPJ" className="w-full bg-transparent px-2 py-2 text-white outline-none" />
                  </div>
                </div>
                <div className="mt-2 max-h-[260px] overflow-auto rounded-lg border border-white/10">
                  {managerClientsFiltered.map((client) => (
                    <label key={client.id} className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm text-gray-200">
                      <span>
                        <div className="font-semibold">{client.name}</div>
                        <div className="text-xs text-gray-400">{client.cnpj || '-'}</div>
                      </span>
                      <input
                        type="checkbox"
                        checked={allClientsSelection.includes(client.id)}
                        onChange={(e) =>
                          setAllClientsSelection((prev) =>
                            e.target.checked ? [...new Set([...prev, client.id])] : prev.filter((id) => id !== client.id),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button type="button" onClick={addAllFilteredClients} className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200">
                    Adicionar todos
                  </button>
                  <button type="button" onClick={addSelectedClients} className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200">
                    Adicionar ao responsável
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 text-2xl font-semibold text-white">
                  Clientes de {usersNormalized.find((u) => u.id === currentDeptManagerId)?.name || 'não atribuído'}
                </div>
                <div className="flex items-center rounded-lg border border-white/20 bg-[#1f2736] px-3">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input value={assignedSearch} onChange={(e) => setAssignedSearch(e.target.value)} placeholder="Filtre por nome ou CNPJ" className="w-full bg-transparent px-2 py-2 text-white outline-none" />
                </div>
                <div className="mt-2 max-h-[260px] overflow-auto rounded-lg border border-white/10">
                  {assignedClientsFiltered.map((client) => (
                    <label key={client.id} className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm text-gray-200">
                      <span>
                        <div className="font-semibold">{client.name}</div>
                        <div className="text-xs text-gray-400">{client.cnpj || '-'}</div>
                      </span>
                      <input
                        type="checkbox"
                        checked={assignedClientsSelection.includes(client.id)}
                        onChange={(e) =>
                          setAssignedClientsSelection((prev) =>
                            e.target.checked ? [...new Set([...prev, client.id])] : prev.filter((id) => id !== client.id),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button type="button" onClick={removeSelectedClients} className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-semibold text-gray-200">
                    Remover do responsável
                  </button>
                  <button type="button" onClick={removeAllAssignedClients} className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-semibold text-gray-200">
                    Remover todos
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 p-4 text-right">
              <button type="button" onClick={saveClientAssignments} className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200">
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'historico' ? (
        <div className="rounded-xl border border-white/10 bg-black/20">
          <div className="grid grid-cols-1 gap-4 border-b border-white/10 p-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-300">Origem</div>
              {['Todos', 'Processos', 'Tarefas', 'Modelos', 'Configurações'].map((origin) => (
                <button
                  key={origin}
                  type="button"
                  onClick={() => setLogOrigin(origin)}
                  className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${logOrigin === origin ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-100' : 'border-white/10 bg-white/5 text-gray-300'}`}
                >
                  {origin}
                </button>
              ))}
            </div>
            <div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                <div className="flex items-center rounded-lg border border-white/20 bg-[#1f2736] px-3">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input value={logSearch} onChange={(e) => setLogSearch(e.target.value)} placeholder="Filtre por colaborador, ação ou detalhe" className="w-full bg-transparent px-2 py-2 text-white outline-none" />
                </div>
                <select value={logAction} onChange={(e) => setLogAction(e.target.value)} className="rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none">
                  <option>Todos</option>
                  <option>add</option>
                  <option>remove</option>
                  <option>update</option>
                </select>
              </div>
              <div className="mt-3 max-h-[420px] space-y-2 overflow-auto rounded-lg border border-white/10 p-2">
                {filteredLogs.length ? filteredLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                      <span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                      <span>{log.origin}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">{log.actor}</div>
                    <div className="text-sm text-gray-300">{log.details}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-emerald-300">{log.action}</div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-white/20 px-4 py-8 text-center text-sm text-gray-400">
                    Histórico não encontrado para os filtros atuais.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ServicesSettingsPanel;
