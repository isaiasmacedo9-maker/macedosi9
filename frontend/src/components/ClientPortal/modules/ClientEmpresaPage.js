import React, { useEffect, useState } from 'react';
import {
  Building2,
  CalendarPlus2,
  Download,
  FileCheck2,
  IdCard,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Eye,
  EyeOff,
  Upload,
  Users2,
} from 'lucide-react';
import { createMockCertificateServiceRequest, getPortalEmpresaData } from '../../../dev/clientPortalData';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const statusDocStyle = {
  atualizado: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  pendente_revisao: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

const statusCertStyle = {
  vigente: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  renovar_em_breve: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  vencido: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const statusCertLabel = {
  vigente: 'Vigente',
  renovar_em_breve: 'Renovar em breve',
  vencido: 'Vencido',
};

const ClientEmpresaPage = ({ clienteId }) => {
  const moduleData = getPortalEmpresaData(clienteId);
  const [isEditing, setIsEditing] = useState(false);
  const [showCertificatePassword, setShowCertificatePassword] = useState(false);
  const [formData, setFormData] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    endereco: '',
    cidade: '',
    cidadeAtendimento: '',
    email: '',
    telefone: '',
    whatsapp: '',
  });

  useEffect(() => {
    if (!moduleData) return;
    setFormData({
      razaoSocial: moduleData.company.nome_empresa,
      nomeFantasia: moduleData.company.nome_fantasia,
      cnpj: moduleData.company.cnpj,
      endereco: moduleData.endereco.descricao,
      cidade: moduleData.endereco.cidade,
      cidadeAtendimento: moduleData.endereco.cidadeAtendimento,
      email: moduleData.contato.email,
      telefone: moduleData.contato.telefone,
      whatsapp: moduleData.contato.whatsapp,
    });
    setIsEditing(false);
  }, [clienteId]);

  if (!moduleData) return null;

  const { company, socios, documentos, certificadoDigital } = moduleData;
  const validadeFim = new Date(certificadoDigital.validadeFim);
  const diffDays = Math.ceil((validadeFim - new Date()) / (1000 * 60 * 60 * 24));
  const isNearExpiry = diffDays <= 30;
  const isExpired = diffDays < 0;
  const showScheduleButton = isNearExpiry || isExpired;

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCancelEdit = () => {
    setFormData({
      razaoSocial: company.nome_empresa,
      nomeFantasia: company.nome_fantasia,
      cnpj: company.cnpj,
      endereco: moduleData.endereco.descricao,
      cidade: moduleData.endereco.cidade,
      cidadeAtendimento: moduleData.endereco.cidadeAtendimento,
      email: moduleData.contato.email,
      telefone: moduleData.contato.telefone,
      whatsapp: moduleData.contato.whatsapp,
    });
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
  };

  const handleScheduleCertificate = () => {
    const result = createMockCertificateServiceRequest(moduleData.portalClient, company);
    if (result.created) {
      alert('Serviço de certificado digital criado no dashboard interno (mock).');
    } else {
      alert('Já existe uma solicitação ativa de certificado para esta empresa.');
    }
  };

  const handleDownloadCertificate = () => {
    if (!certificadoDigital.cadastrado || !certificadoDigital.arquivoNome) return;
    const fileContent = `Certificado digital mock\nEmpresa: ${company.nome_fantasia}\nArquivo: ${certificadoDigital.arquivoNome}\nValidade: ${formatDate(
      certificadoDigital.validadeFim,
    )}`;
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = certificadoDigital.arquivoNome.replace('.pfx', '.txt');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950/90 p-7 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-200">
              <Building2 className="mr-2 h-4 w-4" />
              Empresa
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-white">Dados cadastrais da empresa</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-200">
              Area comum para clientes MEI e Simples Nacional com visao cadastral, documentos e certificado digital.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3">
            <div className="text-base uppercase tracking-[0.14em] text-zinc-300">Empresa ativa</div>
            <div className="mt-1 text-lg font-semibold text-white">{company.nome_fantasia}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1.6fr)_420px]">
        <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-7 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">Informacoes principais</h2>
              <p className="text-lg text-zinc-200">Cadastro base da empresa e dados de contato.</p>
            </div>
            <div className="flex items-center gap-3">
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25"
                >
                  Editar informacoes
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/15"
                  >
                    Cancelar
                  </button>
                </>
              )}
              <IdCard className="h-5 w-5 text-zinc-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-5">
            {isEditing ? (
              <>
                <InputBlock label="Razao social" value={formData.razaoSocial} onChange={(value) => handleFieldChange('razaoSocial', value)} />
                <InputBlock label="Nome fantasia" value={formData.nomeFantasia} onChange={(value) => handleFieldChange('nomeFantasia', value)} />
                <InputBlock label="CNPJ" value={formData.cnpj} onChange={(value) => handleFieldChange('cnpj', value)} />
                <InputBlock label="Endereco" value={formData.endereco} onChange={(value) => handleFieldChange('endereco', value)} />
                <InputBlock label="Cidade" value={formData.cidade} onChange={(value) => handleFieldChange('cidade', value)} />
                <InputBlock label="Cidade de atendimento" value={formData.cidadeAtendimento} onChange={(value) => handleFieldChange('cidadeAtendimento', value)} />
              </>
            ) : (
              <>
                <InfoBlock label="Razao social" value={formData.razaoSocial} />
                <InfoBlock label="Nome fantasia" value={formData.nomeFantasia} />
                <InfoBlock label="CNPJ" value={formData.cnpj} />
                <InfoBlock label="Endereco" value={formData.endereco} />
                <InfoBlock label="Cidade" value={formData.cidade} />
                <InfoBlock label="Cidade de atendimento" value={formData.cidadeAtendimento} />
              </>
            )}
          </div>

          <div className="mt-7">
            <div className="mb-4 flex items-center gap-2 text-3xl font-bold text-white">
              <Users2 className="h-4 w-4 text-zinc-300" />
              Socios
            </div>
            <div className="space-y-4">
              {socios.map((socio) => (
                <div key={socio.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-xl font-semibold text-white">{socio.nome}</div>
                      <div className="mt-2 text-lg text-zinc-200">{socio.funcao}</div>
                    </div>
                    <div className="rounded-full bg-zinc-800 px-3 py-1 text-base text-zinc-50">
                      Participacao: {socio.participacao}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
            {isEditing ? (
              <>
                <InputBlock label="Email" value={formData.email} onChange={(value) => handleFieldChange('email', value)} icon={Mail} />
                <InputBlock label="Telefone" value={formData.telefone} onChange={(value) => handleFieldChange('telefone', value)} icon={Phone} />
                <InputBlock label="WhatsApp" value={formData.whatsapp} onChange={(value) => handleFieldChange('whatsapp', value)} icon={MapPin} />
              </>
            ) : (
              <>
                <ContactChip icon={Mail} label="Email" value={formData.email} />
                <ContactChip icon={Phone} label="Telefone" value={formData.telefone} />
                <ContactChip icon={MapPin} label="WhatsApp" value={formData.whatsapp} />
              </>
            )}
          </div>
        </div>

        <div className="space-y-7">
          <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-7 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
            <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white">Documentos</h2>
                <p className="text-lg text-zinc-200">Arquivos principais do cadastro empresarial.</p>
              </div>
              <FileCheck2 className="h-5 w-5 text-zinc-400" />
            </div>

            <div className="space-y-4">
              {documentos.map((documento) => (
                <div key={documento.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">{documento.nome}</div>
                      <div className="mt-2 text-lg text-zinc-200">
                        Atualizado em {formatDate(documento.ultimaAtualizacao)}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-base font-medium ${statusDocStyle[documento.status] || statusDocStyle.atualizado}`}>
                      {documento.status === 'pendente_revisao' ? 'Pendente revisao' : 'Atualizado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-zinc-900/80 p-7 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
              <h2 className="text-3xl font-bold text-white">Certificado digital</h2>
                <p className="text-lg text-zinc-200">Controle de validade e status de uso.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-zinc-400" />
            </div>

            <div className="mb-5 rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
              <div className="text-lg uppercase tracking-[0.14em] text-zinc-300">Validade</div>
              <div className="mt-2 text-2xl font-bold text-white">
                {diffDays >= 0 ? `Faltam ${diffDays} dias para expirar` : `Expirado ha ${Math.abs(diffDays)} dias`}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {!certificadoDigital.cadastrado ? (
                  <button
                    type="button"
                    onClick={() => alert('Fluxo de upload preparado para integração futura.')}
                    className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/35 bg-sky-500/15 px-4 py-3 text-base font-semibold text-sky-100 transition hover:bg-sky-500/25"
                  >
                    <Upload className="h-4 w-4" />
                    Upload do certificado
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDownloadCertificate}
                    className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-3 text-base font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
                  >
                    <Download className="h-4 w-4" />
                    Download do certificado
                  </button>
                )}

                {showScheduleButton ? (
                  <button
                    type="button"
                    onClick={handleScheduleCertificate}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-500/35 bg-red-500/15 px-4 py-3 text-base font-semibold text-red-100 transition hover:bg-red-500/25"
                  >
                    <CalendarPlus2 className="h-4 w-4" />
                    Agendar novo certificado
                  </button>
                ) : null}
              </div>

              <InfoBlock label="Expira em" value={formatDate(certificadoDigital.validadeFim)} />
              <SensitiveInfoBlock
                label="Senha"
                value={certificadoDigital.senha}
                visible={showCertificatePassword}
                onToggle={() => setShowCertificatePassword((prev) => !prev)}
              />
              <div className={`rounded-2xl px-4 py-3 text-lg font-semibold ${statusCertStyle[certificadoDigital.status] || statusCertStyle.vigente}`}>
                Status: {statusCertLabel[certificadoDigital.status] || statusCertLabel.vigente}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoBlock = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
    <div className="text-base uppercase tracking-[0.12em] text-zinc-300">{label}</div>
    <div className="mt-3 text-2xl font-semibold text-zinc-50">{value}</div>
  </div>
);

const ContactChip = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
    <div className="flex items-center gap-2 text-base uppercase tracking-[0.12em] text-zinc-300">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="mt-3 text-2xl font-semibold text-zinc-50">{value}</div>
  </div>
);

const InputBlock = ({ label, value, onChange, icon: Icon }) => (
  <div className="rounded-2xl border border-red-500/25 bg-zinc-950/80 p-4 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
    <div className="flex items-center gap-2 text-base uppercase tracking-[0.12em] text-zinc-300">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </div>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-3 w-full rounded-xl border border-white/10 bg-zinc-900/90 px-3 py-2 text-xl font-semibold text-zinc-50 outline-none transition focus:border-red-400/60 focus:ring-2 focus:ring-red-500/30"
    />
  </div>
);

const SensitiveInfoBlock = ({ label, value, visible, onToggle }) => (
  <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
    <div className="flex items-center justify-between">
      <div className="text-base uppercase tracking-[0.12em] text-zinc-300">{label}</div>
      <button
        type="button"
        onClick={onToggle}
        className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
    <div className="mt-3 text-2xl font-semibold text-zinc-50">{visible ? value : '••••••••'}</div>
  </div>
);

export default ClientEmpresaPage;
