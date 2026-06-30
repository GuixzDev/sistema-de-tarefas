# Design Document — Task Management RBAC

## Overview

O sistema é uma aplicação web de gerenciamento de tarefas com controle de acesso baseado em papéis (RBAC), construída com **Next.js 14+ (App Router)** hospedado na **Vercel** e banco de dados **PostgreSQL via Supabase**. A autenticação é feita com **JWT customizado** (biblioteca `jsonwebtoken`) e senhas protegidas com **bcrypt**. Não há ORM — todas as queries são SQL puro via a biblioteca `postgres` (npm).

Existem dois papéis: **Chefe** (acesso administrativo total) e **Desenvolvedor** (acesso restrito a visualizar, assumir e concluir tarefas). A API é exposta inteiramente via Next.js API Routes (`app/api/`), aproveitando o modelo serverless da Vercel.

---

## Architecture

### Diagrama de Componentes

```mermaid
graph TD
    Browser["Browser / Cliente HTTP"]

    subgraph Vercel["Vercel (Serverless)"]
        NextApp["Next.js App Router"]
        APIRoutes["API Routes (app/api/)"]
        AuthModule["lib/auth.ts (JWT sign/verify)"]
        RBACMiddleware["lib/middleware.ts (RBAC)"]
        Validations["lib/validations.ts (Zod schemas)"]
        DBClient["lib/db.ts (postgres client)"]
    end

    subgraph Supabase["Supabase (PostgreSQL)"]
        DB["PostgreSQL Database"]
        Tables["usuarios + tarefas"]
        Trigger["Trigger: update atualizado_em"]
    end

    Browser -->|"HTTPS requests"| NextApp
    NextApp --> APIRoutes
    APIRoutes --> AuthModule
    APIRoutes --> RBACMiddleware
    APIRoutes --> Validations
    APIRoutes --> DBClient
    DBClient -->|"SQL puro (DATABASE_URL)"| DB
    DB --> Tables
    Tables --> Trigger
```

### Fluxo de Requisição

Toda requisição a uma rota protegida passa pelas seguintes camadas em ordem:

1. **Zod validation** — valida o body/params da requisição
2. **JWT verification** — extrai e verifica o token do header `Authorization: Bearer <token>`
3. **RBAC check** — verifica se o `papel` do token tem permissão para a operação
4. **Business logic** — executa a query SQL e retorna a resposta

```mermaid
sequenceDiagram
    participant C as Cliente
    participant A as API Route
    participant V as Validações (Zod)
    participant M as RBAC Middleware
    participant DB as PostgreSQL

    C->>A: HTTP Request + JWT
    A->>V: Valida body/params
    V-->>A: OK ou 422
    A->>M: Verifica JWT + papel
    M-->>A: OK ou 401/403
    A->>DB: Query SQL
    DB-->>A: Resultado
    A-->>C: HTTP Response
```

---

## Components and Interfaces

### `lib/db.ts` — Conexão com PostgreSQL

```typescript
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  max: 10,
});

export default sql;
```

Exporta uma instância única do cliente `postgres` reutilizada em todas as API Routes. A string de conexão vem da variável de ambiente `DATABASE_URL`.

---

### `lib/auth.ts` — JWT Sign / Verify

```typescript
export interface JWTPayload {
  id: string;
  papel: 'Chefe' | 'Desenvolvedor';
  iat?: number;
  exp?: number;
}

// sign: gera token com expiração de 8 horas
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string

// verify: valida e decodifica token; lança erro se inválido/expirado
export function verifyToken(token: string): JWTPayload

// extractBearer: extrai token do header Authorization
export function extractBearer(authHeader: string | null): string | null
```

- `signToken` usa `jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })`
- `verifyToken` usa `jwt.verify(token, JWT_SECRET)` — lança `TokenExpiredError` ou `JsonWebTokenError`
- Erros são mapeados para HTTP 401 nas API Routes

---

### `lib/middleware.ts` — RBAC Helper

