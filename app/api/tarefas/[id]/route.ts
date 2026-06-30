/**
 * PATCH  /api/tarefas/[id]  — Atualiza parcialmente uma tarefa (apenas Chefe)
 * DELETE /api/tarefas/[id]  — Exclui uma tarefa Disponível (apenas Chefe)
 */
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth, requirePapel } from '@/lib/middleware';
import { parseBody, AtualizarTarefaSchema } from '@/lib/validations';

type RouteParams = { params: { id: string } };

// ─────────────────────────────────────────────
// PATCH /api/tarefas/[id]
// ─────────────────────────────────────────────
/**
 * Atualiza apenas os campos fornecidos (atualização parcial).
 * O campo atualizado_em é atualizado automaticamente pelo trigger do banco.
 *
 * Body (pelo menos um campo): { titulo?, descricao?, prioridade? }
 *
 * Respostas:
 *   200 - Tarefa atualizada completa
 *   401 - token ausente/inválido/expirado
 *   403 - papel sem permissão
 *   404 - tarefa não encontrada
 *   422 - dados inválidos
 *   500 - erro interno
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const accessResult = requirePapel(authResult, ['Chefe']);
    if (accessResult) return accessResult;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Dados inválidos', details: [{ campo: 'body', mensagem: 'JSON inválido ou ausente' }] },
        { status: 422 }
      );
    }

    const parsed = parseBody(AtualizarTarefaSchema, body);
    if (parsed instanceof Response) return parsed;

    // Verificar se a tarefa existe
    const existing = await sql`
      SELECT id FROM tarefas WHERE id = ${params.id}
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // Construir SET dinâmico com apenas os campos fornecidos
    const { titulo, descricao, prioridade } = parsed;
    const result = await sql`
      UPDATE tarefas
      SET
        titulo       = COALESCE(${titulo ?? null}, titulo),
        descricao    = CASE WHEN ${descricao !== undefined} THEN ${descricao ?? null} ELSE descricao END,
        prioridade   = COALESCE(${prioridade ?? null}::prioridade_enum, prioridade)
      WHERE id = ${params.id}
      RETURNING id, titulo, descricao, prioridade, status, responsavel_id, criado_em, atualizado_em
    `;

    return NextResponse.json(result[0], { status: 200 });
  } catch (err) {
    console.error('[PATCH /api/tarefas/:id]', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// DELETE /api/tarefas/[id]
// ─────────────────────────────────────────────
/**
 * Exclui uma tarefa. Apenas tarefas com status 'Disponível' podem ser excluídas.
 *
 * Respostas:
 *   200 - { message: 'Tarefa excluída com sucesso' }
 *   401 - token ausente/inválido/expirado
 *   403 - papel sem permissão
 *   404 - tarefa não encontrada
 *   409 - tarefa Em Andamento ou Concluída (não pode ser excluída)
 *   500 - erro interno
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const accessResult = requirePapel(authResult, ['Chefe']);
    if (accessResult) return accessResult;

    // Buscar tarefa para verificar existência e status
    const existing = await sql`
      SELECT id, status FROM tarefas WHERE id = ${params.id}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const tarefa = existing[0];

    if (tarefa.status !== 'Disponível') {
      return NextResponse.json(
        { error: 'Apenas tarefas disponíveis podem ser excluídas' },
        { status: 409 }
      );
    }

    await sql`DELETE FROM tarefas WHERE id = ${params.id}`;

    return NextResponse.json({ message: 'Tarefa excluída com sucesso' }, { status: 200 });
  } catch (err) {
    console.error('[DELETE /api/tarefas/:id]', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
