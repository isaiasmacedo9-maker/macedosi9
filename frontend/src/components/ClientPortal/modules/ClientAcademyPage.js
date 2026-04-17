import React from 'react';
import {
  BookOpen,
  Briefcase,
  ClipboardList,
  DollarSign,
  FileStack,
  Headset,
  Lightbulb,
  Megaphone,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';

const sectors = [
  {
    id: 'administrativo',
    title: 'Administrativo',
    icon: ClipboardList,
    description: 'Organiza rotina, prazos e tarefas para a empresa funcionar sem apagar incêndio.',
    courses: ['Rotina administrativa em 30 minutos por dia', 'Como montar um calendário mensal simples'],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    icon: DollarSign,
    description: 'Ajuda a controlar dinheiro que entra e sai para evitar sustos no fim do mês.',
    courses: ['Fluxo de caixa para pequenos negócios', 'Preço de venda sem complicação'],
  },
  {
    id: 'marketing',
    title: 'Marketing',
    icon: Megaphone,
    description: 'Atrai clientes certos e aumenta a lembrança da sua marca.',
    courses: ['Conteúdo simples para Instagram que vende', 'Posicionamento local para ganhar autoridade'],
  },
  {
    id: 'comercial',
    title: 'Comercial',
    icon: Target,
    description: 'Transforma interesse em venda com processo e acompanhamento de oportunidades.',
    courses: ['Script de venda consultiva para pequenos times', 'Funil comercial no dia a dia'],
  },
  {
    id: 'atendimento',
    title: 'Atendimento',
    icon: Headset,
    description: 'Melhora experiência do cliente e aumenta recompra com comunicação clara.',
    courses: ['Padrão de resposta rápida no WhatsApp', 'Como lidar com reclamações com calma e método'],
  },
  {
    id: 'gestao',
    title: 'Gestão',
    icon: Briefcase,
    description: 'Dá visão do negócio para tomar decisão com menos achismo.',
    courses: ['Indicadores básicos para dono de empresa', 'Reunião semanal de gestão em 20 minutos'],
  },
  {
    id: 'documental',
    title: 'Organização documental',
    icon: FileStack,
    description: 'Evita perda de documentos e acelera demandas com contador e bancos.',
    courses: ['Pasta digital padrão para documentos da empresa', 'Checklist mensal de documentos críticos'],
  },
  {
    id: 'fiscal',
    title: 'Fiscal básico para empreendedores',
    icon: ShieldCheck,
    description: 'Mostra o essencial de impostos para reduzir erros e multas.',
    courses: ['Entendendo DAS, INSS e FGTS sem juridiquês', 'Como acompanhar vencimentos fiscais'],
  },
];

const tips = [
  'Separe conta pessoal e conta da empresa já no primeiro dia.',
  'Defina um dia fixo da semana para revisar números.',
  'Registre toda entrada e saída, mesmo valores pequenos.',
  'Monte uma reserva financeira mínima de 2 meses de despesas.',
  'Crie um checklist padrão para abertura e fechamento do dia.',
  'Não venda sem saber a margem de lucro do produto ou serviço.',
  'Use respostas rápidas no atendimento para ganhar agilidade.',
  'Tenha uma planilha simples de clientes ativos e inativos.',
  'Faça pós-venda: mensagem curta 7 dias após a entrega.',
  'Padronize propostas comerciais para evitar retrabalho.',
  'Revise contratos e documentos importantes todo mês.',
  'Defina metas semanais pequenas e mensuráveis.',
  'Acompanhe impostos com calendário visual e lembretes.',
  'Organize os documentos por mês e por categoria.',
  'Treine a equipe para resolver problemas comuns sem depender do dono.',
  'Acompanhe quais canais trazem mais clientes.',
  'Negocie prazos com fornecedores para melhorar fluxo de caixa.',
  'Evite descontos sem estratégia; priorize valor percebido.',
  'Mantenha indicadores simples: vendas, custos, lucro e inadimplência.',
  'Revise o que funcionou na semana e ajuste rapidamente.',
];

const ClientAcademyPage = () => {
  return (
    <div className="space-y-6">
      <section className="glass-intense rounded-[28px] border border-white/10 p-6">
        <div className="mb-4 inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
          <BookOpen className="mr-2 h-4 w-4" />
          Macedo Academy
        </div>
        <h1 className="text-3xl font-bold text-white">Aprendizado prático para sua empresa crescer</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-300">
          Conteúdo educativo com linguagem simples para empreendedores: setores essenciais, mini cursos e dicas úteis para aplicar hoje.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sectors.map((sector) => {
          const Icon = sector.icon;
          return (
            <article key={sector.id} className="glass rounded-[24px] border border-white/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2">
                  <Icon className="h-5 w-5 text-indigo-300" />
                </div>
                <h2 className="text-base font-semibold text-white">{sector.title}</h2>
              </div>
              <p className="text-sm text-gray-300">{sector.description}</p>
              <div className="mt-4 space-y-2">
                {sector.courses.map((course) => (
                  <div key={course} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-400">Mini curso</div>
                    <div className="mt-1 text-sm font-medium text-white">{course}</div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="glass rounded-[26px] border border-white/10 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-sky-300" />
          <h2 className="text-xl font-semibold text-white">20 dicas práticas para empreendedores</h2>
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {tips.map((tip, index) => (
            <div key={tip} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-gray-200">
              <span className="mr-2 font-semibold text-sky-300">{String(index + 1).padStart(2, '0')}.</span>
              {tip}
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-[26px] border border-white/10 p-5">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold text-white">Como usar a Academy no dia a dia</h2>
        </div>
        <p className="mt-2 text-sm text-gray-300">
          Escolha 1 setor por semana, aplique um mini curso e execute 3 dicas práticas. Em 30 dias, você já percebe mais organização e previsibilidade na operação.
        </p>
      </section>
    </div>
  );
};

export default ClientAcademyPage;
