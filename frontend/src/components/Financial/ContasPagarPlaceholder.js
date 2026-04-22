import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, FileUp, Plus, RefreshCw, Wallet } from 'lucide-react';
import api from '../../config/api';

const getTodayInputDate = () => new Date().toISOString().slice(0, 10);

const defaultForm = () => ({
  descricao: '',
  categoria: '',
  subcategoria: '',
  valor: '',
  valor_pago: '',
  juros: '',
  valor_restante: '',
  situacao: 'em_aberto',
  forma_pagamento: '',
  tipo_despesa: '',
  centro_custo: '',
  conta_utilizada: '',
  competencia: '',
  natureza_despesa: '',
  recorrente: false,
  tipo_parcela: '',
  numero_parcela: '',
  total_parcelas: '',
  prioridade: 'media',
  comentario: '',
  comprovante_anexo: '',
  data_lancamento: getTodayInputDate(),
  data_pagamento_ref: getTodayInputDate(),
  data_reproducao: getTodayInputDate(),
});

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ContasPagarPlaceholder = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [situacao, setSituacao] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const loadContasPagar = async (nextSearch = search, nextSituacao = situacao) => {
    try {
      setLoading(true);
      const response = await api.get('/financial/contas-pagar', {
        params: {
          search: nextSearch || undefined,
          situacao: nextSituacao || undefined,
        },
      });
      const rows = Array.isArray(response.data?.items) ? response.data.items : [];
      setItems(rows);
    } catch (error) {
      console.error('Erro ao carregar contas a pagar:', error);
    } finally {
      setLoading(false);
    }
  };

  const onClickImport = () => fileInputRef.current?.click();

  const onFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploading(true);
      await api.post('/financial/contas-pagar/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadContasPagar();
    } catch (error) {
      console.error('Erro ao importar CSV de contas a pagar:', error);
      alert('Não foi possível importar o CSV de contas a pagar.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const markAsPaid = async (item) => {
    try {
      await api.put(`/financial/contas-pagar/${item.id}`, {
        pago: true,
        situacao: 'pago',
        valor_pago: Number(item.valor || 0),
        data_pagamento_ref: getTodayInputDate(),
      });
      await loadContasPagar();
    } catch (error) {
      console.error('Erro ao marcar conta como paga:', error);
      alert('Não foi possível atualizar a conta.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.descricao.trim()) return;
    try {
      await api.post('/financial/contas-pagar', {
        ...form,
        valor: Number(form.valor || 0),
        valor_pago: Number(form.valor_pago || 0),
        juros: Number(form.juros || 0),
        valor_restante: Number(form.valor_restante || 0),
        numero_parcela: form.numero_parcela ? Number(form.numero_parcela) : null,
        total_parcelas: form.total_parcelas ? Number(form.total_parcelas) : null,
      });
      setForm(defaultForm());
      setShowCreateForm(false);
      await loadContasPagar();
    } catch (error) {
      console.error('Erro ao criar conta a pagar:', error);
      alert('Não foi possível criar a conta a pagar.');
    }
  };

  const resumo = useMemo(() => {
    const total = items.length;
    const pagos = items.filter((item) => item.pago || item.situacao === 'pago').length;
    const emAberto = items.filter((item) => item.situacao === 'em_aberto').length;
    const atrasados = items.filter((item) => item.situacao === 'atrasado').length;
    const valorTotal = items.reduce((acc, item) => acc + Number(item.valor || 0), 0);
    return { total, pagos, emAberto, atrasados, valorTotal };
  }, [items]);

  React.useEffect(() => {
    loadContasPagar();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="glass-intense rounded-2xl border border-white/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Contas a Pagar</h1>
            <p className="mt-2 text-sm text-gray-300">Gestão real de lançamentos com importação CSV e persistência no backend.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/financeiro')}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/10"
            >
              Voltar para Financeiro
            </button>
            <button
              type="button"
              onClick={() => loadContasPagar()}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/25"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
            <button
              type="button"
              onClick={onClickImport}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/15 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/25 disabled:opacity-60"
            >
              <FileUp className="h-4 w-4" />
              {uploading ? 'Importando...' : 'Importar CSV'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFileSelected}
            />
            <button
              type="button"
              onClick={() => setShowCreateForm((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/25"
            >
              <Plus className="h-4 w-4" />
              Novo lançamento
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="glass rounded-xl border border-white/10 p-3">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-lg font-semibold text-white">{resumo.total}</p>
        </div>
        <div className="glass rounded-xl border border-white/10 p-3">
          <p className="text-xs text-gray-400">Pagas</p>
          <p className="text-lg font-semibold text-emerald-300">{resumo.pagos}</p>
        </div>
        <div className="glass rounded-xl border border-white/10 p-3">
          <p className="text-xs text-gray-400">Em aberto</p>
          <p className="text-lg font-semibold text-amber-300">{resumo.emAberto}</p>
        </div>
        <div className="glass rounded-xl border border-white/10 p-3">
          <p className="text-xs text-gray-400">Atrasadas</p>
          <p className="text-lg font-semibold text-rose-300">{resumo.atrasados}</p>
        </div>
        <div className="glass rounded-xl border border-white/10 p-3">
          <p className="text-xs text-gray-400">Valor total</p>
          <p className="text-lg font-semibold text-cyan-300">{formatCurrency(resumo.valorTotal)}</p>
        </div>
      </div>

      {showCreateForm ? (
        <form onSubmit={handleCreate} className="glass rounded-2xl border border-white/10 p-4 space-y-3">
          <h2 className="text-white font-semibold">Novo lançamento de conta a pagar</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input className="input-futuristic rounded-lg px-3 py-2 text-sm" placeholder="Descrição" value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} />
            <input className="input-futuristic rounded-lg px-3 py-2 text-sm" placeholder="Categoria" value={form.categoria} onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))} />
            <input className="input-futuristic rounded-lg px-3 py-2 text-sm" placeholder="Subcategoria" value={form.subcategoria} onChange={(e) => setForm((p) => ({ ...p, subcategoria: e.target.value }))} />
            <input className="input-futuristic rounded-lg px-3 py-2 text-sm" type="number" step="0.01" placeholder="Valor" value={form.valor} onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))} />
            <input className="input-futuristic rounded-lg px-3 py-2 text-sm" type="number" step="0.01" placeholder="Valor pago" value={form.valor_pago} onChange={(e) => setForm((p) => ({ ...p, valor_pago: e.target.value }))} />
            <input className="input-futuristic rounded-lg px-3 py-2 text-sm" type="number" step="0.01" placeholder="Juros" value={form.juros} onChange={(e) => setForm((p) => ({ ...p, juros: e.target.value }))} />
            <input className="input-futuristic rounded-lg px-3 py-2 text-sm" placeholder="Forma de pagamento" value={form.forma_pagamento} onChange={(e) => setForm((p) => ({ ...p, forma_pagamento: e.target.value }))} />
            <input className="input-futuristic rounded-lg px-3 py-2 text-sm" placeholder="Centro de custo" value={form.centro_custo} onChange={(e) => setForm((p) => ({ ...p, centro_custo: e.target.value }))} />
            <input className="input-futuristic rounded-lg px-3 py-2 text-sm" placeholder="Conta utilizada" value={form.conta_utilizada} onChange={(e) => setForm((p) => ({ ...p, conta_utilizada: e.target.value }))} />
            <div>
              <label className="mb-1 block text-xs text-gray-400">Data de lançamento</label>
              <input className="input-futuristic w-full rounded-lg px-3 py-2 text-sm" type="date" value={form.data_lancamento} onChange={(e) => setForm((p) => ({ ...p, data_lancamento: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Data de pagamento</label>
              <input className="input-futuristic w-full rounded-lg px-3 py-2 text-sm" type="date" value={form.data_pagamento_ref} onChange={(e) => setForm((p) => ({ ...p, data_pagamento_ref: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Data de reprodução</label>
              <input className="input-futuristic w-full rounded-lg px-3 py-2 text-sm" type="date" value={form.data_reproducao} onChange={(e) => setForm((p) => ({ ...p, data_reproducao: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowCreateForm(false); setForm(defaultForm()); }} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200">Cancelar</button>
            <button type="submit" className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">Salvar</button>
          </div>
        </form>
      ) : null}

      <div className="glass rounded-2xl border border-white/10 p-4">
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição, categoria, centro de custo..."
            className="input-futuristic rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            className="input-futuristic rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas as situações</option>
            <option value="em_aberto">Em aberto</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
          </select>
          <button
            type="button"
            onClick={() => loadContasPagar(search, situacao)}
            className="rounded-lg border border-cyan-500/35 bg-cyan-500/15 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/25"
          >
            Aplicar filtros
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] text-sm">
            <thead>
              <tr className="text-left text-gray-300 border-b border-white/10">
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2">Subcategoria</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Valor pago</th>
                <th className="px-3 py-2">Juros</th>
                <th className="px-3 py-2">Restante</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Forma</th>
                <th className="px-3 py-2">Centro de custo</th>
                <th className="px-3 py-2">Competência</th>
                <th className="px-3 py-2">Lançamento</th>
                <th className="px-3 py-2">Pagamento</th>
                <th className="px-3 py-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-gray-400" colSpan={14}>Carregando...</td>
                </tr>
              ) : !items.length ? (
                <tr>
                  <td className="px-3 py-4 text-gray-400" colSpan={14}>Nenhuma conta a pagar encontrada.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white">{item.descricao || '-'}</td>
                    <td className="px-3 py-2 text-gray-200">{item.categoria || '-'}</td>
                    <td className="px-3 py-2 text-gray-300">{item.subcategoria || '-'}</td>
                    <td className="px-3 py-2 text-emerald-300">{formatCurrency(item.valor)}</td>
                    <td className="px-3 py-2 text-cyan-300">{formatCurrency(item.valor_pago)}</td>
                    <td className="px-3 py-2 text-amber-300">{formatCurrency(item.juros)}</td>
                    <td className="px-3 py-2 text-rose-300">{formatCurrency(item.valor_restante)}</td>
                    <td className="px-3 py-2 text-gray-200">{item.situacao || '-'}</td>
                    <td className="px-3 py-2 text-gray-300">{item.forma_pagamento || '-'}</td>
                    <td className="px-3 py-2 text-gray-300">{item.centro_custo || '-'}</td>
                    <td className="px-3 py-2 text-gray-300">{item.competencia || '-'}</td>
                    <td className="px-3 py-2 text-gray-300 inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{item.data_lancamento || '-'}</td>
                    <td className="px-3 py-2 text-gray-300">{item.data_pagamento_ref || '-'}</td>
                    <td className="px-3 py-2">
                      {item.pago || item.situacao === 'pago' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Pago
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markAsPaid(item)}
                          className="rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-500/25"
                        >
                          Marcar pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-8 text-center">
        <Wallet className="w-14 h-14 text-amber-300 mx-auto mb-4" />
        <p className="text-sm text-gray-400">
          Importe o CSV em <span className="text-white font-medium">Importar CSV</span> para lançar automaticamente os dados no módulo.
        </p>
      </div>
    </div>
  );
};

export default ContasPagarPlaceholder;
