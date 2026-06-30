-- ============================================================
-- Migration: 001_initial.sql
-- Sistema de Gerenciamento de Tarefas com RBAC
-- Plataforma: Supabase (PostgreSQL)
-- ============================================================

-- 1. Extensão para geração de UUIDs (já habilitada no Supabase por padrão)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. ENUMS
-- ============================================================

CREATE TYPE papel_enum AS ENUM ('Chefe', 'Desenvolvedor');

CREATE TYPE prioridade_enum AS ENUM ('Baixa', 'Média', 'Alta');

CREATE TYPE status_enum AS ENUM ('Disponível', 'Em Andamento', 'Concluída');

-- ============================================================
-- 3. TABELA: usuarios
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT          NOT NULL UNIQUE,
  senha_hash  TEXT          NOT NULL,
  papel       papel_enum    NOT NULL DEFAULT 'Desenvolvedor',
  criado_em   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índice para buscas por e-mail no login
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);

-- ============================================================
-- 4. TABELA: tarefas
-- ============================================================

CREATE TABLE IF NOT EXISTS tarefas (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          TEXT              NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 100),
  descricao       TEXT,
  prioridade      prioridade_enum   NOT NULL,
  status          status_enum       NOT NULL DEFAULT 'Disponível',
  responsavel_id  UUID              REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ       NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- Índice para filtrar tarefas por status (usado na listagem por Desenvolvedor)
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas (status);

-- Índice para checar se um desenvolvedor já tem tarefa Em Andamento
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_status ON tarefas (responsavel_id, status);

-- ============================================================
-- 5. TRIGGER: atualiza automaticamente o campo atualizado_em
-- ============================================================

CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tarefas_atualizado_em
  BEFORE UPDATE ON tarefas
  FOR EACH ROW
  EXECUTE FUNCTION set_atualizado_em();

-- ============================================================
-- 6. COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================================

COMMENT ON TABLE usuarios IS 'Usuários do sistema. Papel padrão: Desenvolvedor.';
COMMENT ON COLUMN usuarios.senha_hash IS 'Hash bcrypt da senha (custo 10). Nunca armazenar senha em texto simples.';
COMMENT ON COLUMN usuarios.papel IS 'Cargo do usuário: Chefe (admin) ou Desenvolvedor (executor).';

COMMENT ON TABLE tarefas IS 'Tarefas do sistema. Status inicial: Disponível.';
COMMENT ON COLUMN tarefas.responsavel_id IS 'ID do Desenvolvedor que assumiu a tarefa. NULL = tarefa disponível.';
COMMENT ON COLUMN tarefas.atualizado_em IS 'Atualizado automaticamente pelo trigger trg_tarefas_atualizado_em.';
