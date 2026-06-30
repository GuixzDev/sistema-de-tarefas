# Requirements Document

## Introduction

Sistema de Gerenciamento de Tarefas com Controle de Acesso Baseado em Papéis (RBAC), hospedado inteiramente em plataformas free-tier. O sistema permite que usuários autenticados gerenciem tarefas de acordo com seu papel: **Chefe** (administrador) possui controle total sobre tarefas e usuários, enquanto **Desenvolvedor** (executor) pode visualizar e assumir tarefas disponíveis. A autenticação é realizada via e-mail e senha com tokens JWT ou Supabase Auth.

---

## Glossary

- **Sistema**: A aplicação web de gerenciamento de tarefas descrita neste documento.
- **Auth_Service**: Componente responsável por autenticação, emissão e validação de tokens JWT.
- **RBAC_Middleware**: Componente que intercepta requisições e verifica se o papel do usuário autenticado possui permissão para a operação solicitada.
- **Task_Service**: Componente responsável pelas operações de criação, leitura, atualização e exclusão de tarefas.
- **User_Service**: Componente responsável pelo gerenciamento de dados e papéis de usuários.
- **Chefe**: Papel de usuário com permissões administrativas completas sobre tarefas e usuários.
- **Desenvolvedor**: Papel de usuário com permissões restritas a visualizar, assumir e concluir tarefas.
- **Tarefa**: Unidade de trabalho com campos: id, título, descrição, prioridade, status e id do responsável.
- **Status_Tarefa**: Estado atual de uma tarefa. Valores possíveis: `Disponível`, `Em Andamento`, `Concluída`.
- **Prioridade_Tarefa**: Nível de urgência de uma tarefa. Valores possíveis: `Baixa`, `Média`, `Alta`.
- **Token_JWT**: Token de acesso assinado com duração definida, emitido após autenticação bem-sucedida.
- **Free-Tier**: Hospedagem em plataformas que oferecem plano gratuito sem custo monetário (Vercel, Render, Supabase, Neon).

---

## Requirements

---

### Requisito 1: Registro de Usuário

**User Story:** Como visitante, quero criar uma conta com e-mail e senha, para que eu possa acessar o sistema de gerenciamento de tarefas.

#### Critérios de Aceite

1. WHEN um visitante submete um e-mail com formato válido e uma senha entre 8 e 128 caracteres, THE Auth_Service SHALL criar um novo usuário com o papel `Desenvolvedor` e retornar HTTP 201 com os campos `id` e `email` do usuário criado.
2. IF o e-mail submetido já estiver cadastrado no sistema, THEN THE Auth_Service SHALL retornar HTTP 409 com uma mensagem de erro indicando conflito de e-mail.
3. IF a senha submetida tiver menos de 8 caracteres, THEN THE Auth_Service SHALL retornar HTTP 422 com uma mensagem indicando o requisito mínimo de 8 caracteres.
4. IF a senha submetida tiver mais de 128 caracteres, THEN THE Auth_Service SHALL retornar HTTP 422 com uma mensagem indicando o limite máximo de 128 caracteres.
5. IF o formato do e-mail submetido for inválido, THEN THE Auth_Service SHALL retornar HTTP 422 com uma mensagem de erro de validação de formato.
6. IF o campo e-mail ou o campo senha estiver ausente ou vazio na requisição, THEN THE Auth_Service SHALL retornar HTTP 422 indicando qual campo está ausente.
7. THE Auth_Service SHALL armazenar senhas exclusivamente na forma de hash bcrypt com fator de custo mínimo 10, nunca em texto simples.

---

### Requisito 2: Autenticação de Usuário

**User Story:** Como usuário cadastrado, quero fazer login com e-mail e senha, para que eu possa acessar as funcionalidades correspondentes ao meu papel.

#### Critérios de Aceite

