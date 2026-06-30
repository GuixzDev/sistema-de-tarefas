# Guia de Deploy — Task Management RBAC
## Vercel (frontend + API) + Supabase (PostgreSQL) — 100% gratuito

---

## Pré-requisitos

- Conta no [GitHub](https://github.com) (gratuita)
- Conta no [Supabase](https://supabase.com) (gratuita)
- Conta na [Vercel](https://vercel.com) (gratuita)
- Node.js 18+ instalado localmente

---

## Passo 1 — Configurar o banco de dados no Supabase

1. Acesse [app.supabase.com](https://app.supabase.com) e clique em **New project**
2. Preencha:
   - **Name:** `task-management-rbac`
   - **Database Password:** escolha uma senha forte (anote — você vai precisar)
   - **Region:** escolha a mais próxima de você
3. Aguarde o projeto ser criado (~2 minutos)
4. No painel do projeto, acesse **SQL Editor** (ícone de banco de dados no menu lateral)
5. Cole o conteúdo completo de `supabase/migrations/001_initial.sql` e clique em **Run**
6. Verifique no **Table Editor** que as tabelas `usuarios` e `tarefas` foram criadas

### Obter a DATABASE_URL

1. Vá em **Project Settings → Database**
2. Role até **Connection string** e selecione a aba **URI**
3. Escolha o modo **Transaction** (porta 6543) para ambiente serverless
4. Copie a string — ela tem o formato:
   ```
   postgresql://postgres:[SEU-PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres
   ```
5. Substitua `[SEU-PASSWORD]` pela senha que você definiu no passo 2

---

## Passo 2 — Gerar o JWT_SECRET

Execute este comando no terminal para gerar um segredo seguro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copie o resultado (algo como `k8J2mN...`). Este é o seu `JWT_SECRET`.

---

## Passo 3 — Preparar o repositório no GitHub

```bash
# Na pasta do projeto
git init
git add .
git commit -m "feat: initial commit — task management RBAC"

# Crie um repositório no GitHub (github.com/new) e depois:
git remote add origin https://github.com/SEU-USUARIO/task-management-rbac.git
git branch -M main
git push -u origin main
```

> **Importante:** O `.gitignore` já protege `.env.local` e `.env`. Nunca versione credenciais.

---

## Passo 4 — Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) e clique em **Add New → Project**
2. Clique em **Import Git Repository** e selecione o repositório criado no passo 3
3. Na tela de configuração:
   - **Framework Preset:** Next.js (detectado automaticamente)
   - **Root Directory:** deixe em branco (raiz do projeto)
   - **Build Command:** `npm run build` (padrão)
   - **Output Directory:** `.next` (padrão)
4. Expanda **Environment Variables** e adicione:

   | Nome | Valor |
   |------|-------|
   | `DATABASE_URL` | a string copiada no Passo 1 |
   | `JWT_SECRET` | o segredo gerado no Passo 2 |

5. Clique em **Deploy**
6. Aguarde o deploy (~2 minutos). Você receberá uma URL como `https://task-management-rbac-xyz.vercel.app`

---

## Passo 5 — Verificar o deploy

Teste as rotas com curl ou qualquer cliente HTTP (Insomnia, Postman, Thunder Client):

```bash
BASE_URL="https://task-management-rbac-xyz.vercel.app"

# 1. Registrar um usuário Chefe (primeiro usuário — altere o papel via SQL no Supabase)
curl -X POST "$BASE_URL/api/auth/registro" \
  -H "Content-Type: application/json" \
  -d '{"email":"chefe@empresa.com","senha":"minhasenha123"}'

# 2. Fazer login
curl -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"chefe@empresa.com","senha":"minhasenha123"}'
# Copie o token retornado

# 3. Criar uma tarefa (com token do Chefe)
curl -X POST "$BASE_URL/api/tarefas" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"Implementar login","prioridade":"Alta"}'
```

### Promover o primeiro usuário a Chefe

Após o primeiro registro, execute no SQL Editor do Supabase:

```sql
UPDATE usuarios
SET papel = 'Chefe'
WHERE email = 'chefe@empresa.com';
```

---

## Passo 6 — Deploy automático (CI/CD)

Após a configuração inicial, **todo push na branch `main`** dispara um novo deploy automaticamente na Vercel. Se o deploy falhar, você receberá um e-mail com o log de erro.

Para outros ambientes (staging, preview):
- Pushes em outras branches criam **Preview Deployments** automáticos na Vercel
- Cada PR recebe sua própria URL de preview

---

## Referência rápida das rotas da API

| Método | Rota | Papel | Descrição |
|--------|------|-------|-----------|
| POST | `/api/auth/registro` | Público | Registra novo usuário |
| POST | `/api/auth/login` | Público | Autentica e retorna JWT |
| GET | `/api/tarefas` | Chefe / Dev | Lista tarefas (filtradas por papel) |
| POST | `/api/tarefas` | Chefe | Cria nova tarefa |
| PATCH | `/api/tarefas/:id` | Chefe | Atualiza campos da tarefa |
| DELETE | `/api/tarefas/:id` | Chefe | Exclui tarefa (somente Disponível) |
| POST | `/api/tarefas/:id/assumir` | Desenvolvedor | Assume tarefa disponível |
| POST | `/api/tarefas/:id/concluir` | Desenvolvedor | Conclui tarefa em andamento |
| PATCH | `/api/usuarios/:id/papel` | Chefe | Altera papel de usuário |

---

## Limites do plano gratuito

| Serviço | Limite gratuito | Suficiente para? |
|---------|----------------|-----------------|
| Vercel | 100GB bandwidth/mês, funções serverless ilimitadas | ✅ MVPs e projetos pequenos |
| Supabase | 500MB DB, 2GB bandwidth, 50.000 MAU | ✅ Validação de produto |

---

## Variáveis de ambiente necessárias

```env
# Obrigatórias em produção (Vercel) e localmente (.env.local)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:6543/postgres
JWT_SECRET=seu-segredo-aleatorio-minimo-32-chars
```
