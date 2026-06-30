# Implementation Plan

## Overview

Plano de implementação do Sistema de Gerenciamento de Tarefas com RBAC usando Next.js 14+ (App Router) hospedado na Vercel com PostgreSQL no Supabase. A implementação é organizada em ondas sequenciais: infraestrutura → bibliotecas compartilhadas → rotas de API → testes → deploy.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1, 2], "description": "Setup: projeto e banco de dados" },
    { "wave": 2, "tasks": [3, 4, 5], "description": "Fundações: tipos, DB client e JWT" },
    { "wave": 3, "tasks": [6, 7], "description": "Middleware RBAC e validações Zod" },
    { "wave": 4, "tasks": [8, 9], "description": "Rotas de autenticação (registro e login)" },
    { "wave": 5, "tasks": [10, 11, 12, 13, 14], "description": "Todas as rotas de negócio" },
    { "wave": 6, "tasks": [15, 16], "description": "Testes unitários e de propriedade" },
    { "wave": 7, "tasks": [17], "description": "Deploy em produção" }
  ]
}
```

## Tasks

- [x] 1. Configuração inicial do projeto Next.js
  - Inicializar projeto Next.js 14+ com TypeScript e App Router via `npx create-next-app@latest`
  - Instalar dependências de produção: `postgres`, `bcryptjs`, `jsonwebtoken`, `zod`
  - Instalar dependências de desenvolvimento: `vitest`, `fast-check`, `@types/bcryptjs`, `@types/jsonwebtoken`, `@vitejs/plugin-react`
  - Criar arquivo `vitest.config.ts` com `environment: 'node'` e `globals: true`
  - Criar arquivo `.env.local.example` com as variáveis `DATABASE_URL` e `JWT_SECRET` documentadas
  - Adicionar `.env.local` ao `.gitignore`
  - Criar estrutura de pastas: `lib/`, `types/`, `supabase/migrations/`, `app/api/`
  - **Requirements:** 10.1, 10.4


- [x] 2. Script SQL de criação do banco de dados (migration)
  - Criar arquivo `supabase/migrations/001_initial.sql`
  - Definir enum `papel_enum` com valores `'Chefe'` e `'Desenvolvedor'`
  - Definir enum `prioridade_enum` com valores `'Baixa'`, `'Média'` e `'Alta'`
  - Definir enum `status_enum` com valores `'Disponível'`, `'Em Andamento'` e `'Concluída'`
  - Criar tabela `usuarios`: campos `id` (uuid pk default gen_random_uuid()), `email` (text unique not null), `senha_hash` (text not null), `papel` (papel_enum not null default 'Desenvolvedor'), `criado_em` (timestamptz not null default now())
  - Criar tabela `tarefas`: campos `id`, `titulo`, `descricao`, `prioridade`, `status` (default 'Disponível'), `responsavel_id` (uuid FK → usuarios.id ON DELETE SET NULL), `criado_em`, `atualizado_em`
  - Criar função PL/pgSQL `set_atualizado_em()` que atribui `NEW.atualizado_em = now()`
  - Criar trigger `trg_tarefas_atualizado_em` BEFORE UPDATE ON tarefas que executa a função
  - **Requirements:** 9.1, 9.2, 9.3


- [x] 3. Tipos TypeScript compartilhados (`types/index.ts`)
  - Definir interface `Usuario` com campos: `id`, `email`, `senha_hash`, `papel`, `criado_em`
  - Definir interface `Tarefa` com campos: `id`, `titulo`, `descricao`, `prioridade`, `status`, `responsavel_id`, `criado_em`, `atualizado_em`
  - Definir interface `JWTPayload` com campos `id: string`, `papel: 'Chefe' | 'Desenvolvedor'`, `iat?: number`, `exp?: number`
  - Definir tipos literais `Papel`, `Prioridade` e `StatusTarefa` para reutilização
  - **Requirements:** 9.1, 9.2

- [x] 4. Módulo de conexão com banco de dados (`lib/db.ts`)
  - Importar e instanciar cliente `postgres` com `process.env.DATABASE_URL!` e `ssl: 'require'`
  - Configurar pool com `max: 10` conexões
  - Exportar instância única `sql` para reuso em todas as API Routes
  - **Requirements:** 9.1, 9.2, 10.4


- [x] 5. Módulo de autenticação JWT (`lib/auth.ts`)
  - Implementar `signToken(payload)`: usa `jwt.sign` com `JWT_SECRET` e `expiresIn: '8h'`; lança erro se `JWT_SECRET` não estiver definido
  - Implementar `verifyToken(token)`: usa `jwt.verify`; propaga `TokenExpiredError` e `JsonWebTokenError` separadamente para mapeamento de HTTP 401 correto
  - Implementar `extractBearer(authHeader)`: extrai token do header `Authorization: Bearer <token>`; retorna `null` se ausente ou mal formatado
  - **Requirements:** 2.1, 2.3, 2.4, 2.5, 10.4

- [x] 6. Módulo de middleware RBAC (`lib/middleware.ts`)
  - Implementar `requireAuth(request)`: extrai e verifica JWT; retorna `JWTPayload` se válido, ou `Response` com HTTP 401 e mensagem adequada (`'Token não fornecido'`, `'Token expirado'`, `'Token inválido'`)
  - Implementar `requirePapel(payload, papeis[])`: verifica se `payload.papel` está na lista de papéis permitidos; retorna `null` se autorizado ou `Response` HTTP 403 `'Acesso negado'` se não autorizado ou se o papel for desconhecido
  - **Requirements:** 3.1, 3.2, 3.3, 3.4, 3.5


- [x] 7. Schemas de validação Zod (`lib/validations.ts`)
  - Implementar `RegistroSchema`: `email` (string email), `senha` (string min 8 max 128), ambos obrigatórios
  - Implementar `LoginSchema`: `email` (string email), `senha` (string min 1), ambos obrigatórios
  - Implementar `CriarTarefaSchema`: `titulo` (string min 1 max 100), `descricao` (string optional), `prioridade` (enum Baixa/Média/Alta)
  - Implementar `AtualizarTarefaSchema`: todos os campos opcionais com `.refine()` garantindo ao menos um campo presente
  - Implementar `AlterarPapelSchema`: `papel` (enum Chefe/Desenvolvedor)
  - Criar helper `parseBody(schema, body)` que retorna dados validados ou `Response` HTTP 422 com detalhes do erro Zod formatados
  - **Requirements:** 1.3, 1.4, 1.5, 1.6, 4.2, 4.4, 4.8, 8.3


- [x] 8. Rota de registro de usuário (`app/api/auth/registro/route.ts`)
  - Implementar handler `POST`: valida body com `RegistroSchema`; retorna HTTP 422 em falha de validação
  - Verificar se e-mail já existe com `SELECT id FROM usuarios WHERE email = $1`; retornar HTTP 409 com `'E-mail já cadastrado'` se duplicado
  - Gerar hash da senha com `bcrypt.hash(senha, 10)`
  - Inserir usuário com `INSERT INTO usuarios (email, senha_hash) VALUES ($1, $2) RETURNING id, email` (papel default 'Desenvolvedor')
  - Retornar HTTP 201 com `{ id, email }` do usuário criado
  - **Requirements:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7


- [x] 9. Rota de login (`app/api/auth/login/route.ts`)
  - Implementar handler `POST`: valida body com `LoginSchema`; retorna HTTP 422 em falha
  - Buscar usuário com `SELECT id, senha_hash, papel FROM usuarios WHERE email = $1`
  - Se usuário não encontrado: retornar HTTP 401 com `'Credenciais inválidas'` (sem revelar qual campo está errado)
  - Comparar senha com `bcrypt.compare(senha, senha_hash)`; retornar HTTP 401 com `'Credenciais inválidas'` se não corresponder
  - Emitir JWT com `signToken({ id, papel })`; retornar HTTP 200 com `{ token }`
  - **Requirements:** 2.1, 2.2

- [x] 10. Rotas de listagem e criação de tarefas (`app/api/tarefas/route.ts`)
  - Implementar handler `GET`: autenticar com `requireAuth`; se `Desenvolvedor`, executar `SELECT * FROM tarefas WHERE status = 'Disponível'`; se `Chefe`, executar `SELECT * FROM tarefas`; retornar HTTP 200 com array (vazio se não houver resultados)
  - Implementar handler `POST`: autenticar com `requireAuth`; verificar papel `Chefe` com `requirePapel`; validar body com `CriarTarefaSchema`; inserir com `INSERT INTO tarefas (titulo, descricao, prioridade) VALUES ($1,$2,$3) RETURNING *`; retornar HTTP 201 com dados da tarefa
  - **Requirements:** 4.1, 4.2, 4.8, 5.1, 5.2, 5.3


- [x] 11. Rotas de edição e exclusão de tarefa (`app/api/tarefas/[id]/route.ts`)
  - Implementar handler `PATCH`: autenticar; verificar papel `Chefe`; validar body com `AtualizarTarefaSchema`; buscar tarefa pelo `id` — retornar HTTP 404 se não existir; construir query de UPDATE dinâmica com apenas os campos fornecidos usando `RETURNING *`; retornar HTTP 200 com dados atualizados
  - Implementar handler `DELETE`: autenticar; verificar papel `Chefe`; buscar tarefa pelo `id` — retornar HTTP 404 se não existir; verificar se `status = 'Disponível'` — retornar HTTP 409 `'Apenas tarefas disponíveis podem ser excluídas'` se status for diferente; executar `DELETE FROM tarefas WHERE id = $1`; retornar HTTP 200 com confirmação
  - **Requirements:** 4.3, 4.4, 4.5, 4.6, 4.7


- [x] 12. Rota de assumir tarefa (`app/api/tarefas/[id]/assumir/route.ts`)
  - Implementar handler `POST`: autenticar; verificar papel `Desenvolvedor`
  - Dentro de uma transação PostgreSQL: executar `SELECT * FROM tarefas WHERE id = $1 FOR UPDATE` — retornar HTTP 404 se tarefa não existir
  - Se `status != 'Disponível'`: retornar HTTP 409 `'Tarefa não disponível para ser assumida'`
  - Verificar se usuário já possui tarefa Em Andamento: `SELECT id FROM tarefas WHERE responsavel_id = $1 AND status = 'Em Andamento'` — retornar HTTP 409 `'Usuário já possui uma tarefa em andamento'` se sim
  - Executar `UPDATE tarefas SET status = 'Em Andamento', responsavel_id = $1 WHERE id = $2 RETURNING *`
  - Retornar HTTP 200 com dados atualizados da tarefa
  - **Requirements:** 6.1, 6.2, 6.3, 6.4


- [x] 13. Rota de concluir tarefa (`app/api/tarefas/[id]/concluir/route.ts`)
  - Implementar handler `POST`: autenticar; verificar papel `Desenvolvedor`
  - Buscar tarefa com `SELECT * FROM tarefas WHERE id = $1` — retornar HTTP 404 se não existir
  - Se `responsavel_id != payload.id`: retornar HTTP 403 `'Acesso negado'`
  - Se `status != 'Em Andamento'`: retornar HTTP 409 `'Apenas tarefas em andamento podem ser concluídas'`
  - Executar `UPDATE tarefas SET status = 'Concluída' WHERE id = $1 RETURNING *`
  - Retornar HTTP 200 com dados atualizados da tarefa
  - **Requirements:** 7.1, 7.2, 7.3, 7.4

- [x] 14. Rota de alteração de papel de usuário (`app/api/usuarios/[id]/papel/route.ts`)
  - Implementar handler `PATCH`: autenticar; verificar papel `Chefe`; validar body com `AlterarPapelSchema`
  - Se `params.id == payload.id`: retornar HTTP 403 `'Um usuário não pode alterar o próprio papel'`
  - Executar `UPDATE usuarios SET papel = $1 WHERE id = $2 RETURNING id, email, papel` — retornar HTTP 404 se nenhuma linha for afetada
  - Retornar HTTP 200 com `{ id, email, papel }` do usuário atualizado
  - **Requirements:** 8.1, 8.2, 8.3, 8.4


- [x] 15. Testes unitários das bibliotecas compartilhadas (`__tests__/lib/`)
  - Criar `__tests__/lib/auth.test.ts`: testar round-trip sign→verify; testar que token expirado lança `TokenExpiredError`; testar que token malformado lança `JsonWebTokenError`; testar que `extractBearer` retorna null para header ausente ou formato inválido
  - Criar `__tests__/lib/middleware.test.ts`: testar `requireAuth` retorna HTTP 401 sem token; testar `requirePapel` retorna HTTP 403 com papel errado; testar que papel desconhecido no JWT retorna HTTP 403
  - Criar `__tests__/lib/validations.test.ts`: testar que `RegistroSchema` aceita e-mails válidos e rejeita inválidos; testar limites de senha (7, 8, 128, 129 chars); testar `AtualizarTarefaSchema` rejeita objeto vazio
  - Executar `vitest --run` e garantir que todos os testes passam
  - **Requirements:** 1.3–1.6, 2.4, 2.5, 3.1, 3.2, 3.5


- [x] 16. Testes de propriedade e integração das API Routes (`__tests__/api/`)
  - Criar `__tests__/api/auth.test.ts` com testes PBT usando `fast-check` (`numRuns: 100`):
    - Property 1: e-mail válido + senha [8,128] → HTTP 201, papel = 'Desenvolvedor'
    - Property 2: senha fora de [8,128] → HTTP 422
    - Property 3: e-mail inválido → HTTP 422
    - Property 4: login com credenciais válidas → HTTP 200 com JWT contendo `id` e `papel` corretos
    - Caso de exemplo: e-mail duplicado → HTTP 409
    - Caso de exemplo: login com e-mail inexistente → HTTP 401 `'Credenciais inválidas'`
    - Caso de exemplo: login com senha errada → HTTP 401 `'Credenciais inválidas'`
  - Criar `__tests__/api/tarefas.test.ts` com testes PBT:
    - Property 6: Desenvolvedor em rota de Chefe → HTTP 403
    - Property 7: Chefe cria tarefa válida → HTTP 201, status = 'Disponível'
    - Property 8: título com 0 ou >100 chars → HTTP 422
    - Property 9: PATCH parcial preserva campos não fornecidos
    - Property 10: Desenvolvedor vê apenas tarefas 'Disponível'
    - Property 11: Chefe vê todas as tarefas
    - Property 12: assumir tarefa disponível → status 'Em Andamento', responsavel_id correto
    - Property 13: Desenvolvedor com tarefa Em Andamento não pode assumir outra → HTTP 409
    - Property 14: concluir tarefa própria Em Andamento → HTTP 200, status 'Concluída'
    - Property 15: Chefe altera papel → HTTP 200 com campos corretos
    - Teste de concorrência: dois requests simultâneos de assumir a mesma tarefa → exatamente um HTTP 200 e um HTTP 409
  - Executar `vitest --run` e garantir que todos os testes passam
  - **Requirements:** 1.1–1.7, 2.1–2.5, 3.1–3.5, 4.1–4.8, 5.1–5.3, 6.1–6.4, 7.1–7.4, 8.1–8.4


- [ ] 17. Configuração de deploy na Vercel e Supabase
  - Criar projeto no Supabase (plano gratuito) e executar `supabase/migrations/001_initial.sql` no SQL Editor
  - Copiar a `DATABASE_URL` do Supabase (modo Transaction, porta 6543, ou Session, porta 5432)
  - Gerar `JWT_SECRET` seguro (mínimo 32 chars aleatórios, ex: `openssl rand -base64 32`)
  - Conectar repositório GitHub à Vercel via painel *Add New Project*
  - Configurar variáveis de ambiente na Vercel: `DATABASE_URL` e `JWT_SECRET` em *Project Settings → Environment Variables*
  - Realizar push na branch `main` para disparar o primeiro deploy automático
  - Verificar que o deploy foi bem-sucedido no painel da Vercel e testar as rotas `/api/auth/registro` e `/api/auth/login` em produção
  - **Requirements:** 10.1, 10.2, 10.4, 10.5


## Notes

### Dependências Críticas

- Tarefas 3–7 dependem da tarefa 1 (projeto inicializado e dependências instaladas)
- Tarefas 8–14 dependem das tarefas 4, 5, 6 e 7 (db, auth, middleware e validações prontos)
- Tarefa 12 requer uso de transação PostgreSQL com `SELECT ... FOR UPDATE` para evitar race condition
- Tarefas 15–16 dependem de todas as rotas implementadas (tarefas 8–14)
- Tarefa 17 depende de todos os testes passando (tarefas 15–16)

### Convenções de Código

- Todas as respostas de erro seguem o formato `{ "error": "mensagem" }` ou `{ "error": "mensagem", "details": [...] }` para erros 422
- Queries SQL sempre usam parâmetros posicionais `$1, $2...` — nunca interpolação de strings
- O middleware `requireAuth` e `requirePapel` deve ser chamado no início de cada handler protegido, antes de qualquer acesso ao banco
- Senhas nunca são retornadas em nenhuma resposta da API

### Segurança

- `bcrypt.hash` com custo 10 para registro
- `JWT_SECRET` mínimo 32 chars, nunca versionado
- Mensagens de login genéricas — não revelar e-mail vs. senha incorretos
- RBAC aplicado antes de qualquer lógica de negócio
