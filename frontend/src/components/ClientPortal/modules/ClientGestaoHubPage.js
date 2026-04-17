import React from 'react';
import {
  Building2,
  FileCheck2,
  Files,
  History,
  IdCard,
  MapPin,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { getPortalDocumentosData, getPortalEmpresaData } from '../../../dev/clientPortalData';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const docStatusStyles = {
  atualizado: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  pendente_revisao: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
};

const certStatusStyles = {
  vigente: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  renovar_em_breve: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200',
  vencido: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
};

const certStatusLabels = {
  vigente: 'Vigente',
  renovar_em_breve: 'Renovar em breve',
  vencido: 'Vencido',
};

const ClientGestaoHubPage = ({ clienteId }) => {
  const empresaData = getPortalEmpresaData(clienteId);
  const docsData = getPortalDocumentosData(clienteId);

  if (!empresaData || !docsData) return null;

  const { company, portalClient, socios, documentos, certificadoDigital, endereco, contato } = empresaData;
  const historico = [...docsData.documentos].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 6);
  const validadeFim = new Date(certificadoDigital.validadeFim);
  const diffDays = Math.ceil((validadeFim - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      <section className="glass-intense rounded-[28px] border border-white/10 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-200">
              <Building2 className="mr-2 h-4 w-4" />
              Gestão centralizada
            </div>
            <h1 className="text-3xl font-bold text-white">Gestão da empresa e documentos</h1>
            <p className="mt-2 text-sm text-gray-300">
              Área única para dados da empresa, documentos principais, certificado digital e histórico de controles.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Empresa ativa</div>
            <div className="mt-1 text-base font-semibold text-white">{company.nome_fantasia}</div>
            <div className="text-xs text-gray-400">{portalClient.regime_label}</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="glass rounded-[26px] border border-white/10 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Dados da empresa</h2>
              <p className="text-sm text-gray-400">Cadastro principal, contato e estrutura societária.</p>
            </div>
            <IdCard className="h-5 w-5 text-gray-400" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBlock label="Razão social" value={company.nome_empresa} />
            <InfoBlock label="Nome fantasia" value={company.nome_fantasia} />
            <InfoBlock label="CNPJ" value={company.cnpj} />
            <InfoBlock label="Cidade" value={endereco.cidade} />
            <InfoBlock label="Endereço" value={endereco.descricao} />
            <InfoBlock label="Contato" value={`${contato.telefone} | ${contato.email}`} />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <UserCheck className="h-4 w-4 text-emerald-300" />
              Sócios
            </div>
            <div className="space-y-2">
              {socios.map((socio) => (
                <div key={socio.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-3 py-2">
                  <span className="text-sm text-white">{socio.nome}</span>
                  <span className="text-xs text-gray-300">{socio.funcao} - {socio.participacao}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="glass rounded-[26px] border border-white/10 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Certificado digital</h2>
              <p className="text-sm text-gray-400">Validade e situação operacional.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-gray-400" />
          </div>

          <div className="space-y-3">
            <InfoBlock label="Expira em" value={formatDate(certificadoDigital.validadeFim)} />
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-gray-400">Controle de prazo</div>
              <div className="mt-1 text-base font-semibold text-white">
                {diffDays >= 0 ? `Faltam ${diffDays} dias para expirar` : `Expirado há ${Math.abs(diffDays)} dias`}
              </div>
            </div>
            <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${certStatusStyles[certificadoDigital.status] || certStatusStyles.vigente}`}>
              Status: {certStatusLabels[certificadoDigital.status] || certStatusLabels.vigente}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="glass rounded-[26px] border border-white/10 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Documentos principais</h2>
              <p className="text-sm text-gray-400">CCMEI para MEI e contrato social para Simples.</p>
            </div>
            <FileCheck2 className="h-5 w-5 text-gray-400" />
          </div>

          <div className="space-y-3">
            {documentos.map((documento) => (
              <article key={documento.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{documento.nome}</p>
                    <p className="mt-1 text-sm text-gray-400">Atualizado em {formatDate(documento.ultimaAtualizacao)}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${docStatusStyles[documento.status] || docStatusStyles.atualizado}`}>
                    {documento.status === 'pendente_revisao' ? 'Pendente revisão' : 'Atualizado'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="glass rounded-[26px] border border-white/10 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Histórico e controles</h2>
              <p className="text-sm text-gray-400">Movimentações recentes de documentos e fluxo.</p>
            </div>
            <History className="h-5 w-5 text-gray-400" />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <MetricCard label="Total de documentos" value={docsData.resumo.total} icon={Files} />
            <MetricCard label="Pendências" value={docsData.resumo.pendentes} icon={MapPin} />
          </div>

          <div className="space-y-2">
            {historico.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-white">{item.nome}</span>
                  <span className="text-xs text-gray-400">{formatDate(item.data)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {item.direcao === 'enviado' ? 'Enviado' : 'Recebido'} · {item.status}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const InfoBlock = ({ label, value }) => (
  <div className="rounded-xl border border-white/10 bg-black/20 p-3.5">
    <div className="text-xs uppercase tracking-[0.18em] text-gray-400">{label}</div>
    <div className="mt-1.5 text-sm font-semibold text-white">{value}</div>
  </div>
);

const MetricCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="mt-1 text-xl font-bold text-white">{value}</div>
  </div>
);

export default ClientGestaoHubPage;
