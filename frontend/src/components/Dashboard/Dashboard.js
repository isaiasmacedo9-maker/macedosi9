import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { 
  Building2, 
  DollarSign, 
  Users, 
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    clients: 0,
    financial: { total_aberto: 0, total_atrasado: 0, total_recebido: 0 },
    tasks: { pendente: 0, em_andamento: 0, concluida: 0 },
    tickets: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        
        // Load stats based on user permissions
        const promises = [];
        
        // Always load clients
        promises.push(
          api.get('/clients?limit=1').then(res => ({
            type: 'clients',
            data: res.data.total || 0
          })).catch(() => ({ type: 'clients', data: 0 }))
        );

        // Load financial data if user has access
        if (user?.role === 'admin' || user?.allowed_sectors?.includes('financeiro')) {
          promises.push(
            api.get('/financial/dashboard-stats').then(res => ({
              type: 'financial',
              data: res.data
            })).catch(() => ({ type: 'financial', data: { total_aberto: 0, total_atrasado: 0, total_recebido: 0 } }))
          );
        }

        // Load tasks data
        promises.push(
          api.get('/tasks/stats/dashboard').then(res => ({
            type: 'tasks',
            data: res.data.status_stats || { pendente: 0, em_andamento: 0, concluida: 0 }
          })).catch(() => ({ type: 'tasks', data: { pendente: 0, em_andamento: 0, concluida: 0 } }))
        );

        const results = await Promise.all(promises);
        
        const newStats = { ...stats };
        results.forEach(result => {
          if (result.type === 'clients') {
            newStats.clients = result.data;
          } else if (result.type === 'financial') {
            newStats.financial = result.data;
          } else if (result.type === 'tasks') {
            newStats.tasks = result.data;
          }
        });

        setStats(newStats);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  const StatCard = ({ title, value, icon: Icon, color, trend, emoji }) => (
    <div className="glass p-6 rounded-2xl card-hover">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium flex items-center">
            <span className="mr-2">{emoji}</span>
            {title}
          </p>
          <p className={`text-2xl font-bold mt-2 ${color}`}>
            {loading ? (
              <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full"></div>
            ) : (
              value
            )}
          </p>
          {trend && (
            <p className="text-sm text-gray-500 mt-1">{trend}</p>
          )}
        </div>
        <div className={`w-12 h-12 ${color} bg-opacity-10 rounded-xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">📊</span>
            Dashboard
          </h1>
          <p className="text-gray-400 mt-2">
            Bem-vindo, {user?.name}! Aqui está o resumo do sistema.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
          <div className="flex items-center justify-end mt-1">
            <div className="w-2 h-2 status-online rounded-full mr-2"></div>
            <span className="text-xs text-gray-500">Sistema Online</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Clientes"
          value={stats.clients}
          icon={Users}
          color="text-blue-400"
          emoji="🏢"
        />
        
        <StatCard
          title="Contas em Aberto"
          value={`R$ ${(stats.financial.total_aberto?.valor ?? stats.financial.total_aberto ?? 0).toLocaleString('pt-BR')}`}
          icon={DollarSign}
          color="text-yellow-400"
          emoji="💰"
        />

        <StatCard
          title="Tarefas Pendentes"
          value={stats.tasks.pendente}
          icon={Clock}
          color="text-orange-400"
          emoji="📋"
        />

        <StatCard
          title="Tarefas Concluídas"
          value={stats.tasks.concluida}
          icon={CheckCircle}
          color="text-green-400"
          emoji="✅"
        />
      </div>

      {/* Quick Actions */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center">
          <span className="mr-3">⚡</span>
          Acesso Rápido
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {user?.role === 'admin' || user?.allowed_sectors?.includes('comercial') ? (
            <button className="p-4 rounded-xl bg-gradient-to-r from-blue-600/20 to-blue-800/20 border border-blue-600/30 hover:from-blue-600/30 hover:to-blue-800/30 transition-all duration-200 text-center">
              <Building2 className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <span className="text-sm text-white">🏢 Clientes</span>
            </button>
          ) : null}
          
          {user?.role === 'admin' || user?.allowed_sectors?.includes('financeiro') ? (
            <button className="p-4 rounded-xl bg-gradient-to-r from-green-600/20 to-green-800/20 border border-green-600/30 hover:from-green-600/30 hover:to-green-800/30 transition-all duration-200 text-center">
              <DollarSign className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <span className="text-sm text-white">💸 Financeiro</span>
            </button>
          ) : null}
          
          {user?.role === 'admin' || user?.allowed_sectors?.includes('trabalhista') ? (
            <button className="p-4 rounded-xl bg-gradient-to-r from-purple-600/20 to-purple-800/20 border border-purple-600/30 hover:from-purple-600/30 hover:to-purple-800/30 transition-all duration-200 text-center">
              <FileText className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <span className="text-sm text-white">👥 Trabalhista</span>
            </button>
          ) : null}
          
          {user?.role === 'admin' || user?.allowed_sectors?.includes('fiscal') ? (
            <button className="p-4 rounded-xl bg-gradient-to-r from-yellow-600/20 to-yellow-800/20 border border-yellow-600/30 hover:from-yellow-600/30 hover:to-yellow-800/30 transition-all duration-200 text-center">
              <FileText className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <span className="text-sm text-white">📋 Fiscal</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center">
          <span className="mr-3">📈</span>
          Resumo de Atividades
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-black/20">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Sistema Operacional</p>
                <p className="text-gray-400 text-sm">Todos os módulos funcionando normalmente</p>
              </div>
            </div>
            <span className="text-green-400 text-sm">Agora</span>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-black/20">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Base de Dados Carregada</p>
                <p className="text-gray-400 text-sm">{stats.clients} clientes sincronizados</p>
              </div>
            </div>
            <span className="text-blue-400 text-sm">Hoje</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;