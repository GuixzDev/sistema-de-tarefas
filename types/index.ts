// ============================================================
// Tipos compartilhados — Task Management RBAC
// ============================================================

// ---------------------
// Tipos literais
// ---------------------

/** Papel do usuário no sistema */
export type Papel = 'Chefe' | 'Desenvolvedor';

/** Nível de prioridade de uma tarefa */
export type Prioridade = 'Baixa' | 'Média' | 'Alta';

/** Estado atual de uma tarefa */
export type StatusTarefa = 'Disponível' | 'Em Andamento' | 'Concluída';

// ---------------------
// Payload do JWT
// ---------------------

/** Payload contido no Token JWT assinado pelo sistema */
export interface JWTPayload {
  /** ID UUID do usuário autenticado */
  id: string;
  /** Papel do usuário no sistema */
  papel: Papel;
  /** Issued at (timestamp Unix) — adicionado automaticamente pelo jsonwebtoken */
  iat?: number;
  /** Expiration time (timestamp Unix) — 8 horas após emissão */
  exp?: number;
}

// ---------------------
// Entidades do banco de dados
// ---------------------

/** Usuário do sistema — corresponde à tabela `usuarios` */
export interface Usuario {
  /** UUID gerado automaticamente */
  id: string;
  /** E-mail único do usuário */
  email: string;
  /** Hash bcrypt da senha (custo 10) — nunca exposto em respostas da API */
  senha_hash: string;
  /** Papel do usuário: Chefe (admin) ou Desenvolvedor (executor) */
  papel: Papel;
  /** Timestamp de criação do registro */
  criado_em: Date;
}

/** Tarefa do sistema — corresponde à tabela `tarefas` */
export interface Tarefa {
  /** UUID gerado automaticamente */
  id: string;
  /** Título da tarefa (1–100 caracteres) */
  titulo: string;
  /** Descrição opcional da tarefa */
  descricao: string | null;
  /** Nível de prioridade */
  prioridade: Prioridade;
  /** Status atual da tarefa */
  status: StatusTarefa;
  /** ID do Desenvolvedor responsável — null quando status é 'Disponível' */
  responsavel_id: string | null;
  /** Email do responsável (via JOIN) — null quando não atribuída */
  responsavel_email?: string | null;
  /** Timestamp de quando a tarefa foi assumida */
  assumida_em?: string | null;
  /** Timestamp de criação */
  criado_em: Date;
  /** Timestamp da última atualização — mantido pelo trigger do banco */
  atualizado_em: Date;
}

// ---------------------
// Tipos de resposta da API
// ---------------------

/** Resposta de erro padrão de todas as rotas */
export interface ErrorResponse {
  error: string;
  details?: unknown[];
}

/** Dados públicos do usuário — sem senha_hash */
export type UsuarioPublico = Omit<Usuario, 'senha_hash'>;