```typescript
export type Papel = 'Chefe' | 'Desenvolvedor';

// requireAuth: verifica JWT e retorna o payload; retorna Response 401 se inválido
export function requireAuth(request: Request): JWTPayload | Response

// requirePapel: garante que o usuário tem um dos papéis exigidos
export function requirePapel(
  payload: JWTPayload,
  papeis: Papel[]
): Response | null  // null = autorizado, Response = 403
```

Uso padrão em uma API Route:

```typescript
export async function POST(request: Request) {
  const authResult = requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const accessResult = requirePapel(authResult, ['Chefe']);
  if (accessResult) return accessResult;

  // lógica de negócio...
}
```

---

### `lib/validations.ts` — Schemas Zod

```typescript
export const RegistroSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(8).max(128),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export const CriarTarefaSchema = z.object({
  titulo: z.string().min(1).max(100),
  descricao: z.string().optional(),
  prioridade: z.enum(['Baixa', 'Média', 'Alta']),
});

export const AtualizarTarefaSchema = z.object({
  titulo: z.string().min(1).max(100).optional(),
  descricao: z.string().optional(),
  prioridade: z.enum(['Baixa', 'Média', 'Alta']).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'Pelo menos um campo deve ser fornecido para atualização.',
});

export const AlterarPapelSchema = z.object({
  papel: z.enum(['Chefe', 'Desenvolvedor']),
});
```

Erros de validação Zod são formatados e retornados como HTTP 422 com os detalhes do erro.

---

### API Routes — Interfaces

| Método | Rota | Papel exigido | Descrição |
|--------|------|---------------|-----------|
| `POST` | `/api/auth/registro` | — (público) | Registra novo usuário |
| `POST` | `/api/auth/login` | — (público) | Autentica e retorna JWT |
| `GET` | `/api/tarefas` | Chefe ou Desenvolvedor | Lista tarefas (filtradas por papel) |
| `POST` | `/api/tarefas` | Chefe | Cria nova tarefa |
| `PATCH` | `/api/tarefas/[id]` | Chefe | Atualiza campos da tarefa |
| `DELETE` | `/api/tarefas/[id]` | Chefe | Exclui tarefa (somente Disponível) |
| `POST` | `/api/tarefas/[id]/assumir` | Desenvolvedor | Assume tarefa disponível |
| `POST` | `/api/tarefas/[id]/concluir` | Desenvolvedor | Conclui tarefa em andamento |
| `PATCH` | `/api/usuarios/[id]/papel` | Chefe | Altera papel de usuário |

---

## Data Models

### Enums PostgreSQL

```sql
CREATE TYPE papel_enum AS ENUM ('Chefe', 'Desenvolvedor');
CREATE TYPE prioridade_enum AS ENUM ('Baixa', 'Média', 'Alta');
CREATE TYPE status_enum AS ENUM ('Disponível', 'Em Andamento', 'Concluída');
```

### Tabela `usuarios`

