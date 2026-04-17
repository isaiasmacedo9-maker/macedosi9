export const mockBasicUsers = [
  { id: 'user-1', name: 'Marina Costa', email: 'marina@macedosi.local', role: 'admin' },
  { id: 'user-2', name: 'Rafael Souza', email: 'rafael@macedosi.local', role: 'colaborador' },
  { id: 'user-3', name: 'Bianca Lima', email: 'bianca@macedosi.local', role: 'colaborador' },
];

export const mockClients = [
  {
    id: 'client-1',
    nome_empresa: 'Alfa Comercio de Pecas Ltda',
    nome_fantasia: 'Alfa Pecas',
    cidade: 'Jacobina',
    cidade_atendimento: 'Jacobina',
    status: 'ativo',
    status_empresa: 'ativa',
    responsavel_empresa: 'Carlos Mendes',
    email: 'financeiro@alfapecas.com.br',
    telefone: '(74) 3333-1000',
    whatsapp: '(74) 99999-1000',
    cnpj: '12.345.678/0001-90',
    tipo_regime: 'simples_nacional',
    codigo_iob: 'IOB-1001',
    forma_envio: 'email',
    empresa_grupo: 'Grupo Alfa',
    novo_cliente: false,
    created_at: '2026-03-02T10:00:00',
  },
  {
    id: 'client-2',
    nome_empresa: 'Beta Servicos Medicos',
    nome_fantasia: 'Clinica Beta',
    cidade: 'Ourolandia',
    cidade_atendimento: 'Ourolandia',
    status: 'ativo',
    status_empresa: 'ativa',
    responsavel_empresa: 'Juliana Rocha',
    email: 'contato@clinicabeta.com.br',
    telefone: '(74) 3333-2000',
    whatsapp: '(74) 99999-2000',
    cnpj: '23.456.789/0001-01',
    tipo_regime: 'lucro_presumido',
    codigo_iob: 'IOB-1002',
    forma_envio: 'whatsapp',
    empresa_grupo: 'Grupo Beta',
    novo_cliente: true,
    created_at: '2026-03-12T14:30:00',
  },
  {
    id: 'client-3',
    nome_empresa: 'Construtora Serra Azul',
    nome_fantasia: 'Serra Azul',
    cidade: 'Umburanas',
    cidade_atendimento: 'Umburanas',
    status: 'inativo',
    status_empresa: 'inativa',
    responsavel_empresa: 'Fernanda Sales',
    email: 'adm@serraazul.com.br',
    telefone: '(74) 3333-3000',
    whatsapp: '(74) 99999-3000',
    cnpj: '34.567.890/0001-12',
    tipo_regime: 'lucro_real',
    codigo_iob: 'IOB-1003',
    forma_envio: 'email',
    empresa_grupo: 'Obras Serra',
    novo_cliente: false,
    created_at: '2026-02-18T09:15:00',
  },
  {
    id: 'client-4',
    nome_empresa: 'Mercadinho Central Jacobina',
    nome_fantasia: 'Mercadinho Central',
    cidade: 'Jacobina',
    cidade_atendimento: 'Jacobina',
    status: 'ativo',
    status_empresa: 'ativa',
    responsavel_empresa: 'Paulo Henrique',
    email: 'contato@mercadinhocentral.com.br',
    telefone: '(74) 3333-4000',
    whatsapp: '(74) 99999-4000',
    cnpj: '45.678.901/0001-23',
    tipo_regime: 'mei',
    codigo_iob: 'IOB-1004',
    forma_envio: 'email',
    empresa_grupo: 'Varejo Central',
    novo_cliente: false,
    created_at: '2026-01-25T11:00:00',
  },
];

export const mockDashboardStats = {
  clients: mockClients.length,
  financial: {
    total_aberto: { valor: 48250.75, count: 14 },
    total_atrasado: { valor: 12890.0, count: 4 },
    total_recebido_mes: { valor: 36540.2, count: 11 },
  },
  tasks: {
    pendente: 8,
    em_andamento: 5,
    concluida: 19,
  },
};

