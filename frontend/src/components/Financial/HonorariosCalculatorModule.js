import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

const defaultHonorariosConfig = [
  { key: 'baseMensal', label: 'Base mensal (BPO contábil)', valor: 280 },
  { key: 'porFuncionario', label: 'Por funcionário ativo', valor: 38 },
  { key: 'porNotaFiscal', label: 'Por nota fiscal mensal', valor: 3.5 },
  { key: 'atendimentoPrioritario', label: 'Atendimento prioritário', valor: 120 },
  { key: 'consultoriaHora', label: 'Consultoria por hora', valor: 165 },
  { key: 'relatorioGerencial', label: 'Relatório gerencial extra', valor: 95 },
];

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

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const HonorariosCalculatorModule = () => {
  const navigate = useNavigate();
  const { hasAccess } = useAuth();
  const [config, setConfig] = useState(defaultHonorariosConfig);
  const [input, setInput] = useState({
    funcionarios: 0,
    notasFiscais: 0,
    horasConsultoria: 0,
    includeAtendimentoPrioritario: false,
    includeRelatorioGerencial: false,
  });
  const [availableServices, setAvailableServices] = useState([]);
  const [newServiceName, setNewServiceName] = useState('');

  useEffect(() => {
    if (!hasAccess([], ['financeiro'])) return;
    const load = async () => {
      try {
        const [honorariosRes, servicesRes] = await Promise.all([
          api.get('/financial/settings/honorarios'),
          api.get('/financial/settings/assinaturas/services'),
        ]);
        const honorariosItems = Array.isArray(honorariosRes.data?.items) ? honorariosRes.data.items : [];
        const servicesItems = Array.isArray(servicesRes.data?.items) ? servicesRes.data.items.map(normalizeService) : [];
        if (honorariosItems.length) setConfig(honorariosItems);
        setAvailableServices(servicesItems);
      } catch {
        setConfig(defaultHonorariosConfig);
        setAvailableServices([]);
      }
    };
    load();
  }, [hasAccess]);

  const getValue = (key) => Number(config.find((item) => item.key === key)?.valor || 0);

  const result = useMemo(() => {
    const baseMensal = getValue('baseMensal');
    const porFuncionario = getValue('porFuncionario') * Number(input.funcionarios || 0);
    const porNotaFiscal = getValue('porNotaFiscal') * Number(input.notasFiscais || 0);
    const consultoria = getValue('consultoriaHora') * Number(input.horasConsultoria || 0);
    const atendimentoPrioritario = input.includeAtendimentoPrioritario ? getValue('atendimentoPrioritario') : 0;
    const relatorioGerencial = input.includeRelatorioGerencial ? getValue('relatorioGerencial') : 0;
    const total = baseMensal + porFuncionario + porNotaFiscal + consultoria + atendimentoPrioritario + relatorioGerencial;
    return { baseMensal, porFuncionario, porNotaFiscal, consultoria, atendimentoPrioritario, relatorioGerencial, total };
  }, [config, input]);

  const saveConfig = async () => {
    try {
      await api.put('/financial/settings/honorarios', { items: config });
      toast.success('Configuração de honorários salva.');
    } catch {
      toast.error('Não foi possível salvar a configuração.');
    }
  };

  const updateConfigValue = (key, value) => {
    setConfig((current) =>
      current.map((item) => (item.key === key ? { ...item, valor: Number(String(value).replace(',', '.')) || 0 } : item)),
    );
  };

  const persistServices = async (items) => {
    await api.put('/financial/settings/assinaturas/services', {
      items: items.map((item) => ({ id: item.id, nome: item.nome })),
    });
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
    const next = [{ id: `svc-${Date.now()}`, nome }, ...availableServices];
    try {
      await persistServices(next);
      setAvailableServices(next);
      setNewServiceName('');
      toast.success('Serviço adicionado com sucesso.');
    } catch {
      toast.error('Não foi possível adicionar o serviço.');
    }
  };

  const removeService = async (serviceId) => {
    const next = availableServices.filter((item) => item.id !== serviceId);
    try {
      await persistServices(next);
      setAvailableServices(next);
      toast.success('Serviço removido com sucesso.');
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
            <h1 className="text-2xl font-bold text-white">Calculadora de Honorários</h1>
            <p className="mt-1 text-sm text-gray-300">Módulo separado para configuração e simulação de honorários.</p>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl border border-white/10 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">Configuração base</h2>
          <div className="space-y-3">
            {config.map((item) => (
              <label key={item.key} className="block">
                <span className="mb-1 block text-sm text-gray-300">{item.label}</span>
                <input
                  type="number"
                  step="0.01"
                  value={item.valor}
                  onChange={(event) => updateConfigValue(item.key, event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={saveConfig} className="btn-futuristic rounded-lg px-4 py-2 text-sm font-semibold text-white">
              Salvar configuração
            </button>
            <button
              type="button"
              onClick={() => setConfig(defaultHonorariosConfig)}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
            >
              <RefreshCw className="mr-2 inline h-4 w-4" />
              Restaurar padrão
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl border border-white/10 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">Simulador</h2>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm text-gray-300">Funcionários ativos</span>
              <input
                type="number"
                value={input.funcionarios}
                onChange={(event) => setInput((current) => ({ ...current, funcionarios: Number(event.target.value || 0) }))}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-300">Notas fiscais mensais</span>
              <input
                type="number"
                value={input.notasFiscais}
                onChange={(event) => setInput((current) => ({ ...current, notasFiscais: Number(event.target.value || 0) }))}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-300">Horas de consultoria</span>
              <input
                type="number"
                value={input.horasConsultoria}
                onChange={(event) => setInput((current) => ({ ...current, horasConsultoria: Number(event.target.value || 0) }))}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-200">
              <input
                type="checkbox"
                checked={input.includeAtendimentoPrioritario}
                onChange={(event) => setInput((current) => ({ ...current, includeAtendimentoPrioritario: event.target.checked }))}
              />
              Incluir atendimento prioritário
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-200">
              <input
                type="checkbox"
                checked={input.includeRelatorioGerencial}
                onChange={(event) => setInput((current) => ({ ...current, includeRelatorioGerencial: event.target.checked }))}
              />
              Incluir relatório gerencial
            </label>
          </div>
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
            <p className="text-sm">Valor sugerido</p>
            <p className="mt-1 inline-flex items-center gap-2 text-2xl font-bold">
              <Calculator className="h-5 w-5" />
              {formatCurrency(result.total)}
            </p>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-5">
        <h2 className="text-lg font-semibold text-white">Serviços compartilhados com Assinaturas</h2>
        <p className="mt-1 text-sm text-gray-400">
          A lista abaixo usa a mesma base de dados do módulo Assinaturas.
        </p>
        <div className="mt-4 flex gap-2">
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
        <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
          {availableServices.map((service) => (
            <div key={service.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <span className="text-sm text-gray-100">{service.nome}</span>
              <button
                type="button"
                onClick={() => removeService(service.id)}
                className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HonorariosCalculatorModule;
