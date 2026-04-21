import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Login from "./components/Login/Login";
import Dashboard from "./components/Dashboard/Dashboard";
import DashboardTaskListView from "./components/Dashboard/DashboardTaskListView";
import DashboardAlertsView from "./components/Dashboard/DashboardAlertsView";
import DashboardAllTasksView from "./components/Dashboard/DashboardAllTasksView";
import DashboardTaskDetailView from "./components/Dashboard/DashboardTaskDetailView";
import ClientPortalEntry from "./components/ClientPortal/ClientPortalEntry";
import ClientPortalRoutes from "./components/ClientPortal/ClientPortalRoutes";
import ClientesExpandido from "./components/Clients/ClientesExpandido";
import ClientesAvulso from "./components/Clients/ClientesAvulso";
import FinancialClients from "./components/Clients/FinancialClients";
import FinanceiroExpandido from "./components/Financial/FinanceiroExpandido";
import FinanceiroHub from "./components/Financial/FinanceiroHub";
import MetricasFinanceiras from "./components/Financial/MetricasFinanceiras";
import ContasPagarPlaceholder from "./components/Financial/ContasPagarPlaceholder";
import ServicosAvulsos from "./components/Financial/ServicosAvulsos";
import TrabalhistaCompleto from "./components/Trabalhista/TrabalhistaCompleto";
import FiscalExpandido from "./components/Fiscal/FiscalExpandido";
import AtendimentoAgendamento from "./components/Atendimento/AtendimentoAgendamento";
import PainelContadores from "./components/Contadores/PainelContadores";
import Configuracoes from "./components/Configuracoes/Configuracoes";
import ChatHub from "./components/Chat/ChatHub";
import Users from "./components/Settings/Users";
import MeusDados from "./components/Settings/MeusDados";
import ChangePassword from "./components/Settings/ChangePassword";
import Services from "./components/Services/Services";
import DocumentsCenter from "./components/Documents/DocumentsCenter";
import Comercial from "./components/Comercial/Comercial";
import MacedoAcademyManuais from "./components/Ourolandia/MacedoAcademyManuais";
import ProtectedRoute, { AdminGuard, ColaboradorGuard, ModuleGuard } from "./components/ProtectedRoute";
import Layout from "./components/Layout/Layout";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";

function AppContent() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="App min-h-screen bg-futuristic">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/cliente"
              element={
                <ProtectedRoute>
                  <ClientPortalEntry />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cliente/:clienteId/*"
              element={
                <ProtectedRoute>
                  <ClientPortalRoutes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/admin" replace />} />
                      <Route path="/admin" element={<Dashboard />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/dashboard/tarefas-pendentes" element={<DashboardTaskListView viewType="pending" />} />
                      <Route path="/dashboard/novas-tarefas" element={<DashboardTaskListView viewType="new" />} />
                      <Route path="/dashboard/alertas-setor" element={<DashboardAlertsView />} />
                      <Route path="/dashboard/tarefas-gerais" element={<DashboardAllTasksView />} />
                      <Route path="/dashboard/tarefas-gerais/:taskId" element={<DashboardTaskDetailView />} />
                      <Route path="/servicos" element={<ModuleGuard moduleKey="servicos"><Services /></ModuleGuard>} />
                      <Route path="/documentos" element={<DocumentsCenter />} />
                      <Route path="/comercial" element={<ModuleGuard moduleKey="comercial"><Comercial /></ModuleGuard>} />
                      <Route path="/clientes" element={<ModuleGuard moduleKey="clientes"><ClientesExpandido /></ModuleGuard>} />
                      <Route path="/clientes-avulso" element={<ClientesAvulso />} />
                      <Route path="/financeiro" element={<ModuleGuard moduleKey="financeiro"><FinanceiroHub /></ModuleGuard>} />
                      <Route path="/clientes-financeiro" element={<ModuleGuard moduleKey="financeiro"><FinancialClients /></ModuleGuard>} />
                      <Route path="/contas-receber" element={<ModuleGuard moduleKey="financeiro"><FinanceiroExpandido /></ModuleGuard>} />
                      <Route path="/metricas-financeiras" element={<AdminGuard><ModuleGuard moduleKey="financeiro"><MetricasFinanceiras /></ModuleGuard></AdminGuard>} />
                      <Route path="/contas-pagar" element={<AdminGuard><ModuleGuard moduleKey="financeiro"><ContasPagarPlaceholder /></ModuleGuard></AdminGuard>} />
                      <Route path="/servicos-avulsos" element={<ModuleGuard moduleKey="financeiro"><ServicosAvulsos /></ModuleGuard>} />
                      <Route path="/servicos-avulsos/:categoria" element={<ModuleGuard moduleKey="financeiro"><ServicosAvulsos /></ModuleGuard>} />
                      <Route path="/servicos-avulsos/:categoria/:subservico" element={<ModuleGuard moduleKey="financeiro"><ServicosAvulsos /></ModuleGuard>} />
                      <Route path="/trabalhista" element={<ModuleGuard moduleKey="trabalhista"><TrabalhistaCompleto /></ModuleGuard>} />
                      <Route path="/fiscal" element={<ModuleGuard moduleKey="fiscal"><FiscalExpandido /></ModuleGuard>} />
                      <Route path="/atendimento" element={<ModuleGuard moduleKey="atendimento"><AtendimentoAgendamento /></ModuleGuard>} />
                      <Route path="/contadores" element={<ModuleGuard moduleKey="contadores"><PainelContadores /></ModuleGuard>} />
                      <Route path="/ourolandia" element={<ModuleGuard moduleKey="ourolandia"><MacedoAcademyManuais /></ModuleGuard>} />
                      <Route path="/chat" element={<ModuleGuard moduleKey="chat"><ChatHub /></ModuleGuard>} />
                      <Route path="/meus-dados" element={<ColaboradorGuard><MeusDados /></ColaboradorGuard>} />
                      <Route path="/configuracoes" element={<AdminGuard><ModuleGuard moduleKey="configuracoes"><Configuracoes /></ModuleGuard></AdminGuard>} />
                      <Route path="/configuracoes/meus-dados" element={<AdminGuard><ModuleGuard moduleKey="configuracoes"><MeusDados /></ModuleGuard></AdminGuard>} />
                      <Route path="/configuracoes/usuarios" element={<AdminGuard><ModuleGuard moduleKey="configuracoes"><Users /></ModuleGuard></AdminGuard>} />
                      <Route path="/configuracoes/senha" element={<AdminGuard><ModuleGuard moduleKey="configuracoes"><ChangePassword /></ModuleGuard></AdminGuard>} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
          <Toaster 
            theme={isDark ? "dark" : "light"} 
            position="top-right"
            toastOptions={{
              style: {
                background: isDark
                  ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.94))'
                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(245, 247, 251, 0.98))',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(15, 23, 42, 0.1)',
                color: isDark ? '#ffffff' : '#111827',
                boxShadow: isDark ? '0 10px 24px rgba(0, 0, 0, 0.34)' : '0 8px 20px rgba(15, 23, 42, 0.12)',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
