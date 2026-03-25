import { SEED_PREFIX } from '../seed-config.js';

export interface InterviewScenario {
  title: string;
  expectedMaturity: number;
  fixtureFile: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'pptx';
  messages: string[];
}

export const INTERVIEW_SCENARIOS: InterviewScenario[] = [
  // #1 — App de Delivery de Comida (maturity ~0.15)
  {
    title: `${SEED_PREFIX} App de Delivery de Comida`,
    expectedMaturity: 0.15,
    fixtureFile: 'pdf',
    messages: [
      'Quero criar um aplicativo de delivery de comida similar ao iFood, com foco em restaurantes locais de uma cidade de 500 mil habitantes.',
      'O público-alvo são pessoas de 18-45 anos que preferem pedir comida pelo celular. Queremos começar com Android e iOS.',
    ],
  },

  // #2 — Sistema ERP Industrial (maturity ~0.45)
  {
    title: `${SEED_PREFIX} Sistema ERP Industrial`,
    expectedMaturity: 0.45,
    fixtureFile: 'docx',
    messages: [
      'Preciso de um ERP para uma fábrica de autopeças com 200 funcionários. Módulos necessários: estoque, produção, financeiro e RH.',
      'O prazo ideal seria 12 meses para o MVP. Temos budget de R$800 mil para a primeira fase do projeto.',
      'Integrações necessárias: SAP para contabilidade, sistema de ponto eletrônico Dimep, e API do banco Itaú para conciliação financeira.',
      'Stack preferida: Java Spring Boot no backend, React no frontend, PostgreSQL como banco de dados principal.',
      'O módulo de produção precisa de rastreabilidade completa de lotes, com código de barras e QR code em cada peça produzida.',
    ],
  },

  // #3 — Plataforma de Telemedicina (maturity ~0.72)
  {
    title: `${SEED_PREFIX} Plataforma de Telemedicina`,
    expectedMaturity: 0.72,
    fixtureFile: 'xlsx',
    messages: [
      'Preciso desenvolver uma plataforma de telemedicina para conectar médicos e pacientes via videochamada, com prontuário digital e prescrição eletrônica.',
      'O escopo inclui: agendamento online, videochamada (WebRTC), prontuário médico digital, prescrição eletrônica com assinatura digital, e histórico do paciente.',
      'O prazo para o MVP é de 6 meses. Queremos lançar com pelo menos 50 médicos cadastrados e suporte para 500 consultas simultâneas.',
      'Budget aprovado: R$1.2 milhões para desenvolvimento + R$200k para infraestrutura no primeiro ano.',
      'Integrações essenciais: HL7 FHIR para interoperabilidade, e-prescribing com CFM, integração com planos de saúde (Unimed, Amil, SulAmérica) e CFM para validação de CRM.',
      'Stack técnica: Node.js + NestJS no backend, React Native para o app móvel, React para web, PostgreSQL para dados estruturados, Redis para sessões de videochamada.',
      'Requisitos de segurança: LGPD obrigatório, criptografia end-to-end nas videochamadas, audit log completo de acessos ao prontuário, 2FA para médicos.',
      'Precisamos de um módulo de analytics para métricas de uso, satisfação dos pacientes e indicadores clínicos para gestores.',
    ],
  },

  // #4 — Marketplace B2B Insumos Agrícolas (maturity ~0.85)
  {
    title: `${SEED_PREFIX} Marketplace B2B Insumos Agrícolas`,
    expectedMaturity: 0.85,
    fixtureFile: 'csv',
    messages: [
      'Quero construir um marketplace B2B para conectar distribuidores de insumos agrícolas (sementes, fertilizantes, defensivos) com produtores rurais em todo o Brasil.',
      'O modelo de negócio é comissão sobre transações (3-5%). Os fornecedores cadastram produtos e os produtores fazem pedidos com entrega na fazenda.',
      'Prazo: 8 meses para MVP funcional. Budget total: R$2.4 milhões (R$1.8M desenvolvimento + R$600k operações e marketing no primeiro ano).',
      'Funcionalidades core: catálogo de produtos com filtros por cultura/região, cotação multi-fornecedor, negociação de preço, gestão de pedidos e rastreamento de entrega.',
      'Integrações críticas: NFe/NFCe (Sefaz), gateway de pagamento (boleto, PIX, crédito rural), transportadoras (Correios, Jadlog, frota própria), e API de previsão do tempo (Climatempo).',
      'Stack: Node.js + NestJS (backend), React + Next.js (frontend web), React Native (app produtores), PostgreSQL + Redis, AWS S3 para documentos fiscais.',
      'Requisitos de escala: suporte a 10.000 produtores e 500 fornecedores no primeiro ano, pico de 50.000 pedidos/dia na safra de soja (jan-mar).',
      'Módulo de analytics avançado: previsão de demanda por região e cultura, alertas de preço, relatórios de performance de fornecedores, dashboard de comissões.',
      'Necessidade de sistema de avaliação e rating de fornecedores, com mediação de disputas e garantia de pagamento (escrow para pedidos > R$50k).',
      'Compliance: cadastro de produtores via CPF/CNPJ + INCRA, validação de nota agronômica para defensivos, relatório de rastreabilidade para certificações orgânicas.',
    ],
  },

  // #5 — Plataforma SaaS Gestão Escolar (maturity ~0.93)
  {
    title: `${SEED_PREFIX} Plataforma SaaS de Gestão Escolar`,
    expectedMaturity: 0.93,
    fixtureFile: 'pptx',
    messages: [
      'Preciso de uma plataforma SaaS completa de gestão escolar para atender escolas privadas de educação básica (Fundamental I, II e Médio) com 200 a 2000 alunos.',
      'Módulos obrigatórios para o MVP: matrículas e rematrículas digitais, diário eletrônico de notas e frequência, boletim online, portal do aluno e portal dos responsáveis.',
      'Módulos na segunda fase: comunicados e agenda online, controle financeiro (mensalidades, bolsas, inadimplência), emissão de boletos e PIX, portal do professor.',
      'Terceira fase: relatórios pedagógicos e BI, integração com MEC (Censo Escolar), e-SIC, biblioteca digital, cardápio da cantina, controle de ônibus escolar.',
      'Prazo: MVP em 9 meses, plataforma completa em 18 meses. Budget: R$3.2 milhões no total (R$2.1M dev, R$600k infra, R$500k go-to-market).',
      'Modelo de precificação: R$8 a R$15 por aluno/mês dependendo do porte. Meta: 200 escolas e 80.000 alunos em 24 meses (MRR alvo: R$800k).',
      'Integrações: gateway de pagamento Asaas (boleto, PIX, cartão), NFSe para notas fiscais, eSocial para funcionários, FGTS Digital, API do MEC para validação de diplomas.',
      'Stack técnica definida: SvelteKit 5 (web app), React Native (app mobile), Node.js + NestJS (API), PostgreSQL 16 (banco principal), Redis (cache e jobs), GCP (infraestrutura), Firebase Auth.',
      'Requisitos regulatórios: LGPD (dados de menores de 18 anos exige atenção especial), LGPD Art. 14 (menores), portaria MEC para diário eletrônico, ABNT NBR 9050 (acessibilidade).',
      'Preciso de um sistema de multi-tenancy completo onde cada escola tem seu subdomínio (escola.outeescola.com.br), dados isolados, e configurações independentes (logo, cores, campos customizados).',
      'Sistema de permissões granulares: Admin da escola, Diretor, Coordenador Pedagógico, Professor, Secretaria, Financeiro, Responsável, Aluno — cada um com visibilidade e ações específicas.',
      'Necessidade de um painel SaaS para nós (o operador da plataforma): onboarding de novas escolas, métricas de uso, suporte, faturamento consolidado, e health check por tenant.',
    ],
  },

  // #6 — Portal de E-commerce de Moda (maturity ~0.88) — para estimate done
  {
    title: `${SEED_PREFIX} Portal de E-commerce de Moda`,
    expectedMaturity: 0.88,
    fixtureFile: 'pdf',
    messages: [
      'Vou construir um e-commerce de moda feminina premium com catálogo de 5.000 SKUs, focado em marcas nacionais independentes.',
      'Escopo: vitrine de produtos com filtros avançados, wishlist, comparador, provador virtual (IA), checkout multi-step, gestão de devoluções.',
      'Prazo: 10 meses para lançamento. Budget: R$1.8 milhões (desenvolvimento + marketing de lançamento).',
      'Integrações: VTEX para catálogo, Bling para ERP/estoque, Melhor Envio para fretes, Adyen para pagamentos internacionais, Meta/Google Ads para marketing.',
      'Stack: Next.js 14 (frontend), Node.js + Fastify (backend), PostgreSQL + Elasticsearch (busca e catálogo), Redis (cart e sessão), AWS (infraestrutura).',
      'Métricas alvo no primeiro ano: 50.000 usuários ativos, R$8M em GMV, ticket médio R$280, taxa de conversão 2.5%, NPS > 70.',
      'Sistema de recomendação personalizada com ML (collaborative filtering + content-based), baseado em histórico de navegação e compras.',
      'Programa de fidelidade: pontos por compra, indicação, review de produto. Integração com cartão co-branded Mastercard planejado para fase 2.',
      'Conformidade: LGPD, certificação PCI DSS nível 1, acessibilidade WCAG 2.1 AA, suporte a i18n (pt-BR, en-US, es-AR para expansão).',
      'Dashboard para lojistas parceiros: painel de vendas, gestão de catálogo, repasse de comissões, performance de anúncios.',
    ],
  },

  // #7 — Sistema de Gestão de Frotas (maturity ~0.78) — para estimate failed
  {
    title: `${SEED_PREFIX} Sistema de Gestão de Frotas`,
    expectedMaturity: 0.78,
    fixtureFile: 'docx',
    messages: [
      'Preciso de um sistema de gestão de frotas para uma empresa de logística com 350 veículos (caminhões, vans e carros executivos) em 5 estados.',
      'Funcionalidades: rastreamento GPS em tempo real, gestão de manutenção preventiva e corretiva, controle de abastecimento, multas e documentos dos veículos.',
      'Prazo: 7 meses. Budget: R$900 mil (R$650k desenvolvimento + R$250k licenças de hardware GPS e primeiro ano de operação).',
      'Integrações críticas: dispositivos GPS Teltonika via MQTT, API Detran para consulta de multas, NFCe para abastecimentos, seguradora para sinistros.',
      'Stack: Node.js (backend), Vue 3 (dashboard web), React Native (app motoristas), PostgreSQL + TimescaleDB (dados de telemetria), Redis, GCP.',
      'Módulo de jornada do motorista: controle de horas de trabalho conforme CTB, alertas de fadiga, geofencing de rotas autorizadas, score de direção (Behavior Score).',
      'Relatórios regulatórios: ANTT para transporte de cargas, relatório de emissões de CO2 para ESG, controle de velocidade por trecho para auditoria.',
      'App do motorista: recebimento de ordens de serviço, check-list de vistoria do veículo, comunicação com central, registro de ocorrências com foto.',
    ],
  },
];

export type InterviewIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
