import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Login from "./components/Login/Login";
import Dashboard from "./components/Dashboard/Dashboard";
import ClientesExpandido from "./components/Clients/ClientesExpandido";
import FinancialClients from "./components/Clients/FinancialClients";
import FinanceiroExpandido from "./components/Financial/FinanceiroExpandido";
import TrabalhistaExpandido from "./components/Trabalhista/TrabalhistaExpandido";
import FiscalExpandido from "./components/Fiscal/FiscalExpandido";
import AtendimentoAgendamento from "./components/Atendimento/AtendimentoAgendamento";
import PainelContadores from "./components/Contadores/PainelContadores";
import Configuracoes from "./components/Configuracoes/Configuracoes";
import Chat from "./components/Chat/Chat";
import ChatEnhanced from "./components/Chat/ChatEnhanced";
import Users from "./components/Settings/Users";
import Services from "./components/Services/Services";
import Comercial from "./components/Comercial/Comercial";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout/Layout";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="App min-h-screen bg-futuristic">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/servicos" element={<Services />} />
                      <Route path="/comercial" element={<Comercial />} />
                      <Route path="/clientes" element={<ClientesExpandido />} />
                      <Route path="/clientes-financeiro" element={<FinancialClients />} />
                      <Route path="/contas-receber" element={<FinanceiroExpandido />} />
                      <Route path="/trabalhista" element={<TrabalhistaExpandido />} />
                      <Route path="/fiscal" element={<FiscalExpandido />} />
                      <Route path="/atendimento" element={<AtendimentoAgendamento />} />
                      <Route path="/contadores" element={<PainelContadores />} />
                      <Route path="/chat" element={<ChatEnhanced />} />
                      <Route path="/configuracoes" element={<Configuracoes />} />
                      <Route path="/configuracoes/usuarios" element={<Users />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
          <Toaster 
            theme="dark" 
            position="top-right"
            toastOptions={{
              style: {
                background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.08), rgba(0, 0, 0, 0.95))',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                color: '#ffffff',
                boxShadow: '0 0 15px rgba(220, 38, 38, 0.2)',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;