1. WHEN um usuário submete credenciais válidas (e-mail cadastrado e senha correta), THE Auth_Service SHALL emitir um Token_JWT com validade de 8 horas contendo os campos `id` e `papel` do usuário, e retornar HTTP 200 com o token no corpo da resposta.
2. IF o e-mail submetido não estiver cadastrado ou a senha não corresponder ao hash armazenado, THEN THE Auth_Service SHALL retornar HTTP 401 com uma mensagem genérica "Credenciais inválidas", sem revelar qual campo está incorreto.
3. WHILE um Token_JWT válido e não expirado estiver presente no header `Authorization: Bearer <token>` da requisição, THE Auth_Service SHALL autenticar o usuário e retornar os dados solicitados sem exigir novo login.
4. IF um Token_JWT expirado for enviado em uma requisição, THEN THE Auth_Service SHALL retornar HTTP 401 com mensagem indicando que o token expirou.
5. IF um Token_JWT com assinatura inválida ou malformado for enviado em uma requisição, THEN THE Auth_Service SHALL retornar HTTP 401 com mensagem indicando que o token é inválido.

---

### Requisito 3: Controle de Acesso Baseado em Papéis (RBAC)

**User Story:** Como sistema, quero verificar o papel do usuário antes de cada operação privilegiada, para que apenas usuários autorizados executem ações restritas.

#### Critérios de Aceite

1. WHEN uma requisição for recebida em uma rota protegida, THE RBAC_Middleware SHALL verificar o campo `papel` contido no Token_JWT antes de encaminhar a requisição ao serviço de destino.
2. IF o papel do usuário autenticado não possuir permissão para a operação solicitada, THEN THE RBAC_Middleware SHALL retornar HTTP 403 com mensagem "Acesso negado" sem executar a operação.
3. THE RBAC_Middleware SHALL conceder ao papel `Chefe` permissão para criar, editar e excluir tarefas, listar todas as tarefas independentemente de status, e alterar o papel de outros usuários.
4. THE RBAC_Middleware SHALL conceder ao papel `Desenvolvedor` permissão exclusivamente para listar tarefas com Status_Tarefa `Disponível`, assumir uma tarefa e marcar uma tarefa como concluída.
5. IF o Token_JWT contiver um valor de papel não reconhecido (diferente de `Chefe` ou `Desenvolvedor`), THEN THE RBAC_Middleware SHALL retornar HTTP 403 com mensagem "Acesso negado" sem executar a operação.

---

### Requisito 4: Gerenciamento de Tarefas pelo Chefe

**User Story:** Como Chefe, quero criar, editar e excluir tarefas com prioridades definidas, para que a equipe tenha clareza sobre o trabalho a ser realizado e sua urgência.

#### Critérios de Aceite

1. WHEN um usuário com papel `Chefe` submete um título com 1 a 100 caracteres, descrição opcional e Prioridade_Tarefa válida, THE Task_Service SHALL criar uma nova Tarefa com Status_Tarefa `Disponível` e retornar HTTP 201 com os dados completos da tarefa criada.
2. IF o título submetido para criação estiver vazio ou exceder 100 caracteres, THEN THE Task_Service SHALL retornar HTTP 422 com mensagem indicando que o título deve ter entre 1 e 100 caracteres.
3. WHEN um usuário com papel `Chefe` submete dados de atualização para uma tarefa existente, THE Task_Service SHALL atualizar apenas os campos fornecidos (atualização parcial) e retornar HTTP 200 com os dados atualizados da tarefa.
4. IF os dados de atualização contiverem título vazio, título com mais de 100 caracteres ou Prioridade_Tarefa inválida, THEN THE Task_Service SHALL retornar HTTP 422 com mensagem descrevendo a violação de validação.
5. WHEN um usuário com papel `Chefe` solicita a exclusão de uma tarefa com Status_Tarefa `Disponível`, THE Task_Service SHALL remover a tarefa e retornar HTTP 200 com confirmação de exclusão.
6. IF um usuário com papel `Chefe` tentar excluir uma tarefa com Status_Tarefa `Em Andamento` ou `Concluída`, THEN THE Task_Service SHALL retornar HTTP 409 com mensagem indicando que apenas tarefas disponíveis podem ser excluídas.
7. IF a tarefa alvo de atualização ou exclusão não existir, THEN THE Task_Service SHALL retornar HTTP 404.
8. IF a Prioridade_Tarefa submetida para criação não for `Baixa`, `Média` ou `Alta`, THEN THE Task_Service SHALL retornar HTTP 422 com mensagem listando os valores aceitos.

