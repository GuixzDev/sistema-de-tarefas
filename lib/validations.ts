/**
 * lib/validations.ts
 * Schemas de validação Zod para as API Routes do sistema Task Management RBAC.
 *
 * Convenções:
 * - Todos os erros de validação retornam HTTP 422 com { error, details }
 * - O helper parseBody abstrai o parse + formatação de erro para uso nas rotas
 */
import { z } from 'zod';
import { NextResponse } from 'next/server';

// ---------------------
// Schemas de Autenticação
// ---------------------

/**
 * Schema para POST /api/auth/registro
 * Req 1: e-mail válido, senha entre 8 e 128 caracteres
 */
export const RegistroSchema = z.object({
  email: z
    .string({ required_error: 'O campo email é obrigatório' })
    .min(1, 'O campo email não pode ser vazio')
    .email('Formato de e-mail inválido'),
  senha: z
    .string({ required_error: 'O campo senha é obrigatório' })
    .min(8, 'A senha deve ter no mínimo 8 caracteres')
    .max(128, 'A senha deve ter no máximo 128 caracteres'),
});

/**
 * Schema para POST /api/auth/login
 * Req 2: e-mail válido, senha não vazia (validação mínima — bcrypt faz o resto)
 */
export const LoginSchema = z.object({
  email: z
    .string({ required_error: 'O campo email é obrigatório' })
    .min(1, 'O campo email não pode ser vazio')
    .email('Formato de e-mail inválido'),
  senha: z
    .string({ required_error: 'O campo senha é obrigatório' })
    .min(1, 'O campo senha não pode ser vazio'),
});

// ---------------------
// Schemas de Tarefas
// ---------------------

/** Valores aceitos para prioridade (Req 4.8) */
const PrioridadeEnum = z.enum(['Baixa', 'Média', 'Alta'], {
  errorMap: () => ({
    message: "Prioridade inválida. Valores aceitos: 'Baixa', 'Média', 'Alta'",
  }),
});

/**
 * Schema para POST /api/tarefas (criar tarefa — Chefe)
 * Req 4.1, 4.2, 4.8: título 1–100 chars, descrição opcional, prioridade enum
 */
export const CriarTarefaSchema = z.object({
  titulo: z
    .string({ required_error: 'O campo titulo é obrigatório' })
    .min(1, 'O título deve ter no mínimo 1 caractere')
    .max(100, 'O título deve ter no máximo 100 caracteres'),
  descricao: z.string().optional(),
  prioridade: PrioridadeEnum,
});

/**
 * Schema para PATCH /api/tarefas/[id] (atualizar tarefa — Chefe)
 * Req 4.3, 4.4: todos os campos opcionais, mas pelo menos um deve ser fornecido
 */
export const AtualizarTarefaSchema = z
  .object({
    titulo: z
      .string()
      .min(1, 'O título deve ter no mínimo 1 caractere')
      .max(100, 'O título deve ter no máximo 100 caracteres')
      .optional(),
    descricao: z.string().optional(),
    prioridade: PrioridadeEnum.optional(),
  })
  .refine(
    (data) =>
      data.titulo !== undefined ||
      data.descricao !== undefined ||
      data.prioridade !== undefined,
    { message: 'Pelo menos um campo deve ser fornecido para atualização' }
  );

// ---------------------
// Schema de Usuários
// ---------------------

/**
 * Schema para PATCH /api/usuarios/[id]/papel (alterar papel — Chefe)
 * Req 8.3: papel deve ser 'Chefe' ou 'Desenvolvedor'
 */
export const AlterarPapelSchema = z.object({
  papel: z.enum(['Chefe', 'Desenvolvedor'], {
    errorMap: () => ({
      message: "Papel inválido. Valores aceitos: 'Chefe', 'Desenvolvedor'",
    }),
  }),
});

// ---------------------
// Tipos inferidos
// ---------------------

export type RegistroInput = z.infer<typeof RegistroSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CriarTarefaInput = z.infer<typeof CriarTarefaSchema>;
export type AtualizarTarefaInput = z.infer<typeof AtualizarTarefaSchema>;
export type AlterarPapelInput = z.infer<typeof AlterarPapelSchema>;

// ---------------------
// Helper: parseBody
// ---------------------

/**
 * Faz o parse do body da requisição contra um schema Zod.
 *
 * @param schema - Schema Zod a ser aplicado
 * @param body   - Corpo da requisição já parseado como objeto
 * @returns Dados validados tipados ou Response HTTP 422 com detalhes dos erros
 *
 * @example
 * const parsed = parseBody(RegistroSchema, await request.json());
 * if (parsed instanceof Response) return parsed;
 * // parsed é RegistroInput com tipo seguro
 */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): z.infer<T> | Response {
  const result = schema.safeParse(body);

  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      campo: e.path.join('.') || 'body',
      mensagem: e.message,
    }));

    return NextResponse.json(
      { error: 'Dados inválidos', details },
      { status: 422 }
    );
  }

  return result.data;
}
