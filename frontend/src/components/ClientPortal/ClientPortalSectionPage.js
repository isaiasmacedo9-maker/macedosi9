import React from 'react';
import { ArrowUpRight, BadgeCheck, Building2, Sparkles } from 'lucide-react';
import { getPortalPageDefinition } from '../../dev/clientPortalData';

const ClientPortalSectionPage = ({ portalClient, sectionKey }) => {
  const page = getPortalPageDefinition(sectionKey, portalClient);

  return (
    <div className="space-y-6">
      <div className="glass-intense rounded-[28px] border border-white/8 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200">
              <Sparkles className="mr-2 h-4 w-4" />
              Módulo do portal
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">{page.title}</h1>
            <p className="mt-3 text-sm leading-6 text-gray-300">{page.description}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Empresa atual</div>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-white">
              <Building2 className="h-4 w-4" />
              {portalClient.nome_fantasia}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass rounded-[24px] p-5">
          <div className="text-sm text-gray-400">{page.primaryMetricLabel}</div>
          <div className="mt-3 text-3xl font-semibold text-white">{page.cards.primaryMetric}</div>
          <div className="mt-2 text-sm text-gray-400">Indicador configurado para demonstração local.</div>
        </div>
        <div className="glass rounded-[24px] p-5">
          <div className="text-sm text-gray-400">{page.secondaryMetricLabel}</div>
          <div className="mt-3 text-3xl font-semibold text-white">{page.cards.secondaryMetric}</div>
          <div className="mt-2 text-sm text-gray-400">Personalizado conforme tipo de empresa e atividade.</div>
        </div>
        <div className="glass rounded-[24px] p-5">
          <div className="text-sm text-gray-400">Status do módulo</div>
          <div className="mt-3 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-200">
            <BadgeCheck className="mr-2 h-4 w-4" />
            Estrutura pronta para SaaS
          </div>
          <div className="mt-2 text-sm text-gray-400">Base visual pronta para conectar API e regras reais.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="glass rounded-[28px] p-6">
          <h2 className="text-lg font-semibold text-white">Resumo operacional</h2>
          <div className="mt-5 space-y-3">
            {page.bullets.map((bullet) => (
              <div
                key={bullet}
                className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/20 p-4"
              >
                <ArrowUpRight className="mt-0.5 h-4 w-4 text-sky-300" />
                <p className="text-sm text-gray-300">{bullet}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-[28px] p-6">
          <h2 className="text-lg font-semibold text-white">Contexto da empresa</h2>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Tipo de empresa</div>
              <div className="mt-2 text-sm font-medium text-white uppercase">{portalClient.tipo_empresa}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Atividade</div>
              <div className="mt-2 text-sm font-medium capitalize text-white">{portalClient.atividade}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Responsável</div>
              <div className="mt-2 text-sm font-medium text-white">{portalClient.responsavel_conta}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientPortalSectionPage;
