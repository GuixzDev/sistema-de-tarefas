/**
 * POST /api/auth/registro
 *
 * Registra um novo usuário com papel padrão 'Desenvolvedor'.
 *
 * Body: { email: string, senha: string }
 *
 * Respostas:
 *   201 - { id, email } — usuário criado com sucesso
 *   409 - { error }    — e-mail já cadastrado
 *   422 - { error, details } — dados inválidos (formato e-mail, tamanho senha)
 *   500 - { error }    — erro interno do servidor
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { parseBody, RegistroSchema } from '@/lib/validations';

export async function POST(request: Request) {
  try {
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

    const parsed = parseBody(RegistroSchema, body);
    if (parsed instanceof Response) return parsed;

    const { email, senha } = parsed;

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

    // 4. Inserir novo usuário (papel default 'Desenvolvedor' definido no banco)
    const result = await sql`
      INSERT INTO usuarios (email, senha_hash)
      VALUES (${email}, ${senha_hash})
      RETURNING id, email
    `;

    const usuario = result[0];

    // 5. Retornar HTTP 201 com id e email (nunca retornar senha_hash)
    return NextResponse.json(
      { id: usuario.id, email: usuario.email },
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
