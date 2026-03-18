# Plano de Implementação — Analista RAG + Persistência de Documentos

**Data:** 2026-03-18
**Status:** Aprovado para implementação
**Pré-requisito:** Entrevistador de chat funcional (já implementado)

---

## Objetivo

Transformar o fluxo de documentos e conhecimento da plataforma para que:
1. Documentos enviados sejam persistidos (arquivo original + texto extraído)
2. Todo conhecimento relevante da entrevista alimente o pgvector em tempo real
3. O Entrevistador aguarde o processamento RAG de documentos antes de responder
4. O Analista RAG do pipeline batch tenha base de conhecimento real para buscar

---

## Arquitetura do Fluxo

```
DURANTE A ENTREVISTA (tempo real, sem CrewAI):

  Usuário envia mensagem
       │
       ▼
  Entrevistador responde via SSE
       │
       ▼
  Resumo do turno embeddado no pgvector ──► ai.knowledge_vectors
  (source_type="interview_turn",            (acumula conhecimento
   source_id=interview_id)                   a cada turno)


  Usuário envia documento
       │
       ├──► Arquivo salvo no StorageBackend (GCS/local)
       │
       ├──► Texto extraído (document_processor)
       │
       ├──► Texto embeddado no pgvector ──► ai.knowledge_vectors
       │    (source_type="document",
       │     source_id=interview_id)
       │
       ▼
  Entrevistador AGUARDA processamento
  e recebe resumo do documento para
  interagir com o usuário sobre o conteúdo


NO PIPELINE DE ESTIMATIVA (batch, CrewAI):

  Agente 2 (Analista RAG)
       │
       ▼
  VectorSearchTool busca em ai.knowledge_vectors
       │
       ├── Encontra turnos de entrevista deste projeto
       ├── Encontra documentos deste projeto
       └── Encontra estimativas de projetos ANTERIORES
```

---

## Tarefas de Implementação

### Fase A — Persistência de Arquivos (StorageBackend)

**A1. Implementar StorageBackend no FastAPI**
- Arquivo: `apps/ai/src/services/storage.py` (novo)
- Protocol com duas implementações:
  - `GCSBackend` — usa `google-cloud-storage` (prod, quando `GOOGLE_CLOUD_STORAGE_BUCKET` está setado)
  - `LocalBackend` — salva em `STORAGE_LOCAL_PATH` (dev, fallback)
- Interface:
  ```python
  class StorageBackend(Protocol):
      async def upload(self, path: str, data: bytes, content_type: str) -> str: ...
      async def download(self, path: str) -> bytes: ...
  ```
- Factory: `create_storage_backend()` baseado em settings

**A2. Integrar upload no fluxo do BFF**
- Arquivo: `apps/web/src/routes/api/chat/[id]/upload/+server.ts`
- Alterar: enviar arquivo para o FastAPI que agora persiste E processa
- O FastAPI recebe o arquivo, salva via StorageBackend, extrai texto, retorna resultado

**A3. Novo endpoint no FastAPI para receber e persistir**
- Arquivo: `apps/ai/src/routers/chat.py`
- Alterar `POST /chat/process-document`:
  - Receber `interview_id` como parâmetro (hoje não recebe)
  - Salvar arquivo via StorageBackend
  - Extrair texto
  - Retornar texto extraído + storage_path

**A4. Adicionar `google-cloud-storage` como dependência**
- Arquivo: `apps/ai/pyproject.toml`
- Adicionar: `google-cloud-storage >= 2.18.0`

---

### Fase B — Embedding de Documentos no pgvector

**B1. Criar serviço de chunking**
- Arquivo: `apps/ai/src/services/text_chunker.py` (novo)
- Função: `chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]`
- Divide texto extraído em chunks com overlap para melhor recuperação
- Cada chunk vira um vetor separado no pgvector

**B2. Criar serviço de ingestão RAG**
- Arquivo: `apps/ai/src/services/rag_ingest.py` (novo)
- Função principal:
  ```python
  async def ingest_document(
      interview_id: str,
      document_id: str,
      filename: str,
      extracted_text: str,
  ) -> int:
      """Chunkeia texto e embeda no pgvector. Retorna qtd de chunks."""
  ```
- Chama `text_chunker.chunk_text()` → para cada chunk chama `vector_store.store_vector()`
- Metadata: `{ interview_id, document_id, filename, chunk_index, source_type: "document" }`

**B3. Integrar ingestão no fluxo de upload**
- Arquivo: `apps/ai/src/routers/chat.py`
- Após extrair texto do documento, chamar `rag_ingest.ingest_document()`
- Retornar status de embedding junto com o texto extraído

---

### Fase C — Embedding de Turnos da Entrevista

**C1. Criar função de ingestão de turno**
- Arquivo: `apps/ai/src/services/rag_ingest.py` (mesmo arquivo da B2)
- Nova função:
  ```python
  async def ingest_interview_turn(
      interview_id: str,
      conversation_summary: str,
      turn_number: int,
  ) -> str | None:
      """Embeda resumo atualizado da conversa no pgvector.
      Faz upsert: substitui o vetor anterior do mesmo interview_id
      para manter sempre o resumo mais recente."""
  ```
