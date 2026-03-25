export interface CostScenario {
  name: 'conservador' | 'moderado' | 'otimista';
  description: string;
  total_hours: number;
  hourly_rate: number;
  total_cost: number;
  duration_weeks: number;
  team_size: number;
  confidence: number;
  currency: 'BRL';
  risk_buffer_percent: number;
}

export interface MilestoneResult {
  name: string;
  description: string;
  duration_weeks: number;
  deliverables: string[];
  dependencies: string[];
}

export interface TechRecommendation {
  category: string;
  technology: string;
  justification: string;
}

export interface Risk {
  description: string;
  impact: string;
  mitigation: string;
  probability: 'Baixa' | 'Média' | 'Alta';
}

export interface EstimateResult {
  summary: string;
  architecture_overview: string;
  milestones: MilestoneResult[];
  cost_scenarios: CostScenario[];
  tech_recommendations: TechRecommendation[];
  risks: Risk[];
  similar_projects: Array<{ name: string; similarity: number; duration_weeks: number; cost: number }>;
  executive_summary: string;
}

export interface AgentStep {
  agent_key: string;
  status: 'done' | 'running' | 'pending' | 'failed';
  duration_s: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error_message?: string | null;
}

// --- Estimate #1 (Telemedicina, pending_approval) ---
export const ESTIMATE_RESULT_TELEMEDICINA: EstimateResult = {
  summary: `A Plataforma de Telemedicina apresenta alto potencial de viabilidade técnica e comercial no cenário atual de digitalização da saúde no Brasil. A análise aprofundada dos requisitos identifica um projeto de complexidade média-alta, com desafios específicos em conformidade regulatória (CFM, HL7 FHIR, LGPD), integração com planos de saúde e garantia de qualidade nas videochamadas em redes móveis de baixa qualidade.

O principal diferencial competitivo identificado está na integração nativa com sistemas de prescrição eletrônica validada pelo CFM, ausente nas principais soluções do mercado. O módulo de analytics clínico representa uma oportunidade de upsell para gestores de saúde.

Recomendamos a arquitetura baseada em microserviços para isolamento de domínios (videochamada, prontuário, prescrição, financeiro) com um gateway centralizado. A escolha de WebRTC com servidor TURN próprio garante qualidade mesmo em redes corporativas com NAT. A estimativa conservadora prevê 24 semanas (6 meses) para MVP com equipe de 6 pessoas.`,
  architecture_overview: `Arquitetura baseada em microserviços com API Gateway (NestJS) centralizando a autenticação e roteamento. Serviços independentes para: Videochamada (WebRTC + coturn TURN server), Prontuário Eletrônico (HL7 FHIR R4), Prescrição Digital (assinatura ICP-Brasil), Agendamento (slots + calendário médico) e Notificações (email/SMS/push). Banco de dados por serviço (PostgreSQL), cache distribuído com Redis Cluster, mensageria assíncrona com RabbitMQ. Frontend React (web) e React Native (mobile) consumindo a mesma API. Deploy em GCP com Cloud Run, CDN para assets estáticos.`,
  milestones: [
    {
      name: 'Fase 1 — Infraestrutura e Auth',
      description: 'Configuração do ambiente cloud, CI/CD, autenticação de médicos e pacientes, cadastro e validação de CRM',
      duration_weeks: 4,
      deliverables: ['Ambiente GCP configurado', 'Pipeline CI/CD', 'Auth com 2FA', 'Validação CRM online'],
      dependencies: [],
    },
    {
      name: 'Fase 2 — Agendamento e Videochamada',
      description: 'Calendário de disponibilidade dos médicos, agendamento por pacientes, sala de videochamada WebRTC com TURN server',
      duration_weeks: 5,
      deliverables: ['API de agendamento', 'App web de videochamada', 'TURN server na GCP', 'Gravação opcional'],
      dependencies: ['Fase 1'],
    },
    {
      name: 'Fase 3 — Prontuário e Prescrição',
      description: 'Prontuário eletrônico HL7 FHIR, histórico do paciente, prescrição eletrônica com assinatura digital ICP-Brasil',
      duration_weeks: 6,
      deliverables: ['API FHIR R4', 'Editor de prontuário', 'PDF de prescrição assinado', 'Integração e-prescribing CFM'],
      dependencies: ['Fase 1'],
    },
    {
      name: 'Fase 4 — Pagamentos e Planos de Saúde',
      description: 'Gateway de pagamento, faturamento para planos de saúde (TISS), repasse para médicos',
      duration_weeks: 4,
      deliverables: ['Checkout com cartão/PIX', 'TISS 3.0 (Unimed/Amil)', 'Relatório financeiro'],
      dependencies: ['Fase 2', 'Fase 3'],
    },
    {
      name: 'Fase 5 — QA, LGPD e Launch',
      description: 'Testes de carga, auditoria LGPD, documentação, treinamento e go-live com primeiros 50 médicos',
      duration_weeks: 3,
      deliverables: ['Relatório de pentest', 'DPA e política de privacidade', 'Onboarding de médicos', 'Go-live'],
      dependencies: ['Fase 2', 'Fase 3', 'Fase 4'],
    },
  ],
  cost_scenarios: [
    {
      name: 'conservador',
      description: 'Equipe sênior com alta cobertura de testes, escopo máximo do MVP, buffer de risco elevado para integrações regulatórias',
      total_hours: 2880,
      hourly_rate: 185,
      total_cost: 532800,
      duration_weeks: 24,
      team_size: 6,
      confidence: 0.92,
      currency: 'BRL',
      risk_buffer_percent: 25,
    },
    {
      name: 'moderado',
      description: 'Mix de sênior e pleno, buffer padrão, escopo MVP sem analytics',
      total_hours: 2400,
      hourly_rate: 160,
      total_cost: 384000,
      duration_weeks: 22,
      team_size: 5,
      confidence: 0.78,
      currency: 'BRL',
      risk_buffer_percent: 15,
    },
    {
      name: 'otimista',
      description: 'Equipe experiente em healthtech, reuso de componentes open-source, escopo enxuto',
      total_hours: 1920,
      hourly_rate: 145,
      total_cost: 278400,
      duration_weeks: 20,
      team_size: 4,
      confidence: 0.58,
      currency: 'BRL',
      risk_buffer_percent: 8,
    },
  ],
  tech_recommendations: [
    { category: 'Backend', technology: 'Node.js 22 + NestJS 10', justification: 'Ecossistema maduro para APIs REST/GraphQL, suporte nativo a streams (SSE para notificações em tempo real), decorators para RBAC' },
    { category: 'Videochamada', technology: 'WebRTC + coturn', justification: 'Padrão open para P2P, coturn como TURN server garante conectividade em redes corporativas com NAT agressivo' },
    { category: 'Frontend Web', technology: 'React 18 + Vite', justification: 'Ecossistema rico para UI médica, bibliotecas como react-hook-form para formulários complexos de prontuário' },
    { category: 'Mobile', technology: 'React Native + Expo', justification: 'Código compartilhado iOS/Android, Expo Managed Workflow reduz overhead de build, biblioteca expo-av para mídia' },
    { category: 'Banco de Dados', technology: 'PostgreSQL 16', justification: 'ACID para dados clínicos críticos, JSONB para dados FHIR flexíveis, pgaudit para trilha de auditoria LGPD' },
    { category: 'Interoperabilidade', technology: 'HAPI FHIR Server', justification: 'Implementação de referência HL7 FHIR R4, suporta SMART on FHIR para autorização granular' },
    { category: 'Assinatura Digital', technology: 'ICP-Brasil via API', justification: 'Obrigatório para validade jurídica de prescrições, integração com certificadoras credenciadas (Certisign, Valid)' },
  ],
  risks: [
    { description: 'Latência em videochamadas via redes móveis 4G em regiões com cobertura ruim', impact: 'Abandono de consulta por qualidade de vídeo, reclamações e reembolsos', mitigation: 'Implementar adaptive bitrate, fallback para áudio apenas, indicador de qualidade na UI', probability: 'Média' },
    { description: 'Mudança de norma CFM para prescrição eletrônica durante o desenvolvimento', impact: 'Retrabalho de até 3 semanas no módulo de prescrição', mitigation: 'Manter contato com CFM via consulta pública, arquitetura plugável para troca de provedor de assinatura', probability: 'Baixa' },
    { description: 'Complexidade de integração TISS 3.0 com cada operadora de saúde', impact: 'Atraso de 4-6 semanas por operadora não-homologada', mitigation: 'Iniciar com Unimed (maior base), usar middleware TISS open-source (OpenTISS)', probability: 'Alta' },
    { description: 'Requisitos LGPD para dados de saúde (dados sensíveis Art. 11)', impact: 'Necessidade de DPO e relatório de impacto, potencial retrabalho de arquitetura', mitigation: 'Contratar DPO desde o início, Privacy by Design no modelo de dados, criptografia de dados em repouso', probability: 'Média' },
  ],
  similar_projects: [
    { name: 'Plataforma de Teleconsulta Veterinária', similarity: 0.71, duration_weeks: 20, cost: 320000 },
    { name: 'Portal de Agendamento Médico com Videochamada', similarity: 0.68, duration_weeks: 18, cost: 275000 },
  ],
  executive_summary: `A Plataforma de Telemedicina é tecnicamente viável com um investimento entre R$278k e R$533k em 20-24 semanas. O mercado endereçável cresceu 500% pós-pandemia e ainda apresenta baixa digitalização, especialmente no segmento de especialistas.

Os maiores riscos estão na complexidade regulatória (CFM, HL7 FHIR, LGPD para dados sensíveis) e na variabilidade das integrações com planos de saúde. Recomendamos iniciar pelo cenário moderado (R$384k) com uma equipe de 5 pessoas, priorizando o MVP de videochamada + prontuário sem integrações com planos de saúde. Essas integrações devem ser abordadas na fase 2, após validação do produto com os primeiros médicos.

O payback estimado é de 18 meses considerando 500 consultas/dia a R$15 de comissão média. A barreira de entrada para competidores é moderada — o diferencial sustentável está na qualidade da integração com o sistema de saúde brasileiro (CFM, TISS, ANS).`,
};