```sql
CREATE TABLE usuarios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  senha_hash  TEXT        NOT NULL,
  papel       papel_enum  NOT NULL DEFAULT 'Desenvolvedor',
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabela `tarefas`

```sql
CREATE TABLE tarefas (
  id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         TEXT            NOT NULL,
  descricao      TEXT,
  prioridade     prioridade_enum NOT NULL,
  status         status_enum     NOT NULL DEFAULT 'Disponível',
  responsavel_id UUID            REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ     NOT NULL DEFAULT now()
);
```

### Trigger — `atualizado_em`

```sql
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tarefas_atualizado_em
BEFORE UPDATE ON tarefas
FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
```

### Tipos TypeScript correspondentes

```typescript
export interface Usuario {
  id: string;
  email: string;
  senha_hash: string;
  papel: 'Chefe' | 'Desenvolvedor';
  criado_em: Date;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: 'Baixa' | 'Média' | 'Alta';
  status: 'Disponível' | 'Em Andamento' | 'Concluída';
  responsavel_id: string | null;
  criado_em: Date;
  atualizado_em: Date;
}
```

### Migration file

O arquivo `supabase/migrations/001_initial.sql` contém todas as instruções DDL acima em ordem: enums → tabela usuarios → tabela tarefas → função trigger → trigger.

---

## Estrutura de Arquivos do Projeto

```
/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── registro/
│   │   │   │   └── route.ts         # POST /api/auth/registro
│   │   │   └── login/
│   │   │       └── route.ts         # POST /api/auth/login
│   │   ├── tarefas/
│   │   │   ├── route.ts             # GET /api/tarefas, POST /api/tarefas
│   │   │   └── [id]/
│   │   │       ├── route.ts         # PATCH /api/tarefas/[id], DELETE /api/tarefas/[id]
│   │   │       ├── assumir/
│   │   │       │   └── route.ts     # POST /api/tarefas/[id]/assumir
│   │   │       └── concluir/
│   │   │           └── route.ts     # POST /api/tarefas/[id]/concluir
│   │   └── usuarios/
│   │       └── [id]/
│   │           └── papel/
│   │               └── route.ts     # PATCH /api/usuarios/[id]/papel
│   ├── layout.tsx
│   └── page.tsx                     # Frontend (páginas)
├── lib/
│   ├── db.ts                        # Conexão PostgreSQL (postgres client)
│   ├── auth.ts                      # signToken, verifyToken, extractBearer
│   ├── middleware.ts                 # requireAuth, requirePapel
│   └── validations.ts               # Schemas Zod
├── types/
│   └── index.ts                     # Interfaces TypeScript (Usuario, Tarefa, JWTPayload)
├── supabase/
│   └── migrations/
│       └── 001_initial.sql          # DDL completo
├── .env.local.example               # Modelo de variáveis de ambiente
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Fluxos Principais

### Fluxo 1 — Login e Emissão de JWT

```mermaid
sequenceDiagram
    participant C as Cliente
    participant R as POST /api/auth/login
    participant V as Zod (LoginSchema)
    participant DB as PostgreSQL

    C->>R: { email, senha }
    R->>V: Valida campos
    V-->>R: OK ou 422
    R->>DB: SELECT * FROM usuarios WHERE email = $1
    DB-->>R: Row ou null
    alt E-mail não encontrado
        R-->>C: 401 "Credenciais inválidas"
    else E-mail encontrado
        R->>R: bcrypt.compare(senha, senha_hash)
        alt Senha incorreta
            R-->>C: 401 "Credenciais inválidas"
        else Senha correta
            R->>R: signToken({ id, papel })
            R-->>C: 200 { token: "eyJ..." }
        end
    end
```

**Nota de segurança:** Tanto e-mail inválido quanto senha incorreta retornam a mesma mensagem genérica "Credenciais inválidas" para não vazar qual campo está errado.

---

### Fluxo 2 — Desenvolvedor Assume Tarefa (com controle de concorrência)

```mermaid
sequenceDiagram
    participant C as Desenvolvedor
    participant R as POST /api/tarefas/[id]/assumir
    participant M as RBAC Middleware
    participant DB as PostgreSQL

    C->>R: Bearer <token>
    R->>M: requireAuth + requirePapel(['Desenvolvedor'])
    M-->>R: JWTPayload { id, papel }
    R->>DB: SELECT * FROM tarefas WHERE id = $1 FOR UPDATE
    DB-->>R: Tarefa ou null
    alt Tarefa não existe
        R-->>C: 404
    else Status ≠ Disponível
        R-->>C: 409 "Tarefa não disponível"
    else
        R->>DB: SELECT id FROM tarefas WHERE responsavel_id = $1 AND status = 'Em Andamento'
        DB-->>R: Row ou null
        alt Já possui tarefa Em Andamento
            R-->>C: 409 "Usuário já possui tarefa em andamento"
        else
            R->>DB: UPDATE tarefas SET status='Em Andamento', responsavel_id=$1 WHERE id=$2
            DB-->>R: Tarefa atualizada
            R-->>C: 200 { tarefa }
        end
    end
```

**Nota de concorrência:** O `SELECT ... FOR UPDATE` garante que duas requisições simultâneas para a mesma tarefa não resultem em dupla atribuição. O PostgreSQL serializa o acesso à linha.

---

### Fluxo 3 — Chefe Cria Tarefa