export const mockSimplesNacionalCard = {
  nome_empresa: 'Alfa Comercio de Pecas Ltda',
  aliquota_efetiva: 6.65,
  anexo: 'Anexo I',
  rbt12: 486250.45,
  faixa_atual: 'Faixa 3',
  faixa_numero: 3,
  limite_faixa: 720000.0,
  limite_anual: 720000.0,
};

export const mockDashboardInsights = {
  impostos_a_pagar: {
    quantidade: 3,
    valor_total: 4120.75,
    proximo_vencimento: '2026-04-20',
  },
  documentos_pendentes: {
    quantidade: 5,
    ultimo_envio: '2026-04-14',
  },
  situacao_financeira: {
    status: 'atencao',
    saldo_previsto: 18340.55,
    titulos_em_atraso: 2,
  },
  alertas_importantes: [
    {
      id: 'alerta-1',
      titulo: 'Vencimento do DAS próximo',
      descricao: 'Guia de abril vence em 20/04/2026.',
      criticidade: 'medio',
    },
    {
      id: 'alerta-2',
      titulo: 'Documentos de folha pendentes',
      descricao: 'Faltam 2 comprovantes para fechamento mensal.',
      criticidade: 'alto',
    },
  ],
  atividades_recentes: [
    {
      id: 'atividade-1',
      titulo: 'Conciliação financeira atualizada',
      descricao: 'Movimentações de caixa revisadas hoje.',
      momento: 'Hoje',
    },
    {
      id: 'atividade-2',
      titulo: 'Notas fiscais sincronizadas',
      descricao: '12 notas enviadas para conferência contábil.',
      momento: 'Ontem',
    },
  ],
};

export const mockFinancialContas = [
  {
    id: 'conta-1',
    empresa_id: 'client-1',
    empresa: 'Alfa Pecas',
    descricao: 'Honorarios contabeis - Marco/2026',
    documento: 'BOL-1045',
    situacao: 'em_aberto',
    valor_original: 1850.0,
    valor_quitado: 0,
    total_liquido: 1850.0,
    forma_pagamento: 'boleto',
    conta: 'Banco do Brasil',
    centro_custo: 'Contabil',
    plano_custo: 'Honorarios Mensais',
    data_emissao: '2026-03-01',
    data_vencimento: '2026-04-20',
    data_recebimento: null,
    cidade_atendimento: 'Jacobina',
    usuario_responsavel: 'Marina Costa',
    observacao: 'Cliente com envio recorrente por email.',
  },
  {
    id: 'conta-2',
    empresa_id: 'client-2',
    empresa: 'Clinica Beta',
    descricao: 'Folha complementar - Abril/2026',
    documento: 'PIX-2210',
    situacao: 'atrasado',
    valor_original: 2740.5,
    valor_quitado: 0,
    total_liquido: 2740.5,
    forma_pagamento: 'pix',
    conta: 'Sicredi',
    centro_custo: 'Trabalhista',
    plano_custo: 'Folha',
    data_emissao: '2026-04-01',
    data_vencimento: '2026-04-10',
    data_recebimento: null,
    cidade_atendimento: 'Ourolandia',
    usuario_responsavel: 'Rafael Souza',
    observacao: 'Aguardando retorno do financeiro da clinica.',
  },
  {
    id: 'conta-3',
    empresa_id: 'client-4',
    empresa: 'Mercadinho Central',
    descricao: 'Parcelamento de regularizacao fiscal',
    documento: 'REC-8821',
    situacao: 'pago',
    valor_original: 920.0,
    valor_quitado: 920.0,
    total_liquido: 920.0,
    forma_pagamento: 'transferencia',
    conta: 'Caixa',
    centro_custo: 'Fiscal',
    plano_custo: 'Parcelamentos',
    data_emissao: '2026-03-18',
    data_vencimento: '2026-03-28',
    data_recebimento: '2026-03-27',
    cidade_atendimento: 'Jacobina',
    usuario_responsavel: 'Bianca Lima',
    observacao: 'Pago antecipadamente.',
  },
];

