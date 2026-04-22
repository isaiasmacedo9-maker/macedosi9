import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeService = (item = {}) => ({
  id: String(item.id || `svc-${Date.now()}`),
  nome: String(item.nome || item.name || '').trim(),
});

const normalizePlan = (item = {}) => ({
  id: String(item.id || `plan-${Date.now()}`),
  name: String(item.name || item.nome || '').trim(),
  selectedServices: Array.isArray(item.selectedServices)
    ? item.selectedServices.map(normalizeService)
    : (Array.isArray(item.services) ? item.services.map(normalizeService) : []),
});

const AssinaturasModule = () => {
  const navigate = useNavigate();
  const { hasAccess } = useAuth();
  const [availableServices, setAvailableServices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [draft, setDraft] = useState({
    id: '',
    name: '',
    selectedServices: [],
  });

  const selectedPlan = useMemo(
    () => plans.find((item) => String(item.id) === String(selectedPlanId)) || null,
    [plans, selectedPlanId],
  );

  useEffect(() => {
    if (!hasAccess([], ['financeiro'])) return;
    const load = async () => {
      try {
        const [servicesRes, plansRes] = await Promise.all([
          api.get('/financial/settings/assinaturas/services'),
          api.get('/financial/settings/assinaturas/plans'),
        ]);
        const services = Array.isArray(servicesRes.data?.items) ? servicesRes.data.items.map(normalizeService) : [];
        const plansList = Array.isArray(plansRes.data?.items) ? plansRes.data.items.map(normalizePlan) : [];
        setAvailableServices(services);
        setPlans(plansList);
        setSelectedPlanId('');
        setDraft({ id: '', name: '', selectedServices: [] });
      } catch {
        setAvailableServices([]);
        setPlans([]);
      }
    };
    load();
  }, [hasAccess]);

  const persistServices = async (items) => {
    await api.put('/financial/settings/assinaturas/services', {
      items: items.map((item) => ({ id: item.id, nome: item.nome })),
    });
  };

  const persistPlans = async (items) => {
    await api.put('/financial/settings/assinaturas/plans', {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        selectedServices: item.selectedServices.map((service) => ({ id: service.id, nome: service.nome })),
        updated_at: new Date().toISOString(),
      })),
    });
  };

  const startNewPlan = () => {
    setSelectedPlanId('');
    setDraft({ id: '', name: '', selectedServices: [] });
  };

  const editPlan = (plan) => {
    if (!plan) return;
    setSelectedPlanId(plan.id);
    setDraft({
      id: plan.id,
      name: plan.name || '',
      selectedServices: Array.isArray(plan.selectedServices) ? plan.selectedServices : [],
    });
  };

  const addServiceToDraft = (service) => {
    if (!service?.id) return;
    setDraft((current) => {
      if (current.selectedServices.some((item) => item.id === service.id)) return current;
      return {
        ...current,
        selectedServices: [...current.selectedServices, service],
      };
    });
  };

  const removeServiceFromDraft = (serviceId) => {
    setDraft((current) => ({
      ...current,
      selectedServices: current.selectedServices.filter((item) => item.id !== serviceId),
    }));
  };

  const saveDraftPlan = async () => {
    const name = String(draft.name || '').trim();
    if (!name) {
      toast.error('Informe o nome do plano.');
      return;
    }
    const planId = draft.id || `plan-${Date.now()}`;
    const nextPlan = {
      id: planId,
      name,
      selectedServices: draft.selectedServices,
    };
    const next = draft.id
      ? plans.map((item) => (item.id === draft.id ? nextPlan : item))
      : [nextPlan, ...plans];
    try {
      await persistPlans(next);
      setPlans(next);
      setSelectedPlanId(planId);
      setDraft(nextPlan);
      toast.success('Plano salvo com sucesso.');
    } catch {
      toast.error('Não foi possível salvar o plano.');
    }
  };

  const deletePlan = async (planId) => {
    const next = plans.filter((item) => item.id !== planId);
    try {
      await persistPlans(next);
      setPlans(next);
      if (String(selectedPlanId) === String(planId)) startNewPlan();
      toast.success('Plano removido.');
    } catch {
      toast.error('Não foi possível remover o plano.');
    }
  };

  const addNewService = async () => {
    const nome = String(newServiceName || '').trim();
    if (!nome) {
      toast.error('Digite o nome do serviço.');
      return;
    }
    if (availableServices.some((item) => normalizeText(item.nome) === normalizeText(nome))) {
      toast.error('Esse serviço já existe na lista.');
      return;
    }
    const nextService = { id: `svc-${Date.now()}`, nome };
    const next = [nextService, ...availableServices];
    try {
      await persistServices(next);
      setAvailableServices(next);
      setNewServiceName('');
      toast.success('Serviço adicionado na base de assinaturas.');
    } catch {
      toast.error('Não foi possível adicionar o serviço.');
    }
  };

  const removeAvailableService = async (serviceId) => {
    const nextServices = availableServices.filter((item) => item.id !== serviceId);
    const nextPlans = plans.map((plan) => ({
      ...plan,
      selectedServices: (plan.selectedServices || []).filter((item) => item.id !== serviceId),
    }));
    try {
      await Promise.all([persistServices(nextServices), persistPlans(nextPlans)]);
      setAvailableServices(nextServices);
      setPlans(nextPlans);
      setDraft((current) => ({
        ...current,
        selectedServices: (current.selectedServices || []).filter((item) => item.id !== serviceId),
      }));
      toast.success('Serviço removido.');
    } catch {
      toast.error('Não foi possível remover o serviço.');
    }
  };

  if (!hasAccess([], ['financeiro'])) {
    return <div className="glass rounded-2xl border border-white/10 p-6 text-gray-300">Acesso restrito ao módulo financeiro.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl border border-white/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Assinaturas</h1>
            <p className="mt-1 text-sm text-gray-300">Cadastre planos e escolha quais serviços cada plano oferece.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/financeiro')}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
          >
            Voltar para Financeiro
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Planos cadastrados</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={startNewPlan} className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-100">
            + Novo plano
          </button>
          {plans.map((plan) => (
            <div key={plan.id} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
              <button
                type="button"
                onClick={() => editPlan(plan)}
                className={`text-sm ${String(selectedPlanId) === String(plan.id) ? 'text-white' : 'text-gray-300'}`}
              >
                {plan.name}
              </button>
              <button type="button" onClick={() => deletePlan(plan.id)} className="text-red-300 hover:text-red-200" title="Remover plano">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-5">
        <label className="mb-2 block text-sm text-gray-300">Nome do plano</label>
        <input
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder="Digite o nome do plano"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl border border-white/10 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Serviços disponíveis</h3>
            <span className="text-sm text-gray-300">{availableServices.length}</span>
          </div>
          <div className="mb-3 flex gap-2">
            <input
              value={newServiceName}
              onChange={(event) => setNewServiceName(event.target.value)}
              placeholder="Adicionar novo serviço"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <button type="button" onClick={addNewService} className="btn-futuristic rounded-lg px-3 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
            {availableServices.map((service) => (
              <div key={service.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <span className="text-sm text-gray-100">{service.nome}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => addServiceToDraft(service)} className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-100">
                    Adicionar
                  </button>
                  <button type="button" onClick={() => removeAvailableService(service.id)} className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl border border-white/10 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Serviços do plano</h3>
            <span className="text-sm text-gray-300">{draft.selectedServices.length}</span>
          </div>
          <div className="max-h-[470px] space-y-2 overflow-auto pr-1">
            {draft.selectedServices.length ? (
              draft.selectedServices.map((service) => (
                <div key={service.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                  <span className="text-sm text-gray-100">{service.nome}</span>
                  <button
                    type="button"
                    onClick={() => removeServiceFromDraft(service.id)}
                    className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200"
                  >
                    Remover
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center text-sm text-gray-400">
                Nenhum serviço adicionado ao plano.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={saveDraftPlan} className="btn-futuristic rounded-lg px-5 py-2.5 text-sm font-semibold text-white">
          Salvar plano
        </button>
      </div>

      {selectedPlan ? (
        <div className="text-xs text-gray-400">Editando plano: <span className="text-gray-200">{selectedPlan.name}</span></div>
      ) : null}
    </div>
  );
};

export default AssinaturasModule;
