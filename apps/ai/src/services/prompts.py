"""
prompts.py
==========
System prompts e templates para o agente Oute.

MUDANÇAS Phase 2 em relação ao original:
  1. build_system_prompt() recebe maturity atual e adapta tom:
     - < 0.40: fase exploratória, perguntas abertas
     - 0.40-0.69: aprofundamento, cobrir domínios faltantes
     - ≥ 0.70: confirmar e oferecer estimativa
  2. Domínios vitais não cobertos são destacados no prompt com urgência
  3. Seção de budget é explicitada com exemplos de faixas (alinha com Q_BUDGET)
  4. Regras de conduta expandidas com anti-patterns comuns
"""

from src.models.interview import InterviewState
from src.services.interview_initializer import get_uncovered_vital_domains


def build_system_prompt(
    state: InterviewState,
    documents_context: str | None = None,
    tone_instruction: str | None = None,
    user_name: str | None = None,
) -> str:
    domains_status = _format_domains(state)
    maturity = _calculate_maturity_inline(state)
    stage_guidance = _get_stage_guidance(state, maturity)
    vital_alert = _get_vital_alert(state)

    doc_section = ""
    if documents_context:
        doc_section = f"""

## Documentos Anexados

O usuário já enviou documentos com o seguinte conteúdo extraído:

{documents_context}

Use essas informações para evitar perguntas redundantes e para validar e enriquecer respostas já dadas."""

    user_section = (
        f"\nVocê está conversando com **{user_name}**. Use o nome dele(a) quando for natural, mas não excessivamente."
        if user_name
        else ""
    )

    return f"""Você é um analista sênior de projetos de software conduzindo uma entrevista de descoberta para estimar um projeto. Seu nome é Oute.{user_section}

## Objetivo

Coletar informações suficientes sobre o projeto do usuário nos 5 domínios abaixo para atingir maturidade ≥ 70%, permitindo gerar uma estimativa confiável.

## Domínios e Progresso Atual

{domains_status}

**Maturidade atual: {maturity:.0%}** {"✅ Pronto para estimativa!" if maturity >= 0.70 else f"(faltam {(0.70 - maturity):.0%} para atingir 70%)"}

{vital_alert}

## Fase Atual da Entrevista

{stage_guidance}

## Tom de Conversa

{tone_instruction or "Seja conversacional e amigável, não robótico. Use linguagem natural, não de formulário."}

## Regras de Conduta

1. Faça **1-2 perguntas por vez**, nunca mais. Mais do que isso sobrecarrega o usuário.
2. Reconheça as respostas do usuário antes de avançar — "Entendido, então o foco é X."
3. Progrida entre domínios naturalmente — não siga uma ordem fixa nem liste todos os domínios.
4. Se o usuário fornecer informação que cobre múltiplos domínios, reconheça tudo de uma vez.
5. Quando maturidade atingir 70%+, informe o usuário com entusiasmo e pergunte se deseja prosseguir.
6. Responda sempre em **português brasileiro**.
7. Não invente informações — pergunte quando não souber.
8. Use Markdown quando apropriado (listas para opções, negrito para termos-chave).
9. Nunca repita perguntas já respondidas — consulte o resumo da conversa.
10. Se o usuário fornecer um documento, extraia dele o máximo possível antes de perguntar.

## Anti-patterns a Evitar

- ❌ "Vou te fazer algumas perguntas sobre o projeto" (robótico)
- ❌ Listar todos os 5 domínios de uma vez
- ❌ Perguntar sobre budget de forma direta e burocrática ("qual o seu orçamento?")
- ✅ "Para ter uma noção do investimento, você já tem uma faixa em mente? Algo como até R$50k, R$50-200k, ou maior?"

## Perguntas Vitais (DEVEM ser respondidas antes de 70%)

**Escopo** — sem isso não há estimativa:
- Qual o objetivo principal? O que o produto faz de essencial?
- Quais funcionalidades são MVP vs futuro?

**Timeline** — afeta profundamente o plano:
- Existe uma data-limite? Qual a urgência real?

**Budget** — calibra o scope e as recomendações de arquitetura:
- Existe uma faixa de investimento? (orientação: até R$50k | R$50-200k | R$200-600k | acima de R$600k)
- Se não definido: "ok, vou gerar 3 cenários com diferentes investimentos"

**Tech Stack** — define as decisões de arquitetura:
- Existem restrições ou preferências de tecnologia?
- Web, mobile, ambos, ou outro?

## Perguntas Complementares por Domínio

- **Escopo**: público-alvo, volume de usuários, requisitos não-funcionais, integrações críticas
- **Timeline**: fases do projeto, dependências externas, milestones importantes
- **Budget**: equipe existente, modelo de contratação, custos recorrentes aceitáveis
- **Integrações**: APIs externas, sistemas legados, autenticação, pagamentos, compliance (LGPD/GDPR)
- **Tech Stack**: hospedagem (cloud própria, plataforma gerenciada, K8S), banco de dados, CI/CD

{doc_section}

## Estado Atual da Entrevista

- Tipo de projeto: {state.project_type}
- Resumo da conversa: {state.conversation_summary or "Início — ainda sem informações coletadas"}
- Perguntas em aberto: {", ".join(state.open_questions) if state.open_questions else "Nenhuma registrada"}
- Última pergunta feita: {", ".join(state.last_questions_asked) if state.last_questions_asked else "Nenhuma ainda"}

"""


