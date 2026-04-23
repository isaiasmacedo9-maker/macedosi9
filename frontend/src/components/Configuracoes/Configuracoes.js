import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { Settings, User, Shield, Users as UsersIcon, UserCircle2, CheckCircle2, XCircle, RefreshCw, Loader2, Save, TestTube2 } from 'lucide-react';

const Configuracoes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleSaving, setGoogleSaving] = useState(false);
  const [googleTesting, setGoogleTesting] = useState(false);
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [googleFeedback, setGoogleFeedback] = useState('');
  const [googleStatus, setGoogleStatus] = useState(null);
  const [googleForm, setGoogleForm] = useState({
    enabled: true,
    root_folder_id: '',
    service_account_json: '',
    scopesText: '',
  });
  const [templatesForm, setTemplatesForm] = useState({
    contrato_template_file_id: '',
    ordem_servico_template_file_id: '',
    contas_receber_relatorio_geral_template_file_id: '',
    contas_receber_relatorio_cliente_template_file_id: '',
    os_template_file_id: '',
    chat_attachments_folder_name: 'Anexos do Chat',
  });

  useEffect(() => {
    loadConfigurations();
    if (isAdmin) {
      loadGoogleDriveIntegration();
    }
  }, [isAdmin]);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/configuracoes');
      setConfigurations(response.data || []);
    } catch (error) {
      console.error('Error loading configurations:', error);
      setConfigurations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleDriveIntegration = async () => {
    try {
      setGoogleLoading(true);
      setGoogleFeedback('');
      const [statusResponse, templatesResponse] = await Promise.all([
        api.get('/integrations/google-drive/status'),
        api.get('/integrations/google-drive/templates'),
      ]);
      const status = statusResponse?.data || {};
      const templates = templatesResponse?.data?.templates || {};
      setGoogleStatus(status);
      setGoogleForm((prev) => ({
        ...prev,
        enabled: Boolean(status.enabled),
        root_folder_id: String(status.root_folder_id || ''),
        scopesText: Array.isArray(status.scopes) ? status.scopes.join('\n') : '',
      }));
      setTemplatesForm({
        contrato_template_file_id: String(templates?.comercial?.contrato_template_file_id || ''),
        ordem_servico_template_file_id: String(templates?.comercial?.ordem_servico_template_file_id || ''),
        contas_receber_relatorio_geral_template_file_id: String(
          templates?.financeiro?.contas_receber_relatorio_geral_template_file_id || '',
        ),
        contas_receber_relatorio_cliente_template_file_id: String(
          templates?.financeiro?.contas_receber_relatorio_cliente_template_file_id || '',
        ),
        os_template_file_id: String(templates?.os_template_file_id || ''),
        chat_attachments_folder_name: String(templates?.chat?.attachments_folder_name || 'Anexos do Chat'),
      });
    } catch (error) {
      console.error('Error loading google drive integration:', error);
      setGoogleFeedback(error?.response?.data?.detail || 'Não foi possível carregar integração Google Drive.');
      setGoogleStatus(null);
    } finally {
      setGoogleLoading(false);
    }
  };

  const saveGoogleDriveConfig = async () => {
    try {
      setGoogleSaving(true);
      setGoogleFeedback('');

      const scopes = String(googleForm.scopesText || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);

      let serviceAccountValue = null;
      if (String(googleForm.service_account_json || '').trim()) {
        serviceAccountValue = googleForm.service_account_json.trim();
      }

      await api.post('/integrations/google-drive/configure', {
        enabled: Boolean(googleForm.enabled),
        root_folder_id: String(googleForm.root_folder_id || '').trim(),
        service_account_json: serviceAccountValue,
        scopes,
      });

      setGoogleFeedback('Integração Google Drive salva com sucesso.');
      await loadGoogleDriveIntegration();
      setGoogleForm((prev) => ({ ...prev, service_account_json: '' }));
    } catch (error) {
      console.error('Error saving google drive integration:', error);
      setGoogleFeedback(error?.response?.data?.detail || 'Não foi possível salvar integração Google Drive.');
    } finally {
      setGoogleSaving(false);
    }
  };

  const testGoogleDriveConnection = async () => {
    try {
      setGoogleTesting(true);
      setGoogleFeedback('');
      await api.post('/integrations/google-drive/test');
      setGoogleFeedback('Conexão com Google Drive validada com sucesso.');
      await loadGoogleDriveIntegration();
    } catch (error) {
      console.error('Error testing google drive integration:', error);
      setGoogleFeedback(error?.response?.data?.detail || 'Falha ao validar conexão Google Drive.');
    } finally {
      setGoogleTesting(false);
    }
  };

  const saveGoogleTemplates = async () => {
    try {
      setTemplatesSaving(true);
      setGoogleFeedback('');
      await api.put('/integrations/google-drive/templates', {
        contrato_template_file_id: templatesForm.contrato_template_file_id,
        ordem_servico_template_file_id: templatesForm.ordem_servico_template_file_id,
        contas_receber_relatorio_geral_template_file_id: templatesForm.contas_receber_relatorio_geral_template_file_id,
        contas_receber_relatorio_cliente_template_file_id: templatesForm.contas_receber_relatorio_cliente_template_file_id,
        os_template_file_id: templatesForm.os_template_file_id,
        chat_attachments_folder_name: templatesForm.chat_attachments_folder_name,
      });
      setGoogleFeedback('Templates Google salvos com sucesso.');
      await loadGoogleDriveIntegration();
    } catch (error) {
      console.error('Error saving google templates:', error);
      setGoogleFeedback(error?.response?.data?.detail || 'Não foi possível salvar templates Google.');
    } finally {
      setTemplatesSaving(false);
    }
  };

  const isOauthClientSecret = (() => {
    const raw = String(googleForm.service_account_json || '').trim();
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.installed || parsed?.web);
    } catch {
      return false;
    }
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">⚙️</span>
            Configurações
          </h1>
          <p className="text-gray-400 mt-2">Configurações do sistema</p>
        </div>
      </div>

      {/* Menu de Navegação */}
      {isAdmin && (
        <div className="glass p-4 rounded-2xl">
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/configuracoes/usuarios')}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <UsersIcon size={20} />
              Gerenciar Usuários
            </button>
          </div>
        </div>
      )}

      {isAdmin ? (
        <div className="glass rounded-2xl border border-white/10 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Integração Google Drive
              </h2>
              <p className="text-sm text-gray-400 mt-1">Armazenamento de documentos e geração por templates Google Docs.</p>
            </div>
            <button
              type="button"
              onClick={loadGoogleDriveIntegration}
              disabled={googleLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-gray-200 hover:bg-white/10 disabled:opacity-60"
            >
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Atualizar
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <input
                  type="checkbox"
                  checked={googleForm.enabled}
                  onChange={(e) => setGoogleForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                Integração habilitada
              </label>

              <label className="block text-sm text-gray-300 mb-2">
                ID da pasta raiz no Drive
                <input
                  type="text"
                  value={googleForm.root_folder_id}
                  onChange={(e) => setGoogleForm((prev) => ({ ...prev, root_folder_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none"
                  placeholder="Ex.: 1AbCdEfGhIj..."
                />
              </label>

              <label className="block text-sm text-gray-300 mb-2">
                Scopes (1 por linha)
                <textarea
                  rows={4}
                  value={googleForm.scopesText}
                  onChange={(e) => setGoogleForm((prev) => ({ ...prev, scopesText: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none"
                  placeholder="https://www.googleapis.com/auth/drive"
                />
              </label>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <label className="block text-sm text-gray-300 mb-2">
                JSON da Service Account (opcional ao editar)
                <textarea
                  rows={9}
                  value={googleForm.service_account_json}
                  onChange={(e) => setGoogleForm((prev) => ({ ...prev, service_account_json: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none font-mono text-xs"
                  placeholder='Cole aqui o JSON com "type": "service_account"'
                />
              </label>
              <p className="text-xs text-gray-500">
                Dica: só envie esse campo quando quiser trocar a credencial. Se deixar vazio, mantém a credencial atual.
              </p>
              {isOauthClientSecret ? (
                <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-100">
                  Esse JSON parece ser <strong>client_secret OAuth</strong> (web/installed). Para essa integração, use JSON de <strong>service account</strong>.
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveGoogleDriveConfig}
              disabled={googleSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
            >
              {googleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar integração
            </button>
            <button
              type="button"
              onClick={testGoogleDriveConnection}
              disabled={googleTesting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
            >
              {googleTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
              Testar conexão
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
            <h3 className="text-sm font-semibold text-white">Status atual</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p className="text-gray-300">
                Configurada:{' '}
                {googleStatus?.configured ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="w-4 h-4" /> Sim</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-300"><XCircle className="w-4 h-4" /> Não</span>
                )}
              </p>
              <p className="text-gray-300">
                Habilitada:{' '}
                {googleStatus?.enabled ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="w-4 h-4" /> Sim</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-300"><XCircle className="w-4 h-4" /> Não</span>
                )}
              </p>
              <p className="text-gray-400">Conta de serviço: {googleStatus?.service_account_email_masked || '-'}</p>
              <p className="text-gray-400">Último teste: {googleStatus?.last_test_at ? new Date(googleStatus.last_test_at).toLocaleString('pt-BR') : '-'}</p>
              <p className="text-gray-400">Resultado teste: {googleStatus?.last_test_status || '-'}</p>
              <p className="text-gray-400">Erro último teste: {googleStatus?.last_test_error || '-'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
            <h3 className="text-sm font-semibold text-white">Templates por módulo</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <label className="block text-sm text-gray-300">
                Contrato (Comercial)
                <input
                  type="text"
                  value={templatesForm.contrato_template_file_id}
                  onChange={(e) => setTemplatesForm((prev) => ({ ...prev, contrato_template_file_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="block text-sm text-gray-300">
                Ordem de Serviço (Comercial)
                <input
                  type="text"
                  value={templatesForm.ordem_servico_template_file_id}
                  onChange={(e) => setTemplatesForm((prev) => ({ ...prev, ordem_servico_template_file_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="block text-sm text-gray-300">
                Relatório geral (Contas a Receber)
                <input
                  type="text"
                  value={templatesForm.contas_receber_relatorio_geral_template_file_id}
                  onChange={(e) => setTemplatesForm((prev) => ({ ...prev, contas_receber_relatorio_geral_template_file_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="block text-sm text-gray-300">
                Relatório por cliente (Contas a Receber)
                <input
                  type="text"
                  value={templatesForm.contas_receber_relatorio_cliente_template_file_id}
                  onChange={(e) => setTemplatesForm((prev) => ({ ...prev, contas_receber_relatorio_cliente_template_file_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="block text-sm text-gray-300">
                Template O.S. global
                <input
                  type="text"
                  value={templatesForm.os_template_file_id}
                  onChange={(e) => setTemplatesForm((prev) => ({ ...prev, os_template_file_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none"
                />
              </label>
              <label className="block text-sm text-gray-300">
                Nome da pasta de anexos do Chat
                <input
                  type="text"
                  value={templatesForm.chat_attachments_folder_name}
                  onChange={(e) => setTemplatesForm((prev) => ({ ...prev, chat_attachments_folder_name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#1f2736] px-3 py-2 text-white outline-none"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={saveGoogleTemplates}
              disabled={templatesSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-60"
            >
              {templatesSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar templates
            </button>
          </div>

          {googleFeedback ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200">{googleFeedback}</div>
          ) : null}
        </div>
      ) : (
        <div className="glass rounded-2xl border border-white/10 p-4 text-sm text-gray-300">
          A configuração administrativa da integração Google Drive é exibida apenas para administradores.
        </div>
      )}

      <div className="glass rounded-2xl border border-white/10 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 bg-black/25 p-2">
            <UserCircle2 className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Nome</div>
              <div className="text-lg font-semibold text-white">{user?.name || 'Usuário'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Email</div>
              <div className="text-sm text-gray-300">{user?.email || '-'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Perfil</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                <Shield className="h-3.5 w-3.5" />
                {user?.role || 'colaborador'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Profile */}
        <div className="glass p-6 rounded-2xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <User className="w-6 h-6 mr-3" />
            Perfil do Usuário
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
              <input
                type="text"
                value={user?.name || ''}
                className="input-futuristic w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 focus:outline-none"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                className="input-futuristic w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 focus:outline-none"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Função</label>
              <input
                type="text"
                value={user?.role || ''}
                className="input-futuristic w-full px-4 py-3 rounded-xl text-white placeholder-gray-400 focus:outline-none capitalize"
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Access Permissions */}
        <div className="glass p-6 rounded-2xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Shield className="w-6 h-6 mr-3" />
            Permissões de Acesso
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cidades Permitidas</label>
              <div className="flex flex-wrap gap-2">
                {user?.allowed_cities?.map((city) => (
                  <span
                    key={city}
                    className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full text-sm capitalize"
                  >
                    {city}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Setores e Visualizações</label>
              <div className="space-y-3">
                {user?.permissoes?.map((perm) => (
                  <div key={perm.setor} className="bg-gray-700/50 p-3 rounded-lg">
                    <p className="text-white font-medium mb-2">{perm.setor}</p>
                    <div className="flex flex-wrap gap-2">
                      {perm.visualizacoes.map((vis) => (
                        <span
                          key={vis}
                          className="px-2 py-1 bg-green-600/20 text-green-400 border border-green-600/30 rounded text-xs"
                        >
                          {vis}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {(!user?.permissoes || user.permissoes.length === 0) && (
                  <p className="text-gray-400 text-sm">Nenhuma permissão configurada</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="glass p-6 rounded-2xl lg:col-span-2">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Settings className="w-6 h-6 mr-3" />
            Informações do Sistema
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-3 h-3 status-online rounded-full mx-auto mb-2"></div>
              <p className="text-white font-medium">Sistema Online</p>
              <p className="text-gray-400 text-sm">Operacional</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-blue-600 rounded-full mx-auto mb-2"></div>
              <p className="text-white font-medium">Banco de Dados</p>
              <p className="text-gray-400 text-sm">SQLite Conectado</p>
            </div>
            <div className="text-center">
              <div className="w-3 h-3 bg-green-600 rounded-full mx-auto mb-2"></div>
              <p className="text-white font-medium">API Backend</p>
              <p className="text-gray-400 text-sm">FastAPI Ativo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
