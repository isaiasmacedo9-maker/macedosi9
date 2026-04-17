import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';

const FINANCIAL_CLIENTS_KEY = 'mock_financial_clients_v2';

const readList = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(FINANCIAL_CLIENTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getRangeByDay = (day) => {
  if (day >= 1 && day <= 7) return '01-07';
  if (day >= 8 && day <= 11) return '08-11';
  if (day >= 12 && day <= 16) return '12-16';
  if (day >= 17 && day <= 21) return '17-21';
  return '22-30';
};

const MetricasFinanceiras = () => {
  const navigate = useNavigate();

  const data = useMemo(() => {
    const list = readList();
    const capacidade = {
      paga_em_dia: 0,
      paga_no_mes: 0,
      atraso_recorrente: 0,
    };
    const ranges = {
      '01-07': 0,
      '08-11': 0,
      '12-16': 0,
      '17-21': 0,
      '22-30': 0,
    };

    list.forEach((item) => {
      const valor = Number(item.valor_com_desconto || item.valor_boleto || 0);
      const cap = item.capacidade_pagamento || 'paga_em_dia';
      if (capacidade[cap] !== undefined) capacidade[cap] += valor;

      const date = item.data_vencimento ? new Date(`${item.data_vencimento}T00:00:00`) : null;
      if (date && !Number.isNaN(date.getTime())) {
        const day = date.getDate();
        const range = getRangeByDay(day);
        ranges[range] += valor;
      }
    });

    const graph = [
      { key: '01-07', label: 'Dia 01 a dia 07', value: ranges['01-07'] },
      { key: '08-11', label: 'Dia 08 a dia 11', value: ranges['08-11'] },
      { key: '12-16', label: 'Dia 12 a dia 16', value: ranges['12-16'] },
      { key: '17-21', label: 'Dia 17 a dia 21', value: ranges['17-21'] },
      { key: '22-30', label: 'Dia 22 a dia 30', value: ranges['22-30'] },
    ];
    const max = Math.max(...graph.map((g) => g.value), 1);

    return { capacidade, graph, max };
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="glass-intense rounded-2xl border border-white/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Metricas Financeiras</h1>
            <p className="mt-2 text-sm text-gray-300">Analise de capacidade de pagamento e entrada esperada por faixa de datas.</p>
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

      <div className="glass rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white">Capacidade de pagamento</h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => navigate('/clientes-financeiro?capacidade=paga_em_dia')}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left"
          >
            <p className="text-sm text-emerald-200">Paga em Dia</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(data.capacidade.paga_em_dia)}</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/clientes-financeiro?capacidade=paga_no_mes')}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left"
          >
            <p className="text-sm text-amber-200">Paga Dentro do Mes</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(data.capacidade.paga_no_mes)}</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/clientes-financeiro?capacidade=atraso_recorrente')}
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-left"
          >
            <p className="text-sm text-rose-200">Atraso Recorrente</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(data.capacidade.atraso_recorrente)}</p>
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/10 p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-red-300" />
          <h2 className="text-lg font-semibold text-white">Entrada esperada por data</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Considera janela de pagamento com variacao de fim de semana (vencimento pode ocorrer entre dia anterior e posterior).
        </p>
        <div className="space-y-3">
          {data.graph.map((item) => (
            <div key={item.key} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between text-sm text-gray-200">
                <span>{item.label}</span>
                <span className="font-semibold text-white">{formatCurrency(item.value)}</span>
              </div>
              <div className="mt-2 h-3 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400" style={{ width: `${Math.round((item.value / data.max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MetricasFinanceiras;