---

### Requisito 5: Visualização de Tarefas pelo Desenvolvedor

**User Story:** Como Desenvolvedor, quero visualizar as tarefas disponíveis, para que eu possa escolher qual tarefa assumir.

#### Critérios de Aceite

1. WHEN um usuário com papel `Desenvolvedor` solicita a listagem de tarefas, THE Task_Service SHALL retornar HTTP 200 com array contendo todas as tarefas com Status_Tarefa `Disponível`, ou array vazio se não houver tarefas disponíveis.
2. THE Task_Service SHALL incluir nos dados de cada tarefa listada: `id`, `titulo`, `descricao`, `prioridade` e `status`.
3. WHEN um usuário com papel `Chefe` solicita a listagem de tarefas, THE Task_Service SHALL retornar HTTP 200 com todas as tarefas independentemente do Status_Tarefa.

---

### Requisito 6: Assumir uma Tarefa (Desenvolvedor)

**User Story:** Como Desenvolvedor, quero assumir uma tarefa disponível, para que eu possa iniciar o trabalho e sinalizar ao time que a tarefa está em progresso.

#### Critérios de Aceite

1. WHEN um usuário com papel `Desenvolvedor` solicita assumir uma tarefa com Status_Tarefa `Disponível`, THE Task_Service SHALL atualizar o Status_Tarefa para `Em Andamento`, registrar o `id` do usuário autenticado como `responsavel_id` da tarefa, e retornar HTTP 200 com os dados atualizados da tarefa.
2. IF a tarefa solicitada não possuir Status_Tarefa `Disponível`, THEN THE Task_Service SHALL retornar HTTP 409 com mensagem informando que a tarefa não está disponível para ser assumida.
3. IF o usuário autenticado já for responsável por outra tarefa com Status_Tarefa `Em Andamento`, THEN THE Task_Service SHALL retornar HTTP 409 com mensagem informando que o usuário já possui uma tarefa em andamento.
4. IF a tarefa solicitada não existir, THEN THE Task_Service SHALL retornar HTTP 404.

---

### Requisito 7: Conclusão de Tarefa (Desenvolvedor)

**User Story:** Como Desenvolvedor, quero marcar minha tarefa em andamento como concluída, para que o time saiba que o trabalho foi finalizado.

#### Critérios de Aceite

1. WHEN um usuário com papel `Desenvolvedor` solicita concluir uma tarefa da qual é responsável e cujo status é `Em Andamento`, THE Task_Service SHALL atualizar o Status_Tarefa para `Concluída` e retornar HTTP 200 com os dados atualizados da tarefa.
2. IF o usuário autenticado não for o `responsavel_id` registrado na tarefa, THEN THE Task_Service SHALL retornar HTTP 403 com mensagem "Acesso negado".
3. IF a tarefa solicitada não possuir Status_Tarefa `Em Andamento`, THEN THE Task_Service SHALL retornar HTTP 409 com mensagem informando que apenas tarefas em andamento podem ser concluídas.
4. IF a tarefa solicitada não existir, THEN THE Task_Service SHALL retornar HTTP 404.

---

### Requisito 8: Gerenciamento de Papéis pelo Chefe

**User Story:** Como Chefe, quero alterar o papel de outros usuários, para que eu possa promover Desenvolvedores a Chefe ou rebaixar Chefes a Desenvolvedor conforme necessário.