export const mockFinancialDashboardStats = {
  total_aberto: { valor: 48250.75, count: 14 },
  total_atrasado: { valor: 12890.0, count: 4 },
  total_recebido_mes: { valor: 36540.2, count: 11 },
  aging: {
    a_vencer: { valor: 17300.0, count: 6 },
    vencido_30: { valor: 6420.0, count: 2 },
    vencido_60: { valor: 4470.0, count: 1 },
    vencido_90: { valor: 2000.0, count: 1 },
  },
};

export const mockFiscalDashboardStats = {
  obrigacoes_por_status: {
    pendente: 9,
    entregue: 21,
    atrasado: 2,
    em_andamento: 4,
  },
  obrigacoes_vencendo_30_dias: 6,
  notas_fiscais_mes: 38,
};

export const mockFiscalObrigacoes = [
  {
    id: 'fiscal-1',
    empresa_id: 'client-1',
    empresa: 'Alfa Pecas',
    tipo: 'pgdas',
    nome: 'PGDAS-D Abril/2026',
    periodicidade: 'mensal',
    proximo_vencimento: '2026-04-20',
    status: 'pendente',
    responsavel: 'Bianca Lima',
    regime_tributario: 'simples_nacional',
    valor: 1320.45,
    observacoes: 'Aguardando faturamento final do periodo.',
  },
  {
    id: 'fiscal-2',
    empresa_id: 'client-2',
    empresa: 'Clinica Beta',
    tipo: 'dctf',
    nome: 'DCTF Mensal',
    periodicidade: 'mensal',
    proximo_vencimento: '2026-04-18',
    status: 'em_andamento',
    responsavel: 'Marina Costa',
    regime_tributario: 'lucro_presumido',
    valor: 980.0,
    observacoes: 'Conferencia de retenções em andamento.',
  },
  {
    id: 'fiscal-3',
    empresa_id: 'client-3',
    empresa: 'Serra Azul',
    tipo: 'sped_fiscal',
    nome: 'SPED Fiscal',
    periodicidade: 'mensal',
    proximo_vencimento: '2026-04-15',
    status: 'atrasado',
    responsavel: 'Rafael Souza',
    regime_tributario: 'lucro_real',
    valor: 2450.0,
    observacoes: 'Necessita retificação de notas de entrada.',
  },
];

export const mockFiscalNotasFiscais = [
  {
    id: 'nota-1',
    empresa_id: 'client-1',
    empresa: 'Alfa Pecas',
    tipo: 'saida',
    numero: 1045,
    serie: '1',
    chave_nfe: '29260412345678000190550010000010451000010451',
    data_emissao: '2026-04-02',
    emitente_cnpj: '12.345.678/0001-90',
    emitente_razao_social: 'Alfa Comercio de Pecas Ltda',
    valor_total: 12850.9,
    status_conciliacao: 'conciliado',
    cfop: '5102',
  },
  {
    id: 'nota-2',
    empresa_id: 'client-2',
    empresa: 'Clinica Beta',
    tipo: 'entrada',
    numero: 875,
    serie: '3',
    chave_nfe: '29260423456789000101550030000008751000008751',
    data_emissao: '2026-04-05',
    emitente_cnpj: '23.456.789/0001-01',
    emitente_razao_social: 'Beta Servicos Medicos',
    valor_total: 3920.0,
    status_conciliacao: 'pendente',
    cfop: '1102',
  },
];

export const mockTrabalhistaDashboardStats = {
  solicitacoes_por_status: {
    pendente: 5,
    em_andamento: 3,
    concluido: 11,
  },
  obrigacoes_pendentes: 4,
  total_funcionarios: 126,
};

export const mockTrabalhistaDashboardServicos = {
  recalculos: {
    pendentes: 2,
    em_andamento: 1,
  },
  admissoes: {
    pendentes: 3,
    em_andamento: 2,
  },
  demissoes: {
    pendentes: 1,
    aguardando_homologacao: 2,
  },
};

