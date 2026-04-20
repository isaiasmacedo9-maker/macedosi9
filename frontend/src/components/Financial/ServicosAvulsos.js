import React, { useMemo, useState } from 'react';
import { ArrowLeft, FilePlus2, Printer, Users, BarChart3, Plus, Save, Pencil, Trash2, Filter, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockClients } from '../../dev/mockData';

const AVULSO_ORDERS_KEY = 'mock_avulso_orders_v1';
const AVULSO_CLIENTS_KEY = 'mock_avulso_clients_v1';
const AVULSO_TEMPLATES_KEY = 'mock_avulso_os_templates_v1';
const AVULSO_TEMPLATE_DELETED_KEYS = 'mock_avulso_template_deleted_keys_v1';
const COMMERCIAL_ORDERS_KEY = 'mock_comercial_ordens_servico_v1';
const OS_MODELS_KEY = 'mock_comercial_os_models_v1';
const MOCK_ADMIN_CLIENTS_KEY = 'mock_admin_clients_v1';

const CATEGORIES = [
  { key: 'irpf', label: 'IRPF' },
  { key: 'mei', label: 'MEI' },
  { key: 'itr', label: 'ITR' },
  { key: 'legalizacao', label: 'Legalizacao' },
  { key: 'outros-servicos', label: 'Outros Servicos' },
];

const OUTROS_SERVICOS_ITEMS = [
  {
    key: 'parcelamento-debitos',
    nome: 'Parcelamento de Debitos',
    processo: 'Levantamento de debitos + simulacao + adesao ao parcelamento',
    responsavel: 'Financeiro',
    tarefas: [
      'Conferir origem e valor dos debitos',
      'Validar modalidade de parcelamento aplicavel',
      'Simular parcelas e validar com cliente',
      'Gerar e protocolar adesao',
      'Enviar resumo e cronograma para o cliente',
    ],
  },
  {
    key: 'calculo-rescisao-avulsa',
    nome: 'Calculo de Rescisao Avulsa',
    processo: 'Coleta de dados trabalhistas + calculo + conferencia + entrega',
    responsavel: 'Trabalhista',
    tarefas: [
      'Coletar dados do colaborador e contrato',
      'Validar eventos e verbas rescisorias',
      'Calcular rescisao e encargos',
      'Conferir consistencia e aprovar',
      'Entregar memoria de calculo ao cliente',
    ],
  },
  {
    key: 'outros-servicos',
    nome: 'Outros Servicos',
    processo: 'Triagem da demanda + definicao de escopo + execucao',
    responsavel: 'Atendimento',
    tarefas: [
      'Registrar demanda detalhada',
      'Classificar setor responsavel',
      'Definir escopo e prazo',
      'Executar e revisar entrega',
      'Formalizar retorno ao cliente',
    ],
  },
];

const DEFAULT_TEMPLATES = [
  { id: 'tpl-irpf-1', categoria: 'irpf', nome: 'Declaracao IRPF Completa', processo: 'Checklist IRPF + validacao pendencias', responsavel: 'Fiscal', valorPadrao: 240 },
  { id: 'tpl-irpf-2', categoria: 'irpf', nome: 'Retificacao de IRPF', processo: 'Analise de divergencias + retificacao', responsavel: 'Fiscal', valorPadrao: 180 },
  { id: 'tpl-mei-1', categoria: 'mei', nome: 'DASN-SIMEI Anual', processo: 'Conferencia faturamento + transmissao DASN', responsavel: 'Fiscal', valorPadrao: 160 },
  { id: 'tpl-mei-2', categoria: 'mei', nome: 'Regularizacao de DAS MEI', processo: 'Levantamento debitos + emissao guias', responsavel: 'Financeiro', valorPadrao: 120 },
  { id: 'tpl-itr-1', categoria: 'itr', nome: 'Declaracao ITR', processo: 'Levantamento imovel rural + transmissao ITR', responsavel: 'Fiscal', valorPadrao: 350 },
  { id: 'tpl-leg-1', categoria: 'legalizacao', nome: 'Abertura de Empresa', processo: 'Viabilidade + DBE + Junta + Prefeitura', responsavel: 'Contadores', valorPadrao: 1200 },
  { id: 'tpl-leg-2', categoria: 'legalizacao', nome: 'Alteracao Contratual', processo: 'Minuta + assinatura + protocolo', responsavel: 'Contadores', valorPadrao: 700 },
  { id: 'tpl-out-1', categoria: 'outros-servicos', nome: 'Certificado Digital A1', processo: 'Validacao documentos + emissao certificado', responsavel: 'Atendimento', valorPadrao: 290 },
];

