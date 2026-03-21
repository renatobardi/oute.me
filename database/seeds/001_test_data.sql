-- =============================================================================
-- 001_test_data.sql
-- Massa de testes para renatobardicabral@gmail.com
-- Cobre todos os estados do fluxo: Interview → Estimate → Project
--
-- COMO RODAR:
--   psql $DATABASE_URL -f database/seeds/001_test_data.sql
--
-- CUIDADO: apaga e recria registros seed (idempotente via DO + IDs fixos).
-- =============================================================================

DO $$
DECLARE
  v_user_id     uuid;
  v_iw1         uuid := 'aaaaaaaa-0001-0000-0000-000000000001'; -- in_progress
  v_iw2         uuid := 'aaaaaaaa-0001-0000-0000-000000000002'; -- ready (maturity ≥0.7)
  v_iw3         uuid := 'aaaaaaaa-0001-0000-0000-000000000003'; -- archived
  v_iw4         uuid := 'aaaaaaaa-0001-0000-0000-000000000004'; -- com estimativa pending
  v_iw5         uuid := 'aaaaaaaa-0001-0000-0000-000000000005'; -- com estimativa done
  v_iw6         uuid := 'aaaaaaaa-0001-0000-0000-000000000006'; -- com estimativa failed
  v_iw7         uuid := 'aaaaaaaa-0001-0000-0000-000000000007'; -- com estimativa approved → projeto
  v_est4        uuid := 'bbbbbbbb-0001-0000-0000-000000000004';
  v_est5        uuid := 'bbbbbbbb-0001-0000-0000-000000000005';
  v_est6        uuid := 'bbbbbbbb-0001-0000-0000-000000000006';
  v_est7        uuid := 'bbbbbbbb-0001-0000-0000-000000000007';
  v_proj7       uuid := 'cccccccc-0001-0000-0000-000000000007';
  v_ms1         uuid := 'dddddddd-0001-0000-0000-000000000001';
  v_ms2         uuid := 'dddddddd-0001-0000-0000-000000000002';
  v_ms3         uuid := 'dddddddd-0001-0000-0000-000000000003';

  -- estado de entrevista completo para interviews com maturity ≥ 0.7
  v_state_full  jsonb := '{
    "project_type": "new",
    "setup_confirmed": true,
    "domains": {
      "scope":        {"answered": 7, "total": 8, "vital_answered": true},
      "timeline":     {"answered": 4, "total": 5, "vital_answered": true},
      "budget":       {"answered": 4, "total": 4, "vital_answered": true},
      "integrations": {"answered": 4, "total": 6, "vital_answered": true},
      "tech_stack":   {"answered": 5, "total": 5, "vital_answered": true}
    },
    "responses": {
      "q_scope_001": {"value": "Aplicativo mobile de delivery de comida", "source": "user", "confirmed": true},
      "q_scope_002": {"value": "iOS e Android, React Native", "source": "user", "confirmed": true},
      "q_budget_001": {"value": "R$ 150.000", "source": "user", "confirmed": true},
      "q_timeline_001": {"value": "6 meses", "source": "user", "confirmed": true},
      "q_tech_001": {"value": "React Native, Node.js, PostgreSQL", "source": "user", "confirmed": true}
    },
    "open_questions": [],
    "documents_processed": [],
    "conversation_summary": "Projeto de app de delivery móvel com React Native. Budget de R$ 150k, prazo 6 meses. Integrações com gateway de pagamento (Stripe) e geolocalização (Google Maps).",
    "last_questions_asked": []
  }';

  -- estado parcial (maturity ~0.5)
  v_state_partial jsonb := '{
    "project_type": "new",
    "setup_confirmed": true,
    "domains": {
      "scope":        {"answered": 4, "total": 8, "vital_answered": true},
      "timeline":     {"answered": 2, "total": 5, "vital_answered": false},
      "budget":       {"answered": 1, "total": 4, "vital_answered": false},
      "integrations": {"answered": 0, "total": 6, "vital_answered": false},
      "tech_stack":   {"answered": 2, "total": 5, "vital_answered": true}
    },
    "responses": {
      "q_scope_001": {"value": "Sistema CRM para pequenas empresas", "source": "user", "confirmed": true}
    },
    "open_questions": ["q_budget_001", "q_timeline_001", "q_integrations_001"],
    "documents_processed": [],
    "conversation_summary": "CRM para pequenas empresas. Escopo ainda em definição.",
    "last_questions_asked": ["q_budget_001"]
  }';

  v_result_full jsonb := '{
    "executive_summary": "Estimativa para app de delivery mobile: R$ 120.000–175.000, 5–7 meses, equipe de 4–6 pessoas.",
    "architecture_overview": "Arquitetura mobile-first com React Native no cliente, Node.js + Express no backend, PostgreSQL como banco principal e Redis para cache de sessão e filas.",
    "milestones": [
      {"name": "MVP — Autenticação e Catálogo", "description": "Login, cadastro de restaurantes e listagem de produtos.", "duration_weeks": 4, "deliverables": ["Tela de login", "Listagem de restaurantes", "Cardápio digital"], "dependencies": [], "team_size": 3, "cost_estimate": 28000},
      {"name": "Checkout e Pagamentos", "description": "Fluxo de pedido com integração Stripe.", "duration_weeks": 3, "deliverables": ["Carrinho de compras", "Integração Stripe", "Confirmação de pedido"], "dependencies": ["MVP"], "team_size": 3, "cost_estimate": 22000},
      {"name": "Rastreamento e Entregas", "description": "Geolocalização em tempo real com Google Maps.", "duration_weeks": 4, "deliverables": ["Mapa de rastreamento", "Push notifications", "Painel entregador"], "dependencies": ["Checkout"], "team_size": 4, "cost_estimate": 35000},
      {"name": "Admin e Analytics", "description": "Dashboard para restaurantes e relatórios.", "duration_weeks": 3, "deliverables": ["Dashboard restaurante", "Relatórios de vendas", "Gestão de cardápio"], "dependencies": ["Rastreamento"], "team_size": 3, "cost_estimate": 25000}
    ],
    "tech_recommendations": [
      {"category": "Frontend", "technology": "React Native 0.73", "justification": "Cross-platform nativo, comunidade madura."},
      {"category": "Backend", "technology": "Node.js + Fastify", "justification": "Alta performance para APIs REST e WebSocket."},
      {"category": "Banco", "technology": "PostgreSQL + pgvector", "justification": "ACID transactions + busca semântica de restaurantes."},
      {"category": "Pagamentos", "technology": "Stripe", "justification": "SDK maduro, suporte a PIX e cartões."}
    ],
    "risks": [
      {"description": "Integrações com múltiplos gateways de pagamento podem atrasar entrega", "probability": "medium", "impact": "high", "mitigation": "Começar apenas com Stripe, adicionar outros gateways na v2."},
      {"description": "Performance de geolocalização em tempo real com muitos entregadores", "probability": "low", "impact": "medium", "mitigation": "Usar Redis Pub/Sub + WebSocket com throttling de 3s."}
    ],
    "cost_scenarios": [
      {"name": "conservador", "description": "Equipe menor, prazo mais longo", "total_cost": 175000, "total_hours": 1400, "duration_weeks": 28, "team_size": 4, "confidence": 0.85},
      {"name": "moderado", "description": "Equipe equilibrada, prazo realista", "total_cost": 145000, "total_hours": 1160, "duration_weeks": 22, "team_size": 5, "confidence": 0.72},
      {"name": "otimista", "description": "Equipe experiente, prazo agressivo", "total_cost": 120000, "total_hours": 960, "duration_weeks": 18, "team_size": 6, "confidence": 0.55}
    ],
    "similar_projects": [],
    "summary": "App de delivery mobile completo com React Native, backend Node.js e integrações de pagamento e geolocalização."
  }';

  v_steps_full jsonb := '[
    {"agent_key": "architecture_interviewer", "status": "done", "duration_s": 18.2, "output_preview": "Requisitos consolidados: app mobile delivery...", "error": null},
    {"agent_key": "rag_analyst",              "status": "done", "duration_s": 12.5, "output_preview": "3 projetos similares encontrados...", "error": null},
    {"agent_key": "software_architect",       "status": "done", "duration_s": 24.1, "output_preview": "Arquitetura React Native + Node.js...", "error": null},
    {"agent_key": "cost_specialist",          "status": "done", "duration_s": 16.8, "output_preview": "3 cenários de custo: R$ 120k–175k...", "error": null},
    {"agent_key": "reviewer",                 "status": "done", "duration_s": 11.3, "output_preview": "Estimativa validada. Confiança alta.", "error": null},
    {"agent_key": "knowledge_manager",        "status": "done", "duration_s": 8.9, "output_preview": "Conhecimento indexado no pgvector.", "error": null}
  ]';

  v_steps_failed jsonb := '[
    {"agent_key": "architecture_interviewer", "status": "done", "duration_s": 19.1, "output_preview": "Requisitos consolidados...", "error": null},
    {"agent_key": "rag_analyst",              "status": "done", "duration_s": 11.7, "output_preview": "Busca RAG executada...", "error": null},
    {"agent_key": "software_architect",       "status": "failed", "duration_s": 90.0, "output_preview": null, "error": "Agent timeout after 90s"},
    {"agent_key": "cost_specialist",          "status": "pending", "duration_s": null, "output_preview": null, "error": null},
    {"agent_key": "reviewer",                 "status": "pending", "duration_s": null, "output_preview": null, "error": null},
    {"agent_key": "knowledge_manager",        "status": "pending", "duration_s": null, "output_preview": null, "error": null}
  ]';

