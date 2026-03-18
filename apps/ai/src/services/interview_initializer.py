"""
interview_initializer.py
========================
Inicializa os domínios do InterviewState com os totais corretos.

PROBLEMA QUE RESOLVE:
  InterviewState.domains começa como {} (vazio) quando a entrevista é criada.
  calculate_maturity() usa `d.answered / d.total` — com total=0, score=0 sempre.
  Sem inicialização, a entrevista NUNCA atinge maturity ≥ 0.70.

ONDE USAR:
  No início de process_message() em interviewer.py, antes de build_system_prompt().

  from src.services.interview_initializer import ensure_domains_initialized
  state = ensure_domains_initialized(request.state)

DESIGN DAS PERGUNTAS POR DOMÍNIO:
  Os totais refletem as sub-questões que o agente conversacional precisa cobrir
  em cada domínio. Derivados do v4-interview-flow.json (domain_mapping).

  scope (30% vital):
    1. Objetivo principal do projeto
    2. Funcionalidades essenciais (MVP)
    3. Público-alvo e volume de usuários
    4. MVP vs produto completo
    5. Contexto greenfield/brownfield
    Total = 5

  timeline (20% vital):
    1. Existência de deadline
    2. Prazo em semanas/meses
    3. Fases e milestones
    Total = 3

  budget (20% vital):
    1. Faixa de investimento prevista
    2. Modelo de contratação / equipe existente
    Total = 2

  integrations (15% opcional):
    1. APIs externas necessárias
    2. Sistemas legados / autenticação
    3. Pagamentos / third-party services
    4. Nível de compliance necessário
    Total = 4

  tech_stack (15% vital):
    1. Restrições / preferências de linguagem
    2. Tipo de produto (web/mobile/data/AI)
    3. Estratégia de infraestrutura
    4. Banco de dados / storage
    Total = 4

  Total entrevista: 18 sub-questões → maturity 100% = todas respondidas com vitais OK
"""

from src.models.interview import DomainState, InterviewState

# ---------------------------------------------------------------------------
# Domain totals — fonte de verdade para calculate_maturity()
# Modificar aqui se o escopo de perguntas mudar.
# ---------------------------------------------------------------------------

DEFAULT_DOMAIN_TOTALS: dict[str, int] = {
    "scope": 5,
    "timeline": 3,
    "budget": 2,
    "integrations": 4,
    "tech_stack": 4,
}


def ensure_domains_initialized(state: InterviewState) -> InterviewState:
    """
    Garante que todos os domínios estejam presentes em state.domains com
    os totais corretos. Idempotente — seguro chamar em todo turno.

    Comportamento:
    - Se o domínio não existe → cria com total correto, answered=0, vital=False
    - Se o domínio existe mas total=0 → corrige o total (migração de dados antigos)
    - Se o domínio existe com total>0 → não toca (preserva progresso)
    """
    updated = state.model_copy(deep=True)
    changed = False

    for domain, total in DEFAULT_DOMAIN_TOTALS.items():
        existing = updated.domains.get(domain)

        if existing is None:
            # Domínio não existe — criar do zero
            updated.domains[domain] = DomainState(
                answered=0,
                total=total,
                vital_answered=False,
            )
            changed = True

        elif existing.total == 0:
            # Domínio existe mas total não foi setado (dado legado)
            updated.domains[domain] = DomainState(
                answered=existing.answered,
                total=total,
                vital_answered=existing.vital_answered,
            )
            changed = True

        # Se total > 0 → preservar estado atual sem modificar

    if changed and not updated.conversation_summary:
        # Primeira inicialização — marcar setup confirmado
        updated.setup_confirmed = True

    return updated


def get_domain_progress_summary(state: InterviewState) -> dict[str, dict]:
    """
    Retorna um resumo de progresso por domínio.
    Útil para logging e para o system prompt.

    Retorna:
    {
      "scope": {"answered": 2, "total": 5, "pct": 40.0, "vital": True},
      ...
    }
    """
    summary = {}
    for domain in DEFAULT_DOMAIN_TOTALS:
        d = state.domains.get(domain)
        if not d:
            summary[domain] = {"answered": 0, "total": DEFAULT_DOMAIN_TOTALS[domain], "pct": 0.0, "vital": False}
        else:
            pct = (d.answered / d.total * 100) if d.total > 0 else 0.0
            summary[domain] = {
                "answered": d.answered,
                "total": d.total,
                "pct": round(pct, 1),
                "vital": d.vital_answered,
            }
    return summary


def get_uncovered_vital_domains(state: InterviewState) -> list[str]:
    """
    Retorna lista de domínios vitais com vital_answered=False.
    Usado pelo system prompt para direcionar o agente.
    """
    from src.models.interview import VITAL_REQUIRED
    return [
        domain
        for domain, required in VITAL_REQUIRED.items()
        if required and not state.domains.get(domain, DomainState()).vital_answered
    ]