```mermaid
sequenceDiagram
    participant C as Chefe
    participant R as POST /api/tarefas
    participant V as Zod (CriarTarefaSchema)
    participant M as RBAC Middleware
    participant DB as PostgreSQL

    C->>R: Bearer <token> + { titulo, descricao?, prioridade }
    R->>V: Valida body
    V-->>R: OK ou 422
    R->>M: requireAuth + requirePapel(['Chefe'])
    M-->>R: JWTPayload { id, papel:'Chefe' }
    R->>DB: INSERT INTO tarefas (titulo, descricao, prioridade) VALUES ($1,$2,$3) RETURNING *
    DB-->>R: Nova tarefa
    R-->>C: 201 { tarefa }
```

---

## Variáveis de Ambiente

Arquivo `.env.local.example`:

```env
# String de conexão com o PostgreSQL do Supabase
# Formato: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
DATABASE_URL=postgresql://postgres:senha@host:5432/postgres

# Segredo para assinatura dos tokens JWT
# Use uma string aleatória longa e complexa (mínimo 32 caracteres)
JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio
```

**Regras:**
- `.env.local` está no `.gitignore` — **nunca versionar**
- Na Vercel, configurar as variáveis no painel *Project Settings → Environment Variables*
- `DATABASE_URL` deve usar a connection string do modo **Transaction** ou **Session** do Supabase (porta 5432 ou 6543)

---

## Error Handling

### Mapeamento de Erros HTTP

| Situação | HTTP | Mensagem |
|----------|------|----------|
| Validação Zod falhou | 422 | Detalhes dos campos inválidos |
| Token ausente | 401 | "Token não fornecido" |
| Token expirado | 401 | "Token expirado" |
| Token inválido/malformado | 401 | "Token inválido" |
| Papel sem permissão | 403 | "Acesso negado" |
| Recurso não encontrado | 404 | "Não encontrado" |
| Conflito de estado | 409 | Mensagem específica ao contexto |
| E-mail já cadastrado | 409 | "E-mail já cadastrado" |
| Credenciais incorretas | 401 | "Credenciais inválidas" (genérico) |
| Erro interno | 500 | "Erro interno do servidor" |

### Padrão de Resposta de Erro

```typescript
// Todas as respostas de erro seguem este formato:
{
  "error": "Mensagem de erro legível",
  "details"?: [...]  // apenas para erros 422 (Zod)
}
```

### Princípios de Segurança

- **bcrypt cost factor 10**: `bcrypt.hash(senha, 10)` — equilíbrio entre segurança e latência serverless
- **JWT expiry 8h**: `jwt.sign(payload, secret, { expiresIn: '8h' })`
- **Mensagens genéricas no login**: não revelar qual campo está incorreto
- **RBAC antes da lógica**: middleware de papel é aplicado antes de qualquer acesso ao DB
- **SQL parametrizado**: uso exclusivo de queries com parâmetros `$1, $2...` via `postgres` lib — imune a SQL injection
- **Sem ORM**: queries explícitas dão controle total e visibilidade sobre o que é executado

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Registro com dados válidos cria usuário como Desenvolvedor

*Para qualquer* e-mail com formato válido e senha com comprimento entre 8 e 128 caracteres, o endpoint de registro SHALL retornar HTTP 201 e o usuário criado SHALL ter o papel `Desenvolvedor`.

**Validates: Requirements 1.1**

---

### Property 2: Senhas fora do intervalo [8, 128] são rejeitadas

*Para qualquer* string de senha com comprimento menor que 8 ou maior que 128 caracteres, o endpoint de registro SHALL retornar HTTP 422.

**Validates: Requirements 1.3, 1.4**

---

### Property 3: E-mails com formato inválido são rejeitados

*Para qualquer* string que não constitua um endereço de e-mail válido (sem `@`, sem domínio, etc.), o endpoint de registro SHALL retornar HTTP 422.

**Validates: Requirements 1.5**

---

### Property 4: Login com credenciais válidas emite JWT com campos corretos

*Para qualquer* usuário cadastrado com qualquer papel (`Chefe` ou `Desenvolvedor`), o login com as credenciais corretas SHALL retornar HTTP 200 com um JWT que, ao ser decodificado, contenha os campos `id` e `papel` correspondentes ao usuário, com expiração aproximada de 8 horas a partir do momento da emissão.

