import React, { useMemo, useState } from 'react';
import { ArrowLeft, Building2, Filter, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const CATEGORIES = ['MEI Avulso', 'Associacao', 'Igreja', 'CPF'];
const AVULSO_CLIENTS_KEY = 'mock_avulso_clients_v1';

const MOCK_AVULSOS = [
  { id: 'av-1', nome: 'Joao da Silva', documento: '123.456.789-10', categoria: 'CPF', cidade: 'Jacobina' },
  { id: 'av-2', nome: 'Igreja Esperanca Viva', documento: '12.345.678/0001-44', categoria: 'Igreja', cidade: 'Ourolandia' },
  { id: 'av-3', nome: 'Associacao Bairro Novo', documento: '44.321.778/0001-88', categoria: 'Associacao', cidade: 'Umburanas' },
  { id: 'av-4', nome: 'Mercadinho Ana', documento: '55.111.222/0001-33', categoria: 'MEI Avulso', cidade: 'Uberlandia' },
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

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const canonicalCityKey = (city = '') => {
  const normalized = normalizeText(city);
  if (!normalized) return '';
  if (normalized.startsWith('ouroland')) return 'ourolandia';
  if (normalized.startsWith('uberland')) return 'uberlandia';
  if (normalized.startsWith('jacobin')) return 'jacobina';
  if (normalized.startsWith('umburan')) return 'umburanas';
  return normalized;
};

const canonicalCityLabel = (city = '') => {
  const key = canonicalCityKey(city);
  if (key === 'ourolandia') return 'Ourolandia';
  if (key === 'uberlandia') return 'Uberlandia';
  if (key === 'jacobina') return 'Jacobina';
  if (key === 'umburanas') return 'Umburanas';
  if (!key) return 'Nao informado';
  return String(city || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const ClientesAvulso = () => {
  const navigate = useNavigate();
  const { hasModuleAccess } = useAuth();
  const [activeCategory, setActiveCategory] = useState('MEI Avulso');
  const [version, setVersion] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newClient, setNewClient] = useState({
    nome: '',
    documento: '',
    categoria: 'MEI Avulso',
    cidade: '',
  });

  const canAccess = hasModuleAccess('comercial') || hasModuleAccess('financeiro');

  const avulsos = useMemo(() => {
    const local = readJson(AVULSO_CLIENTS_KEY, []).map((item) => ({
      id: item.id || `local-${item.nome_empresa || item.nome_fantasia || Date.now()}`,
      nome: item.nome_empresa || item.nome_fantasia || item.name || 'Cliente Avulso',
      documento: item.cnpj || item.documento || '-',
      categoria: item.categoria || 'MEI Avulso',
      cidade: canonicalCityLabel(item.cidade || 'Nao informado'),
    }));
    const base = [...MOCK_AVULSOS, ...local];
    const map = new Map();
    base.forEach((item) => {
      const key = item.id || `${normalizeText(item.nome)}-${item.documento}`;
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  }, [version]);

  const filtered = useMemo(() => avulsos.filter((item) => item.categoria === activeCategory), [avulsos, activeCategory]);

  const handleAddClient = () => {
    if (!newClient.nome.trim()) return;
    const payload = {
      id: `avulso-client-${Date.now()}`,
      nome_empresa: newClient.nome.trim(),
      cnpj: newClient.documento.trim(),
      categoria: newClient.categoria,
      cidade: canonicalCityLabel(newClient.cidade.trim()),
      origem: 'clientes_avulso',
    };
    const current = readJson(AVULSO_CLIENTS_KEY, []);
    writeJson(AVULSO_CLIENTS_KEY, [payload, ...current]);
    setVersion((v) => v + 1);
    setShowCreate(false);
    setNewClient({
      nome: '',
      documento: '',
      categoria: activeCategory,
      cidade: '',
    });
  };

  if (!canAccess) {
    return (
      <div className="glass rounded-2xl border border-white/10 p-6 text-center">
        <h2 className="text-xl font-semibold text-white">Acesso restrito</h2>
        <p className="mt-2 text-sm text-gray-400">
          Somente usuários com módulo Comercial ou Financeiro podem acessar Clientes Avulso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass-intense rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Lista de Clientes Avulso</h1>
            <p className="mt-1 text-sm text-gray-400">Gestao por categoria: MEI Avulso, Associacao, Igreja e CPF.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25"
            >
              <Plus className="h-4 w-4" />
              Adicionar novo cliente
            </button>
            <button
              type="button"
              onClick={() => navigate('/clientes')}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Lista de Clientes
            </button>
          </div>
        </div>
      </div>

      {showCreate ? (
        <div className="glass rounded-2xl border border-white/10 p-4">
          <h2 className="text-sm font-semibold text-white">Novo cliente avulso</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={newClient.nome}
              onChange={(e) => setNewClient((prev) => ({ ...prev, nome: e.target.value }))}
              placeholder="Nome do cliente"
              className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <input
              value={newClient.documento}
              onChange={(e) => setNewClient((prev) => ({ ...prev, documento: e.target.value }))}
              placeholder="CPF/CNPJ"
              className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <select
              value={newClient.categoria}
              onChange={(e) => setNewClient((prev) => ({ ...prev, categoria: e.target.value }))}
              className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <input
              value={newClient.cidade}
              onChange={(e) => setNewClient((prev) => ({ ...prev, cidade: e.target.value }))}
              placeholder="Cidade"
              className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={handleAddClient}
              className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/25"
            >
              Salvar cliente avulso
            </button>
          </div>
        </div>
      ) : null}

      <div className="glass rounded-2xl border border-white/10 p-4">
        <div className="mb-3 inline-flex items-center gap-2 text-sm text-gray-300">
          <Filter className="h-4 w-4" />
          Categorias
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                activeCategory === category
                  ? 'border-red-500/35 bg-red-500/15 text-red-100'
                  : 'border-white/15 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filtered.map((item) => (
          <article key={item.id} className="glass rounded-xl border border-white/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <Building2 className="h-4 w-4 text-cyan-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{item.nome}</p>
                  <p className="mt-1 text-xs text-gray-300">{item.documento}</p>
                  <p className="mt-1 text-xs text-gray-500">{item.cidade}</p>
                </div>
              </div>
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-gray-200">
                {item.categoria}
              </span>
            </div>
          </article>
        ))}

        {!filtered.length ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-gray-400">
            Nenhum cliente avulso nesta categoria.
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ClientesAvulso;
