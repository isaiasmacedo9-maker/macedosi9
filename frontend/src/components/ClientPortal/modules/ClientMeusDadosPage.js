import React from 'react';
import { Building2, CheckCircle2, KeyRound, Mail, Settings2, UserCircle2 } from 'lucide-react';
import { getPortalMeusDadosData } from '../../../dev/clientPortalData';

const formatDateTime = (value) =>
  new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const statusStyles = {
  regular: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  pendente: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  atrasado: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const ClientMeusDadosPage = ({ clienteId, authUser }) => {
  const moduleData = getPortalMeusDadosData(clienteId, authUser);

  if (!moduleData) return null;

  const { profile, linkedCompanies, preferencias } = moduleData;

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <UserCircle2 className="mr-2 h-4 w-4" />
              Meus dados
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Perfil e empresas vinculadas</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
              Área pronta para um portal SaaS profissional, com dados de acesso, preferências e vínculos empresariais.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Último acesso</div>
            <div className="mt-2 text-lg font-semibold text-white">{formatDateTime(profile.ultimo_acesso)}</div>
            <div className="mt-1 text-sm text-gray-400">{profile.email}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="space-y-6">
          <div className="glass rounded-[28px] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Dados do usuário</h2>
                <p className="text-sm text-gray-400">Informações da conta de acesso ao portal.</p>
              </div>
              <Mail className="h-5 w-5 text-gray-400" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InfoBlock label="Nome" value={profile.nome} />
              <InfoBlock label="Email" value={profile.email} />
              <InfoBlock label="Telefone de suporte" value={profile.telefone} />
              <InfoBlock label="Senha definida manualmente" value={profile.senha_definida_manualmente ? 'Sim' : 'Não'} />
            </div>
          </div>

          <div className="glass rounded-[28px] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Empresas vinculadas</h2>
                <p className="text-sm text-gray-400">Um único usuário pode acessar múltiplas empresas no mesmo portal.</p>
              </div>
              <Building2 className="h-5 w-5 text-gray-400" />
            </div>

            <div className="space-y-3">
              {linkedCompanies.map((company) => (
                <div key={company.clienteId} className="rounded-3xl border border-white/8 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-white">{company.nome_fantasia}</div>
                      <div className="mt-1 text-sm text-gray-400">
                        {company.regime_label} • atividade {company.atividade}
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[company.status_geral] || statusStyles.pendente}`}>
                      {company.status_geral}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-[28px] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Preferências</h2>
                <p className="text-sm text-gray-400">Configurações iniciais da experiência do portal.</p>
              </div>
              <Settings2 className="h-5 w-5 text-gray-400" />
            </div>

            <div className="space-y-3">
              <PreferenceItem label="Notificações por email" value={preferencias.notificacoes_email ? 'Ativadas' : 'Desativadas'} />
              <PreferenceItem label="Notificações por WhatsApp" value={preferencias.notificacoes_whatsapp ? 'Ativadas' : 'Desativadas'} />
              <PreferenceItem label="Canal principal de documentos" value={preferencias.recebimento_documentos} />
            </div>
          </div>

          <div className="glass rounded-[28px] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Segurança</h2>
                <p className="text-sm text-gray-400">Base preparada para credenciais, recuperação e trilha de acesso.</p>
              </div>
              <KeyRound className="h-5 w-5 text-gray-400" />
            </div>

            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-3 text-emerald-200">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Estrutura pronta para SaaS</span>
              </div>
              <div className="mt-2 text-sm text-emerald-100">
                O fluxo já considera senha definida manualmente pelo admin e múltiplas empresas vinculadas por usuário.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoBlock = ({ label, value }) => (
  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
    <div className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</div>
    <div className="mt-2 text-sm font-medium text-white">{value}</div>
  </div>
);

const PreferenceItem = ({ label, value }) => (
  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
    <div className="text-sm text-gray-400">{label}</div>
    <div className="mt-2 text-sm font-medium capitalize text-white">{value}</div>
  </div>
);

export default ClientMeusDadosPage;
