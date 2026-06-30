/**
 * POST /api/auth/registro
 *
 * Registra um novo usuário. Rota PROTEGIDA — exclusiva para Chefe.
 * O Chefe pode definir o papel do novo usuário (Chefe ou Desenvolvedor).
 *
 * Body: { email: string, senha: string, papel?: 'Chefe' | 'Desenvolvedor' }
 *
 * Respostas:
 *   201 - { id, email, papel } — usuário criado com sucesso
 *   401 - token ausente/inválido/expirado
 *   403 - usuário autenticado não é Chefe
 *   409 - { error }    — e-mail já cadastrado
 *   422 - { error, details } — dados inválidos
 *   500 - { error }    — erro interno do servidor
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { parseBody } from '@/lib/validations';
import { requireAuth, requirePapel } from '@/lib/middleware';
import { z } from 'zod';

// Schema estendido: Chefe pode definir o papel do novo usuário
const RegistroAdminSchema = z.object({
  email: z
    .string({ required_error: 'O campo email é obrigatório' })
    .min(1, 'O campo email não pode ser vazio')
    .email('Formato de e-mail inválido'),
  senha: z
    .string({ required_error: 'O campo senha é obrigatório' })
    .min(8, 'A senha deve ter no mínimo 8 caracteres')
    .max(128, 'A senha deve ter no máximo 128 caracteres'),
  papel: z.enum(['Chefe', 'Desenvolvedor']).default('Desenvolvedor'),
});

export async function POST(request: Request) {
  try {
    // 0. Autenticação e autorização — apenas Chefe pode criar usuários
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const accessResult = requirePapel(authResult, ['Chefe']);
    if (accessResult) return accessResult;

    // 1. Parse e validação do body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Dados inválidos', details: [{ campo: 'body', mensagem: 'JSON inválido ou ausente' }] },
        { status: 422 }
      );
    }

    const parsed = parseBody(RegistroAdminSchema, body);
    if (parsed instanceof Response) return parsed;

    const { email, senha, papel } = parsed;

    // 2. Verificar se o e-mail já está cadastrado
    const existing = await sql`
      SELECT id FROM usuarios WHERE email = ${email}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'E-mail já cadastrado' },
        { status: 409 }
      );
    }

    // 3. Gerar hash bcrypt da senha (custo 10)
    const senha_hash = await bcrypt.hash(senha, 10);

    // 4. Inserir novo usuário com o papel especificado
    const result = await sql`
      INSERT INTO usuarios (email, senha_hash, papel)
      VALUES (${email}, ${senha_hash}, ${papel}::papel_enum)
      RETURNING id, email, papel
    `;

    const usuario = result[0];

    // 5. Retornar HTTP 201 (nunca retornar senha_hash)
    return NextResponse.json(
      { id: usuario.id, email: usuario.email, papel: usuario.papel },
      { status: 201 }
    );

  } catch (err) {
    console.error('[POST /api/auth/registro]', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
