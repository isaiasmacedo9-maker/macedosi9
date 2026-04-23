import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDashboardTasks } from './dashboardTaskData';

const MOCK_SERVICES = [
  { id: 'srv-1', cliente: 'Loja Vila Centro', tipo: 'Certificado digital', status: 'em_andamento', moduleKey: 'servicos', criadoEm: '2026-04-10', assignedTo: ['dev-user'] },
  { id: 'srv-2', cliente: 'Macedo Comercio', tipo: 'Abertura de filial', status: 'novo', moduleKey: 'servicos', criadoEm: '2026-04-12', assignedTo: ['colaborador@macedosi.com'] },
  { id: 'srv-3', cliente: 'Clinica Sao Miguel', tipo: 'Regularizacao fiscal', status: 'concluido', moduleKey: 'servicos', criadoEm: '2026-04-02', assignedTo: ['dev-user'] },
];

const moduleLabelByKey = {
  atendimento: 'Atendimento',
  comercial: 'Comercial',
  contadores: 'Contadores',
  financeiro: 'Financeiro',
  fiscal: 'Fiscal',
  trabalhista: 'Trabalhista',
  servicos: 'Serviços',
  clientes: 'Clientes',
};

const alertBadge = {
  alta: 'bg-rose-500/15 text-rose-200 border border-rose-500/30',
  media: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  baixa: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
};

const daysBetween = (fromDate, toDate) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  const diff = Math.floor((to - from) / (1000 * 60 * 60 * 24));
  return Number.isNaN(diff) ? 0 : diff;
};

const normalizeIdentity = (value = '') => String(value).trim().toLowerCase();
const CUSTOM_ALERTS_KEY = 'mock_sector_alerts_v1';

