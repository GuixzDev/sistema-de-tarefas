/**
 * PATCH /api/usuarios/[id]/papel
 *
 * Chefe altera o papel de outro usuário.
 * Um Chefe não pode alterar o próprio papel.
 *
 * Body: { papel: 'Chefe' | 'Desenvolvedor' }
 *
 * Respostas:
 *   200 - { id, email, papel } — papel atualizado com sucesso
 *   401 - token ausente/inválido/expirado
 *   403 - papel sem permissão OU tentativa de alterar o próprio papel
 *   404 - usuário alvo não encontrado
 *   422 - dados inválidos (papel fora do enum)
 *   500 - erro interno
 */
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth, requirePapel } from '@/lib/middleware';
import { parseBody, AlterarPapelSchema } from '@/lib/validations';

type RouteParams = { params: { id: string } };

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const accessResult = requirePapel(authResult, ['Chefe']);
    if (accessResult) return accessResult;

    // Impedir que um Chefe altere o próprio papel (Req 8.4)
    if (params.id === authResult.id) {
      return NextResponse.json(
        { error: 'Um usuário não pode alterar o próprio papel' },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: [{ campo: 'body', mensagem: 'JSON inválido ou ausente' }],
        },
        { status: 422 }
      );
    }

    const parsed = parseBody(AlterarPapelSchema, body);
    if (parsed instanceof Response) return parsed;

    const { papel } = parsed;

    // Atualizar o papel; RETURNING confirma que o usuário existe (Req 8.1, 8.2)
    const result = await sql`
      UPDATE usuarios
      SET papel = ${papel}::papel_enum
      WHERE id = ${params.id}
      RETURNING id, email, papel
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    return NextResponse.json(result[0], { status: 200 });
  } catch (err) {
    console.error('[PATCH /api/usuarios/:id/papel]', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