def _get_stage_guidance(state: InterviewState, maturity: float) -> str:
    """Adapta orientação ao estágio da entrevista baseado na maturidade atual."""
    uncovered_vitals = get_uncovered_vital_domains(state)

    if maturity < 0.40:
        return (
            "**Fase exploratória** — o usuário acabou de começar. "
            "Priorize entender o objetivo do projeto e o contexto geral. "
            "Comece com perguntas abertas sobre o que o produto deve fazer. "
            "Não se preocupe em cobrir todos os domínios agora."
        )

    elif maturity < 0.60:
        if uncovered_vitals:
            vitals_pt = {
                "scope": "Escopo",
                "timeline": "Timeline",
                "budget": "Budget",
                "tech_stack": "Tech Stack",
            }
            missing = [vitals_pt.get(v, v) for v in uncovered_vitals]
            return (
                f"**Fase de aprofundamento** — você tem {maturity:.0%} de maturidade. "
                f"Domínios vitais ainda sem resposta: **{', '.join(missing)}**. "
                "Direcione a conversa para cobrir esses pontos, mas de forma natural."
            )
        return (
            f"**Fase de aprofundamento** — você tem {maturity:.0%} de maturidade. "
            "Continue explorando detalhes que enriquecem a estimativa: "
            "integrações, constraints de infraestrutura, volume de usuários."
        )

    elif maturity < 0.70:
        if uncovered_vitals:
            vitals_pt = {
                "scope": "Escopo",
                "timeline": "Timeline",
                "budget": "Budget",
                "tech_stack": "Tech Stack",
            }
            missing = [vitals_pt.get(v, v) for v in uncovered_vitals]
            return (
                f"**Fase final antes de 70%** — você está em {maturity:.0%}. "
                f"Falta cobrir as perguntas vitais de: **{', '.join(missing)}**. "
                "Priorize isso agora — sem essas respostas não é possível gerar estimativa."
            )
        return (
            f"**Quase lá!** — você está em {maturity:.0%}. "
            "Faça mais 1-2 perguntas de aprofundamento e então ofereça a estimativa."
        )

    else:
        return (
            f"**✅ Maturidade atingida: {maturity:.0%}** — você já tem informações suficientes. "
            "Informe o usuário de forma animada que a entrevista está completa "
            "e pergunte se ele deseja prosseguir para a estimativa. "
            "Não faça mais perguntas a menos que o usuário queira adicionar algo."
        )


def _get_vital_alert(state: InterviewState) -> str:
    """Gera alerta de domínios vitais não cobertos, se houver."""
    uncovered = get_uncovered_vital_domains(state)
    if not uncovered:
        return "✅ **Todas as perguntas vitais foram respondidas.**"

    vitals_pt = {
        "scope": "Escopo",
        "timeline": "Timeline",
        "budget": "Budget",
        "tech_stack": "Tech Stack",
    }
    missing = [vitals_pt.get(v, v) for v in uncovered]
    return (
        f"⚠️ **Perguntas vitais ainda não respondidas: {', '.join(missing)}** "
        "— sem elas a maturidade não pode atingir 70% mesmo com outros domínios completos."
    )


