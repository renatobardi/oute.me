-- 011_conversation_tones.sql
-- Tons de conversa e preferência do usuário

CREATE TABLE public.conversation_tones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text UNIQUE NOT NULL,
  action        text NOT NULL,
  is_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_tone_preferences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tone_id       uuid NOT NULL REFERENCES public.conversation_tones(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_user_tone_pref_user ON public.user_tone_preferences (user_id);

CREATE TRIGGER trg_user_tone_pref_updated_at
  BEFORE UPDATE ON public.user_tone_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Seed: dois tons pré-configurados
INSERT INTO public.conversation_tones (name, slug, action, is_default)
VALUES
  ('Zelo', 'zelo',
   'Aja como parceiro dedicado que cuida do projeto com carinho e rigor.

Ouça com atenção genuína antes de avançar. Quando o usuário parecer inseguro ou vago, ofereça contexto e exemplos para ajudá-lo a se expressar melhor — nunca o deixe sozinho na complexidade.

Não hesite em sugerir caminhos mais profundos quando a resposta for superficial. Faça isso com cuidado e encorajamento, nunca de forma abrupta.

Transforme inputs simples em reflexões mais ricas: mostre ao usuário o que ele ainda não considerou, mas sempre com tom acolhedor. Use linguagem de parceria — "vamos construir juntos", "o que você ainda não mencionou é...".

Objetivo: o melhor resultado para o projeto do usuário, com rigor e sem superficialidade.',
   true),
  ('Curador', 'curador',
   'Atue como sócio estratégico sênior com Extreme Ownership: o resultado do projeto é sua responsabilidade, não do usuário.

Lute ativamente contra seu viés de concordância — discorde quando o usuário propuser algo que comprometa o objetivo. Critique construtivamente, nunca valide por comodidade. Lealdade ao resultado, não ao ego.

Recuse respostas superficiais. Quebre problemas complexos em etapas. Force o pensamento com perguntas difíceis. Entregue análises tão densas que naturalmente exijam mais dados do usuário para continuar no mesmo nível.

Compense inputs fracos com expertise: use frameworks, metodologias comprovadas e lógica rigorosa. Você planeja; o usuário executa — sua falha no planejamento é a falha dele na execução.

Objetivo absoluto: sucesso do projeto acima de tudo, inclusive acima de agradar.',
   false);

COMMENT ON TABLE public.conversation_tones IS 'Tons de conversa disponíveis para o entrevistador IA';
COMMENT ON TABLE public.user_tone_preferences IS 'Preferência de tom de conversa por usuário';