// --- Estimate #2 (Marketplace B2B, pending) ---
export const ESTIMATE_RESULT_MARKETPLACE: EstimateResult = {
  summary: `O Marketplace B2B de Insumos Agrícolas representa uma oportunidade de alto impacto no agronegócio brasileiro — o maior do mundo em produtividade por hectare. O projeto tem complexidade alta, especialmente na gestão de compliance fiscal (NFe para insumos agroquímicos tem exigências específicas da MAPA), rastreabilidade e picos sazonais extremos (10x o volume médio durante safra de soja).

A abordagem de marketplace com escrow para grandes pedidos é diferenciada e reduz o risco de inadimplência, que é um problema endêmico no agronegócio (30-40 dias de prazo médio). O módulo de cotação multi-fornecedor é o principal driver de adoção — produtores economizam em média 12% negociando com múltiplos distribuidores.`,
  architecture_overview: `Arquitetura event-driven com CQRS para separação de leitura e escrita. Core do marketplace em Node.js/NestJS com serviços para: Catálogo (Elasticsearch + PostgreSQL), Pedidos (saga pattern para transações distribuídas), Pagamentos/Escrow (integração com conta digital), Logística (cotação e rastreamento), Compliance (NFe/nota agronômica), Analytics (ClickHouse para dados de série temporal). Frontend Next.js 14 (web) + React Native (app produtores). Infraestrutura AWS com Auto Scaling para picos de safra.`,
  milestones: [
    {
      name: 'Fase 1 — Catálogo e Fornecedores',
      description: 'Cadastro de fornecedores com validação, catálogo de produtos com taxonomia agrícola, busca por cultura/região',
      duration_weeks: 5,
      deliverables: ['Portal do fornecedor', 'Catálogo com busca Elasticsearch', 'Onboarding de 10 fornecedores piloto'],
      dependencies: [],
    },
    {
      name: 'Fase 2 — Pedidos e Cotação',
      description: 'Fluxo de cotação multi-fornecedor, negociação de preço, aprovação de pedido com validação de crédito rural',
      duration_weeks: 6,
      deliverables: ['Motor de cotação', 'Fluxo de pedido completo', 'Integração crédito rural Banco do Brasil'],
      dependencies: ['Fase 1'],
    },
    {
      name: 'Fase 3 — Pagamentos e Fiscal',
      description: 'Gateway com escrow, boleto e PIX, emissão automática de NFe com notas agronômicas, integração Sefaz',
      duration_weeks: 5,
      deliverables: ['Escrow com Celcoin', 'Emissão NFe automática', 'Nota agronômica MAPA'],
      dependencies: ['Fase 2'],
    },
    {
      name: 'Fase 4 — Logística e Rastreamento',
      description: 'Cotação de frete multi-transportadora, acompanhamento de entrega, prova de entrega digital',
      duration_weeks: 4,
      deliverables: ['API Melhor Envio integrada', 'App motorista para POD', 'Rastreamento em tempo real'],
      dependencies: ['Fase 2'],
    },
    {
      name: 'Fase 5 — Analytics e Launch',
      description: 'Dashboard de vendas e comissões, relatório de demanda por região, go-live com 50 produtores beta',
      duration_weeks: 4,
      deliverables: ['Dashboard BI (ClickHouse)', 'Relatório de previsão de demanda', 'Beta com 50 produtores'],
      dependencies: ['Fase 3', 'Fase 4'],
    },
  ],
  cost_scenarios: [
    {
      name: 'conservador',
      description: 'Equipe especializada em fintech/agro, compliance fiscal completo desde o início, infraestrutura para pico de safra',
      total_hours: 3840,
      hourly_rate: 195,
      total_cost: 748800,
      duration_weeks: 32,
      team_size: 8,
      confidence: 0.90,
      currency: 'BRL',
      risk_buffer_percent: 20,
    },
    {
      name: 'moderado',
      description: 'Escopo de compliance simplificado no MVP, escalabilidade de safra em fase 2',
      total_hours: 3200,
      hourly_rate: 170,
      total_cost: 544000,
      duration_weeks: 28,
      team_size: 7,
      confidence: 0.75,
      currency: 'BRL',
      risk_buffer_percent: 12,
    },
    {
      name: 'otimista',
      description: 'Reuso de marketplace white-label + customização, escopo mínimo',
      total_hours: 2400,
      hourly_rate: 150,
      total_cost: 360000,
      duration_weeks: 24,
      team_size: 5,
      confidence: 0.55,
      currency: 'BRL',
      risk_buffer_percent: 8,
    },
  ],
  tech_recommendations: [
    { category: 'Backend', technology: 'Node.js + NestJS + CQRS', justification: 'CQRS essencial para separar leitura de catálogo (alta frequência) de operações de pedido (consistência crítica)' },
    { category: 'Busca', technology: 'Elasticsearch 8', justification: 'Busca full-text em 5.000 produtos com filtros por cultura, região, fornecedor e disponibilidade em < 50ms' },
    { category: 'Analytics', technology: 'ClickHouse', justification: 'Agregações sobre bilhões de eventos de preço e demanda sazonal em segundos, custo 10x menor que BigQuery para este volume' },
    { category: 'Pagamentos', technology: 'Celcoin (escrow)', justification: 'Único provedor brasileiro com conta de escrow regulamentado pelo Banco Central para marketplaces (Res. BCB 96/2021)' },
    { category: 'Fiscal', technology: 'Focus NFe API', justification: 'Abstrai 27 SEFAZ estaduais, suporte a CT-e para transporte, nota agronômica via módulo adicional' },
  ],
  risks: [
    { description: 'Pico de 50.000 pedidos/dia durante safra (10x volume normal)', impact: 'Timeout e falha em pagamentos, perda de R$2M+ em GMV potencial', mitigation: 'Load testing com k6 antes de cada safra, Auto Scaling configurado, circuit breakers em integrações externas', probability: 'Alta' },
    { description: 'Aprovação de nota agronômica para defensivos com exigências do MAPA', impact: 'Bloqueio de 40% do catálogo (defensivos são o produto de maior margem)', mitigation: 'Parceria com despachante regulatório, integrar API do MAPA para validação em tempo real de ART do agrônomo', probability: 'Média' },
    { description: 'Fraude em pedidos com crédito rural (custeio agrícola)', impact: 'Chargeback de até R$500k por evento de fraude em pedidos de alto valor', mitigation: 'Score de crédito via Serasa, validação biométrica via Gov.br para pedidos > R$100k', probability: 'Baixa' },
  ],
  similar_projects: [
    { name: 'Marketplace de Equipamentos Agrícolas', similarity: 0.74, duration_weeks: 28, cost: 520000 },
    { name: 'Plataforma B2B de Distribuição de Alimentos', similarity: 0.69, duration_weeks: 24, cost: 440000 },
  ],
  executive_summary: `O Marketplace B2B Agrícola é viável tecnicamente com investimento entre R$360k e R$749k em 24-32 semanas. O TAM do mercado de insumos agrícolas no Brasil é de R$180 bilhões anuais — capturar 0.1% como comissão representa R$180M em receita potencial.

O risco operacional mais relevante é o pico de safra: a arquitetura deve ser dimensionada para 10x o volume médio desde o início, mesmo que o custo de infraestrutura em produção seja maior. A conformidade fiscal (NFe + nota agronômica) é o segundo maior risco e deve ser priorizada com parceiro especializado.

Recomendamos o cenário moderado (R$544k, 28 semanas) iniciando com 3 culturas prioritárias (soja, milho, algodão) e 50 produtores beta na região Centro-Oeste. O modelo de escrow diferencia o produto e justifica comissões acima dos concorrentes.`,
};

