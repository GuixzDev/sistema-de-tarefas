/**
 * POST /api/auth/login
 *
 * Autentica um usuário e retorna um Token JWT com validade de 8 horas.
 *
 * Body: { email: string, senha: string }
 *
 * Respostas:
 *   200 - { token } — autenticação bem-sucedida
 *   401 - { error: 'Credenciais inválidas' } — e-mail não encontrado ou senha incorreta
 *   422 - { error, details } — dados inválidos (formato e-mail, senha vazia)
 *   500 - { error } — erro interno do servidor
 *
 * Segurança: e-mail inexistente e senha incorreta retornam a MESMA mensagem genérica
 * para prevenir enumeração de usuários.
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { signToken } from '@/lib/auth';
import { parseBody, LoginSchema } from '@/lib/validations';

/** Mensagem genérica compartilhada para e-mail não encontrado E senha incorreta */
const CREDENCIAIS_INVALIDAS = 'Credenciais inválidas';

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

    const parsed = parseBody(LoginSchema, body);
    if (parsed instanceof Response) return parsed;

    const { email, senha } = parsed;

    // 2. Buscar usuário pelo e-mail
    const result = await sql`
      SELECT id, senha_hash, papel
      FROM usuarios
      WHERE email = ${email}
    `;

    // 3. Se o e-mail não existir — retorna mensagem GENÉRICA (não revela qual campo está errado)
    if (result.length === 0) {
      return NextResponse.json(
        { error: CREDENCIAIS_INVALIDAS },
        { status: 401 }
      );
    }

    const usuario = result[0];

    // 4. Comparar senha com hash bcrypt
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

    // 5. Se a senha for incorreta — mesma mensagem GENÉRICA
    if (!senhaCorreta) {
      return NextResponse.json(
        { error: CREDENCIAIS_INVALIDAS },
        { status: 401 }
      );
    }

    // 6. Gerar Token JWT com { id, papel } e expiração de 8 horas
    const token = signToken({
      id: usuario.id,
      papel: usuario.papel,
    });

    // 7. Retornar HTTP 200 com o token
    return NextResponse.json({ token }, { status: 200 });

  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