BEGIN
  -- ── Busca usuário ─────────────────────────────────────────────────────────
  SELECT id INTO v_user_id FROM public.users WHERE email = 'renatobardicabral@gmail.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário renatobardicabral@gmail.com não encontrado. Execute o login primeiro.';
  END IF;

  RAISE NOTICE 'Seed: user_id = %', v_user_id;

  -- ── Limpa seeds anteriores ────────────────────────────────────────────────
  DELETE FROM public.projects   WHERE id = v_proj7;
  DELETE FROM public.estimates  WHERE id IN (v_est4, v_est5, v_est6, v_est7);
  DELETE FROM public.interviews WHERE id IN (v_iw1, v_iw2, v_iw3, v_iw4, v_iw5, v_iw6, v_iw7);

  -- ── Interview 1: Em andamento, maturity ~0.5 ──────────────────────────────
  INSERT INTO public.interviews (id, user_id, title, status, maturity, state)
  VALUES (v_iw1, v_user_id, '[SEED] CRM para PMEs — Em andamento', 'active', 0.49, v_state_partial);

  -- ── Interview 2: Pronta para estimar, maturity 0.79 ───────────────────────
  INSERT INTO public.interviews (id, user_id, title, status, maturity, state)
  VALUES (v_iw2, v_user_id, '[SEED] App Delivery Mobile — Pronto p/ Estimar', 'active', 0.79, v_state_full);

  -- ── Interview 3: Arquivada ────────────────────────────────────────────────
  INSERT INTO public.interviews (id, user_id, title, status, maturity, state)
  VALUES (v_iw3, v_user_id, '[SEED] E-commerce Abandonado — Arquivado', 'archived', 0.35, v_state_partial);

  -- ── Interview 4: Com estimativa pending ───────────────────────────────────
  INSERT INTO public.interviews (id, user_id, title, status, maturity, state)
  VALUES (v_iw4, v_user_id, '[SEED] Plataforma EAD — Estimativa Pendente', 'active', 0.78, v_state_full);

  INSERT INTO public.estimates (id, interview_id, user_id, status, job_id)
  VALUES (v_est4, v_iw4, v_user_id, 'pending', 'seed-job-pending-001');

  -- ── Interview 5: Com estimativa done ─────────────────────────────────────
  INSERT INTO public.interviews (id, user_id, title, status, maturity, state)
  VALUES (v_iw5, v_user_id, '[SEED] Marketplace B2B — Estimativa Concluída', 'active', 0.81, v_state_full);

  INSERT INTO public.estimates (id, interview_id, user_id, status, job_id, result, agent_steps)
  VALUES (v_est5, v_iw5, v_user_id, 'done', 'seed-job-done-001', v_result_full, v_steps_full);

  -- ── Interview 6: Com estimativa failed ────────────────────────────────────
  INSERT INTO public.interviews (id, user_id, title, status, maturity, state)
  VALUES (v_iw6, v_user_id, '[SEED] SaaS Jurídico — Estimativa Falhada', 'active', 0.75, v_state_full);

  INSERT INTO public.estimates (id, interview_id, user_id, status, job_id, agent_steps)
  VALUES (v_est6, v_iw6, v_user_id, 'failed', 'seed-job-failed-001', v_steps_failed);

  -- ── Interview 7: Com estimativa approved + projeto ────────────────────────
  INSERT INTO public.interviews (id, user_id, title, status, maturity, state)
  VALUES (v_iw7, v_user_id, '[SEED] App Delivery Mobile — Aprovado', 'active', 0.81, v_state_full);

  INSERT INTO public.estimates (id, interview_id, user_id, status, job_id, result, agent_steps, approved_at)
  VALUES (v_est7, v_iw7, v_user_id, 'approved', 'seed-job-approved-001', v_result_full, v_steps_full, now() - interval '1 day');

  INSERT INTO public.projects (id, estimate_id, user_id, name, description, status,
                                selected_scenario, total_cost, total_hours, duration_weeks, team_size)
  VALUES (v_proj7, v_est7, v_user_id,
          '[SEED] App de Delivery Mobile',
          'Aplicativo mobile de delivery desenvolvido com React Native, backend Node.js e integrações Stripe e Google Maps.',
          'active', 'moderado', 145000, 1160, 22, 5);

  -- Milestones do projeto
  INSERT INTO public.milestones (id, project_id, name, description, duration_weeks, sort_order, status, deliverables)
  VALUES
    (v_ms1, v_proj7, 'MVP — Autenticação e Catálogo',
     'Login, cadastro de restaurantes e listagem de produtos.',
     4, 1, 'done',
     '["Tela de login", "Listagem de restaurantes", "Cardápio digital"]'),
    (v_ms2, v_proj7, 'Checkout e Pagamentos',
     'Fluxo de pedido com integração Stripe.',
     3, 2, 'in_progress',
     '["Carrinho de compras", "Integração Stripe", "Confirmação de pedido"]'),
    (v_ms3, v_proj7, 'Rastreamento e Entregas',
     'Geolocalização em tempo real com Google Maps.',
     4, 3, 'pending',
     '["Mapa de rastreamento", "Push notifications", "Painel entregador"]');

  -- Tasks dos milestones
  INSERT INTO public.tasks (milestone_id, project_id, title, sort_order, status)
  VALUES
    (v_ms1, v_proj7, 'Implementar tela de login Firebase',    1, 'done'),
    (v_ms1, v_proj7, 'Criar listagem de restaurantes com filtros', 2, 'done'),
    (v_ms1, v_proj7, 'Desenvolver cardápio digital dinâmico', 3, 'done'),
    (v_ms2, v_proj7, 'Implementar carrinho de compras',       1, 'done'),
    (v_ms2, v_proj7, 'Integrar Stripe Checkout',              2, 'in_progress'),
    (v_ms2, v_proj7, 'Tela de confirmação e rastreamento',    3, 'pending'),
    (v_ms3, v_proj7, 'Integrar Google Maps SDK',              1, 'pending'),
    (v_ms3, v_proj7, 'WebSocket para posição do entregador',  2, 'pending'),
    (v_ms3, v_proj7, 'Push notifications via FCM',            3, 'pending');

  RAISE NOTICE 'Seed concluído. 7 entrevistas, 4 estimativas, 1 projeto criados para %.', v_user_id;
END;
$$;