#### Critérios de Aceite

1. WHEN um usuário com papel `Chefe` submete um `id` de usuário existente e um novo papel válido, THE User_Service SHALL atualizar o papel do usuário alvo e retornar HTTP 200 com os campos `id`, `email` e `papel` do usuário atualizado, mesmo que o usuário alvo já possua o papel solicitado.
2. IF o `id` do usuário alvo não existir no sistema, THEN THE User_Service SHALL retornar HTTP 404.
3. IF o novo papel submetido não for `Chefe` ou `Desenvolvedor`, THEN THE User_Service SHALL retornar HTTP 422 com mensagem de validação listando os valores aceitos: `Chefe`, `Desenvolvedor`.
4. IF o `id` do usuário alvo for igual ao `id` do usuário autenticado, THEN THE User_Service SHALL retornar HTTP 403 com mensagem informando que um usuário não pode alterar o próprio papel.

---

### Requisito 9: Modelagem do Banco de Dados

**User Story:** Como desenvolvedor do sistema, quero um esquema de banco de dados relacional bem definido, para que os dados de usuários e tarefas sejam armazenados de forma consistente e íntegra.

#### Critérios de Aceite

1. THE Sistema SHALL manter uma tabela `usuarios` com os campos: `id` (UUID, chave primária, gerado automaticamente), `email` (texto, único, não nulo), `senha_hash` (texto, não nulo), `papel` (enum: `Chefe`, `Desenvolvedor`, não nulo, padrão `Desenvolvedor`), `criado_em` (timestamptz, não nulo, padrão `now()`).
2. THE Sistema SHALL manter uma tabela `tarefas` com os campos: `id` (UUID, chave primária, gerado automaticamente), `titulo` (texto, não nulo), `descricao` (texto, anulável), `prioridade` (enum: `Baixa`, `Média`, `Alta`, não nulo), `status` (enum: `Disponível`, `Em Andamento`, `Concluída`, não nulo, padrão `Disponível`), `responsavel_id` (UUID, anulável), `criado_em` (timestamptz, não nulo, padrão `now()`), `atualizado_em` (timestamptz, não nulo, padrão `now()`); o campo `atualizado_em` SHALL ser atualizado automaticamente para `now()` em cada operação UPDATE na tabela.
3. THE Sistema SHALL garantir integridade referencial entre `tarefas.responsavel_id` e `usuarios.id` por meio de restrição de chave estrangeira com comportamento `ON DELETE SET NULL`, de modo que a exclusão de um usuário torne o campo `responsavel_id` nulo nas tarefas associadas.

---

### Requisito 10: Hospedagem Free-Tier e Deploy

**User Story:** Como proprietário do produto, quero que o sistema rode completamente sem custo monetário, para que eu possa validar o produto antes de qualquer investimento em infraestrutura.

#### Critérios de Aceite

1. THE Sistema SHALL ser implantado utilizando exclusivamente planos gratuitos das plataformas de hospedagem.
2. WHERE a arquitetura for full-stack integrada (Opção A), THE Sistema SHALL utilizar Next.js implantado na Vercel e banco de dados Supabase ou Neon no plano gratuito.
3. WHERE a arquitetura for separada front-end/back-end (Opção B), THE Sistema SHALL utilizar front-end React/Next.js implantado na Vercel ou Netlify, back-end Node.js implantado no Render (plano gratuito) e banco de dados Neon ou Supabase no plano gratuito.
4. THE Sistema SHALL utilizar variáveis de ambiente para armazenar todas as credenciais e segredos (incluindo `DATABASE_URL` e `JWT_SECRET`), nunca incluindo-os no código-fonte versionado.
5. WHEN o repositório principal receber um commit na branch `main`, THE Sistema SHALL ser implantado automaticamente na plataforma de hospedagem configurada via integração com GitHub; IF o deploy falhar, THE plataforma SHALL notificar o responsável via e-mail ou painel de controle com o log de erro.
