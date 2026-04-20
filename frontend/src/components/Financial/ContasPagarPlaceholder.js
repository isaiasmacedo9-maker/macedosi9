import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, CheckCircle2 } from 'lucide-react';

const LOCAL_CONTAS_PAGAR_KEY = 'mock_financeiro_contas_pagar_local_v1';

const readJson = (key, fallback) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const ContasPagarPlaceholder = () => {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);

  const lancamentos = useMemo(() => readJson(LOCAL_CONTAS_PAGAR_KEY, []), [version]);

  const markAsPaid = (id) => {
    const current = readJson(LOCAL_CONTAS_PAGAR_KEY, []);
    const next = current.map((item) => (item.id === id ? { ...item, status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) } : item));
    localStorage.setItem(LOCAL_CONTAS_PAGAR_KEY, JSON.stringify(next));
    setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="glass-intense rounded-2xl border border-white/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Contas a Pagar</h1>
            <p className="mt-2 text-sm text-gray-300">Modulo reservado para desenvolvimento futuro.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/financeiro')}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/10"
          >
            Voltar para Financeiro
          </button>
        </div>
      </div>
      <div className="glass rounded-2xl border border-white/10 p-10 text-center">
        <Wallet className="w-14 h-14 text-amber-300 mx-auto mb-4" />
        <p className="text-lg text-white font-semibold">Area em construcao</p>
        <p className="text-sm text-gray-400 mt-2">Somente administradores visualizam este espaco.</p>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white">Lançamentos importados por extrato CSV</h2>
        <p className="mt-1 text-sm text-gray-400">Dados recebidos automaticamente da importação em Contas a Receber.</p>

        <div className="mt-4 space-y-2">
          {!lancamentos.length ? (
            <p className="text-sm text-gray-500">Nenhum lançamento importado ainda.</p>
          ) : (
            lancamentos.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.descricao}</p>
                  <p className="text-xs text-gray-400">{item.data} • {item.categoria || 'geral'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-emerald-300">
                    {Number(item.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  {item.status === 'pago' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pago
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markAsPaid(item.id)}
                      className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-100 hover:bg-emerald-500/25"
                    >
                      Marcar pago
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ContasPagarPlaceholder;
