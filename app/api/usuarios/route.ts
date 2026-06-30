/**
 * GET /api/usuarios
 * Lista todos os usuários do sistema (apenas Chefe).
 *
 * Respostas:
 *   200 - { id, email, papel, criado_em }[]
 *   401 - token ausente/inválido/expirado
 *   403 - não é Chefe
 *   500 - erro interno
 */
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth, requirePapel } from '@/lib/middleware';

export async function GET(request: Request) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const accessResult = requirePapel(authResult, ['Chefe']);
    if (accessResult) return accessResult;

    const usuarios = await sql`
      SELECT id, email, papel, criado_em
      FROM usuarios
      ORDER BY criado_em ASC
    `;

    return NextResponse.json(usuarios, { status: 200 });
  } catch (err) {
    console.error('[GET /api/usuarios]', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