export const mockTrabalhistaRecalculos = [
  {
    id: 'recalc-1',
    empresa_id: 'client-1',
    empresa: 'Alfa Pecas',
    competencia: '2026-03',
    colaborador_responsavel: 'Rafael Souza',
    tipo: 'folha_complementar',
    status: 'pendente',
    valor_estimado: 540.0,
  },
  {
    id: 'recalc-2',
    empresa_id: 'client-2',
    empresa: 'Clinica Beta',
    competencia: '2026-04',
    colaborador_responsavel: 'Marina Costa',
    tipo: 'rescisao',
    status: 'em_andamento',
    valor_estimado: 1280.75,
  },
];

export const mockTrabalhistaAdmissoes = [
  {
    id: 'adm-1',
    empresa_id: 'client-1',
    empresa: 'Alfa Pecas',
    nome_funcionario: 'Lucas Vieira',
    cargo: 'Assistente Fiscal',
    data_admissao: '2026-04-22',
    status: 'pendente',
    salario: 2100.0,
  },
  {
    id: 'adm-2',
    empresa_id: 'client-4',
    empresa: 'Mercadinho Central',
    nome_funcionario: 'Patricia Gomes',
    cargo: 'Operadora de Caixa',
    data_admissao: '2026-04-25',
    status: 'em_andamento',
    salario: 1650.0,
  },
];

export const mockTrabalhistaDemissoes = [
  {
    id: 'dem-1',
    empresa_id: 'client-2',
    empresa: 'Clinica Beta',
    nome_funcionario: 'Bruno Teixeira',
    data_desligamento: '2026-04-12',
    status: 'pendente',
    tipo_aviso: 'indenizado',
  },
  {
    id: 'dem-2',
    empresa_id: 'client-3',
    empresa: 'Serra Azul',
    nome_funcionario: 'Claudio Santana',
    data_desligamento: '2026-04-08',
    status: 'aguardando_homologacao',
    tipo_aviso: 'trabalhado',
  },
];

export const mockTrabalhistaSolicitacoes = [
  {
    id: 'sol-1',
    empresa_id: 'client-1',
    empresa: 'Alfa Pecas',
    titulo: 'Ajuste de jornada',
    tipo: 'folha',
    responsavel: 'Rafael Souza',
    status: 'pendente',
    prazo: '2026-04-19',
  },
  {
    id: 'sol-2',
    empresa_id: 'client-2',
    empresa: 'Clinica Beta',
    titulo: 'Atualização cadastral de colaborador',
    tipo: 'cadastro',
    responsavel: 'Marina Costa',
    status: 'em_andamento',
    prazo: '2026-04-22',
  },
];

export const mockTrabalhistaObrigacoes = [
  {
    id: 'obrtrab-1',
    empresa_id: 'client-1',
    empresa: 'Alfa Pecas',
    nome: 'Envio eSocial',
    periodicidade: 'mensal',
    proximo_vencimento: '2026-04-17',
    status: 'pendente',
    responsavel: 'Rafael Souza',
  },
  {
    id: 'obrtrab-2',
    empresa_id: 'client-4',
    empresa: 'Mercadinho Central',
    nome: 'FGTS Digital',
    periodicidade: 'mensal',
    proximo_vencimento: '2026-04-20',
    status: 'entregue',
    responsavel: 'Bianca Lima',
  },
];

export const mockTrabalhistaCalendario = [
  {
    tipo: 'obrigacao',
    titulo: 'Envio eSocial',
    data: '2026-04-17',
    status: 'pendente',
    empresa: 'Alfa Pecas',
  },
  {
    tipo: 'solicitacao',
    titulo: 'Ajuste de jornada',
    data: '2026-04-19',
    status: 'pendente',
    empresa: 'Alfa Pecas',
  },
  {
    tipo: 'admissao',
    titulo: 'Admissão de Lucas Vieira',
    data: '2026-04-22',
    status: 'pendente',
    empresa: 'Alfa Pecas',
  },
];

export const mockTrabalhistaRelatorio = {
  total_solicitacoes: 19,
  concluidas: 11,
  taxa_conclusao: 58,
};