- source_type: `"interview_summary"`
- Upsert: DELETE WHERE source_type='interview_summary' AND source_id=interview_id, depois INSERT

**C2. Integrar no fluxo do Entrevistador**
- Arquivo: `apps/ai/src/services/interviewer.py`
- Após `state_update` (quando o resumo da conversa é atualizado), chamar `ingest_interview_turn()`
- Não bloqueia o SSE — pode rodar em background após o `done` event

---

### Fase D — Entrevistador Aguarda RAG de Documento

**D1. Novo endpoint de upload com processamento RAG integrado**
- Arquivo: `apps/ai/src/routers/chat.py`
- Alterar `POST /chat/process-document` para:
  1. Receber arquivo + interview_id
  2. Salvar via StorageBackend
  3. Extrair texto
  4. Embeddar no pgvector (chunks)
  5. Gerar resumo do documento via Gemini (chamada direta, sem CrewAI)
  6. Retornar: `{ extracted_text, summary, chunks_count, status }`

**D2. BFF passa resumo do documento para o Entrevistador**
- Arquivo: `apps/web/src/routes/api/chat/[id]/upload/+server.ts`
- Após upload, o frontend envia uma mensagem automática tipo:
  `"[Documento enviado: {filename}]\n\nResumo: {summary}"`
- O Entrevistador recebe isso como `documents_context` e responde sobre o conteúdo

**D3. Frontend: indicador de processamento**
- Arquivo: `apps/web/src/lib/stores/chat.svelte.ts`
- Mostrar estado "Processando documento..." enquanto aguarda upload + RAG
- Após concluir, disparar mensagem automática ao Entrevistador

---

### Fase E — Melhorar Analista RAG do Pipeline Batch

**E1. Melhorar vector_store.py**
- Arquivo: `apps/ai/src/services/vector_store.py`
- Adicionar parâmetro `min_similarity: float = 0.3` para filtrar resultados irrelevantes
- Adicionar filtro opcional `source_type` (WHERE clause)
- Adicionar filtro opcional `source_id` para buscar vetores de um projeto específico

**E2. Melhorar VectorSearchTool**
- Arquivo: `apps/ai/src/crew/tools.py`
- Melhorar descrição da tool para o LLM
- Formatar output com métricas estruturadas (custo, prazo, equipe)
- Corrigir bridge async/sync

**E3. Reescrever prompts do agente**
- Arquivo: `apps/ai/src/crew/agents.yaml` — backstory mais detalhado
- Arquivo: `apps/ai/src/crew/tasks.yaml` — task com instruções detalhadas, exemplos, fallbacks

**E4. Adicionar modelo Pydantic de output**
- Arquivo: `apps/ai/src/models/estimate.py`
- Novo modelo: `RAGAnalysisResult` com `similar_projects`, `market_benchmarks`, `data_quality`

**E5. Ajustar config do agente no crew builder**
- Arquivo: `apps/ai/src/crew/estimate_crew.py`
- Setar `allow_delegation=False`, `max_iter=5`

---

### Fase F — Testes

**F1. Testes unitários do chunker**
- `apps/ai/tests/test_text_chunker.py`

**F2. Testes unitários do rag_ingest**
- `apps/ai/tests/test_rag_ingest.py`
- Mock de embeddings e vector_store

**F3. Testes do StorageBackend**
- `apps/ai/tests/test_storage.py`
- Testar LocalBackend com tmpdir

**F4. Testes do VectorSearchTool melhorado**
- `apps/ai/tests/test_rag_analyst.py`

---

## Backlog (fora deste plano)

- [ ] **Revisão do Agente Entrevistador** — implementar checklist de informações que o entrevistador coleta durante a conversa
- [ ] **Migration para `ai.document_chunks`** — se necessário tabela separada para chunks (avaliar se `ai.knowledge_vectors` com metadata é suficiente)

---

## Ordem de Execução Recomendada

```
A1 (StorageBackend) ──► A3 (endpoint) ──► A2 (BFF) ──► A4 (dep)
                                              │
B1 (chunker) ──► B2 (rag_ingest) ──► B3 (integração upload)
                       │
                       ├──► C1 (ingestão turno) ──► C2 (integração entrevistador)
                       │
                       └──► D1 (upload+RAG) ──► D2 (BFF resumo) ──► D3 (frontend)
                                                       │
E1..E5 (pipeline batch) ────────────────────────────────┘
                                                       │
F1..F4 (testes) ───────────────────────────────────────┘
```

**Sugestão:** Implementar na ordem A → B → C → D → E → F, pois cada fase depende da anterior.

---

## Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---|---|---|
| RAG em tempo real | Gemini direto + pgvector (sem CrewAI) | CLAUDE.md: "CrewAI SOMENTE no pipeline batch". Chat precisa de baixa latência |
| Chunking | Simples com overlap (1000 chars, 200 overlap) | Suficiente para docs de projeto. Sem necessidade de chunking semântico |
| Upsert de resumo | DELETE + INSERT por interview_id | Mantém sempre o resumo mais recente, evita acúmulo |
| Storage | Protocol + GCS/Local | Já previsto no CLAUDE.md, consistente com padrão do projeto |
