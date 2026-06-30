/**
 * POST /api/tarefas/[id]/concluir
 *
 * Desenvolvedor marca uma tarefa 'Em Andamento' como 'Concluída'.
 * Apenas o responsável pela tarefa pode concluí-la.
 *
 * Respostas:
 *   200 - Tarefa atualizada com status 'Concluída'
 *   401 - token ausente/inválido/expirado
 *   403 - papel sem permissão OU usuário não é o responsável pela tarefa
 *   404 - tarefa não encontrada
 *   409 - tarefa não está 'Em Andamento'
 *   500 - erro interno
 */
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth, requirePapel } from '@/lib/middleware';

type RouteParams = { params: { id: string } };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const accessResult = requirePapel(authResult, ['Desenvolvedor']);
    if (accessResult) return accessResult;

    const userId = authResult.id;

    // Buscar a tarefa
    const tarefas = await sql`
      SELECT id, status, responsavel_id FROM tarefas WHERE id = ${params.id}
    `;

    if (tarefas.length === 0) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const tarefa = tarefas[0];

    // Verificar se o usuário autenticado é o responsável pela tarefa
    if (tarefa.responsavel_id !== userId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se a tarefa está Em Andamento
    if (tarefa.status !== 'Em Andamento') {
      return NextResponse.json(
        { error: 'Apenas tarefas em andamento podem ser concluídas' },
        { status: 409 }
      );
    }

    // Atualizar status para Concluída
    const result = await sql`
      UPDATE tarefas
      SET status = 'Concluída'
      WHERE id = ${params.id}
      RETURNING id, titulo, descricao, prioridade, status, responsavel_id, criado_em, atualizado_em
    `;

    return NextResponse.json(result[0], { status: 200 });

  } catch (err) {
    console.error('[POST /api/tarefas/:id/concluir]', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