const readJson = (key, fallback = []) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const readDeletedKeys = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(AVULSO_TEMPLATE_DELETED_KEYS) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const templateKey = (item = {}) => `${item.categoria}::${normalizeText(item.nome)}`;

const categoryFromServiceName = (name = '') => {
  const normalized = normalizeText(name);
  if (normalized.includes('irpf')) return 'irpf';
  if (normalized.includes('mei')) return 'mei';
  if (normalized.includes('itr')) return 'itr';
  if (normalized.includes('abertura') || normalized.includes('alteracao') || normalized.includes('legalizacao') || normalized.includes('cnpj')) return 'legalizacao';
  return 'outros-servicos';
};

const generateOrderNumber = (categoryKey) => {
  const prefix = (categoryKey || 'os').slice(0, 3).toUpperCase();
  const stamp = Date.now().toString().slice(-6);
  return `OS-${prefix}-${stamp}`;
};

const mergeUniqueClients = () => {
  const base = [...mockClients, ...readJson(MOCK_ADMIN_CLIENTS_KEY, []), ...readJson(AVULSO_CLIENTS_KEY, [])];
  const map = new Map();
  base.forEach((item) => {
    const key = item.id || item.cnpj || item.nome_empresa || item.nome_fantasia;
    if (!key) return;
    if (!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
};

const buildTemplates = () => {
  const custom = readJson(AVULSO_TEMPLATES_KEY, []);
  const deletedKeys = new Set(readDeletedKeys());
  const osModels = readJson(OS_MODELS_KEY, []).map((item) => ({
    id: `os-model-${item.id || Date.now()}`,
    categoria: categoryFromServiceName(item.nome_modelo),
    nome: item.nome_modelo,
    processo: item.detalhes_pagamento || 'Processo comercial padrao',
    responsavel: 'Comercial',
    valorPadrao: Number(item.valor || 0),
  }));
  const merged = [...custom, ...DEFAULT_TEMPLATES, ...osModels];
  const unique = new Map();
  merged.forEach((item) => {
    const key = templateKey(item);
    if (deletedKeys.has(key)) return;
    if (!unique.has(key)) unique.set(key, item);
  });
  return Array.from(unique.values());
};

const printOrder = (order) => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  const html = `
    <html>
      <head><title>${order.numero}</title></head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h1>Ordem de Servico - ${order.numero}</h1>
        <p><strong>Cliente:</strong> ${order.cliente_nome}</p>
        <p><strong>Categoria:</strong> ${order.categoria_label}</p>
        <p><strong>Servico:</strong> ${order.tipo_servico}</p>
        <p><strong>Processo:</strong> ${order.processo}</p>
        <p><strong>Responsavel:</strong> ${order.responsavel}</p>
        <p><strong>Valor:</strong> ${formatCurrency(order.valor)}</p>
        <p><strong>Status de Execucao:</strong> ${order.status_execucao || order.status}</p>
        <p><strong>Status Financeiro:</strong> ${order.status_financeiro || '-'}</p>
        <p><strong>Data:</strong> ${new Date(order.created_at).toLocaleString('pt-BR')}</p>
      </body>
    </html>
  `;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
};

const ServicosAvulsos = () => {
  const navigate = useNavigate();
  const { categoria, subservico } = useParams();
  const selectedCategory = CATEGORIES.find((item) => item.key === categoria) || null;
  const selectedOtherService = useMemo(
    () => OUTROS_SERVICOS_ITEMS.find((item) => item.key === subservico) || null,
    [subservico],
  );
  const [version, setVersion] = useState(0);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [editingTemplateId, setEditingTemplateId] = useState('');

  const [newTemplate, setNewTemplate] = useState({
    categoria: selectedCategory?.key || 'outros-servicos',
    nome: '',
    processo: '',
    responsavel: '',
    valorPadrao: '',
  });

  const [form, setForm] = useState({
    useExistingClient: true,
    existingClientId: '',
    existingAvulsoClientId: '',
    newClientName: '',
    newClientCnpj: '',
    templateId: '',
    valor: '',
    statusExecucao: 'aberta',
    statusFinanceiro: 'aguardando_pagamento',
    dadosNecessarios: '',
  });

  const clients = useMemo(() => mergeUniqueClients(), [version]);
  const avulsoClients = useMemo(
    () =>
      readJson(AVULSO_CLIENTS_KEY, [])
        .map((item) => ({
          id: item.id || `avulso-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          nome: item.nome_empresa || item.nome_fantasia || item.name || 'Cliente Avulso',
          cnpj: item.cnpj || item.documento || '',
          cidade: item.cidade || '',
          categoria: item.categoria || '',
        }))
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')),
    [version],
  );
  const [avulsoSearch, setAvulsoSearch] = useState('');
  const [showAddAvulso, setShowAddAvulso] = useState(false);
  const [quickAvulsoForm, setQuickAvulsoForm] = useState({
    nome: '',
    cnpj: '',
    cidade: '',
    categoria: '',
  });
  const templates = useMemo(() => buildTemplates(), [version]);
  const orders = useMemo(() => readJson(AVULSO_ORDERS_KEY, []), [version]);

  const categoryMetrics = useMemo(
    () =>
      CATEGORIES.map((item) => {
        const list = orders.filter((order) => order.categoria === item.key);
        return {
          ...item,
          totalOS: list.length,
          totalValor: list.reduce((sum, order) => sum + Number(order.valor || 0), 0),
          services: [...new Set(list.map((order) => order.tipo_servico))],
        };
      }),
    [orders],
  );

  const filteredTemplates = useMemo(
    () => (selectedCategory ? templates.filter((item) => item.categoria === selectedCategory.key) : templates),
    [templates, selectedCategory],
  );

  const filteredOrders = useMemo(
    () => (selectedCategory ? orders.filter((item) => item.categoria === selectedCategory.key) : orders),
    [orders, selectedCategory],
  );
  const visibleOrders = useMemo(
    () =>
      statusFilter === 'todos'
        ? filteredOrders
        : filteredOrders.filter((item) => (item.status_execucao || item.status) === statusFilter),
    [filteredOrders, statusFilter],
  );
  const awaitingPaymentOrders = useMemo(
    () => orders.filter((item) => item.status_financeiro === 'aguardando_pagamento'),
    [orders],
  );

  const selectedTemplate = filteredTemplates.find((item) => item.id === form.templateId) || null;
  const filteredAvulsoClients = useMemo(() => {
    const term = normalizeText(avulsoSearch);
    if (!term) return avulsoClients;
    const startsWith = avulsoClients.filter((item) => normalizeText(item.nome).startsWith(term));
    const contains = avulsoClients.filter(
      (item) => !normalizeText(item.nome).startsWith(term) && normalizeText(item.nome).includes(term),
    );
    return [...startsWith, ...contains];
  }, [avulsoClients, avulsoSearch]);

  const selectedAvulsoClient = useMemo(
    () => avulsoClients.find((item) => String(item.id) === String(form.existingAvulsoClientId)) || null,
    [avulsoClients, form.existingAvulsoClientId],
  );

  const ensureTemplateForOtherService = (servicePreset) => {
    const existing = templates.find(
      (item) =>
        item.categoria === 'outros-servicos' &&
        normalizeText(item.nome) === normalizeText(servicePreset.nome),
    );
    if (existing) return existing;

    const created = {
      id: `tpl-custom-${Date.now()}`,
      categoria: 'outros-servicos',
      nome: servicePreset.nome,
      processo: servicePreset.processo,
      responsavel: servicePreset.responsavel,
      valorPadrao: 0,
    };
    writeJson(AVULSO_TEMPLATES_KEY, [created, ...readJson(AVULSO_TEMPLATES_KEY, [])]);
    setVersion((v) => v + 1);
    return created;
  };

  const syncCommercialOrders = (newOrder) => {
    const current = readJson(COMMERCIAL_ORDERS_KEY, []);
    const next = [
      {
        id: newOrder.id,
        numero: newOrder.numero,
        empresa_nome: newOrder.cliente_nome,
        tipo_servico: newOrder.tipo_servico,
        status: newOrder.status_execucao || 'aberta',
        status_financeiro: newOrder.status_financeiro || 'aguardando_pagamento',
        executor_nome: newOrder.responsavel || '-',
        origem: 'servicos_avulsos',
        categoria_avulsa: newOrder.categoria,
        created_at: newOrder.created_at,
      },
      ...current,
    ];
    writeJson(COMMERCIAL_ORDERS_KEY, next);
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.nome || !newTemplate.categoria || !newTemplate.processo || !newTemplate.responsavel) return;
    const current = readJson(AVULSO_TEMPLATES_KEY, []);
    const payload = {
      id: editingTemplateId || `tpl-custom-${Date.now()}`,
      categoria: newTemplate.categoria,
      nome: newTemplate.nome,
      processo: newTemplate.processo,
      responsavel: newTemplate.responsavel,
      valorPadrao: Number(newTemplate.valorPadrao || 0),
    };
    const next = editingTemplateId
      ? current.map((item) => (item.id === editingTemplateId ? payload : item))
      : [payload, ...current];
    writeJson(AVULSO_TEMPLATES_KEY, next);
    const currentDeleted = readDeletedKeys();
    writeJson(
      AVULSO_TEMPLATE_DELETED_KEYS,
      currentDeleted.filter((item) => item !== templateKey(payload)),
    );
    setNewTemplate({
      categoria: selectedCategory?.key || 'outros-servicos',
      nome: '',
      processo: '',
      responsavel: '',
      valorPadrao: '',
    });
    setEditingTemplateId('');
    setVersion((v) => v + 1);
  };

  const handleEditTemplate = (template) => {
    const custom = readJson(AVULSO_TEMPLATES_KEY, []);
    const existsInCustom = custom.find((item) => item.id === template.id);
    setEditingTemplateId(existsInCustom ? template.id : '');
    setNewTemplate({
      categoria: template.categoria,
      nome: template.nome,
      processo: template.processo,
      responsavel: template.responsavel,
      valorPadrao: String(template.valorPadrao || ''),
    });
    if (!existsInCustom) {
      const next = [
        {
          id: `tpl-custom-${Date.now()}`,
          categoria: template.categoria,
          nome: template.nome,
          processo: template.processo,
          responsavel: template.responsavel,
          valorPadrao: Number(template.valorPadrao || 0),
        },
        ...custom,
      ];
      writeJson(AVULSO_TEMPLATES_KEY, next);
      setEditingTemplateId(next[0].id);
      setVersion((v) => v + 1);
    }
  };

  const handleDeleteTemplate = (template) => {
    const custom = readJson(AVULSO_TEMPLATES_KEY, []);
    const nextCustom = custom.filter((item) => item.id !== template.id);
    writeJson(AVULSO_TEMPLATES_KEY, nextCustom);
    const deleted = new Set(readDeletedKeys());
    deleted.add(templateKey(template));
    writeJson(AVULSO_TEMPLATE_DELETED_KEYS, Array.from(deleted));
    if (editingTemplateId === template.id) {
      setEditingTemplateId('');
      setNewTemplate({
        categoria: selectedCategory?.key || 'outros-servicos',
        nome: '',
        processo: '',
        responsavel: '',
        valorPadrao: '',
      });
    }
    setVersion((v) => v + 1);
  };

  const handleGenerateOS = () => {
    if (!selectedTemplate) return;

    let clientName = '';
    let clientId = '';
    let clientCnpj = '';

    if (form.useExistingClient) {
      const selectedClient = clients.find((item) => String(item.id) === String(form.existingClientId));
      if (!selectedClient) return;
      clientName = selectedClient.nome_empresa || selectedClient.nome_fantasia || selectedClient.name || '';
      clientId = selectedClient.id || '';
      clientCnpj = selectedClient.cnpj || '';
    } else {
      if (form.existingAvulsoClientId) {
        const selected = avulsoClients.find((item) => String(item.id) === String(form.existingAvulsoClientId));
        if (!selected) return;
        clientName = selected.nome;
        clientId = selected.id;
        clientCnpj = selected.cnpj;
      } else {
        if (!form.newClientName) return;
        const avulsoClient = {
          id: `avulso-client-${Date.now()}`,
          nome_empresa: form.newClientName,
          cnpj: form.newClientCnpj || '',
          categoria: selectedCategory?.label || 'Cliente Avulso',
          cidade: '',
        };
        writeJson(AVULSO_CLIENTS_KEY, [avulsoClient, ...readJson(AVULSO_CLIENTS_KEY, [])]);
        clientName = avulsoClient.nome_empresa;
        clientId = avulsoClient.id;
        clientCnpj = avulsoClient.cnpj;
        setVersion((v) => v + 1);
      }
    }

    const categoryLabel = CATEGORIES.find((item) => item.key === selectedTemplate.categoria)?.label || 'Outros Servicos';
    const newOrder = {
      id: `avulso-os-${Date.now()}`,
      numero: generateOrderNumber(selectedTemplate.categoria),
      categoria: selectedTemplate.categoria,
      categoria_label: categoryLabel,
      cliente_id: clientId,
      cliente_nome: clientName,
      cliente_cnpj: clientCnpj,
      tipo_servico: selectedTemplate.nome,
      processo: selectedTemplate.processo,
      responsavel: selectedTemplate.responsavel,
      valor: Number(form.valor || selectedTemplate.valorPadrao || 0),
      status: form.statusExecucao || 'aberta',
      status_execucao: form.statusExecucao || 'aberta',
      status_financeiro: form.statusFinanceiro || 'aguardando_pagamento',
      dados_necessarios: form.dadosNecessarios || '',
      created_at: new Date().toISOString(),
      origem: 'servicos_avulsos',
    };

    writeJson(AVULSO_ORDERS_KEY, [newOrder, ...orders]);
    syncCommercialOrders(newOrder);

    setForm({
      useExistingClient: true,
      existingClientId: '',
      existingAvulsoClientId: '',
      newClientName: '',
      newClientCnpj: '',
      templateId: '',
      valor: '',
      statusExecucao: 'aberta',
      statusFinanceiro: 'aguardando_pagamento',
      dadosNecessarios: '',
    });
    setVersion((v) => v + 1);
  };

  const handleQuickAddAvulso = () => {
    if (!quickAvulsoForm.nome.trim()) return;
    const payload = {
      id: `avulso-client-${Date.now()}`,
      nome_empresa: quickAvulsoForm.nome.trim(),
      cnpj: quickAvulsoForm.cnpj.trim(),
      cidade: quickAvulsoForm.cidade.trim(),
      categoria: quickAvulsoForm.categoria || selectedCategory?.label || 'Cliente Avulso',
      origem: 'servicos_avulsos',
    };
    writeJson(AVULSO_CLIENTS_KEY, [payload, ...readJson(AVULSO_CLIENTS_KEY, [])]);
    setVersion((v) => v + 1);
    setShowAddAvulso(false);
    setQuickAvulsoForm({ nome: '', cnpj: '', cidade: '', categoria: '' });
    setForm((prev) => ({
      ...prev,
      useExistingClient: false,
      existingAvulsoClientId: payload.id,
      newClientName: '',
      newClientCnpj: '',
    }));
  };

  return (
    <div className="space-y-6 p-6">
      <div className="glass-intense rounded-2xl border border-white/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {selectedCategory ? `Servicos Avulsos - ${selectedCategory.label}` : 'Servicos Avulsos'}
            </h1>
            <p className="mt-2 text-sm text-gray-300">
              O.S avulsas vinculadas ao Comercial (O.S gerais) com processo e responsavel predefinidos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => (selectedCategory ? navigate('/servicos-avulsos') : navigate('/financeiro'))}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            {selectedCategory ? 'Voltar para Servicos Avulsos' : 'Voltar para Financeiro'}
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-red-300" />
          <h2 className="text-lg font-semibold text-white">Metricas de Servicos Avulsos</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {categoryMetrics.map((metric) => (
            <button
              key={metric.key}
              type="button"
              onClick={() => navigate(`/servicos-avulsos/${metric.key}`)}
              className="rounded-xl border border-white/10 bg-black/20 p-4 text-left hover:bg-black/30"
            >
              <p className="text-sm font-medium text-white">{metric.label}</p>
              <p className="mt-2 text-xs text-gray-300">{metric.totalOS} O.S</p>
              <p className="text-xs text-gray-400">{formatCurrency(metric.totalValor)}</p>
              <p className="mt-2 text-[11px] text-gray-500">
                {metric.services.length ? `Servicos: ${metric.services.slice(0, 2).join(', ')}${metric.services.length > 2 ? '...' : ''}` : 'Sem O.S'}
              </p>
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-100">Aguardando pagamento</p>
          <p className="mt-1 text-xs text-gray-200">
            {awaitingPaymentOrders.length} servicos • {formatCurrency(awaitingPaymentOrders.reduce((sum, item) => sum + Number(item.valor || 0), 0))}
          </p>
        </div>
      </div>

      {selectedCategory?.key === 'outros-servicos' && !selectedOtherService ? (
        <div className="glass rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white">Outros Serviços</h2>
          <p className="mt-1 text-sm text-gray-300">Escolha um serviço para abrir a view com tarefas e geração de O.S.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {OUTROS_SERVICOS_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(`/servicos-avulsos/outros-servicos/${item.key}`)}
                className="rounded-xl border border-white/10 bg-black/20 p-4 text-left hover:bg-black/30"
              >
                <p className="text-sm font-semibold text-white">{item.nome}</p>
                <p className="mt-1 text-xs text-gray-400">{item.processo}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setNewTemplate((prev) => ({ ...prev, categoria: 'outros-servicos' }));
                window.scrollTo({ top: 560, behavior: 'smooth' });
              }}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left hover:bg-emerald-500/20"
            >
              <p className="text-sm font-semibold text-emerald-100">Adicionar modelo de servico</p>
              <p className="mt-1 text-xs text-gray-200">Crie um novo modelo para Outros Serviços</p>
            </button>
          </div>
        </div>
      ) : null}

      {selectedCategory?.key === 'outros-servicos' && selectedOtherService ? (
        <div className="glass rounded-2xl border border-white/10 p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{selectedOtherService.nome}</h2>
              <p className="text-xs text-gray-400">{selectedOtherService.processo}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const template = ensureTemplateForOtherService(selectedOtherService);
                setForm((prev) => ({
                  ...prev,
                  templateId: template.id,
                  valor: String(template.valorPadrao || ''),
                  statusExecucao: 'aberta',
                  statusFinanceiro: 'aguardando_pagamento',
                }));
                window.scrollTo({ top: 980, behavior: 'smooth' });
              }}
              className="rounded-lg border border-red-500/35 bg-red-500/15 px-3 py-2 text-xs text-red-100 hover:bg-red-500/25"
            >
              Criar novo {selectedOtherService.nome}
            </button>
          </div>
          <div className="space-y-2">
            {selectedOtherService.tarefas.map((tarefa) => (
              <div key={tarefa} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-200">
                {tarefa}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass rounded-2xl border border-white/10 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-semibold text-white">Modelos de O.S frequentes</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={newTemplate.categoria}
              onChange={(e) => setNewTemplate((p) => ({ ...p, categoria: e.target.value }))}
              className="input-futuristic rounded-lg px-3 py-2 text-sm"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>{cat.label}</option>
              ))}
            </select>
            <input
              value={newTemplate.valorPadrao}
              onChange={(e) => setNewTemplate((p) => ({ ...p, valorPadrao: e.target.value }))}
              placeholder="Valor padrao"
              className="input-futuristic rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={newTemplate.nome}
              onChange={(e) => setNewTemplate((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Nome do servico"
              className="input-futuristic rounded-lg px-3 py-2 text-sm md:col-span-2"
            />
            <input
              value={newTemplate.processo}
              onChange={(e) => setNewTemplate((p) => ({ ...p, processo: e.target.value }))}
              placeholder="Processo pronto"
              className="input-futuristic rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={newTemplate.responsavel}
              onChange={(e) => setNewTemplate((p) => ({ ...p, responsavel: e.target.value }))}
              placeholder="Responsavel executor"
              className="input-futuristic rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleCreateTemplate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25"
          >
            <Save className="h-4 w-4" />
            {editingTemplateId ? 'Atualizar modelo' : 'Salvar modelo'}
          </button>
          {editingTemplateId ? (
            <button
              type="button"
              onClick={() => {
                setEditingTemplateId('');
                setNewTemplate({
                  categoria: selectedCategory?.key || 'outros-servicos',
                  nome: '',
                  processo: '',
                  responsavel: '',
                  valorPadrao: '',
                });
              }}
              className="ml-2 mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
            >
              Cancelar edicao
            </button>
          ) : null}

          <div className="mt-4 space-y-2">
            {filteredTemplates.slice(0, 12).map((template) => (
              <div
                key={template.id}
                className={`w-full rounded-lg border px-3 py-2 ${
                  form.templateId === template.id ? 'border-red-500/35 bg-red-500/10' : 'border-white/10 bg-black/20 hover:bg-black/30'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setForm((p) => ({ ...p, templateId: template.id, valor: String(template.valorPadrao || '') }));
                  }}
                  className="w-full text-left"
                >
                  <p className="text-sm font-medium text-white">{template.nome}</p>
                  <p className="text-xs text-gray-400">{template.processo}</p>
                  <p className="text-xs text-gray-500">{template.responsavel} • {formatCurrency(template.valorPadrao)}</p>
                </button>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEditTemplate(template)}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-500/35 bg-blue-500/15 px-2 py-1 text-[11px] text-blue-100 hover:bg-blue-500/25"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(template)}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-500/35 bg-rose-500/15 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-500/25"
                  >
                    <Trash2 className="h-3 w-3" />
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl border border-white/10 p-6">
          <div className="mb-4 flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-blue-300" />
            <h2 className="text-lg font-semibold text-white">Gerar O.S avulsa</h2>
          </div>

          <div className="space-y-4">
            <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, useExistingClient: true }))}
                className={`rounded-md px-3 py-1.5 text-xs ${form.useExistingClient ? 'bg-red-500/20 text-red-100' : 'text-gray-300'}`}
              >
                Importar cliente existente
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, useExistingClient: false }))}
                className={`rounded-md px-3 py-1.5 text-xs ${!form.useExistingClient ? 'bg-red-500/20 text-red-100' : 'text-gray-300'}`}
              >
                Cliente avulso
              </button>
            </div>

            {form.useExistingClient ? (
              <div className="space-y-2">
                <select
                  value={form.existingClientId}
                  onChange={(e) => setForm((p) => ({ ...p, existingClientId: e.target.value }))}
                  className="input-futuristic w-full rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Selecione o cliente</option>
                  {clients.map((client) => (
                    <option key={client.id || client.cnpj} value={client.id}>
                      {client.nome_empresa || client.nome_fantasia} {client.cnpj ? `- ${client.cnpj}` : ''}
                    </option>
                  ))}
                </select>
                {form.existingClientId ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
                    {(() => {
                      const selected = clients.find((item) => String(item.id) === String(form.existingClientId));
                      if (!selected) return 'Cliente nao encontrado.';
                      return (
                        <>
                          <p><span className="text-gray-400">Cliente:</span> {selected.nome_empresa || selected.nome_fantasia || '-'}</p>
                          <p><span className="text-gray-400">CNPJ:</span> {selected.cnpj || '-'}</p>
                          <p><span className="text-gray-400">Cidade:</span> {selected.cidade || '-'}</p>
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      value={avulsoSearch}
                      onChange={(e) => setAvulsoSearch(e.target.value)}
                      placeholder="Buscar cliente avulso cadastrado"
                      className="input-futuristic w-full rounded-lg py-2 pl-9 pr-3 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddAvulso((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/25"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar cliente avulso
                  </button>
                </div>
                <select
                  value={form.existingAvulsoClientId}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      existingAvulsoClientId: e.target.value,
                      newClientName: '',
                      newClientCnpj: '',
                    }))
                  }
                  className="input-futuristic w-full rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Selecione cliente avulso cadastrado</option>
                  {filteredAvulsoClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nome} {client.cnpj ? `- ${client.cnpj}` : ''}
                    </option>
                  ))}
                </select>
                {selectedAvulsoClient ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
                    <p><span className="text-gray-400">Cliente:</span> {selectedAvulsoClient.nome}</p>
                    <p><span className="text-gray-400">Documento:</span> {selectedAvulsoClient.cnpj || '-'}</p>
                    <p><span className="text-gray-400">Cidade:</span> {selectedAvulsoClient.cidade || '-'}</p>
                    <p><span className="text-gray-400">Categoria:</span> {selectedAvulsoClient.categoria || '-'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      value={form.newClientName}
                      onChange={(e) => setForm((p) => ({ ...p, newClientName: e.target.value }))}
                      placeholder="Nome do cliente avulso"
                      className="input-futuristic rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      value={form.newClientCnpj}
                      onChange={(e) => setForm((p) => ({ ...p, newClientCnpj: e.target.value }))}
                      placeholder="CNPJ/CPF (opcional)"
                      className="input-futuristic rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
                {showAddAvulso ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-gray-300">Cadastrar cliente avulso rapidamente</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                      <input
                        value={quickAvulsoForm.nome}
                        onChange={(e) => setQuickAvulsoForm((prev) => ({ ...prev, nome: e.target.value }))}
                        placeholder="Nome"
                        className="input-futuristic rounded-lg px-3 py-2 text-xs"
                      />
                      <input
                        value={quickAvulsoForm.cnpj}
                        onChange={(e) => setQuickAvulsoForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                        placeholder="CPF/CNPJ"
                        className="input-futuristic rounded-lg px-3 py-2 text-xs"
                      />
                      <input
                        value={quickAvulsoForm.cidade}
                        onChange={(e) => setQuickAvulsoForm((prev) => ({ ...prev, cidade: e.target.value }))}
                        placeholder="Cidade"
                        className="input-futuristic rounded-lg px-3 py-2 text-xs"
                      />
                      <input
                        value={quickAvulsoForm.categoria}
                        onChange={(e) => setQuickAvulsoForm((prev) => ({ ...prev, categoria: e.target.value }))}
                        placeholder="Categoria"
                        className="input-futuristic rounded-lg px-3 py-2 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickAddAvulso}
                      className="mt-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/25"
                    >
                      Salvar cliente avulso
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-gray-400">Servico / processo selecionado</p>
              <p className="mt-1 text-sm font-medium text-white">{selectedTemplate?.nome || 'Nenhum selecionado'}</p>
              <p className="text-xs text-gray-300">{selectedTemplate?.processo || '-'}</p>
              <p className="text-xs text-gray-500">{selectedTemplate?.responsavel || '-'} • {formatCurrency(selectedTemplate?.valorPadrao || 0)}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-300">Status de Execucao</label>
                <select
                  value={form.statusExecucao}
                  onChange={(e) => setForm((p) => ({ ...p, statusExecucao: e.target.value }))}
                  className="input-futuristic w-full rounded-lg px-3 py-2 text-sm"
                >
                  <option value="aberta">Aberta</option>
                  <option value="em_execucao">Em execucao</option>
                  <option value="concluida">Concluida</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-300">Status Financeiro</label>
                <select
                  value={form.statusFinanceiro}
                  onChange={(e) => setForm((p) => ({ ...p, statusFinanceiro: e.target.value }))}
                  className="input-futuristic w-full rounded-lg px-3 py-2 text-sm"
                >
                  <option value="aguardando_pagamento">Aguardando pagamento</option>
                  <option value="pago">Pago</option>
                  <option value="parcial">Parcial</option>
                  <option value="inadimplente">Inadimplente</option>
                  <option value="isento">Isento</option>
                </select>
              </div>
            </div>

            <input
              value={form.valor}
              onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))}
              placeholder="Valor da O.S"
              className="input-futuristic rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={form.dadosNecessarios}
              onChange={(e) => setForm((p) => ({ ...p, dadosNecessarios: e.target.value }))}
              placeholder="Dados necessarios para este servico (somente complemento; o restante vem pre-preenchido)"
              rows={3}
              className="input-futuristic rounded-lg px-3 py-2 text-sm"
            />

            <button
              type="button"
              onClick={handleGenerateOS}
              disabled={!selectedTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/35 bg-red-500/15 px-4 py-2 text-sm text-red-100 hover:bg-red-500/25 disabled:opacity-40"
            >
              <Users className="h-4 w-4" />
              Gerar O.S e vincular no Comercial
            </button>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">O.S do modulo {selectedCategory ? selectedCategory.label : 'Servicos Avulsos'}</h2>
          <div className="inline-flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-300" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-futuristic rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="todos">Todos os status</option>
              <option value="aberta">Aberta</option>
              <option value="em_execucao">Em execucao</option>
              <option value="concluida">Concluida</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          {visibleOrders.length ? visibleOrders.map((order) => (
            <article key={order.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{order.numero} • {order.tipo_servico}</p>
                  <p className="text-xs text-gray-300">{order.cliente_nome} • {order.categoria_label}</p>
                  <p className="text-xs text-gray-400">{order.processo}</p>
                  <p className="text-xs text-gray-500">{order.responsavel} • {formatCurrency(order.valor)}</p>
                  <p className="text-xs text-gray-400">Status Execucao: {order.status_execucao || order.status}</p>
                  <p className="text-xs text-gray-400">Status Financeiro: {order.status_financeiro || '-'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => printOrder(order)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir O.S
                </button>
              </div>
            </article>
          )) : (
            <div className="rounded-xl border border-dashed border-white/20 bg-black/15 p-6 text-center text-sm text-gray-400">
              Nenhuma O.S cadastrada para o filtro selecionado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServicosAvulsos;
