-- ============================================================
-- Migration: 002_assumida_em_listagem.sql
-- Adiciona coluna assumida_em na tabela tarefas
-- e cria rota de listagem de usuários para o painel do Chefe
-- ============================================================

-- 1. Nova coluna: registra quando a tarefa foi assumida
ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS assumida_em TIMESTAMPTZ;

COMMENT ON COLUMN tarefas.assumida_em
  IS 'Timestamp de quando o Desenvolvedor assumiu a tarefa. NULL enquanto Disponível.';

-- 2. Índice para ordenação/filtragem por data de assunção
CREATE INDEX IF NOT EXISTS idx_tarefas_assumida_em ON tarefas (assumida_em);