// Agent steps — estimate completo (done/approved)
export const AGENT_STEPS_COMPLETE: AgentStep[] = [
  { agent_key: 'architecture_interviewer', status: 'done', duration_s: 18.5, input_tokens: 3200, output_tokens: 1800, error_message: null },
  { agent_key: 'rag_analyst',             status: 'done', duration_s: 25.3, input_tokens: 4100, output_tokens: 2200, error_message: null },
  { agent_key: 'software_architect',      status: 'done', duration_s: 32.1, input_tokens: 5500, output_tokens: 3400, error_message: null },
  { agent_key: 'cost_specialist',         status: 'done', duration_s: 22.7, input_tokens: 4800, output_tokens: 2900, error_message: null },
  { agent_key: 'reviewer',               status: 'done', duration_s: 19.4, input_tokens: 6200, output_tokens: 1500, error_message: null },
  { agent_key: 'knowledge_manager',       status: 'done', duration_s: 12.0, input_tokens: 2100, output_tokens: 800,  error_message: null },
];

// Agent steps — estimate em execução (running, step 4 ativo)
export const AGENT_STEPS_RUNNING: AgentStep[] = [
  { agent_key: 'architecture_interviewer', status: 'done',    duration_s: 21.3, input_tokens: 3400, output_tokens: 1950, error_message: null },
  { agent_key: 'rag_analyst',             status: 'done',    duration_s: 28.7, input_tokens: 4300, output_tokens: 2100, error_message: null },
  { agent_key: 'software_architect',      status: 'done',    duration_s: 35.2, input_tokens: 5200, output_tokens: 3100, error_message: null },
  { agent_key: 'cost_specialist',         status: 'running', duration_s: null,  input_tokens: null,  output_tokens: null, error_message: null },
  { agent_key: 'reviewer',               status: 'pending', duration_s: null,  input_tokens: null,  output_tokens: null, error_message: null },
  { agent_key: 'knowledge_manager',       status: 'pending', duration_s: null,  input_tokens: null,  output_tokens: null, error_message: null },
];

// Agent steps — estimate com falha (failed no step reviewer)
export const AGENT_STEPS_FAILED: AgentStep[] = [
  { agent_key: 'architecture_interviewer', status: 'done',   duration_s: 19.8, input_tokens: 2900, output_tokens: 1700, error_message: null },
  { agent_key: 'rag_analyst',             status: 'done',   duration_s: 24.5, input_tokens: 3800, output_tokens: 1900, error_message: null },
  { agent_key: 'software_architect',      status: 'done',   duration_s: 30.4, input_tokens: 5100, output_tokens: 3200, error_message: null },
  { agent_key: 'cost_specialist',         status: 'done',   duration_s: 21.2, input_tokens: 4500, output_tokens: 2800, error_message: null },
  { agent_key: 'reviewer',               status: 'failed', duration_s: 8.3,  input_tokens: 5800, output_tokens: 120, error_message: 'LLM returned invalid JSON after 3 retries: unexpected token at position 847. Agent: reviewer, model: vertex_ai/gemini-2.5-flash-lite' },
  { agent_key: 'knowledge_manager',       status: 'pending', duration_s: null, input_tokens: null, output_tokens: null, error_message: null },
];
