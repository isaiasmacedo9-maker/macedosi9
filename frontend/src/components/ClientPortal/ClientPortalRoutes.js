import React from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import ClientPortalLayout from './ClientPortalLayout';
import ClientPortalHome from './ClientPortalHome';
import ClientPortalAllCompaniesHome from './ClientPortalAllCompaniesHome';
import ClientPortalSectionPage from './ClientPortalSectionPage';
import ClientDasGuiasPage from './modules/ClientDasGuiasPage';
import ClientDocumentosPage from './modules/ClientDocumentosPage';
import ClientDocumentosImportantesPage from './modules/ClientDocumentosImportantesPage';
import ClientFinanceiroCaixaPage from './modules/ClientFinanceiroCaixaPage';
import ClientFinanceiroContasPage from './modules/ClientFinanceiroContasPage';
import ClientFinanceiroOrcamentosPage from './modules/ClientFinanceiroOrcamentosPage';
import ClientFinanceiroRecibosPage from './modules/ClientFinanceiroRecibosPage';
import ClientGestaoAgendaPage from './modules/ClientGestaoAgendaPage';
import ClientGestaoClientesPage from './modules/ClientGestaoClientesPage';
import ClientGestaoEstoquePage from './modules/ClientGestaoEstoquePage';
import ClientGestaoFornecedoresPage from './modules/ClientGestaoFornecedoresPage';
import ClientGestaoHubPage from './modules/ClientGestaoHubPage';
import ClientGestaoProdutosPage from './modules/ClientGestaoProdutosPage';
import ClientAcademyPage from './modules/ClientAcademyPage';
import ClientEmpresaPage from './modules/ClientEmpresaPage';
import ClientMeusDadosPage from './modules/ClientMeusDadosPage';
import ClientMacedogramPage from './modules/ClientMacedogramPage';
import ClientNotasEmissaoPage from './modules/ClientNotasEmissaoPage';
import ClientNotasHistoricoPage from './modules/ClientNotasHistoricoPage';
import ClientRelatorioFaturamentoPage from './modules/ClientRelatorioFaturamentoPage';
import ClientRelatorioDespesasPage from './modules/ClientRelatorioDespesasPage';
import ClientServicosPage from './modules/ClientServicosPage';
import ClientSupportChatPage from './modules/ClientSupportChatPage';
import {
  ALL_CLIENTS_PORTAL_ID,
  getClientEnabledModulesByClientRefId,
  getConsolidatedPortalOverview,
  getPortalOverviewData,
} from '../../dev/clientPortalData';
import { useAuth } from '../../contexts/AuthContext';

const ClientPortalRoutes = () => {
  const { clienteId } = useParams();
  const { user } = useAuth();
  const isAllCompaniesView = clienteId === ALL_CLIENTS_PORTAL_ID;
  const portalContext = getPortalOverviewData(clienteId);
  const consolidatedContext = getConsolidatedPortalOverview(user);
  const enabledModules = portalContext
    ? getClientEnabledModulesByClientRefId(portalContext.portalClient?.clientRefId)
    : null;

  if (isAllCompaniesView) {
    return (
      <ClientPortalLayout>
        <Routes>
          <Route index element={<ClientPortalAllCompaniesHome consolidatedContext={consolidatedContext} />} />
          <Route path="*" element={<Navigate to={`/cliente/${ALL_CLIENTS_PORTAL_ID}`} replace />} />
        </Routes>
      </ClientPortalLayout>
    );
  }

  if (!portalContext) {
    return <ClientPortalLayout><div /></ClientPortalLayout>;
  }

  return (
    <ClientPortalLayout>
      <Routes>
        <Route index element={<ClientPortalHome portalContext={portalContext} />} />
        <Route path="gestao" element={<ClientGestaoHubPage clienteId={clienteId} />} />
        <Route path="financeiro" element={<ClientPortalSectionPage portalClient={portalContext.portalClient} sectionKey="financeiro-hub" />} />
        <Route path="impostos" element={enabledModules?.impostos ? <ClientDasGuiasPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="das/guias" element={<Navigate to={`/cliente/${clienteId}/impostos`} replace />} />
        <Route path="das/divida-ativa" element={<Navigate to={`/cliente/${clienteId}/impostos`} replace />} />
        <Route path="das/parcelamento" element={<Navigate to={`/cliente/${clienteId}/impostos`} replace />} />
        <Route path="notas-fiscais/emissao" element={enabledModules?.fiscal ? <ClientNotasEmissaoPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="notas-fiscais/historico" element={enabledModules?.fiscal ? <ClientNotasHistoricoPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="servicos" element={enabledModules?.servicos ? <ClientServicosPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="documentos/enviados-recebidos" element={<ClientDocumentosPage clienteId={clienteId} />} />
        <Route path="documentos/importantes" element={<ClientDocumentosImportantesPage clienteId={clienteId} />} />
        <Route path="gestao/clientes" element={enabledModules?.atendimento ? <ClientGestaoClientesPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="gestao/fornecedores" element={enabledModules?.atendimento ? <ClientGestaoFornecedoresPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="gestao/produtos" element={enabledModules?.atendimento ? <ClientGestaoProdutosPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="gestao/estoque" element={enabledModules?.atendimento ? <ClientGestaoEstoquePage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="gestao/agenda" element={enabledModules?.atendimento ? <ClientGestaoAgendaPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="academy" element={enabledModules?.academy ? <ClientAcademyPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="financeiro/caixa" element={enabledModules?.financeiro ? <ClientFinanceiroCaixaPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="financeiro/recibos" element={enabledModules?.financeiro ? <ClientFinanceiroRecibosPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="financeiro/orcamentos" element={enabledModules?.financeiro ? <ClientFinanceiroOrcamentosPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="financeiro/contas" element={enabledModules?.financeiro ? <ClientFinanceiroContasPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="relatorios/faturamento" element={enabledModules?.relatorios ? <ClientRelatorioFaturamentoPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="relatorios/despesas" element={enabledModules?.relatorios ? <ClientRelatorioDespesasPage clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="empresa" element={<ClientEmpresaPage clienteId={clienteId} />} />
        <Route path="meus-dados" element={<ClientMeusDadosPage clienteId={clienteId} authUser={user} />} />
        <Route path="chat" element={enabledModules?.chat ? <ClientSupportChatPage clienteId={clienteId} authUser={user} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="macedogram" element={enabledModules?.macedogram ? <ClientMacedogramPage authUser={user} clienteId={clienteId} /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="clube-beneficios" element={enabledModules?.clube_beneficios ? <ClientPortalSectionPage portalClient={portalContext.portalClient} sectionKey="clube-beneficios" /> : <Navigate to={`/cliente/${clienteId}`} replace />} />
        <Route path="*" element={<Navigate to={`/cliente/${clienteId}`} replace />} />
      </Routes>
    </ClientPortalLayout>
  );
};

export default ClientPortalRoutes;
