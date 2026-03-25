import { SEED_PREFIX } from '../seed-config.js';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type MilestoneStatus = 'pending' | 'in_progress' | 'done';
export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface TaskDefinition {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimated_hours: number;
  description?: string;
}

export interface MilestoneDefinition {
  name: string;
  description: string;
  status: MilestoneStatus;
  due_weeks_from_now: number;
  tasks: TaskDefinition[];
}

export interface ProjectDefinition {
  name: string;
  description: string;
  status: ProjectStatus;
  selected_scenario: 'conservador' | 'moderado' | 'otimista';
  milestones: MilestoneDefinition[];
}

export const PROJECT_DEFINITIONS: ProjectDefinition[] = [
  // Projeto #1 — Recém-criado, todos os milestones pendentes
  {
    name: `${SEED_PREFIX} Plataforma de Telemedicina — MVP`,
    description: 'Desenvolvimento do MVP da plataforma de telemedicina com videochamada, prontuário eletrônico e prescrição digital. Prazo: 22 semanas.',
    status: 'active',
    selected_scenario: 'moderado',
    milestones: [
      {
        name: 'Fase 1 — Infraestrutura e Auth',
        description: 'Setup do ambiente GCP, pipeline CI/CD, autenticação médicos/pacientes com 2FA e validação de CRM online',
        status: 'pending',
        due_weeks_from_now: 4,
        tasks: [
          { title: 'Configurar projeto GCP e IAM', status: 'todo', priority: 'high', estimated_hours: 8 },
          { title: 'Setup Cloud Run + Cloud SQL', status: 'todo', priority: 'high', estimated_hours: 12 },
          { title: 'Pipeline CI/CD (GitHub Actions)', status: 'todo', priority: 'high', estimated_hours: 16 },
          { title: 'Implementar Firebase Auth com 2FA', status: 'todo', priority: 'high', estimated_hours: 24 },
          { title: 'API de validação de CRM (CFM)', status: 'todo', priority: 'medium', estimated_hours: 16 },
        ],
      },
      {
        name: 'Fase 2 — Agendamento e Videochamada',
        description: 'Calendário de disponibilidade, agendamento por pacientes, sala de videochamada WebRTC com TURN server',
        status: 'pending',
        due_weeks_from_now: 9,
        tasks: [
          { title: 'API de disponibilidade de médicos', status: 'todo', priority: 'high', estimated_hours: 20 },
          { title: 'UI de agendamento (web + mobile)', status: 'todo', priority: 'high', estimated_hours: 32 },
          { title: 'Servidor TURN/STUN (coturn)', status: 'todo', priority: 'high', estimated_hours: 12 },
          { title: 'Sala de videochamada WebRTC', status: 'todo', priority: 'high', estimated_hours: 40 },
          { title: 'Gravação de consulta (opt-in)', status: 'todo', priority: 'low', estimated_hours: 24 },
        ],
      },
      {
        name: 'Fase 3 — Prontuário e Prescrição',
        description: 'Prontuário eletrônico HL7 FHIR, histórico do paciente, prescrição eletrônica com assinatura digital ICP-Brasil',
        status: 'pending',
        due_weeks_from_now: 15,
        tasks: [
          { title: 'Modelagem HL7 FHIR R4', status: 'todo', priority: 'high', estimated_hours: 16 },
          { title: 'Editor de prontuário médico', status: 'todo', priority: 'high', estimated_hours: 40 },
          { title: 'Integração assinatura ICP-Brasil', status: 'todo', priority: 'high', estimated_hours: 32 },
          { title: 'PDF de prescrição assinado', status: 'todo', priority: 'medium', estimated_hours: 20 },
        ],
      },
    ],
  },

  // Projeto #2 — Em andamento (milestone 1 done, milestone 2 in_progress)
  {
    name: `${SEED_PREFIX} ERP Industrial — MVP`,
    description: 'ERP para fábrica de autopeças com módulos de estoque, produção, financeiro e RH. Integração com SAP, Dimep e Itaú.',
    status: 'active',
    selected_scenario: 'moderado',
    milestones: [
      {
        name: 'Fundação',
        description: 'Setup do projeto, infra, CI/CD e autenticação',
        status: 'done',
        due_weeks_from_now: -8,
        tasks: [
          { title: 'Setup monorepo Java + React', status: 'done', priority: 'high', estimated_hours: 8 },
          { title: 'Configurar CI/CD com GitHub Actions', status: 'done', priority: 'high', estimated_hours: 16 },
          { title: 'Implementar autenticação SSO', status: 'done', priority: 'high', estimated_hours: 24 },
          { title: 'Setup banco PostgreSQL + Redis', status: 'done', priority: 'high', estimated_hours: 8 },
          { title: 'Modelagem do schema inicial', status: 'done', priority: 'high', estimated_hours: 12 },
        ],
      },
      {
        name: 'Módulo de Estoque',
        description: 'CRUD de produtos, controle de lotes com código de barras, relatórios de movimentação',
        status: 'in_progress',
        due_weeks_from_now: 4,
        tasks: [
          { title: 'CRUD de produtos e categorias', status: 'done', priority: 'high', estimated_hours: 16 },
          { title: 'Controle de lotes com QR code', status: 'in_progress', priority: 'high', estimated_hours: 32, description: 'Geração de QR code por lote, integração com leitor Zebra via API REST' },
          { title: 'Movimentações de estoque (entrada/saída)', status: 'todo', priority: 'high', estimated_hours: 24 },
          { title: 'Relatórios de movimentação', status: 'todo', priority: 'medium', estimated_hours: 20 },
          { title: 'Alerta de estoque mínimo', status: 'todo', priority: 'medium', estimated_hours: 8 },
        ],
      },
      {
        name: 'Módulo Financeiro',
        description: 'Contas a pagar/receber, conciliação bancária Itaú, integração contábil SAP',
        status: 'pending',
        due_weeks_from_now: 10,
        tasks: [
          { title: 'Contas a pagar e receber', status: 'todo', priority: 'high', estimated_hours: 40 },
          { title: 'Conciliação bancária Itaú API', status: 'todo', priority: 'high', estimated_hours: 32, description: 'Integração OAuth2 com API Open Finance do Itaú' },
          { title: 'Integração contábil SAP via BAPI', status: 'todo', priority: 'high', estimated_hours: 48 },
          { title: 'Relatórios financeiros (DRE, fluxo de caixa)', status: 'todo', priority: 'medium', estimated_hours: 24 },
        ],
      },
    ],
  },

  // Projeto #3 — Quase pronto (milestones 1 e 2 done, milestone 3 in_progress)
  {
    name: `${SEED_PREFIX} Portal E-commerce de Moda — MVP`,
    description: 'E-commerce de moda feminina premium com 5.000 SKUs, recomendação por IA e marketplace para marcas independentes.',
    status: 'active',
    selected_scenario: 'moderado',
    milestones: [
      {
        name: 'Catálogo e Vitrine',
        description: 'Importação de produtos, busca Elasticsearch, páginas de listagem e detalhe',
        status: 'done',
        due_weeks_from_now: -12,
        tasks: [
          { title: 'Importador de catálogo VTEX', status: 'done', priority: 'high', estimated_hours: 24 },
          { title: 'Indexação Elasticsearch', status: 'done', priority: 'high', estimated_hours: 16 },
          { title: 'UI de listagem com filtros', status: 'done', priority: 'high', estimated_hours: 32 },
          { title: 'Página de detalhe do produto', status: 'done', priority: 'high', estimated_hours: 24 },
          { title: 'Wishlist e compartilhamento', status: 'done', priority: 'medium', estimated_hours: 16 },
        ],
      },
      {
        name: 'Checkout e Pagamentos',
        description: 'Carrinho, checkout multi-step, integração Adyen, confirmação de pedido',
        status: 'done',
        due_weeks_from_now: -6,
        tasks: [
          { title: 'Carrinho com persistência Redis', status: 'done', priority: 'high', estimated_hours: 20 },
          { title: 'Checkout multi-step (dados + endereço + pagamento)', status: 'done', priority: 'high', estimated_hours: 40 },
          { title: 'Integração Adyen (cartão + PIX)', status: 'done', priority: 'high', estimated_hours: 32 },
          { title: 'Cálculo de frete Melhor Envio', status: 'done', priority: 'high', estimated_hours: 16 },
          { title: 'Emails transacionais (confirmação, envio)', status: 'done', priority: 'medium', estimated_hours: 20 },
        ],
      },
      {
        name: 'Recomendação e Analytics',
        description: 'Sistema de recomendação por IA, dashboard para lojistas, relatórios de vendas',
        status: 'in_progress',
        due_weeks_from_now: 3,
        tasks: [
          { title: 'Pipeline de eventos de navegação (Kafka)', status: 'done', priority: 'high', estimated_hours: 24 },
          { title: 'Modelo de recomendação collaborative filtering', status: 'in_progress', priority: 'high', estimated_hours: 48, description: 'Modelo Python com scikit-surprise, treino semanal com dados reais' },
          { title: 'API de recomendações (similar + você pode gostar)', status: 'in_progress', priority: 'high', estimated_hours: 16 },
          { title: 'Dashboard do lojista parceiro', status: 'todo', priority: 'medium', estimated_hours: 32 },
          { title: 'Relatório de performance de produtos', status: 'todo', priority: 'medium', estimated_hours: 20 },
        ],
      },
    ],
  },

  // Projeto #4 — Finalizado, todos done
  {
    name: `${SEED_PREFIX} Sistema de Gestão de Frotas — Fase 1`,
    description: 'Fase 1 do sistema de gestão de frotas: rastreamento GPS, manutenção preventiva e controle de abastecimento para 350 veículos.',
    status: 'completed',
    selected_scenario: 'moderado',
    milestones: [
      {
        name: 'Rastreamento GPS',
        description: 'Integração Teltonika MQTT, mapa em tempo real, histórico de rotas',
        status: 'done',
        due_weeks_from_now: -16,
        tasks: [
          { title: 'Broker MQTT (Mosquitto + HiveMQ)', status: 'done', priority: 'high', estimated_hours: 20 },
          { title: 'Processador de telemetria (TimescaleDB)', status: 'done', priority: 'high', estimated_hours: 32 },
          { title: 'Mapa em tempo real (Mapbox GL)', status: 'done', priority: 'high', estimated_hours: 40 },
          { title: 'Histórico de rotas e relatório de km', status: 'done', priority: 'medium', estimated_hours: 24 },
          { title: 'Geofencing e alertas de rota', status: 'done', priority: 'medium', estimated_hours: 20 },
        ],
      },
      {
        name: 'Manutenção Preventiva',
        description: 'Plano de manutenção por km/tempo, ordens de serviço, histórico de manutenções',
        status: 'done',
        due_weeks_from_now: -10,
        tasks: [
          { title: 'Cadastro de planos de manutenção', status: 'done', priority: 'high', estimated_hours: 16 },
          { title: 'Engine de alertas por km/tempo', status: 'done', priority: 'high', estimated_hours: 24 },
          { title: 'Fluxo de ordem de serviço', status: 'done', priority: 'high', estimated_hours: 32 },
          { title: 'Portal de oficinas credenciadas', status: 'done', priority: 'medium', estimated_hours: 24 },
        ],
      },
      {
        name: 'Abastecimento e Custos',
        description: 'Controle de abastecimentos por motorista, integração NFCe do posto, relatório de custo por veículo',
        status: 'done',
        due_weeks_from_now: -4,
        tasks: [
          { title: 'App do motorista (abastecimento)', status: 'done', priority: 'high', estimated_hours: 32 },
          { title: 'Leitura de NFCe do posto (QR code)', status: 'done', priority: 'high', estimated_hours: 24 },
          { title: 'Relatório de custo por veículo/motorista', status: 'done', priority: 'medium', estimated_hours: 20 },
          { title: 'Alerta de consumo anormal', status: 'done', priority: 'medium', estimated_hours: 12 },
        ],
      },
    ],
  },

  // Projeto #5 — Grande, 4 milestones, 2 pendentes
  {
    name: `${SEED_PREFIX} SaaS Gestão Escolar — Plataforma Completa`,
    description: 'Plataforma SaaS multi-tenant de gestão escolar. MVP em 9 meses, versão completa em 18 meses. Meta: 200 escolas, 80k alunos.',
    status: 'active',
    selected_scenario: 'conservador',
    milestones: [
      {
        name: 'Infraestrutura Multi-tenant',
        description: 'Setup multi-tenant com subdomínios, isolamento de dados, onboarding de escolas',
        status: 'done',
        due_weeks_from_now: -14,
        tasks: [
          { title: 'Schema multi-tenant (row-level security)', status: 'done', priority: 'critical', estimated_hours: 32 },
          { title: 'DNS dinâmico para subdomínios', status: 'done', priority: 'high', estimated_hours: 16 },
          { title: 'Onboarding wizard para novas escolas', status: 'done', priority: 'high', estimated_hours: 40 },
          { title: 'Sistema de permissões (8 papéis)', status: 'done', priority: 'critical', estimated_hours: 48 },
          { title: 'Painel SaaS do operador', status: 'done', priority: 'high', estimated_hours: 32 },
        ],
      },
      {
        name: 'Módulo Acadêmico',
        description: 'Matrículas, diário eletrônico, notas, frequência, boletim online',
        status: 'in_progress',
        due_weeks_from_now: 2,
        tasks: [
          { title: 'Fluxo de matrícula e rematrícula digital', status: 'done', priority: 'high', estimated_hours: 48 },
          { title: 'Diário eletrônico (notas por bimestre)', status: 'done', priority: 'high', estimated_hours: 40 },
          { title: 'Registro de frequência diária', status: 'in_progress', priority: 'high', estimated_hours: 32, description: 'Integração com leitor de biometria via WebSocket' },
          { title: 'Boletim online com histórico', status: 'in_progress', priority: 'high', estimated_hours: 24 },
          { title: 'Portal do aluno (acesso a notas e frequência)', status: 'todo', priority: 'medium', estimated_hours: 32 },
          { title: 'Portal dos responsáveis', status: 'todo', priority: 'medium', estimated_hours: 28 },
        ],
      },
      {
        name: 'Módulo Financeiro',
        description: 'Mensalidades, boletos, PIX, inadimplência, régua de cobrança automática',
        status: 'pending',
        due_weeks_from_now: 8,
        tasks: [
          { title: 'Integração Asaas (boleto, PIX, cartão)', status: 'todo', priority: 'critical', estimated_hours: 48, description: 'Asaas é o gateway obrigatório por integrar NFSe e conta digital' },
          { title: 'Emissão automática de boletos mensais', status: 'todo', priority: 'high', estimated_hours: 24 },
          { title: 'Régua de cobrança (SMS + email + WhatsApp)', status: 'todo', priority: 'high', estimated_hours: 32 },
          { title: 'Controle de bolsas e descontos', status: 'todo', priority: 'medium', estimated_hours: 20 },
          { title: 'Dashboard de inadimplência', status: 'todo', priority: 'medium', estimated_hours: 24 },
          { title: 'NFSe para mensalidades', status: 'todo', priority: 'high', estimated_hours: 20 },
        ],
      },
      {
        name: 'Integrações Regulatórias e Lançamento',
        description: 'Censo Escolar MEC, eSocial, conformidade LGPD Art.14 (menores), go-live com 20 escolas piloto',
        status: 'pending',
        due_weeks_from_now: 16,
        tasks: [
          { title: 'Exportação Censo Escolar (INEP/MEC)', status: 'todo', priority: 'critical', estimated_hours: 40 },
          { title: 'eSocial para funcionários da escola', status: 'todo', priority: 'high', estimated_hours: 32 },
          { title: 'Auditoria LGPD Art.14 (dados de menores)', status: 'todo', priority: 'critical', estimated_hours: 24, description: 'Requer consentimento explícito dos responsáveis legais' },
          { title: 'Acessibilidade WCAG 2.1 AA', status: 'todo', priority: 'high', estimated_hours: 32 },
          { title: 'Treinamento e onboarding das 20 escolas piloto', status: 'todo', priority: 'high', estimated_hours: 40 },
          { title: 'Go-live e monitoramento D+7', status: 'todo', priority: 'high', estimated_hours: 16 },
        ],
      },
    ],
  },
];