const DashboardAlertsView = () => {
  const { user, hasModuleAccess } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [customAlerts, setCustomAlerts] = useState([]);
  const [isNewAlertOpen, setIsNewAlertOpen] = useState(false);
  const [newAlert, setNewAlert] = useState({
    moduleKey: 'servicos',
    titulo: '',
    criticidade: 'media',
    vencimento: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CUSTOM_ALERTS_KEY) || '[]');
      setCustomAlerts(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCustomAlerts([]);
    }
  }, []);

  const viewerIdentity = useMemo(
    () => [user?.id, user?.email, user?.name].filter(Boolean).map(normalizeIdentity),
    [user],
  );

  const isAssignedToViewer = (item) => {
    if (isAdmin) return true;
    if (!Array.isArray(item?.assignedTo) || item.assignedTo.length === 0) return false;
    const assigned = item.assignedTo.map(normalizeIdentity);
    return viewerIdentity.some((identity) => assigned.includes(identity));
  };

  const tasks = useMemo(
    () => getDashboardTasks({ user, isAdmin, hasModuleAccess }),
    [user, isAdmin, hasModuleAccess],
  );

  const services = useMemo(
    () => MOCK_SERVICES.filter((item) => isAssignedToViewer(item) && hasModuleAccess(item.moduleKey)),
    [user, hasModuleAccess],
  );

  const alerts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const taskAlerts = tasks
      .filter((item) => item.status !== 'concluida' && item.status !== 'concluido')
      .map((item) => {
        const diasComTarefa = Math.max(0, daysBetween(item.atribuidoEm || item.vencimento || today, today));
        const diasParaVencer = daysBetween(today, item.vencimento || today);
        const criticidade = diasParaVencer <= 1 ? 'alta' : diasParaVencer <= 3 ? 'media' : 'baixa';
        return {
          id: `alert-task-${item.id}`,
          titulo: `${item.titulo}: tem ${diasComTarefa} dia(s) com voce.`,
          moduleKey: item.moduleKey,
          criticidade,
          vencimento: item.vencimento || today,
          tipo: 'tarefa',
        };
      });

    const serviceAlerts = services
      .filter((item) => item.status !== 'concluido')
      .map((item) => {
        const diasComServico = Math.max(0, daysBetween(item.criadoEm || today, today));
        return {
          id: `alert-service-${item.id}`,
          titulo: `${item.tipo} (${item.cliente}): ${diasComServico} dia(s) em aberto.`,
          moduleKey: item.moduleKey,
          criticidade: diasComServico >= 7 ? 'alta' : diasComServico >= 3 ? 'media' : 'baixa',
          vencimento: item.vencimento || item.criadoEm || today,
          tipo: 'servico',
        };
      });

    return [...taskAlerts, ...serviceAlerts, ...customAlerts]
      .sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));
  }, [tasks, services, customAlerts]);

  const groupedBySector = useMemo(() => {
    const group = {};
    alerts.forEach((alert) => {
      const key = alert.moduleKey || 'outros';
      if (!group[key]) group[key] = [];
      group[key].push(alert);
    });
    return group;
  }, [alerts]);

  const orderedSectors = useMemo(
    () => Object.keys(groupedBySector).sort((a, b) => (moduleLabelByKey[a] || a).localeCompare(moduleLabelByKey[b] || b)),
    [groupedBySector],
  );

  const createNewAlert = () => {
    const title = String(newAlert.titulo || '').trim();
    if (!title) return;
    const payload = {
      id: `custom-alert-${Date.now()}`,
      titulo: title,
      moduleKey: newAlert.moduleKey || 'servicos',
      criticidade: newAlert.criticidade || 'media',
      vencimento: newAlert.vencimento || new Date().toISOString().slice(0, 10),
      tipo: 'manual',
      createdBy: user?.name || user?.email || 'Usuário',
      createdAt: new Date().toISOString(),
    };
    setCustomAlerts((prev) => {
      const next = [payload, ...(Array.isArray(prev) ? prev : [])];
      localStorage.setItem(CUSTOM_ALERTS_KEY, JSON.stringify(next));
      return next;
    });
    setIsNewAlertOpen(false);
    setNewAlert({
      moduleKey: 'servicos',
      titulo: '',
      criticidade: 'media',
      vencimento: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="space-y-5">
      <section className="glass-intense rounded-2xl border border-white/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Alertas do setor</h1>
            <p className="mt-2 text-sm text-gray-300">Alertas divididos pelos setores/módulos que este usuário pode visualizar.</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao dashboard
          </button>
          <button
            onClick={() => setIsNewAlertOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25"
          >
            Novo alerta
          </button>
        </div>
      </section>

      {isNewAlertOpen ? (
        <section className="glass rounded-2xl border border-white/10 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={newAlert.titulo}
              onChange={(event) => setNewAlert((prev) => ({ ...prev, titulo: event.target.value }))}
              placeholder="Título do alerta"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40 md:col-span-2"
            />
            <select
              value={newAlert.moduleKey}
              onChange={(event) => setNewAlert((prev) => ({ ...prev, moduleKey: event.target.value }))}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              {Object.keys(moduleLabelByKey).map((key) => (
                <option key={key} value={key}>{moduleLabelByKey[key]}</option>
              ))}
            </select>
            <select
              value={newAlert.criticidade}
              onChange={(event) => setNewAlert((prev) => ({ ...prev, criticidade: event.target.value }))}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
            <input
              type="date"
              value={newAlert.vencimento}
              onChange={(event) => setNewAlert((prev) => ({ ...prev, vencimento: event.target.value }))}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
            <div className="md:col-span-3" />
            <button
              type="button"
              onClick={createNewAlert}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-100"
            >
              Salvar alerta
            </button>
          </div>
        </section>
      ) : null}

      {orderedSectors.length > 0 ? orderedSectors.map((sector) => (
        <section key={sector} className="glass rounded-2xl border border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-300" />
            <h2 className="text-base font-semibold text-white">{moduleLabelByKey[sector] || sector}</h2>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-300">
              {groupedBySector[sector].length}
            </span>
          </div>
          <div className="space-y-2.5">
            {groupedBySector[sector].map((item) => (
              <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-white">{item.titulo}</p>
                    <p className="mt-1 text-xs text-gray-500">Vencimento/Referencia: {new Date(`${item.vencimento}T00:00:00`).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${alertBadge[item.criticidade] || alertBadge.media}`}>
                    {item.criticidade}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )) : (
        <section className="glass rounded-2xl border border-white/10 p-6 text-center text-sm text-gray-400">
          <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-gray-500" />
          Nenhum alerta disponível para os setores deste usuário.
        </section>
      )}
    </div>
  );
};

export default DashboardAlertsView;