**Validates: Requirements 2.1**

---

### Property 5: JWT válido autentica sem novo login (round-trip)

*Para qualquer* usuário autenticado, usar o JWT emitido no login em uma requisição subsequente a rota protegida SHALL resultar em autenticação bem-sucedida sem exigir novo login, desde que o token não esteja expirado.

**Validates: Requirements 2.3**

---

### Property 6: Desenvolvedor não pode executar operações de Chefe

*Para qualquer* usuário com papel `Desenvolvedor`, tentar executar qualquer operação exclusiva de `Chefe` (criar tarefa, editar tarefa, excluir tarefa, alterar papel de usuário) SHALL retornar HTTP 403 com mensagem "Acesso negado".

**Validates: Requirements 3.2, 3.4**

---

### Property 7: Criação de tarefa válida resulta em status Disponível

*Para qualquer* título com comprimento entre 1 e 100 caracteres e qualquer valor de prioridade válido (`Baixa`, `Média`, `Alta`), um usuário `Chefe` criando uma tarefa SHALL receber HTTP 201 e a tarefa criada SHALL ter `status = 'Disponível'`.

**Validates: Requirements 4.1**

---

### Property 8: Títulos inválidos são rejeitados na criação e atualização

*Para qualquer* string de título com comprimento 0 (vazio) ou maior que 100 caracteres, os endpoints de criação e atualização de tarefa SHALL retornar HTTP 422.

**Validates: Requirements 4.2, 4.4**

---

### Property 9: Atualização parcial preserva campos não fornecidos

*Para qualquer* tarefa existente e qualquer subconjunto não-vazio dos campos atualizáveis (`titulo`, `descricao`, `prioridade`), um PATCH SHALL atualizar apenas os campos fornecidos e manter os demais inalterados.

**Validates: Requirements 4.3**

---

### Property 10: Desenvolvedor vê apenas tarefas Disponível

*Para qualquer* estado do banco com tarefas de status variado (`Disponível`, `Em Andamento`, `Concluída`), a listagem retornada a um `Desenvolvedor` SHALL conter exclusivamente tarefas com `status = 'Disponível'`.

**Validates: Requirements 5.1, 5.2**

---

### Property 11: Chefe vê todas as tarefas independente do status

*Para qualquer* estado do banco com tarefas de status variado, a listagem retornada a um `Chefe` SHALL conter todas as tarefas, sem filtro de status.

**Validates: Requirements 5.3**

---

### Property 12: Assumir tarefa disponível muda status e registra responsável

*Para qualquer* tarefa com `status = 'Disponível'` e qualquer `Desenvolvedor` que não possua outra tarefa `Em Andamento`, assumir a tarefa SHALL atualizar `status` para `Em Andamento` e definir `responsavel_id` como o `id` do usuário autenticado.

**Validates: Requirements 6.1**

---

### Property 13: Desenvolvedor com tarefa em andamento não pode assumir outra

*Para qualquer* `Desenvolvedor` que já seja `responsavel_id` de uma tarefa com `status = 'Em Andamento'`, tentar assumir qualquer outra tarefa SHALL retornar HTTP 409.

**Validates: Requirements 6.3**

---

### Property 14: Concluir tarefa própria em andamento muda status para Concluída

*Para qualquer* tarefa com `status = 'Em Andamento'` onde o `responsavel_id` corresponde ao `id` do `Desenvolvedor` autenticado, concluir a tarefa SHALL atualizar `status` para `Concluída` e retornar HTTP 200.

**Validates: Requirements 7.1**

---

### Property 15: Alteração de papel persiste corretamente

*Para qualquer* usuário alvo (diferente do usuário autenticado) e qualquer valor de papel válido (`Chefe`, `Desenvolvedor`), um `Chefe` alterando o papel SHALL retornar HTTP 200 com o papel atualizado refletido nos campos `id`, `email` e `papel` da resposta.

**Validates: Requirements 8.1**

---

### Property 16: Trigger atualiza `atualizado_em` em qualquer UPDATE

