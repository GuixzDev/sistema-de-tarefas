/**
 * POST /api/tarefas/[id]/assumir
 *
 * Desenvolvedor assume uma tarefa com status 'Disponível'.
 * Usa transação com SELECT ... FOR UPDATE para evitar race conditions.
 *
 * Respostas:
 *   200 - Tarefa atualizada com status 'Em Andamento' e responsavel_id preenchido
 *   401 - token ausente/inválido/expirado
 *   403 - papel sem permissão (não é Desenvolvedor)
 *   404 - tarefa não encontrada
 *   409 - tarefa não disponível OU usuário já possui tarefa em andamento
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

    // Usar transação com SELECT FOR UPDATE para serializar acesso concorrente
    const result = await sql.begin(async (tx) => {
      // 1. Bloquear a linha da tarefa para evitar dupla atribuição
      const tarefas = await tx`
        SELECT id, status FROM tarefas WHERE id = ${params.id} FOR UPDATE
      `;

      if (tarefas.length === 0) {
        throw { code: 'NOT_FOUND', message: 'Tarefa não encontrada' };
      }

      const tarefa = tarefas[0];

      // 2. Verificar se a tarefa está disponível
      if (tarefa.status !== 'Disponível') {
        throw { code: 'CONFLICT', message: 'Tarefa não está disponível para ser assumida' };
      }

      // 3. Verificar se o usuário já tem uma tarefa Em Andamento
      const emAndamento = await tx`
        SELECT id FROM tarefas
        WHERE responsavel_id = ${userId} AND status = 'Em Andamento'
        LIMIT 1
      `;

      if (emAndamento.length > 0) {
        throw { code: 'CONFLICT', message: 'Usuário já possui uma tarefa em andamento' };
      }

      // 4. Assumir a tarefa
      const updated = await tx`
        UPDATE tarefas
        SET status = 'Em Andamento', responsavel_id = ${userId}
        WHERE id = ${params.id}
        RETURNING id, titulo, descricao, prioridade, status, responsavel_id, criado_em, atualizado_em
      `;

      return updated[0];
    });

    return NextResponse.json(result, { status: 200 });

  } catch (err: unknown) {
    // Erros de negócio lançados dentro da transação
    if (err && typeof err === 'object' && 'code' in err) {
      const e = err as { code: string; message: string };
      if (e.code === 'NOT_FOUND') {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      if (e.code === 'CONFLICT') {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
    }

    console.error('[POST /api/tarefas/:id/assumir]', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
