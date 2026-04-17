import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowRightLeft, ArrowUpRight, BarChart3, Building2, Wallet, FileSpreadsheet } from 'lucide-react';

const FinanceiroHub = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const cards = [
    {
      id: 'clientes-financeiro',
      title: 'Clientes Financeiro',
      description: 'Visualize e gerencie a carteira financeira dos clientes.',
      path: '/clientes-financeiro',
      icon: Building2,
      tone: 'border-sky-500/30 bg-sky-500/10',
    },
    {
      id: 'contas-receber',
      title: 'Contas a Receber',
      description: 'Acompanhe lancamentos, vencimentos e status de recebimento.',
      path: '/contas-receber',
      icon: ArrowRightLeft,
      tone: 'border-emerald-500/30 bg-emerald-500/10',
    },
    {
      id: 'servicos-avulsos',
      title: 'Servicos Avulsos',
      description: 'IRPF, MEI, ITR, Legalizacao e Outros Servicos com O.S integrada ao Comercial.',
      path: '/servicos-avulsos',
      icon: FileSpreadsheet,
      tone: 'border-cyan-500/30 bg-cyan-500/10',
    },
    ...(isAdmin
      ? [
          {
            id: 'metricas-financeiras',
            title: 'Metricas Financeiras',
            description: 'Indicadores de capacidade de pagamento e entradas esperadas.',
            path: '/metricas-financeiras',
            icon: BarChart3,
            tone: 'border-violet-500/30 bg-violet-500/10',
          },
          {
            id: 'contas-pagar',
            title: 'Contas a Pagar',
            description: 'Area administrativa de contas a pagar (em construcao).',
            path: '/contas-pagar',
            icon: Wallet,
            tone: 'border-amber-500/30 bg-amber-500/10',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-2xl border border-white/10 p-6">
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        <p className="mt-2 text-sm text-gray-300">Centralize o acesso aos modulos financeiros do sistema.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => navigate(card.path)}
              className={`glass card-hover rounded-2xl border p-5 text-left ${card.tone}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{card.title}</h2>
                  <p className="mt-2 text-sm text-gray-300">{card.description}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-red-200">
                Abrir modulo
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FinanceiroHub;