*Para qualquer* tarefa e qualquer operação UPDATE sobre ela, o campo `atualizado_em` SHALL ser maior que seu valor anterior após a operação.

**Validates: Requirements 9.2**

---

### Property 17: Exclusão de usuário torna `responsavel_id` nulo nas tarefas

*Para qualquer* tarefa com `responsavel_id` não-nulo apontando para um usuário, ao excluir esse usuário do banco, o campo `responsavel_id` da tarefa SHALL se tornar `NULL` (comportamento ON DELETE SET NULL).

**Validates: Requirements 9.3**

---

## Testing Strategy

### Abordagem Dual

A estratégia combina:
- **Testes unitários/de integração baseados em exemplos**: cobrem comportamentos específicos, casos de borda e condições de erro
- **Testes baseados em propriedades (PBT)**: validam invariantes universais com entradas geradas aleatoriamente

### Biblioteca PBT

Usar **[fast-check](https://github.com/dubzzz/fast-check)** (TypeScript/JavaScript), configurado com **mínimo de 100 iterações** por propriedade.

```typescript
import fc from 'fast-check';

// Exemplo de teste de propriedade
test('Property 2: senhas fora do intervalo são rejeitadas', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(
        fc.string({ maxLength: 7 }),          // senha < 8 chars
        fc.string({ minLength: 129 })          // senha > 128 chars
      ),
      async (senha) => {
        const res = await POST('/api/auth/registro', { email: 'test@example.com', senha });
        expect(res.status).toBe(422);
      }
    ),
    { numRuns: 100 }
  );
});
// Feature: task-management-rbac, Property 2: senhas fora do intervalo [8, 128] são rejeitadas
```

### Configuração de Testes

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

Framework: **Vitest** (integração natural com Next.js/TypeScript). Executar com `vitest --run` para execução única (sem watch mode).

### Cobertura por Camada

**Testes Unitários** (`lib/`):
- `auth.ts`: sign/verify round-trip, comportamento com token expirado, token malformado
- `middleware.ts`: requireAuth retorna 401 sem token; requirePapel retorna 403 com papel errado
- `validations.ts`: schemas Zod aceitam entradas válidas e rejeitam inválidas

**Testes de Propriedade** (API Routes com DB em memória ou test DB):
- Cada propriedade listada na seção "Correctness Properties" recebe um teste PBT com `numRuns: 100`
- Queries SQL testadas contra um banco de teste isolado (container PostgreSQL local ou Supabase test project)
- Tag de rastreabilidade em cada teste: `// Feature: task-management-rbac, Property N: <texto>`

**Testes de Exemplo** (casos específicos):
- Registro com e-mail duplicado → 409
- Login com e-mail inexistente → 401 genérico
- Login com senha errada → 401 genérico (mesma mensagem)
- Token expirado → 401
- Token com assinatura inválida → 401
- Papel desconhecido no JWT → 403
- Chefe exclui tarefa Em Andamento → 409
- Desenvolvedor conclui tarefa de outro → 403
- Chefe altera próprio papel → 403
- Atualização/exclusão de tarefa inexistente → 404

**Smoke Tests** (verificação de infraestrutura):
- Schema do banco: tabelas e enums existem com as colunas corretas
- Hash bcrypt armazenado começa com `$2b$10$`
- Variáveis de ambiente `DATABASE_URL` e `JWT_SECRET` estão definidas

### Testes de Concorrência

A propriedade de "um desenvolvedor, uma tarefa em andamento" (Property 13) requer teste de race condition:

```typescript
test('dois requests simultâneos de assumir a mesma tarefa — apenas um deve ter sucesso', async () => {
  // Envia dois POSTs simultâneos para /api/tarefas/[id]/assumir
  const [r1, r2] = await Promise.all([
    assumirTarefa(tarefaId, devToken1),
    assumirTarefa(tarefaId, devToken2),
  ]);
  const statuses = [r1.status, r2.status].sort();
  expect(statuses).toEqual([200, 409]); // exatamente um sucesso
});
```

Isso é garantido pelo `SELECT ... FOR UPDATE` no handler de assumir.