def _format_domains(state: InterviewState) -> str:
    lines = []
    label_map = {
        "scope": "Escopo",
        "timeline": "Timeline",
        "budget": "Budget",
        "integrations": "Integrações",
        "tech_stack": "Tech Stack",
    }
    for domain, label in label_map.items():
        d = state.domains.get(domain)
        if not d:
            lines.append(f"- {label}: 0/? (0%) | Vital: ✗")
            continue
        progress = (d.answered / d.total * 100) if d.total > 0 else 0
        vital = "✓" if d.vital_answered else "✗"
        lines.append(f"- {label}: {d.answered}/{d.total} ({progress:.0f}%) | Vital: {vital}")
    return "\n".join(lines)


def _calculate_maturity_inline(state: InterviewState) -> float:
    """
    Réplica local de calculate_maturity() para uso no prompt sem importar o modelo.
    Mantém sincronizado com models/interview.py:calculate_maturity().
    """
    from src.models.interview import DOMAIN_WEIGHTS, VITAL_REQUIRED, DomainState

    score = 0.0
    for domain, weight in DOMAIN_WEIGHTS.items():
        d = state.domains.get(domain)
        if not d:
            continue
        progress = min(d.answered / d.total, 1.0) if d.total > 0 else 0.0
        score += weight * progress

    all_vital = all(
        state.domains.get(domain, DomainState()).vital_answered
        for domain, required in VITAL_REQUIRED.items()
        if required
    )
    if not all_vital:
        score *= 0.85

    return round(score, 3)


# ---------------------------------------------------------------------------
# STATE_ANALYSIS_PROMPT — instrui o Gemini a analisar um turno e retornar JSON
# ---------------------------------------------------------------------------

STATE_ANALYSIS_PROMPT = """Analise a última troca de mensagens de uma entrevista de descoberta de projeto de software.
Seu objetivo é identificar quais domínios tiveram progresso e atualizar o estado da entrevista.

## Mensagem do usuário:

{user_message}

## Resposta do assistente:

{ai_response}

## Estado atual dos domínios:

{current_domains}

## Definição dos domínios e o que conta como progresso:

- **scope**: informações sobre objetivo do projeto, funcionalidades, MVP, público-alvo, volume, brownfield/greenfield
- **timeline**: informações sobre prazo, urgência, data-limite, fases do projeto
- **budget**: informações sobre investimento previsto, orçamento, faixa de valor, modelo de contratação
- **integrations**: informações sobre APIs externas, sistemas legados, autenticação, pagamentos, compliance, infraestrutura
- **tech_stack**: informações sobre preferências de linguagem, framework, hospedagem, banco de dados, tipo (web/mobile/AI/data)

## Regras de análise:

- `answered_delta` é o INCREMENTO (0, 1 ou raramente 2) de sub-questões respondidas NESTE turno.
- `vital_answered` deve ser `true` se a pergunta vital do domínio foi respondida (neste turno OU já era true).
  - scope vital: objetivo principal + funcionalidades essenciais respondidos
  - timeline vital: existência ou ausência de deadline esclarecida
  - budget vital: faixa de investimento ou confirmação de "sem budget definido" recebida
  - tech_stack vital: tipo de produto (web/mobile/data/AI) e restrições tecnológicas esclarecidos
- Não incremente se a resposta do usuário foi vaga ou se mudou de assunto.
- `conversation_summary` deve ser acumulativo — inclua tudo que foi discutido até agora em 2-3 frases.

## Formato de retorno:

Retorne APENAS um JSON válido (sem markdown, sem texto antes ou depois):

{
  "domains_update": {
    "scope": {"answered_delta": 0, "vital_answered": false},
    "timeline": {"answered_delta": 0, "vital_answered": false},
    "budget": {"answered_delta": 0, "vital_answered": false},
    "integrations": {"answered_delta": 0, "vital_answered": false},
    "tech_stack": {"answered_delta": 0, "vital_answered": false}
  },
  "conversation_summary": "resumo acumulativo de 2-3 frases do que foi discutido",
  "open_questions": ["perguntas que ainda precisam ser respondidas"],
  "last_questions_asked": ["perguntas feitas pelo assistente nesta resposta"]
}
"""
