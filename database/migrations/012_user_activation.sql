-- 012_user_activation.sql
-- Adiciona campos de onboarding, ativação e perfil na tabela de usuários

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name            text,
  ADD COLUMN IF NOT EXISTS company              text,
  ADD COLUMN IF NOT EXISTS role                 text,
  ADD COLUMN IF NOT EXISTS active               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_admin             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_complete  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified       boolean NOT NULL DEFAULT false;

-- Promove admin conhecido
UPDATE public.users SET is_admin = true WHERE email = 'renatobardicabral@gmail.com';
