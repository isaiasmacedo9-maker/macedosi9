import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';

const ContasPagarPlaceholder = () => {
  const navigate = useNavigate();

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
    </div>
  );
};

export default ContasPagarPlaceholder;
